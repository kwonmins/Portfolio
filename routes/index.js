const express = require('express');
const router = express.Router();
// Compatibility for old cached pages: logging now happens in server middleware.
router.get('/track', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));
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

router.get("/paper", function (req, res) {
  res.render("paper", { title: "Express" });
});
/* ✅ 반드시 `router`만 내보내야 함! */
module.exports = router;
