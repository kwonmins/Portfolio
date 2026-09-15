const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { shouldLog, clientIP, safeReferer } = require('../server');
const { parameters } = require('../routes/who');
const { _getConnectionOptionsForTests } = require('../db');
const req = (path, method = 'GET', headers = {}) => ({ path, method, headers,
  get: key => headers[key], socket: { remoteAddress: '::ffff:192.0.2.1' } });

test('only page GETs count; tracking, admin, assets, errors and prefetch do not', () => {
  for (const path of ['/', '/project', '/career/', '/PAPER']) assert.equal(shouldLog(req(path)), true);
  for (const path of ['/who', '/who/data', '/track', '/who.css', '/missing', '/favicon.ico']) {
    assert.equal(shouldLog(req(path)), false);
  }
  assert.equal(shouldLog(req('/', 'HEAD')), false);
  assert.equal(shouldLog(req('/', 'POST')), false);
  assert.equal(shouldLog(req('/', 'GET', { 'sec-purpose': 'prefetch' })), false);
  assert.equal(shouldLog(req('/', 'GET', { 'user-agent': 'vercel-favicon/1.0' })), false);
  assert.equal(shouldLog(req('/', 'GET', { 'user-agent': 'HeadlessChrome/141.0' })), false);
  assert.equal(shouldLog(req('/', 'GET', { 'user-agent': 'Mozilla/5.0 Googlebot/2.1' })), false);
});
test('client IP validates Vercel forwarding and ignores spoofed headers locally', () => {
  const previous = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    assert.equal(clientIP(req('/', 'GET', { 'x-forwarded-for': '198.51.100.4' })), '192.0.2.1');
    process.env.VERCEL = '1';
    assert.equal(clientIP(req('/', 'GET', { 'x-forwarded-for': ' 198.51.100.4, 10.0.0.1' })), '198.51.100.4');
    assert.equal(clientIP(req('/', 'GET', { 'x-forwarded-for': 'garbage' })), null);
    assert.equal(clientIP(req('/', 'GET', { 'x-forwarded-for': '2001:db8::1' })), '2001:db8::1');
  } finally { if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous; }
});
test('dates reject overflow and arrays; referrers omit query secrets and credentials', () => {
  assert.deepEqual(parameters({ date: '2024-02-29', page: '2' }), { date: '2024-02-29', page: 2 });
  for (const date of ['2026-02-30', '2026-13-01', 'invalid', ['2026-09-15']]) {
    assert.throws(() => parameters({ date }));
  }
  for (const page of ['0', '-1', '1.5', '1000000', ['1']]) assert.throws(() => parameters({ page }));
  assert.equal(safeReferer('https://user:password@example.com/path?token=secret#x'), 'https://example.com/path');
  assert.equal(safeReferer('javascript:alert(1)'), '');
});
test('Supabase pool connection keeps TLS and removes conflicting libpq SSL options', () => {
  const options = _getConnectionOptionsForTests(
    'postgresql://user:password@example.com:6543/postgres?sslmode=require&sslrootcert=ignored&application_name=portfolio'
  );
  const normalized = new URL(options.connectionString);
  assert.equal(normalized.searchParams.has('sslmode'), false);
  assert.equal(normalized.searchParams.has('sslrootcert'), false);
  assert.equal(normalized.searchParams.get('application_name'), 'portfolio');
  assert.deepEqual(options.ssl, { rejectUnauthorized: false });
});
test('HTTP routes persist once, require admin for every stats endpoint, and fail safely', async () => {
  const originalEnv = { ...process.env };
  const records = [];
  let fail = false;
  const stats = { date: '2026-09-15', page: 1, page_size: 50, selected_views: 3,
    selected_visitors: 1, total_views: 12, total_visitors: 2, daily: [], ips: [],
    recent: [{ created_at: '2026-09-15T00:00:00Z', ip: '192.0.2.1',
      path: '/', user_agent: '<script>alert(1)</script>', referer: '' }] };
  process.env.POSTGRES_URL = 'postgresql://server-only-secret';
  process.env.WHO_ADMIN_PASSWORD = 'test-pass-13!';
  process.env.WHO_ADMIN_USERNAME = 'admin';
  delete process.env.VERCEL;
  const db = require('../db');
  db._setPoolForTests({ query: async (sql, values) => {
    if (fail) throw new Error('private database error');
    if (/insert into/i.test(sql)) {
      records.push({ ip: values[0], path: values[1], user_agent: values[2], referer: values[3] });
      return { rows: [] };
    }
    return { rows: [{ dashboard: stats }] };
  } });
  const app = require('../app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = { authorization: 'Basic ' + Buffer.from('admin:' + process.env.WHO_ADMIN_PASSWORD).toString('base64') };
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.doesNotMatch(await page.text(), /fetch\("\/track"\)/);
    await fetch(base + '/track');
    await fetch(base + '/who.css');
    await fetch(base + '/missing');
    await fetch(base + '/', { method: 'HEAD' });
    assert.equal(records.length, 1);
    await fetch(base + '/');
    assert.equal(records.length, 2);
    for (const endpoint of ['/who', '/who/data', '/who/count']) {
      assert.equal((await fetch(base + endpoint)).status, 401);
      assert.equal((await fetch(base + endpoint, { headers: { authorization: 'Basic bad' } })).status, 401);
    }
    const dashboard = await fetch(base + '/who?date=2026-09-15', { headers: auth });
    assert.equal(dashboard.status, 200);
    const html = await dashboard.text();
    assert.match(html, /동일 IP 접속 횟수/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /server-only-secret/);
    const counts = await (await fetch(base + '/who/count', { headers: auth })).json();
    assert.equal(counts.daily_visitors, 1);
    assert.equal(counts.daily_views, 3);
    assert.equal(records.length, 2);
    assert.equal((await fetch(base + '/who?date=2026-02-30', { headers: auth })).status, 400);
    fail = true;
    assert.equal((await fetch(base + '/')).status, 200);
    const failure = await fetch(base + '/who', { headers: auth });
    assert.equal(failure.status, 503);
    assert.doesNotMatch(await failure.text(), /private database error/);
    delete process.env.WHO_ADMIN_PASSWORD;
    assert.equal((await fetch(base + '/who')).status, 503);
  } finally {
    db._setPoolForTests(undefined);
    for (const name of ['POSTGRES_URL', 'WHO_ADMIN_PASSWORD', 'WHO_ADMIN_USERNAME', 'VERCEL']) {
      if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name];
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
