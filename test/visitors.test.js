const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { shouldLog, clientIP, safeReferer } = require('../server');
const { parameters } = require('../routes/who');
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
test('HTTP routes persist once, require admin for every stats endpoint, and fail safely', async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const records = [];
  let fail = false;
  const stats = { date: '2026-09-15', page: 1, page_size: 50, selected_views: 3,
    selected_visitors: 1, total_views: 12, total_visitors: 2, daily: [], ips: [],
    recent: [{ created_at: '2026-09-15T00:00:00Z', ip: '192.0.2.1',
      path: '/', user_agent: '<script>alert(1)</script>', referer: '' }] };
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_server_only';
  process.env.WHO_ADMIN_PASSWORD = 'test-password-at-least-16';
  process.env.WHO_ADMIN_USERNAME = 'admin';
  delete process.env.VERCEL;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith(process.env.SUPABASE_URL)) return originalFetch(url, options);
    assert.equal(options.headers.apikey, 'sb_secret_test_server_only');
    assert.equal(options.headers.Authorization, undefined);
    if (fail) return new Response('private database error', { status: 500 });
    if (String(url).endsWith('/portfolio_visits')) {
      records.push(JSON.parse(options.body));
      return new Response(null, { status: 201 });
    }
    return Response.json(stats);
  };
  const app = require('../app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = { authorization: 'Basic ' + Buffer.from('admin:' + process.env.WHO_ADMIN_PASSWORD).toString('base64') };
  try {
    const page = await originalFetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.doesNotMatch(await page.text(), /fetch\("\/track"\)/);
    await originalFetch(base + '/track');
    await originalFetch(base + '/who.css');
    await originalFetch(base + '/missing');
    await originalFetch(base + '/', { method: 'HEAD' });
    assert.equal(records.length, 1);
    await originalFetch(base + '/');
    assert.equal(records.length, 2);
    for (const endpoint of ['/who', '/who/data', '/who/count']) {
      assert.equal((await originalFetch(base + endpoint)).status, 401);
      assert.equal((await originalFetch(base + endpoint, { headers: { authorization: 'Basic bad' } })).status, 401);
    }
    const dashboard = await originalFetch(base + '/who?date=2026-09-15', { headers: auth });
    assert.equal(dashboard.status, 200);
    const html = await dashboard.text();
    assert.match(html, /동일 IP 접속 횟수/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /sb_secret_test_server_only/);
    const counts = await (await originalFetch(base + '/who/count', { headers: auth })).json();
    assert.equal(counts.daily_visitors, 1);
    assert.equal(counts.daily_views, 3);
    assert.equal(records.length, 2);
    assert.equal((await originalFetch(base + '/who?date=2026-02-30', { headers: auth })).status, 400);
    fail = true;
    assert.equal((await originalFetch(base + '/')).status, 200);
    const failure = await originalFetch(base + '/who', { headers: auth });
    assert.equal(failure.status, 503);
    assert.doesNotMatch(await failure.text(), /private database error/);
    delete process.env.WHO_ADMIN_PASSWORD;
    assert.equal((await originalFetch(base + '/who')).status, 503);
  } finally {
    global.fetch = originalFetch;
    for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'WHO_ADMIN_PASSWORD', 'WHO_ADMIN_USERNAME', 'VERCEL']) {
      if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name];
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
