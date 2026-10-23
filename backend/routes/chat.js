// Hệ thống nhắn tin BI99.
// - Chat khách hàng: khách đăng nhập gửi yêu cầu -> trạng thái waiting (ô chat của khách khóa).
//   Sale/Admin bấm Nhận -> active (tối đa 2 nhân viên/cuộc), khách được mở ô chat.
//   Nhân viên trong cuộc có thể Kết thúc -> closed.
// - Tin nhắn nội bộ: chỉ staff (admin/sale) — chat 1-1 và nhóm (tạo nhóm + thêm người).
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');
const { parseImages } = require('../lib/images');

const router = express.Router();
const STAFF = ['admin', 'sale'];
const isStaff = (u) => STAFF.includes(u.role);

async function participants(convId) {
  return (await db.prepare(
    `SELECT u.id, u.name, u.role FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id = ? ORDER BY cp.joined_at`
  ).all(convId)).map((p) => ({ id: p.id, name: p.name, role: p.role }));
}

async function lastMessage(convId) {
  return await db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1`
  ).get(convId) || null;
}

async function myLastRead(convId, userId) {
  const r = await db.prepare('SELECT last_read_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  return r ? r.last_read_id : null;
}

async function unreadCount(convId, userId) {
  const lr = await myLastRead(convId, userId);
  if (lr === null) return 0;
  const r = await db.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ? AND id > ? AND sender_id != ?').get(convId, lr, userId);
  return r.n;
}

async function convShape(c, meId) {
  const parts = await participants(c.id);
  const cust = c.customer_id
    ? await db.prepare('SELECT id, name FROM users WHERE id = ?').get(c.customer_id)
    : null;
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    title: c.title || '',
    customer: cust ? { id: cust.id, name: cust.name } : null,
    participants: parts,
    staff_participants: parts.filter((p) => STAFF.includes(p.role)),
    last_message: await lastMessage(c.id),
    unread: meId ? await unreadCount(c.id, meId) : 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

async function messagesOf(convId) {
  const rows = await db.prepare(
    `SELECT m.id, m.sender_id, m.content, m.kind, m.ref_type, m.ref_id, m.created_at,
            u.name AS sender_name, u.role AS sender_role
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id ASC`
  ).all(convId);
  return enrichAftersales(rows);
}

// Tin nhắn thẻ hậu mãi (kind='aftersales'): gắn thông tin TRỰC TIẾP từ đơn gốc
// (lý do, ảnh, trạng thái mới nhất) để thẻ luôn đúng hiện trạng, không lưu bản sao tĩnh.
async function enrichAftersales(messages) {
  const retIds = [...new Set(messages.filter((m) => m.kind === 'aftersales' && m.ref_type === 'return' && m.ref_id).map((m) => m.ref_id))];
  const warIds = [...new Set(messages.filter((m) => m.kind === 'aftersales' && m.ref_type === 'warranty' && m.ref_id).map((m) => m.ref_id))];
  const rets = {};
  const wars = {};
  if (retIds.length) {
    (await db.prepare(`SELECT * FROM returns WHERE id IN (${retIds.map(() => '?').join(',')})`)
      .all(...retIds)).forEach((r) => { rets[r.id] = r; });
  }
  if (warIds.length) {
    (await db.prepare(`SELECT * FROM warranties WHERE id IN (${warIds.map(() => '?').join(',')})`)
      .all(...warIds)).forEach((w) => { wars[w.id] = w; });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const m of messages) {
    if (m.kind !== 'aftersales') continue;
    if (m.ref_type === 'return' && rets[m.ref_id]) {
      const r = rets[m.ref_id];
      m.aftersales = {
        ref_type: 'return', id: r.id, order_id: r.order_id, type: r.type,
        reason: r.reason, images: parseImages(r.images), status: r.status,
      };
    } else if (m.ref_type === 'warranty' && wars[m.ref_id]) {
      const w = wars[m.ref_id];
      m.aftersales = {
        ref_type: 'warranty', id: w.id, order_id: w.order_id, months: w.months,
        reason: w.reason || '', images: parseImages(w.images),
        status: w.status === 'active'
          ? (w.end_date && w.end_date < todayStr ? 'expired' : 'active')
          : w.status,
        end_date: w.end_date,
        received_note: w.received_note || '',
        received_at: w.received_at || null,
      };
    }
  }
  return messages;
}

async function markRead(convId, userId) {
  const r = await db.prepare('SELECT MAX(id) AS mx FROM chat_messages WHERE conversation_id = ?').get(convId);
  await db.prepare('UPDATE conversation_participants SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?')
    .run(r.mx || 0, convId, userId);
}

async function touch(convId) {
  await db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
}

async function getConv(id) {
  return await db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

function cleanContent(v) {
  const s = String(v || '').trim();
  return s.slice(0, 2000);
}

// ================= PHÍA KHÁCH HÀNG =================

// GET /api/chat/my — cuộc trò chuyện với shop gần nhất của tôi (kèm tin nhắn + người tham gia)
router.get('/my', auth, async (req, res) => {
  try {
    const c = await db.prepare(
      "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? ORDER BY id DESC LIMIT 1"
    ).get(req.user.id);
    if (!c) return res.json({ conversation: null });
    res.json({
      conversation: { ...(await convShape(c, req.user.id)), messages: await messagesOf(c.id) },
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/start {content} — gửi yêu cầu mới (hoặc nối tiếp khi đang chờ/đang mở)
router.post('/start', auth, async (req, res) => {
  try {
    const content = cleanContent(req.body.content);
    if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
    let c = await db.prepare(
      "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
    ).get(req.user.id);
    if (!c) {
      const info = await db.prepare(
        "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
      ).run(req.user.id, req.user.id);
      c = await getConv(info.lastInsertRowid);
      await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, req.user.id);
    }
    await db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
    await touch(c.id);
    await markRead(c.id, req.user.id);
    res.json({ conversation: { ...(await convShape(c, req.user.id)), messages: await messagesOf(c.id) } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/my/messages {content} — khách chỉ nhắn tiếp khi cuộc đã được chấp nhận (active)
router.post('/my/messages', auth, async (req, res) => {
  try {
    const content = cleanContent(req.body.content);
    if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
    const c = await db.prepare(
      "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
    ).get(req.user.id);
    if (!c) return res.status(400).json({ error: 'Cuộc trò chuyện chưa được nhân viên chấp nhận' });
    await db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
    await touch(c.id);
    await markRead(c.id, req.user.id);
    res.json({ ok: true, messages: await messagesOf(c.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ================= PHÍA NHÂN VIÊN: CHAT KHÁCH HÀNG =================

// GET /api/chat/customer-conversations — mọi cuộc với khách (đang chờ trước, rồi đang mở, đã đóng)
router.get('/customer-conversations', auth, staffOnly, async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT * FROM conversations WHERE type = 'customer'
       ORDER BY CASE status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100`
    ).all();
    res.json({ conversations: await Promise.all(rows.map((c) => convShape(c, req.user.id))) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/:id/accept — nhận cuộc đang chờ (waiting -> active) hoặc tham gia cuộc đang mở (tối đa 2 nhân viên)
router.post('/:id/accept', auth, staffOnly, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c || c.type !== 'customer') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (c.status === 'closed') return res.status(400).json({ error: 'Cuộc trò chuyện đã kết thúc' });
    const staff = (await participants(c.id)).filter((p) => STAFF.includes(p.role));
    const already = staff.some((p) => p.id === req.user.id);
    if (!already && staff.length >= 2) return res.status(400).json({ error: 'Cuộc trò chuyện đã đủ 2 nhân viên' });
    if (!already) {
      await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, req.user.id);
    }
    if (c.status === 'waiting') {
      await db.prepare("UPDATE conversations SET status = 'active' WHERE id = ?").run(c.id);
    }
    await touch(c.id);
    res.json({ conversation: await convShape(await getConv(c.id), req.user.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/:id/close — nhân viên trong cuộc kết thúc cuộc trò chuyện với khách
router.post('/:id/close', auth, staffOnly, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c || c.type !== 'customer') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (await myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
    await db.prepare("UPDATE conversations SET status = 'closed' WHERE id = ?").run(c.id);
    await touch(c.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ================= DÙNG CHUNG: ĐỌC / GỬI / ĐÁNH DẤU ĐÃ ĐỌC =================

// GET /api/chat/:id/messages — staff xem được mọi cuộc với khách; nội bộ chỉ người trong cuộc
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    const isParticipant = await myLastRead(c.id, req.user.id) !== null;
    if (c.type === 'internal' && !isParticipant) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
    if (c.type === 'customer' && !isParticipant && !(isStaff(req.user) || c.customer_id === req.user.id)) {
      return res.status(403).json({ error: 'Không có quyền xem' });
    }
    if (isParticipant) await markRead(c.id, req.user.id);
    res.json({ conversation: await convShape(c, req.user.id), messages: await messagesOf(c.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/:id/messages {content}
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    const content = cleanContent(req.body.content);
    if (!content) return res.status(400).json({ error: 'Nội dung tin nhắn trống' });
    const isParticipant = await myLastRead(c.id, req.user.id) !== null;
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
    await db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(c.id, req.user.id, content);
    await touch(c.id);
    await markRead(c.id, req.user.id);
    res.json({ ok: true, messages: await messagesOf(c.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/:id/read — đánh dấu đã đọc tới tin mới nhất
router.post('/:id/read', auth, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (await myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
    await markRead(c.id, req.user.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ================= TIN NHẮN NỘI BỘ (STAFF) =================

// GET /api/chat/internal — các cuộc nội bộ của tôi + danh sách nhân viên
router.get('/internal', auth, staffOnly, async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.type = 'internal' AND cp.user_id = ?
       ORDER BY c.updated_at DESC`
    ).all(req.user.id);
    const staff = (await db.prepare(
      "SELECT id, name, role FROM users WHERE role IN ('admin','sale') AND id != ? ORDER BY role, name"
    ).all(req.user.id)).map((u) => ({ id: u.id, name: u.name, role: u.role }));
    res.json({ conversations: await Promise.all(rows.map((c) => convShape(c, req.user.id))), staff });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/internal/direct {user_id} — mở (hoặc tạo) cuộc 1-1 với 1 nhân viên
router.post('/internal/direct', auth, staffOnly, async (req, res) => {
  try {
    const target = await db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(Number(req.body.user_id));
    if (!target || !STAFF.includes(target.role) || target.id === req.user.id) {
      return res.status(400).json({ error: 'Người nhận không hợp lệ' });
    }
    const mine = await db.prepare(
      `SELECT c.* FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.type = 'internal' AND c.title = '' AND cp.user_id = ?`
    ).all(req.user.id);
    for (const c of mine) {
      const ids = (await participants(c.id)).map((p) => p.id).sort((a, b) => a - b);
      if (ids.length === 2 && ids[0] === Math.min(req.user.id, target.id) && ids[1] === Math.max(req.user.id, target.id)) {
        return res.json({ conversation: await convShape(c, req.user.id) });
      }
    }
    const info = await db.prepare(
      "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', '', ?, 'active')"
    ).run(req.user.id);
    const conv = await getConv(info.lastInsertRowid);
    await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, req.user.id);
    await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, target.id);
    res.json({ conversation: await convShape(conv, req.user.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/internal/group {title, member_ids[]} — tạo nhóm nội bộ
router.post('/internal/group', auth, staffOnly, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 80);
    if (!title) return res.status(400).json({ error: 'Hãy đặt tên nhóm' });
    const ids = [...new Set((req.body.member_ids || []).map(Number).filter((n) => Number.isFinite(n) && n !== req.user.id))];
    const valid = [];
    for (const id of ids) {
      const u = await db.prepare('SELECT role FROM users WHERE id = ?').get(id);
      if (u && STAFF.includes(u.role)) valid.push(id);
    }
    if (valid.length === 0) return res.status(400).json({ error: 'Hãy chọn ít nhất 1 thành viên' });
    const info = await db.prepare(
      "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', ?, ?, 'active')"
    ).run(title, req.user.id);
    const conv = await getConv(info.lastInsertRowid);
    await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(conv.id, req.user.id);
    const ins = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)');
    for (const id of valid) await ins.run(conv.id, id);
    res.json({ conversation: await convShape(conv, req.user.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/chat/:id/members {user_id} — thêm nhân viên vào cuộc nội bộ (nhóm)
router.post('/:id/members', auth, staffOnly, async (req, res) => {
  try {
    const c = await getConv(Number(req.params.id));
    if (!c || c.type !== 'internal') return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện' });
    if (await myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: 'Bạn không ở trong cuộc trò chuyện này' });
    const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(req.body.user_id));
    if (!target || !STAFF.includes(target.role)) return res.status(400).json({ error: 'Người được thêm không hợp lệ' });
    if (await myLastRead(c.id, target.id) !== null) return res.status(400).json({ error: 'Người này đã ở trong nhóm' });
    await db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)').run(c.id, target.id);
    res.json({ conversation: await convShape(c, req.user.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/chat/staff-summary — số liệu cho ô đỏ ở thanh bên quản trị
router.get('/staff-summary', auth, staffOnly, async (req, res) => {
  try {
    const w = await db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE type = 'customer' AND status = 'waiting'").get();
    const mine = await db.prepare(
      `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.type = 'internal' AND cp.user_id = ?`
    ).all(req.user.id);
    let internalUnread = 0;
    for (const c of mine) internalUnread += await unreadCount(c.id, req.user.id);
    const myCust = await db.prepare(
      `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.type = 'customer' AND cp.user_id = ? AND c.status = 'active'`
    ).all(req.user.id);
    let customerUnread = 0;
    for (const c of myCust) customerUnread += await unreadCount(c.id, req.user.id);
    res.json({ waiting: w.n, internal_unread: internalUnread, customer_unread: customerUnread });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
