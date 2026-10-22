// Đổi / trả hàng: khách tạo yêu cầu cho đơn đã giao (chọn từng món + số lượng),
// nhân viên xử lý theo luồng: Chờ duyệt -> Chấp nhận / Từ chối (có lý do)
// -> Đã nhận lại hàng (chọn món còn tốt để nhập kho) -> Hoàn thành (hoàn tiền).
// Mọi thay đổi trạng thái đều thông báo cho khách qua chuông + tin nhắn trong chat.
// Hoàn tiền được trừ vào doanh thu ở tầng thống kê (reports) và tổng chi của khách (tiers);
// hoàn toàn bộ đơn thì đơn chuyển payment_status = 'refunded'.
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');
const { validateImages, parseImages } = require('../lib/images');
const { postAftersalesCard, postChatNotice } = require('../lib/chatCard');

const router = express.Router();

// Trả về bản sao có images đã parse từ JSON sang mảng
const withImages = (row) => (row ? { ...row, images: parseImages(row.images) } : row);

// Nạp chi tiết món cho một danh sách yêu cầu
function attachItems(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const items = db
    .prepare(`SELECT * FROM return_items WHERE return_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`)
    .all(...ids);
  const byReturn = {};
  for (const it of items) (byReturn[it.return_id] = byReturn[it.return_id] || []).push(it);
  return rows.map((r) => ({ ...r, items: byReturn[r.id] || [] }));
}

const getReturnFull = (id) => {
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(id);
  return ret ? attachItems([withImages(ret)])[0] : null;
};

// Trạng thái còn "đang xử lý" — đơn đã có yêu cầu này thì không tạo thêm được
const OPEN_STATUSES = ['requested', 'approved', 'received'];

// Luồng xử lý hợp lệ của một yêu cầu đổi/trả
const ACTION_FLOW = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'completed'],
  received: ['completed'],
  rejected: [],
  completed: [],
};

// Lấy đơn hàng, đồng thời kiểm tra quyền: chủ đơn hoặc nhân viên
function getOrderForUser(orderId, user) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 404, message: 'Không tìm thấy đơn hàng' };
  if (!['admin', 'sale'].includes(user.role) && order.user_id !== user.id)
    return { error: 403, message: 'Bạn không có quyền với đơn hàng này' };
  return { order };
}

// Thông báo cho khách khi yêu cầu đổi/trả đổi trạng thái: chuông + tin nhắn chat.
// Lỗi thông báo không bao giờ làm hỏng thao tác chính.
function notifyCustomer(order, ret, title, content, senderId) {
  if (!order.user_id) return;
  try {
    db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    ).run(order.user_id, 'return', title, content, '/don-hang');
  } catch (e) { /* bỏ qua lỗi thông báo */ }
  try {
    postChatNotice(order.user_id, senderId, content);
  } catch (e) { /* bỏ qua lỗi thông báo */ }
}

// Cộng kho cho các món được chọn nhập lại + ghi nhật ký kho.
// restock: [{ id: return_item_id, qty }] — qty bị chặn ở số lượng chưa nhập.
function applyRestock(ret, restock) {
  if (!Array.isArray(restock)) return;
  for (const entry of restock) {
    const item = db.prepare('SELECT * FROM return_items WHERE id = ? AND return_id = ?')
      .get(parseInt(entry.id), ret.id);
    if (!item) continue;
    const qty = Math.max(0, Math.min(parseInt(entry.qty) || 0, item.quantity - item.restocked_qty));
    if (qty <= 0) continue;
    if (item.variant_id) {
      db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(qty, item.variant_id);
    } else if (item.product_id) {
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(qty, item.product_id);
    }
    db.prepare('UPDATE return_items SET restocked_qty = restocked_qty + ? WHERE id = ?').run(qty, item.id);
    db.logStockMovement({
      product_id: item.product_id,
      variant_id: item.variant_id,
      type: 'IN',
      qty,
      ref_type: 'return',
      ref_id: ret.id,
      note: `Đổi/trả #${ret.id} — nhập kho lại từ đơn #${ret.order_id}`,
    });
  }
}

// POST /api/returns — khách tạo yêu cầu đổi/trả (chỉ cho đơn ĐÃ GIAO của mình)
// Bắt buộc: lý do + ít nhất 1 ảnh minh họa. items: [{order_item_id, quantity}] —
// không gửi items thì hiểu là đổi/trả toàn bộ số lượng còn lại của đơn.
router.post('/', auth, (req, res) => {
  const { order_id, type, reason, images, items } = req.body || {};
  if (!order_id)
    return res.status(400).json({ error: 'Thiếu order_id' });
  if (!['return', 'exchange'].includes(type))
    return res.status(400).json({ error: 'type phải là "return" (trả) hoặc "exchange" (đổi)' });
  if (!(reason || '').trim())
    return res.status(400).json({ error: 'Vui lòng ghi rõ lý do đổi/trả' });
  const img = validateImages(images);
  if (img.error) return res.status(400).json({ error: img.error });

  const { order, error, message } = getOrderForUser(order_id, req.user);
  if (error) return res.status(error).json({ error: message });

  if (order.status !== 'delivered')
    return res.status(403).json({ error: 'Chỉ đơn hàng đã giao mới được yêu cầu đổi/trả' });

  const existing = db
    .prepare(`SELECT id FROM returns WHERE order_id = ? AND status IN ('requested','approved','received')`)
    .get(order.id);
  if (existing)
    return res.status(409).json({ error: 'Đơn này đã có yêu cầu đổi/trả đang được xử lý' });

  // Số lượng từng món còn được đổi/trả = đã mua - đã hoàn tất đổi/trả trước đó
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(order.id);
  const returnedBefore = db.prepare(
    `SELECT ri.order_item_id AS oid, COALESCE(SUM(ri.quantity), 0) AS q
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.order_id = ? AND r.status = 'completed' GROUP BY ri.order_item_id`
  ).all(order.id);
  const returnedMap = Object.fromEntries(returnedBefore.map((x) => [x.oid, x.q]));

  let chosen;
  if (Array.isArray(items) && items.length) {
    chosen = [];
    for (const entry of items) {
      const oi = orderItems.find((x) => x.id === parseInt(entry.order_item_id));
      if (!oi) return res.status(400).json({ error: 'Sản phẩm không thuộc đơn hàng này' });
      const remain = oi.quantity - (returnedMap[oi.id] || 0);
      const qty = parseInt(entry.quantity);
      if (!qty || qty < 1 || qty > remain)
        return res.status(400).json({ error: `Số lượng đổi/trả của "${oi.product_name}" phải từ 1 đến ${remain}` });
      chosen.push({ oi, qty });
    }
  } else {
    chosen = orderItems
      .map((oi) => ({ oi, qty: oi.quantity - (returnedMap[oi.id] || 0) }))
      .filter((c) => c.qty > 0);
  }
  if (!chosen.length)
    return res.status(400).json({ error: 'Không còn sản phẩm nào để đổi/trả trong đơn này' });

  const createTx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO returns (order_id, type, reason, images) VALUES (?, ?, ?, ?)')
      .run(order.id, type, reason.trim(), img.value);
    const retId = info.lastInsertRowid;
    const insItem = db.prepare(
      `INSERT INTO return_items (return_id, order_item_id, product_id, variant_id, product_name, variant_sku, price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const { oi, qty } of chosen) {
      insItem.run(retId, oi.id, oi.product_id, oi.variant_id, oi.product_name, oi.variant_sku || '', oi.price, qty);
    }
    return retId;
  });
  const ret = getReturnFull(createTx());

  // Đăng thẻ yêu cầu vào chat của khách (nối tiếp cuộc đang có, hoặc tạo cuộc chờ mới).
  if (order.user_id) {
    const label = type === 'exchange' ? '🔄 Yêu cầu đổi hàng' : '↩️ Yêu cầu trả hàng';
    const itemText = ret.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ');
    postAftersalesCard(order.user_id, {
      refType: 'return',
      refId: ret.id,
      content: `${label} — Đơn #${order.id}: ${itemText}. Lý do: ${reason.trim().slice(0, 160)}`,
    });
  }

  res.status(201).json({ return: ret });
});

// GET /api/returns — khách xem yêu cầu của mình, nhân viên xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role === 'customer') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('r.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const list = db
    .prepare(
      `SELECT r.*, o.customer_name, o.total AS order_total
       FROM returns r JOIN orders o ON o.id = r.order_id
       ${where} ORDER BY r.id DESC`
    )
    .all(...params);
  res.json({ returns: attachItems(list.map(withImages)) });
});

// GET /api/returns/:id — chủ đơn hoặc nhân viên
router.get('/:id', auth, (req, res) => {
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
  const { error, message } = getOrderForUser(ret.order_id, req.user);
  if (error) return res.status(error).json({ error: message });
  res.json({ return: getReturnFull(ret.id) });
});

// PUT /api/returns/:id — nhân viên duyệt / từ chối / nhận hàng / hoàn thành
// body theo action:
//   approved: {}                          -> chấp nhận yêu cầu
//   rejected: { reason } (bắt buộc)       -> từ chối kèm lý do
//   received: { note, restock: [{id, qty}] } -> đã nhận lại hàng + nhập kho các món còn tốt
//   completed: { refund_amount?, restock? }  -> hoàn tất; refund mặc định = tổng giá trị món trả
router.put('/:id', auth, staffOnly, (req, res) => {
  const { action, refund_amount, reason, note, restock } = req.body || {};
  if (!['approved', 'rejected', 'received', 'completed'].includes(action))
    return res.status(400).json({ error: 'action phải là approved / rejected / received / completed' });
  if (action === 'rejected' && !(reason || '').trim())
    return res.status(400).json({ error: 'Từ chối phải ghi rõ lý do để khách hàng biết' });

  let result;
  try {
    result = db.transaction(() => {
      const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
      if (!ret) return null;
      if (!(ACTION_FLOW[ret.status] || []).includes(action))
        throw new Error(`Không thể chuyển yêu cầu từ "${ret.status}" sang "${action}"`);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(ret.order_id);

      if (action === 'approved') {
        db.prepare("UPDATE returns SET status = 'approved' WHERE id = ?").run(ret.id);
      } else if (action === 'rejected') {
        db.prepare("UPDATE returns SET status = 'rejected', reject_reason = ? WHERE id = ?")
          .run(reason.trim().slice(0, 500), ret.id);
      } else if (action === 'received') {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        db.prepare("UPDATE returns SET status = 'received', received_note = ?, received_at = ? WHERE id = ?")
          .run(String(note || '').trim().slice(0, 500), now, ret.id);
        applyRestock(ret, restock);
      } else if (action === 'completed') {
        applyRestock(ret, restock);
        const items = db.prepare('SELECT price, quantity FROM return_items WHERE return_id = ?').all(ret.id);
        const suggested = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const refund = refund_amount === undefined || refund_amount === null
          ? suggested
          : parseInt(refund_amount) || 0;
        if (refund < 0 || refund > order.total)
          throw new Error(`Số tiền hoàn phải từ 0 đến ${order.total.toLocaleString('vi-VN')} ₫ (tổng đơn)`);
        db.prepare("UPDATE returns SET status = 'completed', refund_amount = ? WHERE id = ?")
          .run(refund, ret.id);
        if (refund > 0) {
          const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(ret.order_id);
          if (payment && refund >= order.total) {
            // Hoàn toàn bộ: đánh dấu đã hoàn tiền ở cả sổ thanh toán lẫn đơn hàng,
            // thống kê doanh thu và hạng khách tự loại đơn này ra.
            db.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(payment.id);
            db.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(order.id);
          }
          // Hoàn một phần: giữ nguyên trạng thái; doanh thu/tổng chi được trừ đúng
          // số tiền hoàn ở tầng thống kê (reports) và phân hạng (tiers).
        }
      }
      return { ret, order };
    })();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (!result) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });

  const { ret, order } = result;
  const fresh = getReturnFull(ret.id);
  const typeLabel = ret.type === 'exchange' ? 'đổi hàng' : 'trả hàng';
  if (action === 'approved') {
    notifyCustomer(order, fresh,
      `✅ Yêu cầu ${typeLabel} đơn #${ret.order_id} đã được chấp nhận`,
      `✅ Shop đã chấp nhận yêu cầu ${typeLabel} cho đơn #${ret.order_id}. Bạn vui lòng đóng gói và gửi hàng về shop giúp shop nhé. Shop sẽ thông báo ngay khi nhận được hàng.`,
      req.user.id);
  } else if (action === 'rejected') {
    notifyCustomer(order, fresh,
      `❌ Yêu cầu ${typeLabel} đơn #${ret.order_id} bị từ chối`,
      `❌ Shop rất tiếc, yêu cầu ${typeLabel} cho đơn #${ret.order_id} chưa được chấp nhận. Lý do: ${fresh.reject_reason}. Bạn cần hỗ trợ thêm cứ nhắn cho shop nhé.`,
      req.user.id);
  } else if (action === 'received') {
    notifyCustomer(order, fresh,
      `📥 Shop đã nhận lại hàng của đơn #${ret.order_id}`,
      `📥 Shop đã nhận lại hàng của đơn #${ret.order_id}${fresh.received_note ? `. Tình trạng hàng nhận lại: ${fresh.received_note}` : ''}. Shop đang hoàn tất thủ tục cho bạn.`,
      req.user.id);
  } else if (action === 'completed') {
    const refundText = fresh.refund_amount > 0
      ? ` Số tiền hoàn lại cho bạn: ${fresh.refund_amount.toLocaleString('vi-VN')} ₫.`
      : '';
    notifyCustomer(order, fresh,
      `↩️ Yêu cầu ${typeLabel} đơn #${ret.order_id} đã hoàn tất`,
      `↩️ Yêu cầu ${typeLabel} cho đơn #${ret.order_id} đã xử lý xong.${refundText} Cảm ơn bạn đã tin tưởng BI99!`,
      req.user.id);
  }

  res.json({ return: fresh });
});

module.exports = router;
