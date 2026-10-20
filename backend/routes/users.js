// Quản trị người dùng (admin)
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me — khách xem hồ sơ của mình
router.get('/me', auth, (req, res) => {
  const user = db.prepare(
    'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user });
});

// PUT /api/users/me — khách cập nhật tên/SĐT của mình
router.put('/me', auth, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !String(name).trim())
    return res.status(400).json({ error: 'Tên không được để trống' });
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(
    String(name).trim(), String(phone || '').trim(), req.user.id
  );
  const user = db.prepare(
    'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  res.json({ user });
});

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
  if (!['admin', 'sale', 'customer'].includes(role))
    return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Không thể tự hạ quyền chính mình' });
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ user: db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id) });
});

// GET /api/users/top-customers — admin: top khách hàng tiềm năng theo tổng tiền đã mua
// Chỉ tính đơn đã xác nhận thanh toán (payment_status='verified') và chưa hủy — khớp cách tính doanh thu.
router.get('/top-customers', auth, adminOnly, (req, res) => {
  const customers = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(o.total), 0) AS total_spent,
           MAX(o.created_at) AS last_order_at
    FROM users u
    JOIN orders o ON o.user_id = u.id
      AND o.payment_status = 'verified' AND o.status != 'cancelled'
    WHERE u.role = 'customer'
    GROUP BY u.id
    ORDER BY total_spent DESC, order_count DESC
    LIMIT 10
  `).all();
  res.json({ customers });
});

// GET /api/users/:id/purchases — admin: một khách đã mua những gì
router.get('/:id/purchases', auth, adminOnly, (req, res) => {
  const customer = db.prepare(
    'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  const orders = db.prepare(
    'SELECT id, total, status, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC'
  ).all(req.params.id);
  const itemsStmt = db.prepare(
    'SELECT id, product_name, quantity, price FROM order_items WHERE order_id = ? ORDER BY id'
  );
  for (const o of orders) o.items = itemsStmt.all(o.id);
  const summary = db.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
    FROM orders WHERE user_id = ? AND payment_status = 'verified' AND status != 'cancelled'
  `).get(req.params.id);
  const topProducts = db.prepare(`
    SELECT oi.product_name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.price) AS total_amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = ? AND o.payment_status = 'verified' AND o.status != 'cancelled'
    GROUP BY oi.product_name
    ORDER BY total_qty DESC, total_amount DESC
    LIMIT 5
  `).all(req.params.id);
  res.json({ customer, summary, top_products: topProducts, orders });
});

module.exports = router;
