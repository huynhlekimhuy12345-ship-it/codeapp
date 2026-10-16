// Bảo hành theo đơn hàng: tạo cho đơn đã giao, gia hạn / hủy bởi admin
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Lấy đơn hàng, đồng thời kiểm tra quyền: chủ đơn hoặc admin
function getOrderForUser(orderId, user) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 404, message: 'Không tìm thấy đơn hàng' };
  if (user.role !== 'admin' && order.user_id !== user.id)
    return { error: 403, message: 'Bạn không có quyền với đơn hàng này' };
  return { order };
}

// Cộng thêm n tháng vào chuỗi ngày YYYY-MM-DD, trả về YYYY-MM-DD
function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/warranties — tạo bảo hành (khách cho đơn ĐÃ GIAO của mình, admin cho đơn bất kỳ)
router.post('/', auth, (req, res) => {
  const { order_id, months } = req.body || {};
  const n = parseInt(months);
  if (!order_id)
    return res.status(400).json({ error: 'Thiếu order_id' });
  if (!n || n <= 0 || n > 120)
    return res.status(400).json({ error: 'Số tháng bảo hành phải từ 1 đến 120' });

  const { order, error, message } = getOrderForUser(order_id, req.user);
  if (error) return res.status(error).json({ error: message });
  // Khách chỉ được tạo bảo hành cho đơn đã giao của mình; admin tạo tự do
  if (req.user.role !== 'admin' && order.status !== 'delivered')
    return res.status(403).json({ error: 'Chỉ đơn hàng đã giao mới được tạo bảo hành' });

  // Tránh trùng: mỗi đơn chỉ có tối đa 1 bảo hành đang hoạt động
  const existing = db
    .prepare("SELECT id FROM warranties WHERE order_id = ? AND status = 'active'")
    .get(order.id);
  if (existing)
    return res.status(409).json({ error: 'Đơn này đã có bảo hành đang hoạt động' });

  const start = today();
  const end = addMonths(start, n);
  const info = db
    .prepare(
      `INSERT INTO warranties (order_id, months, start_date, end_date, status)
       VALUES (?, ?, ?, ?, 'active')`
    )
    .run(order.id, n, start, end);
  const warranty = db.prepare('SELECT * FROM warranties WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ warranty });
});

// GET /api/warranties — khách xem bảo hành của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('w.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const list = db
    .prepare(
      `SELECT w.*, o.customer_name, o.total AS order_total
       FROM warranties w JOIN orders o ON o.id = w.order_id
       ${where} ORDER BY w.id DESC`
    )
    .all(...params);
  res.json({ warranties: list });
});

// PUT /api/warranties/:id — admin gia hạn hoặc hủy (void) bảo hành
router.put('/:id', auth, staffOnly, (req, res) => {
  const { action, months } = req.body || {};
  if (!['extend', 'void'].includes(action))
    return res.status(400).json({ error: 'action phải là extend (gia hạn) hoặc void (hủy)' });

  const w = db.prepare('SELECT * FROM warranties WHERE id = ?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Không tìm thấy bảo hành' });

  if (action === 'void') {
    db.prepare("UPDATE warranties SET status = 'void' WHERE id = ?").run(w.id);
  } else {
    const n = parseInt(months);
    if (!n || n <= 0 || n > 120)
      return res.status(400).json({ error: 'Số tháng gia hạn phải từ 1 đến 120' });
    // Gia hạn: cộng thêm tháng vào ngày hết hạn hiện tại, kích hoạt lại nếu đã hết hạn
    const newEnd = addMonths(w.end_date, n);
    db.prepare("UPDATE warranties SET end_date = ?, months = months + ?, status = 'active' WHERE id = ?")
      .run(newEnd, n, w.id);
  }

  const warranty = db.prepare('SELECT * FROM warranties WHERE id = ?').get(w.id);
  res.json({ warranty });
});

module.exports = router;
