const { isIP } = require('node:net');
const db = require('./db');
const pagePaths = new Set(['/', '/award', '/about', '/license', '/career',
  '/project', '/diary', '/index', '/paper']);
const automatedAgent = /(?:bot\b|crawler|spider|headlesschrome|vercel-favicon|lighthouse|pagespeed|uptime|monitor)/i;
function shouldLog(req) {
  const pathname = req.path.replace(/\/$/, '') || '/';
  return req.method === 'GET' && pagePaths.has(pathname.toLowerCase()) &&
    !/prefetch/i.test((req.get('purpose') || '') + ' ' + (req.get('sec-purpose') || '')) &&
    !automatedAgent.test(req.get('user-agent') || '');
}
function clientIP(req) {
  // Vercel overwrites X-Forwarded-For. Direct/local requests must not trust it.
  let ip = process.env.VERCEL === '1'
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : req.socket.remoteAddress;
  if (!ip) return null;
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}
function safeReferer(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? (url.origin + url.pathname).slice(0, 2048) : '';
  } catch { return ''; }
}
async function visitLogger(req, res, next) {
  if (!shouldLog(req)) return next();
  res.set('Cache-Control', 'private, no-store');
  const ip = clientIP(req);
  if (ip) {
    try {
      await db.recordVisit({ ip, path: req.path.slice(0, 512),
        user_agent: (req.get('user-agent') || '').slice(0, 1024),
        referer: safeReferer(req.get('referer')) });
    } catch (error) {
      console.error('[visit] save failed:', error.name === 'TimeoutError' ? 'timeout' : error.message);
    }
  }
  next();
}
module.exports = { visitLogger, shouldLog, clientIP, safeReferer };
