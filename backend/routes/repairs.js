// Sửa chữa / bảo dưỡng: khách gửi yêu cầu, admin cập nhật trạng thái và phí
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Schema có sẵn chưa có cột warranty_id trên bảng repairs —
// thêm idempotent tại đây (không sửa file schema cũ), để gắn phiếu sửa chữa với bảo hành
db.addColumnIfMissing(
  'repairs',
  'warranty_id',
  'warranty_id INTEGER REFERENCES warranties(id) ON DELETE SET NULL'
);

const VALID_STATUS = ['received', 'repairing', 'done', 'returned'];

// Kiểm tra khách có quyền gắn phiếu sửa chữa với đơn / bảo hành này không
function checkCustomerScope({ order_id, warranty_id }, user) {
  if (user.role === 'admin') return { ok: true };
  if (order_id) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) return { ok: false, error: 404, message: 'Không tìm thấy đơn hàng' };
    if (order.user_id !== user.id)
      return { ok: false, error: 403, message: 'Bạn không có quyền với đơn hàng này' };
  }
  if (warranty_id) {
    const w = db
      .prepare(
        `SELECT w.* FROM warranties w JOIN orders o ON o.id = w.order_id WHERE w.id = ?`
      )
      .get(warranty_id);
    if (!w) return { ok: false, error: 404, message: 'Không tìm thấy bảo hành' };
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(w.order_id);
    if (!order || order.user_id !== user.id)
      return { ok: false, error: 403, message: 'Bạn không có quyền với bảo hành này' };
  }
  return { ok: true };
}

// POST /api/repairs — khách tạo phiếu sửa chữa (gắn đơn và/hoặc bảo hành của mình)
router.post('/', auth, (req, res) => {
  const { order_id, warranty_id, description } = req.body || {};
  if (!(description || '').trim())
    return res.status(400).json({ error: 'Vui lòng mô tả tình trạng cần sửa chữa' });

  const scope = checkCustomerScope({ order_id, warranty_id }, req.user);
  if (!scope.ok) return res.status(scope.error).json({ error: scope.message });

  // Phí sửa chữa do admin ấn định sau — khách tạo phiếu luôn bắt đầu với phí 0
  const info = db
    .prepare(
      `INSERT INTO repairs (order_id, warranty_id, description, fee, status)
       VALUES (?, ?, ?, 0, 'received')`
    )
    .run(order_id || null, warranty_id || null, description.trim());
  const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ repair });
});

// GET /api/repairs — khách xem phiếu của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') {
    // Phiếu của khách = phiếu gắn đơn của mình hoặc gắn bảo hành thuộc đơn của mình
    conds.push('(o.user_id = ? OR wo.user_id = ?)');
    params.push(req.user.id, req.user.id);
  }
  if (status) { conds.push('r.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const list = db
    .prepare(
      `SELECT r.*, o.customer_name
       FROM repairs r
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN warranties w ON w.id = r.warranty_id
       LEFT JOIN orders wo ON wo.id = w.order_id
       ${where} ORDER BY r.id DESC`
    )
    .all(...params);
  res.json({ repairs: list });
});

// PUT /api/repairs/:id — admin cập nhật trạng thái và phí sửa chữa
router.put('/:id', auth, adminOnly, (req, res) => {
  const { status, fee } = req.body || {};
  if (!VALID_STATUS.includes(status))
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  const f = fee === undefined ? undefined : parseInt(fee);
  if (f !== undefined && (isNaN(f) || f < 0))
    return res.status(400).json({ error: 'Phí sửa chữa phải >= 0' });

  const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(req.params.id);
  if (!repair) return res.status(404).json({ error: 'Không tìm thấy phiếu sửa chữa' });

  db.prepare('UPDATE repairs SET status = ?, fee = ? WHERE id = ?')
    .run(status, f !== undefined ? f : repair.fee, repair.id);
  const updated = db.prepare('SELECT * FROM repairs WHERE id = ?').get(repair.id);
  res.json({ repair: updated });
});

module.exports = router;
