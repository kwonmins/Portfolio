const express = require("express");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");

const app = express();
const PORT = 3000;

// 방문 기록 저장 파일 경로
const logFile = path.join(__dirname, "visitors.json");

// 방문 기록 불러오기 (파일이 없으면 빈 객체로 초기화)
let visitors = {};
if (fs.existsSync(logFile)) {
  visitors = JSON.parse(fs.readFileSync(logFile, "utf8"));
}

// EJS 설정
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 정적 파일 제공
app.use(express.static("public"));

// 로그 기록 설정 (morgan)
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);
app.use(
  morgan(":remote-addr :method :url :status :response-time ms", {
    stream: accessLogStream,
  })
);

// 방문자 IP 기록 API
app.get("/track", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (!visitors[ip]) {
    visitors[ip] = { count: 0, lastVisit: new Date().toISOString() };
  }

  visitors[ip].count += 1;
  visitors[ip].lastVisit = new Date().toISOString();

  fs.writeFileSync(logFile, JSON.stringify(visitors, null, 2));

  res.json({ message: "Tracking success", ip, count: visitors[ip].count });
});

// 📌 라우터 불러오기 (who.ejs에 visitors 데이터 전달)
const indexRouter = require("./routes/index"); // index.router 경로 맞게 설정
app.use((req, res, next) => {
  req.visitors = visitors; // visitors 데이터를 요청 객체에 저장
  next();
});
app.use("/", indexRouter); // 기본 라우터 등록

// 📌 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
