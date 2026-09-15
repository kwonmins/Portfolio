// Server-only connection supplied by the Vercel Supabase integration.
const { Pool } = require('pg');

let pool;

function getConnectionOptions(connectionString) {
  const connectionUrl = new URL(connectionString);

  // node-postgres lets sslmode from a connection string overwrite an explicit
  // ssl object. Vercel supplies sslmode=require, so remove those libpq options
  // before configuring the TLS behavior used by the Supabase pooler.
  ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].forEach((name) => {
    connectionUrl.searchParams.delete(name);
  });

  return {
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
  };
}

function getPool() {
  if (!pool) {
    if (!process.env.POSTGRES_URL) throw new Error('SUPABASE_NOT_CONFIGURED');
    pool = new Pool(getConnectionOptions(process.env.POSTGRES_URL));
  }
  return pool;
}

async function recordVisit(visit) {
  await getPool().query(
    `insert into public.portfolio_visits (ip, path, user_agent, referer)
     values ($1::inet, $2, $3, $4)`,
    [visit.ip, visit.path, visit.user_agent, visit.referer]
  );
}

async function getDashboard(date, page) {
  const result = await getPool().query(
    'select public.portfolio_visitor_dashboard($1::date, $2::integer) as dashboard',
    [date, page]
  );
  return result.rows[0].dashboard;
}

module.exports = {
  recordVisit,
  getDashboard,
  _setPoolForTests: (testPool) => { pool = testPool; },
  _getConnectionOptionsForTests: getConnectionOptions,
};
