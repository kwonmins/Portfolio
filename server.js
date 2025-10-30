// server.js  —  "전역 방문 로거"만 export
const pool = require("./db");

// 정적/헬스체크 등 제외 규칙
const shouldLog = (req) => {
  const p = req.path || req.originalUrl || "";
  return !(
    p.startsWith("/public") ||
    p.startsWith("/assets") ||
    p.startsWith("/css") ||
    p.startsWith("/js") ||
    p.startsWith("/img") ||
    p.startsWith("/favicon") ||
    p.startsWith("/_next") ||
    p.startsWith("/api/health") ||
    p.startsWith("/debug")
  );
};

// 전역 방문 로깅 미들웨어
async function visitLogger(req, res, next) {
  try {
    if (req.method === "GET" && shouldLog(req)) {
      const xff = req.headers["x-forwarded-for"];
      const ip =
        (xff ? xff.split(",")[0] : "") ||
        req.socket?.remoteAddress ||
        req.ip ||
        "";
      const ua = req.get("user-agent") || "";
      const referer = req.get("referer") || "";
      const urlPath = req.originalUrl || req.url || "";

      await pool.execute(
        "INSERT INTO ip_visitor (ip, user_agent, path, referer) VALUES (?,?,?,?)",
        [ip, ua, urlPath, referer]
      );
      // 확인용 로그 (원하면 주석 처리)
      console.log("[visit] saved:", ip, urlPath);
    }
  } catch (e) {
    console.error("[visit] insert fail:", e?.message);
  }
  next();
}

module.exports = { visitLogger };
