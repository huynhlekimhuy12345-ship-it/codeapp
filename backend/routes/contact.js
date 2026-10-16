// Tin nhắn liên hệ — port từ web artifact Leather House (server/src/actions.ts)
// Khách gửi công khai; chỉ admin xem / đánh dấu đã đọc / xóa
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Chống spam form liên hệ: tối đa 10 tin/phút/IP
const contactAttempts = new Map();
function contactRateLimit(req, res, next) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();
  let entry = contactAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + 60 * 1000 };
    contactAttempts.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > 10) return res.status(429).json({ error: 'Bạn gửi quá nhiều tin nhắn, vui lòng thử lại sau' });
  next();
}

// POST /api/contact — công khai: khách gửi tin nhắn từ trang Liên hệ
router.post('/', contactRateLimit, (req, res) => {
  const { name, phone, email, content } = req.body || {};
  if (!name || !String(name).trim() || !content || !String(content).trim())
    return res.status(400).json({ error: 'Vui lòng điền Họ tên và Nội dung tin nhắn' });
  const now = new Date().toISOString();
  const info = db.prepare(
    'INSERT INTO contact_messages (name, phone, email, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), String(phone || '').trim(), String(email || '').trim(), content.trim(), now);
  res.status(201).json({ id: info.lastInsertRowid });
});

// GET /api/contact?limit= — admin: danh sách tin nhắn, mới nhất trước
router.get('/', auth, staffOnly, (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
  const messages = db
    .prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ?')
    .all(limit)
    .map((m) => ({ ...m, is_read: m.is_read === 1 }));
  res.json({ messages });
});

// PUT /api/contact/:id/read — admin: đánh dấu đã đọc / chưa đọc
router.put('/:id/read', auth, staffOnly, (req, res) => {
  const isRead = req.body && req.body.is_read === false ? 0 : 1;
  const info = db
    .prepare('UPDATE contact_messages SET is_read = ? WHERE id = ?')
    .run(isRead, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
  res.json({ ok: true });
});

// DELETE /api/contact/:id — admin
router.delete('/:id', auth, staffOnly, (req, res) => {
  const info = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
  res.json({ ok: true });
});

module.exports = router;
