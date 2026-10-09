// Quản trị người dùng (admin)
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — admin xem danh sách
router.get('/', auth, adminOnly, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ users });
});

// PUT /api/users/:id/role — admin đổi vai trò
router.put('/:id/role', auth, adminOnly, (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'customer'].includes(role))
    return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Không thể tự hạ quyền chính mình' });
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user: db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id) });
});

module.exports = router;
