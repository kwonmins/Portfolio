// routes/who.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ 진단: 이 라우트가 실제로 타는지 로그
router.use((req, res, next) => {
  console.log("[WHO ROUTER] hit:", req.method, req.originalUrl);
  next();
});

// ✅ JSON으로 바로 보기 (브라우저에서 /who/data 로 확인)
router.get("/data", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, ip, user_agent, path, referer, created_at
       FROM ip_visitor
       ORDER BY id DESC
       LIMIT 200`
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    next(err);
  }
});

// ✅ 카운트만 보기 (/who/count)
router.get("/count", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM ip_visitor`);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, count: rows[0].c });
  } catch (err) {
    next(err);
  }
});

// ✅ 최종: 뷰 렌더 (여기가 /who 페이지)
router.get("/", async (req, res, next) => {
  try {
    // 캐시 방지(304 회피)
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");

    const [rows] = await pool.query(
      `SELECT id, ip, user_agent, path, referer, created_at
       FROM ip_visitor
       ORDER BY id DESC
       LIMIT 200`
    );

    console.log("[WHO ROUTER] rows:", rows.length); // ✅ 콘솔 확인
    res.status(200).render("who", { visitors: rows }); // ✅ visitors 로 전달
  } catch (err) {
    next(err);
  }
});

module.exports = router;
