// Quản lý đơn hàng: khách đặt hàng, admin cập nhật trạng thái
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Lấy đơn hàng kèm chi tiết sản phẩm
function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return order;
}

// POST /api/orders — khách hàng đã đăng nhập đặt hàng (COD)
router.post('/', auth, (req, res) => {
  const { customer_name, phone, address, items } = req.body || {};
  if (!customer_name || !phone || !address)
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, số điện thoại, địa chỉ' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Giỏ hàng trống' });

  // Kiểm tra tồn kho trước khi tạo đơn (transaction)
  const createOrder = db.transaction((items) => {
    let total = 0;
    const lines = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
      if (!p) throw new Error(`Sản phẩm #${it.product_id} không tồn tại`);
      const qty = parseInt(it.quantity) || 0;
      if (qty <= 0) throw new Error(`Số lượng không hợp lệ cho "${p.name}"`);
      if (p.stock < qty) throw new Error(`"${p.name}" chỉ còn ${p.stock} sản phẩm trong kho`);
      total += p.price * qty;
      lines.push({ product_id: p.id, product_name: p.name, quantity: qty, price: p.price });
    }
    const info = db.prepare(
      `INSERT INTO orders (user_id, customer_name, phone, address, total)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user.id, customer_name.trim(), phone.trim(), address.trim(), total);
    const orderId = info.lastInsertRowid;
    const insItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
    );
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const l of lines) {
      insItem.run(orderId, l.product_id, l.product_name, l.quantity, l.price);
      decStock.run(l.quantity, l.product_id);
    }
    return orderId;
  });

  try {
    const orderId = createOrder(items);
    res.status(201).json({ order: getOrderWithItems(orderId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/orders — khách xem đơn của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('o.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const orders = db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count,
            u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY o.created_at DESC`
  ).all(...params);
  res.json({ orders });
});

// GET /api/orders/:id — chủ đơn hoặc admin
router.get('/:id', auth, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền xem đơn hàng này' });
  res.json({ order });
});

// PUT /api/orders/:id/status — admin cập nhật trạng thái
router.put('/:id/status', auth, adminOnly, (req, res) => {
  const { status } = req.body || {};
  const valid = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ order: getOrderWithItems(req.params.id) });
});

module.exports = router;
