// Server-only Supabase REST client.
async function request(endpoint, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/' + endpoint, {
    ...options,
    headers: {
      apikey: key,
      ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }),
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('SUPABASE_HTTP_' + response.status);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
module.exports = {
  recordVisit: (visit) => request('portfolio_visits', {
    method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(visit),
  }),
  getDashboard: (date, page) => request('rpc/portfolio_visitor_dashboard', {
    method: 'POST', body: JSON.stringify({ p_date: date, p_page: page }),
  }),
};
