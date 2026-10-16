// Đổi / trả hàng: khách tạo yêu cầu cho đơn đã giao, admin duyệt / từ chối / hoàn thành
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Trạng thái còn "đang xử lý" — yêu cầu mới cho đơn đã có yêu cầu này sẽ bị 409
const OPEN_STATUSES = ['requested', 'approved'];

// Luồng xử lý hợp lệ của một yêu cầu đổi/trả
const ACTION_FLOW = {
  requested: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};

// Lấy đơn hàng, đồng thời kiểm tra quyền: chủ đơn hoặc admin
function getOrderForUser(orderId, user) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 404, message: 'Không tìm thấy đơn hàng' };
  if (user.role !== 'admin' && order.user_id !== user.id)
    return { error: 403, message: 'Bạn không có quyền với đơn hàng này' };
  return { order };
}

// POST /api/returns — khách tạo yêu cầu đổi/trả (chỉ cho đơn ĐÃ GIAO của mình)
router.post('/', auth, (req, res) => {
  const { order_id, type, reason } = req.body || {};
  if (!order_id)
    return res.status(400).json({ error: 'Thiếu order_id' });
  if (!['return', 'exchange'].includes(type))
    return res.status(400).json({ error: 'type phải là "return" (trả) hoặc "exchange" (đổi)' });
  if (!(reason || '').trim())
    return res.status(400).json({ error: 'Vui lòng ghi rõ lý do đổi/trả' });

  const { order, error, message } = getOrderForUser(order_id, req.user);
  if (error) return res.status(error).json({ error: message });

  // Chỉ đơn đã giao mới được yêu cầu đổi/trả
  if (order.status !== 'delivered')
    return res.status(403).json({ error: 'Chỉ đơn hàng đã giao mới được yêu cầu đổi/trả' });

  // Chống trùng: đơn đã có yêu cầu đang xử lý thì từ chối yêu cầu mới
  const existing = db
    .prepare(
      `SELECT id FROM returns WHERE order_id = ? AND status IN ('requested','approved')`
    )
    .get(order.id);
  if (existing)
    return res.status(409).json({ error: 'Đơn này đã có yêu cầu đổi/trả đang được xử lý' });

  const info = db
    .prepare('INSERT INTO returns (order_id, type, reason) VALUES (?, ?, ?)')
    .run(order.id, type, reason.trim());
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ return: ret });
});

// GET /api/returns — khách xem yêu cầu của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('r.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const list = db
    .prepare(
      `SELECT r.*, o.customer_name, o.total AS order_total
       FROM returns r JOIN orders o ON o.id = r.order_id
       ${where} ORDER BY r.id DESC`
    )
    .all(...params);
  res.json({ returns: list });
});

// GET /api/returns/:id — chủ đơn hoặc admin
router.get('/:id', auth, (req, res) => {
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
  const { error, message } = getOrderForUser(ret.order_id, req.user);
  if (error) return res.status(error).json({ error: message });
  res.json({ return: ret });
});

// PUT /api/returns/:id — admin duyệt / từ chối / hoàn thành yêu cầu
// Khi hoàn thành (completed) kèm refund_amount > 0: đánh dấu payment đã hoàn tiền
// và ghi nhật ký nhập kho (IN) cho từng mặt hàng của đơn
router.put('/:id', auth, staffOnly, (req, res) => {
  const { action, refund_amount } = req.body || {};
  if (!['approved', 'rejected', 'completed'].includes(action))
    return res.status(400).json({ error: 'action phải là approved / rejected / completed' });

  const refund = parseInt(refund_amount) || 0;
  if (refund < 0)
    return res.status(400).json({ error: 'Số tiền hoàn phải >= 0' });

  const complete = db.transaction(() => {
    const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
    if (!ret) return null;
    // Tuân thủ luồng: requested → approved/rejected → completed
    if (!(ACTION_FLOW[ret.status] || []).includes(action))
      throw new Error(`Không thể chuyển yêu cầu từ "${ret.status}" sang "${action}"`);

    db.prepare('UPDATE returns SET status = ?, refund_amount = ? WHERE id = ?')
      .run(action, refund, ret.id);

    // Hoàn thành + có hoàn tiền: cập nhật payment và ghi nhập kho cho các mặt hàng
    if (action === 'completed' && refund > 0) {
      const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(ret.order_id);
      if (payment)
        db.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(payment.id);

      const items = db
        .prepare('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?')
        .all(ret.order_id);
      for (const it of items) {
        // Cộng lại tồn kho vật lý (variant hoặc sản phẩm thường)
        if (it.variant_id) {
          db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?')
            .run(it.quantity, it.variant_id);
        } else if (it.product_id) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
            .run(it.quantity, it.product_id);
        }
        db.logStockMovement({
          product_id: it.product_id,
          variant_id: it.variant_id,
          type: 'IN',
          qty: it.quantity,
          ref_type: 'return',
          ref_id: ret.id,
          note: `Đổi/trả #${ret.id} — nhập kho lại từ đơn #${ret.order_id}`,
        });
      }
    }
    return ret.id;
  });

  let id;
  try {
    id = complete();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (!id) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(id);
  res.json({ return: ret });
});

module.exports = router;
