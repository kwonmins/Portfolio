const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 방문 기록 저장 파일 경로
const logFile = path.join(__dirname, "visitors.json");

// 방문 기록 불러오기 (파일이 없으면 빈 객체로 초기화)
let visitors = {};
if (fs.existsSync(logFile)) {
  visitors = JSON.parse(fs.readFileSync(logFile, "utf8"));
}

// 📌 방문자 IP 기록 엔드포인트
app.get("/track", (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  if (!visitors[ip]) {
    visitors[ip] = { count: 0, lastVisit: new Date().toISOString() };
  }

  visitors[ip].count += 1;
  visitors[ip].lastVisit = new Date().toISOString();

  // 방문 기록 JSON 파일에 저장
  fs.writeFileSync(logFile, JSON.stringify(visitors, null, 2));

  res.json({ message: "Tracking success", ip, count: visitors[ip].count });
});

// 📌 방문 기록 조회 API
app.get("/stats", (req, res) => {
  res.json(visitors);
});

// 📌 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
