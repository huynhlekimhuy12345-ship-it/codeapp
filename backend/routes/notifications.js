// Thông báo riêng của từng tài khoản (hiện ở chuông 🔔 phía khách hàng).
// Hiện tại sinh ra khi đơn hàng đổi trạng thái; khách bấm mở chuông là đánh dấu đã đọc.
const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — 30 thông báo mới nhất của chính mình + số chưa đọc
router.get('/', auth, (req, res) => {
  const notifications = db.prepare(
    'SELECT id, type, title, content, link, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30'
  ).all(req.user.id);
  const unread = db.prepare(
    'SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id).c;
  res.json({ notifications, unread });
});

// POST /api/notifications/read — đánh dấu đã đọc tất cả
router.post('/read', auth, (req, res) => {
  db.prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
