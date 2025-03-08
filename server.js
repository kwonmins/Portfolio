const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// 📌 방문자 추적 API
router.get("/track", (req, res) => {
  let visitors = req.app.locals.visitors; // ✅ server.js에서 저장된 visitors 불러오기

  if (!visitors) {
    console.error("🚨 visitors 객체가 정의되지 않음!");
    req.app.locals.visitors = {}; // ✅ visitors가 없으면 빈 객체로 초기화
    visitors = req.app.locals.visitors;
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  if (!visitors[ip]) {
    visitors[ip] = { count: 0, lastVisit: new Date().toISOString() };
  }

  visitors[ip].count += 1;
  visitors[ip].lastVisit = new Date().toISOString();

  // JSON 파일에 방문 기록 저장 (서버 재시작 후에도 유지)
  const logFile = path.join(__dirname, "../visitors.json");
  fs.writeFileSync(logFile, JSON.stringify(visitors, null, 2));

  res.json({ message: "Tracking success", ip, count: visitors[ip].count });
});

/* 방문 기록 페이지 */
router.get("/who", function (req, res) {
  let visitors = req.app.locals.visitors;

  if (!visitors) {
    console.error("🚨 visitors 객체가 정의되지 않음!");
    req.app.locals.visitors = {}; // ✅ visitors가 없으면 빈 객체로 초기화
    visitors = req.app.locals.visitors;
  }

  res.render("who", { title: "방문자 통계", visitors });
});

module.exports = router;
