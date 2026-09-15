const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('PostgreSQL: KST day boundaries, exact totals, IP pagination and role isolation', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const schema = fs.readFileSync(path.join(__dirname, '../../supabase/setup.sql'), 'utf8');
    await db.exec(schema);
    await db.exec(schema); // Safe to reapply during setup.
    await db.exec(`
      insert into public.portfolio_visits(ip, path, created_at) values
      ('192.0.2.1', '/', '2026-09-14T14:59:59Z'),
      ('192.0.2.1', '/', '2026-09-14T15:00:00Z'),
      ('192.0.2.1', '/', '2026-09-15T14:59:59Z'),
      ('192.0.2.1', '/', '2026-09-15T15:00:00Z'),
      ('192.0.2.2', '/project', '2026-09-15T00:00:00Z');
      insert into public.portfolio_visits(ip, path, created_at)
      select '192.0.2.1'::inet, '/', '2026-09-14T16:00:00Z'::timestamptz from generate_series(1, 250);
      insert into public.portfolio_visits(ip, path, created_at)
      select ('198.51.100.' || n)::inet, '/', '2026-09-16T00:00:00Z'::timestamptz from generate_series(1, 60) n;
    `);
    const dashboard = async (day, page = 1) => (await db.query(
      'select public.portfolio_visitor_dashboard($1::date, $2::integer) as stats', [day, page])).rows[0].stats;
    const stats = await dashboard('2026-09-15');
    assert.equal(stats.selected_visitors, 2);
    assert.equal(stats.selected_views, 253);
    assert.equal(stats.total_views, 315);
    assert.equal(stats.total_visitors, 62);
    assert.equal(stats.recent.length, 200);
    assert.equal(stats.ips[0].views, 252);
    assert.equal(stats.ips[0].total_views, 254);
    assert.equal(stats.daily.length, 30);
    assert.equal(stats.daily.find(d => d.day === '2026-09-14').views, 1);
    assert.equal(stats.daily.find(d => d.day === '2026-09-13').views, 0);
    const page1 = await dashboard('2026-09-16', 1);
    const page2 = await dashboard('2026-09-16', 2);
    assert.equal(page1.selected_visitors, 61);
    assert.equal(page1.ips.length, 50);
    assert.equal(page2.ips.length, 11);
    assert.equal(new Set([...page1.ips, ...page2.ips].map(i => i.ip)).size, 61);
    const empty = await dashboard('2026-01-01');
    assert.equal(empty.selected_visitors, 0);
    assert.deepEqual(empty.ips, []);
    assert.equal(empty.daily.length, 30);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(db.query('select * from public.portfolio_visits'), /permission denied/);
      await assert.rejects(dashboard('2026-09-15'), /permission denied/);
      await assert.rejects(db.exec("insert into public.portfolio_visits(ip,path) values ('192.0.2.9','/')"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await dashboard('2026-09-15')).selected_views, 253);
    await db.exec("insert into public.portfolio_visits(ip,path) values ('2001:db8::1','/')");
    await db.exec('reset role');
    await assert.rejects(dashboard('2026-09-15', 0), /Invalid date or page/);
  } finally { await db.close(); }
});
