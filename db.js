// db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "211.110.140.202",
  user: process.env.DB_USER || "cbnu2025",
  password: process.env.DB_PASS || "cbnu2025@",
  database: process.env.DB_NAME || "cbnu2025",
  port: Number(process.env.DB_PORT || 3306),
  charset: process.env.DB_CHARSET || "utf8mb4",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

module.exports = pool;
