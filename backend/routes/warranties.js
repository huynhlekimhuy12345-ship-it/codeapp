// Bảo hành theo đơn hàng: tạo cho đơn đã giao, gia hạn / hủy bởi admin
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');
const { validateImages, parseImages } = require('../lib/images');
const { postAftersalesCard, postChatNotice } = require('../lib/chatCard');

const router = express.Router();

// Trả về bản sao có images đã parse từ JSON sang mảng
const withImages = (row) => (row ? { ...row, images: parseImages(row.images) } : row);

// Lấy đơn hàng, đồng thời kiểm tra quyền: chủ đơn hoặc admin
function getOrderForUser(orderId, user) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { error: 404, message: 'Không tìm thấy đơn hàng' };
  // Nhân viên (admin/sale) được xử lý mọi đơn; khách chỉ đơn của mình
  if (!['admin', 'sale'].includes(user.role) && order.user_id !== user.id)
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

// POST /api/warranties — tạo yêu cầu bảo hành.
// - Khách tự gửi (cho đơn ĐÃ GIAO của mình): bắt buộc lý do + ảnh minh họa, KHÔNG chọn
//   thời hạn — yêu cầu vào trạng thái 'requested' (chờ duyệt), sale/admin quyết định sau.
//   Tạo xong, yêu cầu được đăng thành thẻ vào chat tư vấn của khách (lib/chatCard.js).
// - Nhân viên tạo trực tiếp trong quản trị: cấp luôn bảo hành đang hiệu lực theo số tháng.
router.post('/', auth, (req, res) => {
  const { order_id, months, reason, images } = req.body || {};
  if (!order_id)
    return res.status(400).json({ error: 'Thiếu order_id' });
  const isCustomerSelf = req.user.role === 'customer';

  const { order, error, message } = getOrderForUser(order_id, req.user);
  if (error) return res.status(error).json({ error: message });

  if (isCustomerSelf) {
    if (order.status !== 'delivered')
      return res.status(403).json({ error: 'Chỉ đơn hàng đã giao mới được yêu cầu bảo hành' });
    if (!(reason || '').trim())
      return res.status(400).json({ error: 'Vui lòng ghi rõ lý do / tình trạng cần bảo hành' });
    const img = validateImages(images);
    if (img.error) return res.status(400).json({ error: img.error });

    // Chống trùng: đơn đang có yêu cầu chưa kết thúc hoặc bảo hành đang hiệu lực
    const existing = db
      .prepare("SELECT id FROM warranties WHERE order_id = ? AND status IN ('requested','accepted','received','active')")
      .get(order.id);
    if (existing)
      return res.status(409).json({ error: 'Đơn này đã có yêu cầu bảo hành đang xử lý hoặc đang hiệu lực' });

    const info = db
      .prepare(
        `INSERT INTO warranties (order_id, months, start_date, end_date, status, reason, images)
         VALUES (?, 0, NULL, NULL, 'requested', ?, ?)`
      )
      .run(order.id, reason.trim(), img.value);
    const warranty = db.prepare('SELECT * FROM warranties WHERE id = ?').get(info.lastInsertRowid);

    if (order.user_id) {
      postAftersalesCard(order.user_id, {
        refType: 'warranty',
        refId: warranty.id,
        content: `🛡️ Yêu cầu bảo hành — Đơn #${order.id}: ${reason.trim().slice(0, 200)}`,
      });
    }
    return res.status(201).json({ warranty: withImages(warranty) });
  }

  // Nhân viên tạo trực tiếp: bảo hành hiệu lực ngay
  const n = parseInt(months);
  if (!n || n <= 0 || n > 120)
    return res.status(400).json({ error: 'Số tháng bảo hành phải từ 1 đến 120' });
  const existing = db
    .prepare("SELECT id FROM warranties WHERE order_id = ? AND status IN ('requested','accepted','received','active')")
    .get(order.id);
  if (existing)
    return res.status(409).json({ error: 'Đơn này đã có yêu cầu bảo hành đang xử lý hoặc đang hiệu lực' });

  const start = today();
  const end = addMonths(start, n);
  const info = db
    .prepare(
      `INSERT INTO warranties (order_id, months, start_date, end_date, status, reason, images)
       VALUES (?, ?, ?, ?, 'active', '', '[]')`
    )
    .run(order.id, n, start, end);
  const warranty = db.prepare('SELECT * FROM warranties WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ warranty: withImages(warranty) });
});

// GET /api/warranties — khách xem bảo hành của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role === 'customer') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('w.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const list = db
    .prepare(
      `SELECT w.*, o.customer_name, o.total AS order_total
       FROM warranties w JOIN orders o ON o.id = w.order_id
       ${where} ORDER BY w.id DESC`
    )
    .all(...params);
  res.json({ warranties: list.map(withImages) });
});

// Luồng xử lý yêu cầu bảo hành của nhân viên (admin + sale đều làm được):
// requested --accept--> accepted --received (tùy chọn)--> received --activate--> active
// requested --reject--> rejected; accepted/received/active --void--> void; active --extend--> active
const FLOW = {
  requested: ['accept', 'reject', 'void'],
  accepted: ['received', 'activate', 'void'],
  received: ['activate', 'void'],
  active: ['extend', 'void'],
  expired: ['extend', 'void'],
  rejected: [],
  void: [],
};

const fmtDay = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

// Thông báo cho khách khi bảo hành đổi trạng thái: chuông + tin nhắn trong chat.
// Lỗi thông báo không bao giờ làm hỏng thao tác chính.
function notifyWarrantyCustomer(w, title, content, senderId) {
  const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(w.order_id);
  if (!order || !order.user_id) return;
  try {
    db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    ).run(order.user_id, 'warranty', title, content, '/don-hang');
  } catch (e) { /* bỏ qua lỗi thông báo */ }
  try {
    postChatNotice(order.user_id, senderId, content);
  } catch (e) { /* bỏ qua lỗi thông báo */ }
}

// PUT /api/warranties/:id — nhân viên xử lý yêu cầu / bảo hành
router.put('/:id', auth, staffOnly, (req, res) => {
  const { action, months, note } = req.body || {};
  const ACTIONS = ['accept', 'reject', 'received', 'activate', 'extend', 'void'];
  if (!ACTIONS.includes(action))
    return res.status(400).json({ error: 'action không hợp lệ' });

  if (action === 'reject' && !String(note || '').trim())
    return res.status(400).json({ error: 'Từ chối phải ghi rõ lý do (truyền vào trường note) để khách hàng biết' });

  const w = db.prepare('SELECT * FROM warranties WHERE id = ?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Không tìm thấy bảo hành' });
  if (!(FLOW[w.status] || []).includes(action))
    return res.status(400).json({ error: `Không thể thực hiện "${action}" khi bảo hành đang ở trạng thái "${w.status}"` });

  if (action === 'accept') {
    db.prepare("UPDATE warranties SET status = 'accepted' WHERE id = ?").run(w.id);
    notifyWarrantyCustomer(w,
      `🛡️ Yêu cầu bảo hành đơn #${w.order_id} đã được chấp nhận`,
      `🛡️ Shop đã chấp nhận yêu cầu bảo hành cho đơn #${w.order_id}. Bạn vui lòng đóng gói và gửi hàng về shop giúp shop nhé. Shop sẽ thông báo ngay khi nhận được hàng.`,
      req.user.id);
  } else if (action === 'reject') {
    db.prepare("UPDATE warranties SET status = 'rejected' WHERE id = ?").run(w.id);
    const reasonText = String(note || '').trim();
    notifyWarrantyCustomer(w,
      `❌ Yêu cầu bảo hành đơn #${w.order_id} bị từ chối`,
      `❌ Shop rất tiếc, yêu cầu bảo hành cho đơn #${w.order_id} chưa được chấp nhận.${reasonText ? ` Lý do: ${reasonText}.` : ''} Bạn cần hỗ trợ thêm cứ nhắn cho shop nhé.`,
      req.user.id);
  } else if (action === 'received') {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const noteText = String(note || '').trim().slice(0, 500);
    db.prepare("UPDATE warranties SET status = 'received', received_note = ?, received_at = ? WHERE id = ?")
      .run(noteText, now, w.id);
    notifyWarrantyCustomer(w,
      `📥 Shop đã nhận lại hàng bảo hành của đơn #${w.order_id}`,
      `📥 Shop đã nhận lại hàng bảo hành của đơn #${w.order_id}${noteText ? `. Tình trạng hàng nhận lại: ${noteText}` : ''}. Shop đang xử lý bảo hành cho bạn.`,
      req.user.id);
  } else if (action === 'activate') {
    const n = parseInt(months);
    if (!n || n <= 0 || n > 120)
      return res.status(400).json({ error: 'Số tháng bảo hành phải từ 1 đến 120' });
    const start = today();
    const end = addMonths(start, n);
    db.prepare("UPDATE warranties SET months = ?, start_date = ?, end_date = ?, status = 'active' WHERE id = ?")
      .run(n, start, end, w.id);

    // Thông báo cho khách: chuông + tin nhắn trong chat tư vấn kèm thông tin bảo hành
    const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(w.order_id);
    if (order && order.user_id) {
      const updated = db.prepare('SELECT * FROM warranties WHERE id = ?').get(w.id);
      const detail =
        `Sản phẩm của bạn được bảo hành ${n} tháng (từ ${fmtDay(start)} đến ${fmtDay(end)}).` +
        (updated.received_note ? ` Tình trạng hàng shop đã nhận lại: ${updated.received_note}.` : '');
      try {
        db.prepare(
          'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
        ).run(order.user_id, 'warranty', `🛡️ Bảo hành đơn #${w.order_id} đã được chấp nhận`, detail, '/don-hang');
      } catch (e) { /* lỗi thông báo không làm hỏng việc cấp bảo hành */ }
      try {
        postChatNotice(
          order.user_id,
          req.user.id,
          `🛡️ Shop đã chấp nhận bảo hành cho đơn #${w.order_id}. ${detail} Cảm ơn bạn đã tin tưởng BI99!`
        );
      } catch (e) { /* lỗi thông báo không làm hỏng việc cấp bảo hành */ }
    }
  } else if (action === 'void') {
    db.prepare("UPDATE warranties SET status = 'void' WHERE id = ?").run(w.id);
    notifyWarrantyCustomer(w,
      `🛡️ Bảo hành đơn #${w.order_id} đã bị hủy`,
      `🛡️ Bảo hành của đơn #${w.order_id} đã bị hủy.${String(note || '').trim() ? ` Ghi chú: ${String(note).trim()}` : ''} Nếu bạn cần hỗ trợ thêm, cứ nhắn cho shop nhé.`,
      req.user.id);
  } else if (action === 'extend') {
    const n = parseInt(months);
    if (!n || n <= 0 || n > 120)
      return res.status(400).json({ error: 'Số tháng gia hạn phải từ 1 đến 120' });
    // Gia hạn: cộng thêm tháng vào ngày hết hạn hiện tại, kích hoạt lại nếu đã hết hạn
    const base = w.end_date && w.end_date >= today() ? w.end_date : today();
    const newEnd = addMonths(base, n);
    db.prepare("UPDATE warranties SET end_date = ?, months = months + ?, status = 'active' WHERE id = ?")
      .run(newEnd, n, w.id);
    notifyWarrantyCustomer(w,
      `🛡️ Bảo hành đơn #${w.order_id} đã được gia hạn`,
      `🛡️ Bảo hành của đơn #${w.order_id} được gia hạn thêm ${n} tháng, hiệu lực đến ${fmtDay(newEnd)}. Cảm ơn bạn đã tin tưởng BI99!`,
      req.user.id);
  }

  const warranty = db.prepare('SELECT * FROM warranties WHERE id = ?').get(w.id);
  res.json({ warranty: withImages(warranty) });
});

module.exports = router;
