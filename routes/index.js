const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const logFile = path.join(__dirname, "../visitors.json");

// 📌 방문자 추적 API
router.get("/track", (req, res) => {
  let visitors = req.app.locals.visitors;

  if (!visitors) {
    console.error("🚨 visitors 객체가 정의되지 않음!");
    req.app.locals.visitors = {};
    visitors = req.app.locals.visitors;
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  if (!visitors[ip]) {
    visitors[ip] = { count: 0, lastVisit: "정보 없음" }; // ✅ 기본값 설정
  }

  const nowKST = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  visitors[ip].count += 1;
  visitors[ip].lastVisit = nowKST;

  console.log(`📌 방문 기록 저장: ${nowKST} (IP: ${ip})`);

  // ✅ 즉시 파일 저장 (덮어쓰기 방지)
  try {
    fs.writeFileSync(logFile, JSON.stringify(visitors, null, 2));
  } catch (err) {
    console.error("🚨 visitors.json 저장 중 오류 발생:", err);
  }

  res.json({
    message: "Tracking success",
    ip,
    count: visitors[ip].count,
    lastVisit: nowKST,
  });
});

/* 방문 기록 페이지 */
router.get("/who", function (req, res) {
  let visitors = req.app.locals.visitors;

  if (!visitors) {
    console.error("🚨 visitors 객체가 정의되지 않음!");
    req.app.locals.visitors = {};
    visitors = req.app.locals.visitors;
  }

  res.render("who", { title: "방문자 통계", visitors });
});
// ✅ 기존 라우트 유지
router.get("/", function (req, res) {
  res.render("card", { title: "Express" });
});

router.get("/award", function (req, res) {
  res.render("award", { title: "Express" });
});

router.get("/about", function (req, res) {
  res.render("about", { title: "Express" });
});

router.get("/license", function (req, res) {
  res.render("license", { title: "Express" });
});

router.get("/career", function (req, res) {
  res.render("career", { title: "Express" });
});

router.get("/project", function (req, res) {
  res.render("project", { title: "Express" });
});
router.get("/diary", function (req, res) {
  res.render("diary", { title: "Express" });
});

router.get("/index", function (req, res) {
  res.render("index", { title: "Express" });
});
/* ✅ 반드시 `router`만 내보내야 함! */
module.exports = router;
