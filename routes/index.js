var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");

// 방문 기록 파일 경로
const logFile = path.join(__dirname, "../visitors.json");

// 방문 기록 불러오기
let visitors = {};
if (fs.existsSync(logFile)) {
  visitors = JSON.parse(fs.readFileSync(logFile, "utf8"));
}

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("card", { title: "Express" });
});

/* GET home page. */
router.get("/award", function (req, res, next) {
  res.render("award", { title: "Express" });
});

router.get("/about", function (req, res, next) {
  res.render("about", { title: "Express" });
});
router.get("/license", function (req, res, next) {
  res.render("license", { title: "Express" });
});
router.get("/career", function (req, res, next) {
  res.render("career", { title: "Express" });
});
router.get("/project", function (req, res, next) {
  res.render("project", { title: "Express" });
});

/* 방문 기록 페이지 */
router.get("/who", function (req, res, next) {
  res.render("who", { title: "방문자 통계", visitors: visitors || {} });
});

module.exports = router;
