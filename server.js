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
  try {
    visitors = JSON.parse(fs.readFileSync(logFile, "utf8"));
  } catch (err) {
    console.error("🚨 visitors.json 파일을 읽는 중 오류 발생:", err);
    visitors = {};
  }
}

// 📌 `visitors`가 제대로 로드되었는지 확인
console.log("✅ 초기 visitors 데이터:", visitors);

// 📌 `routes/index.js`에서 사용할 수 있도록 `app.locals.visitors`에 저장
app.locals.visitors = visitors;

// 📌 모든 요청에서 `app.locals.visitors`를 유지하도록 설정
app.use((req, res, next) => {
  req.app.locals.visitors = visitors;
  next();
});

// 📌 `routes/index.js` 로드
const indexRouter = require("./routes/index");
app.use("/", indexRouter);

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
