// Routes xác thực: đăng ký / đăng nhập / thông tin user hiện tại
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, signToken } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// Rate-limit chống brute-force cho /api/auth/login:
// tối đa 10 lần đăng nhập / phút / IP → 429 (in-memory)
// ============================================================
const loginAttempts = new Map(); // ip -> { count, resetAt }
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60 * 1000;

function loginRateLimit(req, res, next) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();

  // Dọn dẹp entry hết hạn (tránh phình Map) khi đã đông
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts) {
      if (v.resetAt <= now) loginAttempts.delete(k);
    }
  }

  let entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }
  if (entry.count > LOGIN_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 1 phút',
    });
  }
  next();
}

// Ghi nhận 1 lần đăng nhập thất bại (chỉ đếm sai, không đếm lần đúng)
function recordLoginFailure(req) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }
  entry.count += 1;
}

// Rate-limit đăng ký: tối đa 10 tài khoản/giờ/IP (chống spam)
const registerAttempts = new Map();
const REGISTER_LIMIT = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
function registerRateLimit(req, res, next) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();
  let entry = registerAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + REGISTER_WINDOW_MS };
    registerAttempts.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > REGISTER_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Bạn đã tạo quá nhiều tài khoản, vui lòng thử lại sau' });
  }
  next();
}

// POST /api/auth/register
router.post('/register', registerRateLimit, (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email, mật khẩu' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
    return res.status(400).json({ error: 'Email không đúng định dạng' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return res.status(400).json({ error: 'Email đã được đăng ký' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    "INSERT INTO users (name, email, password_hash, known_tier) VALUES (?, ?, ?, 'potential')"
  ).run(name.trim(), email.trim().toLowerCase(), hash);
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/auth/login
router.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFailure(req);
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }

  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
  res.json({ user: safe, token: signToken(safe) });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user });
});

module.exports = router;
