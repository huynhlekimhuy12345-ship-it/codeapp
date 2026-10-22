// Sự kiện SĂN THẺ trên trang Khuyến mãi.
// - Chỉ ADMIN tạo/phát hành sự kiện (adminOnly); sale không có quyền.
// - Một sự kiện gồm nhiều LOẠI thẻ; mỗi loại: % giảm (tối đa 20%), hạn dùng
//   (tối đa 7 ngày kể từ giờ mở săn) và số lượng phát hành giới hạn.
// - Trong khung giờ săn, khách đã đăng nhập bấm "Lưu thẻ": mỗi khách tối đa
//   1 thẻ mỗi loại; hết số lượng thì loại đó chuyển "Đã hết thẻ", không lưu được nữa.
// - Thẻ săn lưu vào discount_cards (source='hunt') — dùng ở thanh toán như thẻ tháng:
//   còn hạn + chưa dùng là dùng được, giảm % cho 1 món đắt nhất, không cộng dồn.
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

const MAX_PERCENT = 20;
const MAX_DAYS = 7;

// Chuẩn hoá thời gian về 'YYYY-MM-DD HH:MM:SS' (giờ địa phương) để so sánh chuỗi với datetime('now','localtime')
function normTime(v) {
  const s = String(v || '').trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s + ':00';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}
// "Bây giờ" theo giờ địa phương của tiến trình (JS) — KHÔNG dùng datetime('now','localtime')
// của SQLite vì trên một số máy giá trị đó lệch với giờ JS, làm giờ mở săn bị sai.
function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Hạn dùng của thẻ thuộc loại này: cuối ngày (giờ mở săn + valid_days ngày)
function typeExpiry(event, type) {
  const start = new Date(String(event.starts_at).replace(' ', 'T'));
  start.setDate(start.getDate() + type.valid_days);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d} 23:59:59`;
}

function claimedCount(typeId) {
  return db.prepare('SELECT COUNT(*) AS c FROM discount_cards WHERE hunt_type_id = ?').get(typeId).c;
}

function eventWithTypes(event, userId) {
  const types = db.prepare('SELECT * FROM hunt_card_types WHERE event_id = ? ORDER BY percent DESC, id').all(event.id);
  const now = nowLocal();
  const phase = event.status !== 'active' ? 'closed'
    : now < event.starts_at ? 'upcoming'
    : now > event.ends_at ? 'ended' : 'live';
  return {
    ...event,
    phase,
    types: types.map((tp) => {
      const claimed = claimedCount(tp.id);
      const mine = userId
        ? !!db.prepare('SELECT 1 FROM discount_cards WHERE hunt_type_id = ? AND user_id = ?').get(tp.id, userId)
        : false;
      return { ...tp, claimed, remaining: Math.max(0, tp.quantity - claimed), claimed_by_me: mine };
    }),
  };
}

// Sinh danh sách loại thẻ ngẫu nhiên: loại đầu hiếm nhất (% cao nhất, hạn ngắn nhất),
// càng về sau % càng thấp, hạn càng dài — độ hiếm giảm dần theo % và số ngày.
// Số thẻ của từng loại CŨNG ngẫu nhiên (tối đa 10): thẻ càng hiếm càng ít thẻ.
function randomTypes(count) {
  const n = Math.max(1, Math.min(20, parseInt(count) || 10));
  const types = [];
  for (let i = 0; i < n; i++) {
    const ratio = n === 1 ? 0 : i / (n - 1); // 0 = hiếm nhất, 1 = thường nhất
    const percent = Math.max(5, Math.round(MAX_PERCENT - ratio * (MAX_PERCENT - 5)));
    let days; let qty;
    if (percent >= 18) { days = 1 + Math.floor(Math.random() * 2); qty = 1 + Math.floor(Math.random() * 3); }        // 1-2 ngày · 1-3 thẻ
    else if (percent >= 14) { days = 2 + Math.floor(Math.random() * 2); qty = 2 + Math.floor(Math.random() * 4); }   // 2-3 ngày · 2-5 thẻ
    else if (percent >= 10) { days = 3 + Math.floor(Math.random() * 3); qty = 3 + Math.floor(Math.random() * 5); }   // 3-5 ngày · 3-7 thẻ
    else { days = 5 + Math.floor(Math.random() * 3); qty = 5 + Math.floor(Math.random() * 6); }                       // 5-7 ngày · 5-10 thẻ
    const label = percent >= 18 ? 'Cực hiếm' : percent >= 14 ? 'Hiếm' : percent >= 10 ? 'May mắn' : 'Thường';
    types.push({ label, percent, valid_days: Math.min(MAX_DAYS, days), quantity: qty });
  }
  return types;
}

// GET /api/hunt-events/active — sự kiện đang mở/ sắp mở cho trang Khuyến mãi.
// Khách đã đăng nhập (gửi token) sẽ thấy thêm claimed_by_me của từng loại.
router.get('/active', (req, res) => {
  let userId = null;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      userId = jwt.verify(h.slice(7), JWT_SECRET).id;
    } catch (e) { /* khách vãng lai */ }
  }
  const rows = db.prepare(
    "SELECT * FROM hunt_events WHERE status = 'active' AND ends_at >= ? ORDER BY starts_at"
  ).all(nowLocal());
  res.json({ events: rows.map((ev) => eventWithTypes(ev, userId)) });
});

// POST /api/hunt-events/:id/claim { type_id } — khách lưu 1 thẻ của 1 loại về tài khoản
router.post('/:id/claim', auth, (req, res) => {
  const typeId = parseInt((req.body || {}).type_id);
  if (!typeId) return res.status(400).json({ error: 'Thiếu loại thẻ' });

  const result = db.transaction(() => {
    const event = db.prepare('SELECT * FROM hunt_events WHERE id = ?').get(req.params.id);
    if (!event || event.status !== 'active')
      throw new Error('Sự kiện không tồn tại hoặc đã đóng');
    const now = nowLocal();
    if (now < event.starts_at) throw new Error('Chưa tới giờ mở săn, bạn quay lại sau nhé');
    if (now > event.ends_at) throw new Error('Sự kiện săn thẻ đã kết thúc');
    const type = db.prepare('SELECT * FROM hunt_card_types WHERE id = ? AND event_id = ?').get(typeId, event.id);
    if (!type) throw new Error('Loại thẻ không thuộc sự kiện này');
    const mine = db.prepare('SELECT 1 FROM discount_cards WHERE hunt_type_id = ? AND user_id = ?').get(type.id, req.user.id);
    if (mine) throw new Error('Mỗi khách chỉ lưu được 1 thẻ của loại này');
    if (claimedCount(type.id) >= type.quantity)
      throw new Error('Loại thẻ này đã hết, bạn chọn loại khác nhé');

    const expires = typeExpiry(event, type);
    let code;
    let tries = 0;
    do {
      code = `BI99-HUNT-${event.id}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    } while (db.prepare('SELECT 1 FROM discount_cards WHERE code = ?').get(code) && ++tries < 10);
    const info = db.prepare(
      `INSERT INTO discount_cards (user_id, code, percent, tier, period, status, expires_at, source, hunt_event_id, hunt_type_id)
       VALUES (?, ?, ?, 'hunt', ?, 'unused', ?, 'hunt', ?, ?)`
    ).run(req.user.id, code, type.percent, String(event.starts_at).slice(0, 7), expires, event.id, type.id);
    return db.prepare('SELECT * FROM discount_cards WHERE id = ?').get(info.lastInsertRowid);
  });

  let card;
  try {
    card = result();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    ).run(
      req.user.id, 'hunt_card',
      `🎯 Bạn đã săn được thẻ giảm ${card.percent}%!`,
      `Thẻ ${card.code} giảm ${card.percent}% cho 1 sản phẩm (món đắt nhất trong đơn), dùng được đến ${String(card.expires_at).slice(0, 10).split('-').reverse().join('/')}. Xem thẻ trong trang Hạng của tôi.`,
      '/hang-cua-toi'
    );
  } catch (e) { /* lỗi thông báo không làm hỏng việc lưu thẻ */ }

  res.status(201).json({ card });
});

/* ---------------- Chỉ ADMIN ---------------- */

// GET /api/hunt-events/admin — mọi sự kiện + thống kê đã săn
router.get('/admin', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM hunt_events ORDER BY id DESC').all();
  res.json({ events: rows.map((ev) => eventWithTypes(ev, null)) });
});

// POST /api/hunt-events/admin/random-preview { count } — xem trước bộ thẻ random
// (số thẻ từng loại cũng random theo độ hiếm, tối đa 10)
router.post('/admin/random-preview', auth, adminOnly, (req, res) => {
  const { count } = req.body || {};
  res.json({ types: randomTypes(count) });
});

// POST /api/hunt-events/admin — tạo + phát hành sự kiện
// body: { name, starts_at, ends_at, mode: 'manual'|'random', types?, type_count?, per_type_qty? }
router.post('/admin', auth, adminOnly, (req, res) => {
  const { name, mode } = req.body || {};
  const starts = normTime(req.body && req.body.starts_at);
  const ends = normTime(req.body && req.body.ends_at);
  if (!(name || '').trim()) return res.status(400).json({ error: 'Nhập tên sự kiện' });
  if (!starts || !ends) return res.status(400).json({ error: 'Giờ mở săn / giờ kết thúc không hợp lệ' });
  if (ends <= starts) return res.status(400).json({ error: 'Giờ kết thúc phải sau giờ mở săn' });

  let types;
  if (mode === 'random') {
    types = randomTypes(req.body.type_count);
  } else {
    types = Array.isArray(req.body.types) ? req.body.types : [];
    if (!types.length) return res.status(400).json({ error: 'Sự kiện phải có ít nhất 1 loại thẻ' });
    for (const tp of types) {
      const p = parseInt(tp.percent);
      const d = parseInt(tp.valid_days);
      const q = parseInt(tp.quantity);
      if (!p || p < 1 || p > MAX_PERCENT)
        return res.status(400).json({ error: `% giảm của mỗi loại phải từ 1 đến ${MAX_PERCENT}%` });
      if (!d || d < 1 || d > MAX_DAYS)
        return res.status(400).json({ error: `Hạn dùng của mỗi loại phải từ 1 đến ${MAX_DAYS} ngày` });
      if (!q || q < 1)
        return res.status(400).json({ error: 'Số lượng mỗi loại phải từ 1 trở lên' });
    }
    types = types.map((tp) => ({
      label: String(tp.label || 'Thẻ săn sale').slice(0, 40),
      percent: parseInt(tp.percent),
      valid_days: parseInt(tp.valid_days),
      quantity: parseInt(tp.quantity),
    }));
  }

  const id = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO hunt_events (name, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), starts, ends, req.user.id);
    const eventId = info.lastInsertRowid;
    const ins = db.prepare(
      'INSERT INTO hunt_card_types (event_id, label, percent, valid_days, quantity) VALUES (?, ?, ?, ?, ?)'
    );
    for (const tp of types) ins.run(eventId, tp.label, tp.percent, tp.valid_days, tp.quantity);
    return eventId;
  })();

  const event = db.prepare('SELECT * FROM hunt_events WHERE id = ?').get(id);

  // Thông báo cho MỌI khách hàng ngay khi sự kiện được phát hành (kể cả đặt trước
  // trong tương lai): chuông kèm link sang trang Khuyến mãi để khách đếm ngược chờ
  // mở săn; khách đang có cuộc chat mở với shop còn nhận thêm tin nhắn trong chat.
  try {
    const fmtT = (s) => `${String(s).slice(11, 16)} ngày ${String(s).slice(0, 10).split('-').reverse().join('/')}`;
    const maxPercent = Math.max(...types.map((x) => x.percent));
    const totalCards = types.reduce((n, x) => n + x.quantity, 0);
    const title = `🎯 Sự kiện săn thẻ: ${event.name}`;
    const content = `Sự kiện "${event.name}" sẽ mở săn lúc ${fmtT(event.starts_at)} — tổng ${totalCards} thẻ, giảm tới ${maxPercent}% cho 1 sản phẩm. Vào trang Khuyến mãi để đếm ngược và săn thẻ ngay khi mở!`;
    const customers = db.prepare("SELECT id FROM users WHERE role = 'customer'").all();
    const insNotif = db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    );
    db.transaction(() => {
      for (const c of customers) insNotif.run(c.id, 'hunt_event', title, content, '/khuyen-mai');
    })();
    // Tin nhắn chat chỉ đăng cho khách ĐANG có cuộc trò chuyện mở với shop,
    // không tự tạo cuộc mới hàng loạt để tránh rác tab chat của nhân viên.
    const { postChatNotice } = require('../lib/chatCard');
    for (const c of customers) {
      const conv = db.prepare(
        "SELECT id FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active')"
      ).get(c.id);
      if (conv) {
        try { postChatNotice(c.id, req.user.id, `🎯 ${content}`); } catch (e) { /* bỏ qua từng khách */ }
      }
    }
  } catch (e) { /* lỗi thông báo không làm hỏng việc tạo sự kiện */ }

  res.status(201).json({ event: eventWithTypes(event, null) });
});

// PUT /api/hunt-events/admin/:id — đóng / mở lại sự kiện
router.put('/admin/:id', auth, adminOnly, (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'closed'].includes(status))
    return res.status(400).json({ error: 'status phải là active / closed' });
  const event = db.prepare('SELECT * FROM hunt_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  db.prepare('UPDATE hunt_events SET status = ? WHERE id = ?').run(status, event.id);
  res.json({ event: eventWithTypes({ ...event, status }, null) });
});

// DELETE /api/hunt-events/admin/:id — chỉ xóa khi chưa có khách nào lưu thẻ
router.delete('/admin/:id', auth, adminOnly, (req, res) => {
  const event = db.prepare('SELECT * FROM hunt_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const claimed = db.prepare('SELECT COUNT(*) AS c FROM discount_cards WHERE hunt_event_id = ?').get(event.id).c;
  if (claimed > 0)
    return res.status(400).json({ error: 'Đã có khách lưu thẻ của sự kiện này — chỉ có thể Đóng, không xóa được' });
  db.transaction(() => {
    db.prepare('DELETE FROM hunt_card_types WHERE event_id = ?').run(event.id);
    db.prepare('DELETE FROM hunt_events WHERE id = ?').run(event.id);
  })();
  res.json({ ok: true });
});

module.exports = router;
