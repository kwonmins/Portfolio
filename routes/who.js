const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const router = express.Router();
function equal(a, b) {
  const digest = (value) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  const password = process.env.WHO_ADMIN_PASSWORD;
  if (!password || password.length < 16) {
    return res.status(503).send('방문 통계 관리자 인증 설정이 필요합니다.');
  }
  const header = req.get('authorization') || '';
  const credentials = /^Basic /i.test(header) ? Buffer.from(header.slice(6), 'base64').toString('utf8') : '';
  const separator = credentials.indexOf(':');
  const username = separator < 0 ? '' : credentials.slice(0, separator);
  const supplied = separator < 0 ? '' : credentials.slice(separator + 1);
  const validUser = equal(username, process.env.WHO_ADMIN_USERNAME || 'admin');
  const validPassword = equal(supplied, password);
  if (!validUser || !validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="Portfolio statistics", charset="UTF-8"');
    return res.status(401).send('관리자 로그인이 필요합니다.');
  }
  next();
});
function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function parameters(query) {
  const date = query.date === undefined ? todayKST() : query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date ||
      date < '2000-01-01' || date > '2100-12-31') throw new Error('INVALID_DATE');
  const rawPage = query.page === undefined ? '1' : query.page;
  if (typeof rawPage !== 'string' || !/^[1-9]\d{0,5}$/.test(rawPage)) throw new Error('INVALID_PAGE');
  return { date, page: Number(rawPage) };
}
async function dashboard(req, res) {
  let params;
  try { params = parameters(req.query); }
  catch { return res.status(400).send('올바른 날짜와 페이지 번호를 입력해 주세요.'); }
  try {
    const stats = await db.getDashboard(params.date, params.page);
    if (req.path === '/data') return res.json({ ok: true, ...stats });
    if (req.path === '/count') return res.json({ ok: true, count: stats.total_views,
      date: stats.date, daily_views: stats.selected_views, daily_visitors: stats.selected_visitors });
    return res.render('who', { layout: false, stats, today: todayKST(),
      number: (n) => Number(n || 0).toLocaleString('ko-KR'),
      time: (value) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) });
  } catch (error) {
    console.error('[who] query failed:', error.message);
    return res.status(503).send('방문 통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
}
router.get('/', dashboard);
router.get('/data', dashboard);
router.get('/count', dashboard);
module.exports = router;
module.exports.parameters = parameters;
