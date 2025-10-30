var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var expressLayouts = require("express-ejs-layouts");
var app = express();
const { visitLogger } = require("./server"); // ✅ (1) 추가
const whoRouter = require("./routes/who");
// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// 📌 미들웨어 설정
app.use(logger("dev")); // HTTP 요청 로그 기록
app.use(express.json()); // JSON 요청 처리
app.use(express.urlencoded({ extended: false })); // URL-encoded 데이터 처리
app.use(cookieParser()); // 쿠키 파싱
app.use(express.static(path.join(__dirname, "public"))); // 정적 파일 제공
app.use(visitLogger);
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.set("layout", "layout");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);
app.set("layout extractMetas", true);
app.use(expressLayouts);
app.use("/who", whoRouter); // ✅ 먼저
app.use("/", indexRouter);
app.use("/users", usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
module.exports = app;
