// Thông báo riêng của từng tài khoản (hiện ở chuông 🔔 phía khách hàng).
// Hiện tại sinh ra khi đơn hàng đổi trạng thái; khách bấm mở chuông là đánh dấu đã đọc.
const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — 30 thông báo mới nhất của chính mình + số chưa đọc.
// ?all=1 -> tối đa 200 (cho trang "Tất cả thông báo").
router.get('/', auth, async (req, res) => {
  try {
    const limit = req.query.all ? 200 : 30;
    const notifications = await db.prepare(
      'SELECT id, type, title, content, link, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    ).all(req.user.id, limit);
    const unread = (await db.prepare(
      'SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id)).c;
    res.json({ notifications, unread });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/notifications/read — đánh dấu đã đọc tất cả
router.post('/read', auth, async (req, res) => {
  try {
    await db.prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
