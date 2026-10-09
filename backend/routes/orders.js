// Quản lý đơn hàng: khách đặt hàng, admin cập nhật trạng thái
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Lấy đơn hàng kèm chi tiết sản phẩm và lịch sử trạng thái
function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  order.history = db.prepare(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id DESC'
  ).all(id);
  return order;
}

// Luồng trạng thái hợp lệ: chờ xác nhận → đã xác nhận → đang giao → đã giao
// Chỉ được hủy khi chưa giao xong; đơn đã hủy / đã giao không chuyển đi đâu nữa
const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

// Ghi lịch sử trạng thái, dùng tên thật từ phiên đăng nhập (không cho giả mạo nhãn)
function actorName(req) {
  const row = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  return row ? row.name : (req.user.email || '');
}

function writeHistory(orderId, fromStatus, toStatus, req, reason = '') {
  db.prepare(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).run(orderId, fromStatus, toStatus, actorName(req), reason || '');
}

// Hoàn lại tồn kho cho toàn bộ sản phẩm trong đơn
function restoreStock(orderId) {
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const upd = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const i of items) {
    if (i.product_id) upd.run(i.quantity, i.product_id);
  }
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
    // Ghi lịch sử: đơn mới tạo, kèm danh tính khách hàng (tên + SĐT)
    db.prepare(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
       VALUES (?, NULL, 'pending', ?, ?)`
    ).run(orderId, `${customer_name.trim()} (${phone.trim()})`, 'Đơn hàng mới được tạo');
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

// PUT /api/orders/:id/status — admin cập nhật trạng thái (tuân thủ luồng chặt chẽ)
router.put('/:id/status', auth, adminOnly, (req, res) => {
  const { status, reason } = req.body || {};
  const valid = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const change = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return null;
    const from = order.status;
    if (!(STATUS_FLOW[from] || []).includes(status))
      throw new Error(`Không thể chuyển đơn từ "${from}" sang "${status}"`);
    if (status === 'cancelled' && !(reason || '').trim())
      throw new Error('Hủy đơn hàng phải ghi rõ lý do');
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    // Hủy đơn → hoàn lại toàn bộ tồn kho đã trừ
    if (status === 'cancelled') restoreStock(order.id);
    writeHistory(order.id, from, status, req, (reason || '').trim());
  });

  try {
    change();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ order });
});

// DELETE /api/orders/:id — admin xóa đơn (tự động hoàn tồn kho nếu đơn chưa bị hủy)
router.delete('/:id', auth, adminOnly, (req, res) => {
  const remove = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return null;
    // Đơn chưa hủy → hoàn tồn kho trước khi xóa (đơn đã hủy kho đã hoàn)
    if (order.status !== 'cancelled') restoreStock(order.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    return order;
  });

  let order;
  try { order = remove(); } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ ok: true });
});

module.exports = router;
