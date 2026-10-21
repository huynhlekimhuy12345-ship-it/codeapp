// Đăng "thẻ yêu cầu hậu mãi" vào cuộc trò chuyện chat của khách hàng.
// - Đang có cuộc chờ (waiting) hoặc đang mở (active) -> đăng tiếp vào đúng cuộc đó.
// - Chưa có cuộc nào -> tự tạo cuộc mới ở trạng thái waiting (nhân viên thấy trong tab
//   Chat khách hàng như một yêu cầu mới) và đăng thẻ vào đó.
// Thẻ là một tin nhắn kind='aftersales' trỏ về đơn gốc (ref_type/ref_id) để giao diện
// hiển thị trạng thái xử lý trực tiếp từ đơn, không phải bản sao tĩnh.
const db = require('../db');

function postAftersalesCard(customerId, { refType, refId, content }) {
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
  ).get(customerId);
  if (!conv) {
    const info = db.prepare(
      "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
    ).run(customerId, customerId);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
      .run(conv.id, customerId);
  }
  const msg = db.prepare(
    "INSERT INTO chat_messages (conversation_id, sender_id, content, kind, ref_type, ref_id) VALUES (?, ?, ?, 'aftersales', ?, ?)"
  ).run(conv.id, customerId, content, refType, refId);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);
  // Tin hệ thống do chính khách "gửi" qua việc tạo đơn: đánh dấu khách đã đọc tới đây
  db.prepare('UPDATE conversation_participants SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?')
    .run(msg.lastInsertRowid, conv.id, customerId);
  return conv.id;
}

// Đăng một tin nhắn thông báo (vd: shop đã cấp bảo hành) vào cuộc trò chuyện của khách,
// nhân danh nhân viên thực hiện. Chưa có cuộc đang mở thì tạo cuộc chờ mới để khách thấy ngay.
function postChatNotice(customerId, senderId, content) {
  if (!customerId) return null;
  let conv = db.prepare(
    "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
  ).get(customerId);
  if (!conv) {
    const info = db.prepare(
      "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
    ).run(customerId, senderId);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
      .run(conv.id, customerId);
  }
  db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)')
    .run(conv.id, senderId, content);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);
  return conv.id;
}

module.exports = { postAftersalesCard, postChatNotice };
