// Quản lý thanh toán đơn hàng (1 đơn hàng = 1 bản ghi thanh toán)
// - Customer chỉ được tạo / xem payment cho đơn của chính mình
// - Admin: xem tất cả, duyệt / từ chối, đánh dấu hoàn tiền
// - MoMo: chỉ tạo bản ghi pending chờ webhook, KHÔNG tự động verify
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

const METHODS = ['cod', 'bank', 'momo'];
const STATUSES = ['pending', 'verified', 'failed', 'refunded'];

// Nhãn hiển thị phương thức / trạng thái
const METHOD_LABEL = { cod: 'COD (tiền mặt)', bank: 'Chuyển khoản', momo: 'Ví MoMo' };
const STATUS_LABEL = { pending: 'Chờ duyệt', verified: 'Đã xác nhận', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };

// Lấy payment kèm thông tin đơn hàng + khách hàng
function getPaymentFull(id) {
  return db.prepare(
    `SELECT p.*,
            o.customer_name, o.phone, o.address, o.status AS order_status,
            o.payment_method AS order_payment_method, o.user_id,
            u.email AS user_email
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.id = ?`
  ).get(id);
}

// POST /api/payments — tạo bản ghi thanh toán cho 1 đơn hàng
// Body: { order_id, method: 'cod'|'bank'|'momo', proof_url? }
// - amount lấy từ orders.total (không tin client)
// - 1 đơn chỉ 1 payment → 409 nếu đã tồn tại
router.post('/', auth, (req, res) => {
  const { order_id, method, proof_url } = req.body || {};

  if (!order_id) return res.status(400).json({ error: 'Thiếu order_id' });
  if (!METHODS.includes(method))
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ (cod/bank/momo)' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  // Customer chỉ tạo payment cho đơn của mình
  if (req.user.role !== 'admin' && order.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền thanh toán cho đơn hàng này' });

  const exists = db.prepare('SELECT id FROM payments WHERE order_id = ?').get(order.id);
  if (exists)
    return res.status(409).json({ error: 'Đơn hàng này đã có bản ghi thanh toán' });

  // MoMo: chỉ tạo pending chờ webhook, không tự verify
  const note = method === 'momo' ? 'Chờ webhook MoMo' : '';

  const create = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO payments (order_id, method, amount, status, proof_url, note)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).run(order.id, method, order.total, (proof_url || '').trim(), note);
    // Đồng bộ phương thức + trạng thái thanh toán trên đơn hàng
    db.prepare(
      `UPDATE orders SET payment_method = ?, payment_status = 'pending' WHERE id = ?`
    ).run(method, order.id);
    return info.lastInsertRowid;
  });

  const paymentId = create();
  res.status(201).json({ payment: getPaymentFull(paymentId) });
});

// GET /api/payments — danh sách thanh toán (?order_id=, ?status=)
// - Customer chỉ thấy payment của đơn mình, admin thấy tất cả
router.get('/', auth, (req, res) => {
  const { order_id, status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (order_id) { conds.push('p.order_id = ?'); params.push(order_id); }
  if (status) {
    if (!STATUSES.includes(status))
      return res.status(400).json({ error: 'Trạng thái lọc không hợp lệ' });
    conds.push('p.status = ?'); params.push(status);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const payments = db.prepare(
    `SELECT p.*,
            o.customer_name, o.phone, o.status AS order_status, o.user_id,
            u.email AS user_email
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY p.created_at DESC`
  ).all(...params);
  res.json({ payments });
});

// GET /api/payments/:id — chi tiết (chủ đơn hoặc admin)
router.get('/:id', auth, (req, res) => {
  const payment = getPaymentFull(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Không tìm thấy thanh toán' });
  if (req.user.role !== 'admin' && payment.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền xem thanh toán này' });
  res.json({ payment });
});

// PUT /api/payments/:id/proof — khách gửi link ảnh bằng chứng chuyển khoản
// Body: { proof_url } — chỉ chủ đơn, payment đang pending
router.put('/:id/proof', auth, (req, res) => {
  const { proof_url } = req.body || {};
  if (!proof_url || !String(proof_url).trim())
    return res.status(400).json({ error: 'Thiếu link ảnh bằng chứng chuyển khoản' });
  const payment = getPaymentFull(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Không tìm thấy thanh toán' });
  if (req.user.role !== 'admin' && payment.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền cập nhật thanh toán này' });
  if (payment.status !== 'pending')
    return res.status(400).json({ error: 'Chỉ gửi bằng chứng khi thanh toán đang chờ duyệt' });
  db.prepare('UPDATE payments SET proof_url = ? WHERE id = ?').run(String(proof_url).trim(), req.params.id);
  res.json({ payment: getPaymentFull(req.params.id) });
});

// PUT /api/payments/:id/verify — admin duyệt / từ chối thanh toán
// Body: { action: 'verified'|'failed', note? }
// Transaction: cập nhật payments.status + verified_at, đồng thời cập nhật
// orders.payment_status theo cùng giá trị (dùng SQL trực tiếp, không sửa orders.js)
router.put('/:id/verify', auth, staffOnly, (req, res) => {
  const { action, note } = req.body || {};
  if (!['verified', 'failed'].includes(action))
    return res.status(400).json({ error: "action phải là 'verified' hoặc 'failed'" });

  const apply = db.transaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!payment) return null;
    if (payment.status !== 'pending')
      throw new Error(`Chỉ duyệt được thanh toán đang "Chờ duyệt" (hiện tại: ${STATUS_LABEL[payment.status]})`);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.prepare(
      `UPDATE payments SET status = ?, verified_at = ?, note = ? WHERE id = ?`
    ).run(action, now, (note || '').trim(), payment.id);
    db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run(action, payment.order_id);
    return payment.id;
  });

  let paymentId;
  try { paymentId = apply(); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!paymentId) return res.status(404).json({ error: 'Không tìm thấy thanh toán' });
  res.json({ payment: getPaymentFull(paymentId) });
});

// PUT /api/payments/:id/refund — admin đánh dấu hoàn tiền (dùng khi đổi trả)
// Chỉ hoàn được khi payment đã verified; kèm note ghi lý do
router.put('/:id/refund', auth, staffOnly, (req, res) => {
  const { note } = req.body || {};
  if (!(note || '').trim())
    return res.status(400).json({ error: 'Hoàn tiền cần ghi rõ lý do (note)' });

  const apply = db.transaction(() => {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!payment) return null;
    if (payment.status !== 'verified')
      throw new Error(`Chỉ hoàn tiền được cho thanh toán đã xác nhận (hiện tại: ${STATUS_LABEL[payment.status]})`);
    db.prepare(
      `UPDATE payments SET status = 'refunded', note = ? WHERE id = ?`
    ).run((note || '').trim(), payment.id);
    db.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(payment.order_id);
    return payment.id;
  });

  let paymentId;
  try { paymentId = apply(); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!paymentId) return res.status(404).json({ error: 'Không tìm thấy thanh toán' });
  res.json({ payment: getPaymentFull(paymentId) });
});

module.exports = router;
