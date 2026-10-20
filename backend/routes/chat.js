// Hệ thống nhắn tin BI99.
// - Chat khách hàng: khách đăng nhập gửi yêu cầu -> trạng thái waiting (ô chat của khách khóa).
//   Sale/Admin bấm Nhận -> active (tối đa 2 nhân viên/cuộc), khách được mở ô chat.
//   Nhân viên trong cuộc có thể Kết thúc -> closed.
// - Tin nhắn nội bộ: chỉ staff (admin/sale) — chat 1-1 và nhóm (tạo nhóm + thêm người).
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();
const STAFF = ['admin', 'sale'];
const isStaff = (u) => STAFF.includes(u.role);

function participants(convId) {
  return db.prepare(
    `SELECT u.id, u.name, u.role FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id = ? ORDER BY cp.joined_at`
  ).all(convId).map((p) => ({ id: p.id, name: p.name, role: p.role }));
}

function lastMessage(convId) {
  return db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1`
  ).get(convId) || null;
}

function myLastRead(convId, userId) {
  const r = db.prepare('SELECT last_read_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  return r ? r.last_read_id : null;
}

function unreadCount(convId, userId) {
  const lr = myLastRead(convId, userId);
  if (lr === null) return 0;
  const r = db.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ? AND id > ? AND sender_id != ?').get(convId, lr, userId);
  return r.n;
}

function convShape(c, meId) {
  const parts = participants(c.id);
  const cust = c.customer_id
    ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(c.customer_id)
    : null;
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    title: c.title || '',
    customer: cust ? { id: cust.id, name: cust.name } : null,
    participants: parts,
    staff_participants: parts.filter((p) => STAFF.includes(p.role)),
    last_message: lastMessage(c.id),
    unread: meId ? unreadCount(c.id, meId) : 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

function messagesOf(convId) {
  return db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name, u.role AS sender_role
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id ASC`
  ).all(convId);
}

function markRead(convId, userId) {
  const r = db.prepare('SELECT MAX(id) AS mx FROM chat_messages WHERE conversation_id = ?').get(convId);
  db.prepare('UPDATE conversation_participants SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?')
    .run(r.mx || 0, convId, userId);
}

function touch(convId) {
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
}

function getConv(id) {
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

function cleanContent(v) {
  const s = String(v || '').trim();
  return s.slice(0, 2000);
}

// ================= PHÍA KHÁCH HÀNG =================

// GET /api/chat/my — cuộc trò chuyện với shop gần nhất của tôi (kèm tin nhắn + người tham gia)
router.get('/my', auth, (req, res) => {
  const c = db.prepare(
    "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? ORDER BY id DESC LIMIT 1"
  ).get(req.user.id);
  if (!c) return res.json({ conversation: null });
  res.json({
    conversation: { ...convShape(c, req.user.id), messages: messagesOf(c.id) },
  });
});

// POST /api/chat/start {content} — gửi yêu cầu mới (hoặc nối tiếp khi đang chờ/đang mở)
router.post('/start', auth, (req, res) => {
  const content = cleanContent(req.body.content);
  if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
  let c = db.prepare(
    "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
  ).get(req.user.id);
  if (!c) {
    const info = db.prepare(
      "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
    ).run(req.user.id, req.user.id);
    c = getConv(info.lastInsertRowid);
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, req.user.id);
  }
  db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
  touch(c.id);
  markRead(c.id, req.user.id);
  res.json({ conversation: { ...convShape(c, req.user.id), messages: messagesOf(c.id) } });
});

// POST /api/chat/my/messages {content} — khách chỉ nhắn tiếp khi cuộc đã được chấp nhận (active)
router.post('/my/messages', auth, (req, res) => {
  const content = cleanContent(req.body.content);
  if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
  const c = db.prepare(
    "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).get(req.user.id);
  if (!c) return res.status(400).json({ error: 'Cuộc trò chuyện chưa được nhân viên chấp nhận' });
  db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
  touch(c.id);
  markRead(c.id, req.user.id);
  res.json({ ok: true, messages: messagesOf(c.id) });
});

// ================= PHÍA NHÂN VIÊN: CHAT KHÁCH HÀNG =================

// GET /api/chat/customer-conversations — mọi cuộc với khách (đang chờ trước, rồi đang mở, đã đóng)
router.get('/customer-conversations', auth, staffOnly, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM conversations WHERE type = 'customer'
     ORDER BY CASE status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100`
  ).all();
  res.json({ conversations: rows.map((c) => convShape(c, req.user.id)) });
});

// POST /api/chat/:id/accept — nhận cuộc đang chờ (waiting -> active) hoặc tham gia cuộc đang mở (tối đa 2 nhân viên)
router.post('/:id/accept', auth, staffOnly, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c || c.type !== 'customer') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  if (c.status === 'closed') return res.status(400).json({ error: 'Cuộc trò chuyện đã kết thúc' });
  const staff = participants(c.id).filter((p) => STAFF.includes(p.role));
  const already = staff.some((p) => p.id === req.user.id);
  if (!already && staff.length >= 2) return res.status(400).json({ error: 'Cuộc trò chuyện đã đủ 2 nhân viên' });
  if (!already) {
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, req.user.id);
  }
  if (c.status === 'waiting') {
    db.prepare("UPDATE conversations SET status = 'active' WHERE id = ?").run(c.id);
  }
  touch(c.id);
  res.json({ conversation: convShape(getConv(c.id), req.user.id) });
});

// POST /api/chat/:id/close — nhân viên trong cuộc kết thúc cuộc trò chuyện với khách
router.post('/:id/close', auth, staffOnly, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c || c.type !== 'customer') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
  db.prepare("UPDATE conversations SET status = 'closed' WHERE id = ?").run(c.id);
  touch(c.id);
  res.json({ ok: true });
});

// ================= DÙNG CHUNG: ĐỌC / GỬI / ĐÁNH DẤU ĐÃ ĐỌC =================

// GET /api/chat/:id/messages — staff xem được mọi cuộc với khách; nội bộ chỉ người trong cuộc
router.get('/:id/messages', auth, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  const isParticipant = myLastRead(c.id, req.user.id) !== null;
  if (c.type === 'internal' && !isParticipant) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
  if (c.type === 'customer' && !isParticipant && !(isStaff(req.user) || c.customer_id === req.user.id)) {
    return res.status(403).json({ error: 'Không có quyền xem' });
  }
  if (isParticipant) markRead(c.id, req.user.id);
  res.json({ conversation: convShape(c, req.user.id), messages: messagesOf(c.id) });
});

// POST /api/chat/:id/messages {content}
router.post('/:id/messages', auth, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  const content = cleanContent(req.body.content);
  if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
  const isParticipant = myLastRead(c.id, req.user.id) !== null;
  if (c.type === 'customer') {
    if (c.status !== 'active') return res.status(400).json({ error: 'Cuộc trò chuyện chưa mở hoặc đã kết thúc' });
    if (isStaff(req.user)) {
      if (!isParticipant) return res.status(403).json({ error: 'Hãy bấm Nhận/Tham gia trước khi nhắn' });
    } else if (c.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
  } else if (!isParticipant) {
    return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
  }
  db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
  touch(c.id);
  markRead(c.id, req.user.id);
  res.json({ ok: true, messages: messagesOf(c.id) });
});

// POST /api/chat/:id/read — đánh dấu đã đọc tới tin mới nhất
router.post('/:id/read', auth, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
  markRead(c.id, req.user.id);
  res.json({ ok: true });
});

// ================= TIN NHẮN NỘI BỘ (STAFF) =================

// GET /api/chat/internal — các cuộc nội bộ của tôi + danh sách nhân viên
router.get('/internal', auth, staffOnly, (req, res) => {
  const rows = db.prepare(
    `SELECT c.* FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND cp.user_id = ?
     ORDER BY c.updated_at DESC`
  ).all(req.user.id);
  const staff = db.prepare(
    "SELECT id, name, role FROM users WHERE role IN ('admin','sale') AND id != ? ORDER BY role, name"
  ).all(req.user.id).map((u) => ({ id: u.id, name: u.name, role: u.role }));
  res.json({ conversations: rows.map((c) => convShape(c, req.user.id)), staff });
});

// POST /api/chat/internal/direct {user_id} — mở (hoặc tạo) cuộc 1-1 với 1 nhân viên
router.post('/internal/direct', auth, staffOnly, (req, res) => {
  const target = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(Number(req.body.user_id));
  if (!target || !STAFF.includes(target.role) || target.id === req.user.id) {
    return res.status(400).json({ error: 'Người nhận không hợp lệ' });
  }
  const mine = db.prepare(
    `SELECT c.* FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND c.title = '' AND cp.user_id = ?`
  ).all(req.user.id);
  for (const c of mine) {
    const ids = participants(c.id).map((p) => p.id).sort((a, b) => a - b);
    if (ids.length === 2 && ids[0] === Math.min(req.user.id, target.id) && ids[1] === Math.max(req.user.id, target.id)) {
      return res.json({ conversation: convShape(c, req.user.id) });
    }
  }
  const info = db.prepare(
    "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', '', ?, 'active')"
  ).run(req.user.id);
  const conv = getConv(info.lastInsertRowid);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, req.user.id);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, target.id);
  res.json({ conversation: convShape(conv, req.user.id) });
});

// POST /api/chat/internal/group {title, member_ids[]} — tạo nhóm nội bộ
router.post('/internal/group', auth, staffOnly, (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: 'Hãy đặt tên nhóm' });
  const ids = [...new Set((req.body.member_ids || []).map(Number).filter((n) => Number.isFinite(n) && n !== req.user.id))];
  const valid = ids.filter((id) => {
    const u = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
    return u && STAFF.includes(u.role);
  });
  if (valid.length === 0) return res.status(400).json({ error: 'Hãy chọn ít nhất 1 thành viên' });
  const info = db.prepare(
    "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', ?, ?, 'active')"
  ).run(title, req.user.id);
  const conv = getConv(info.lastInsertRowid);
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, req.user.id);
  const ins = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
  valid.forEach((id) => ins.run(conv.id, id));
  res.json({ conversation: convShape(conv, req.user.id) });
});

// POST /api/chat/:id/members {user_id} — thêm nhân viên vào cuộc nội bộ (nhóm)
router.post('/:id/members', auth, staffOnly, (req, res) => {
  const c = getConv(Number(req.params.id));
  if (!c || c.type !== 'internal') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
  if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(req.body.user_id));
  if (!target || !STAFF.includes(target.role)) return res.status(400).json({ error: 'Người được thêm không hợp lệ' });
  if (myLastRead(c.id, target.id) !== null) return res.status(400).json({ error: 'Người này đã ở trong nhóm' });
  db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, target.id);
  res.json({ conversation: convShape(c, req.user.id) });
});

// GET /api/chat/staff-summary — số liệu cho ô đỏ ở thanh bên quản trị
router.get('/staff-summary', auth, staffOnly, (req, res) => {
  const w = db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE type = 'customer' AND status = 'waiting'").get();
  const mine = db.prepare(
    `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND cp.user_id = ?`
  ).all(req.user.id);
  const internalUnread = mine.reduce((s, c) => s + unreadCount(c.id, req.user.id), 0);
  const myCust = db.prepare(
    `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'customer' AND cp.user_id = ? AND c.status = 'active'`
  ).all(req.user.id);
  const customerUnread = myCust.reduce((s, c) => s + unreadCount(c.id, req.user.id), 0);
  res.json({ waiting: w.n, internal_unread: internalUnread, customer_unread: customerUnread });
});

module.exports = router;
