var express = require("express");
var router = express.Router();

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

module.exports = router;
