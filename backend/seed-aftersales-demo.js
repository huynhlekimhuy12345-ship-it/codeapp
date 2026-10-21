// Script tạo DỮ LIỆU MẪU HẬU MÃI cho web BI99 — chạy tay bằng lệnh:
//   node seed-aftersales-demo.js        (trong thư mục backend)
// Điều kiện: đã chạy seed-customers.js trước (cần các khách ảo @demo.vn + đơn đã giao).
// Tạo sẵn: 5 yêu cầu bảo hành ở đủ trạng thái (chờ duyệt / đã chấp nhận / đã nhận hàng /
// đang hiệu lực / từ chối) + 2 yêu cầu đổi/trả, mỗi yêu cầu có lý do + ảnh minh họa mẫu,
// đồng thời có thẻ trong chat tư vấn của đúng khách như luồng thật.
// Chạy lại nhiều lần an toàn: mục nào đã có (trùng đơn + lý do) sẽ bị bỏ qua.
const zlib = require('zlib');
const db = require('./db');
const { postAftersalesCard, postChatNotice } = require('./lib/chatCard');

/* ---------- Sinh ảnh mẫu (PNG) bằng mã thuần — tông da nâu + vết xước/nứt minh họa ---------- */
function crc32(buf) {
  if (!crc32.t) {
    crc32.t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crc32.t[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function makeImage(defect) {
  const W = 320, H = 240;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const t = y / H;
      let r = lerp(126, 82, t), g = lerp(82, 50, t), b = lerp(46, 27, t);
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const s = (n % 13) - 6;
      r += s; g += s; b += s;
      // Đường may ngang (chỉ sáng đứt đoạn) ở 1/3 dưới ảnh
      if (y === 168 && x % 14 < 9) { r += 58; g += 44; b += 22; }
      if (defect === 'scratch') {
        // Vệt xước sáng chéo
        const d = Math.abs((x * 0.6 + 40) - y);
        if (d < 2.2 && x > 60 && x < 280) { r += 74; g += 58; b += 30; }
        const d2 = Math.abs((x * 0.6 + 66) - y);
        if (d2 < 1.4 && x > 90 && x < 250) { r += 52; g += 40; b += 20; }
      } else if (defect === 'crack') {
        // Vết nứt tối chạy zíc-zắc
        const mid = 120 + Math.sin(x / 22) * 16 + ((x * 7) % 13) - 6;
        if (Math.abs(y - mid) < 2.4) { r -= 46; g -= 34; b -= 20; }
      } else if (defect === 'scuff') {
        // Góc dưới-phải bị sờn (sáng lên, mất màu)
        const dx = (x - 268) / 62, dy = (y - 196) / 48;
        if (dx * dx + dy * dy < 1) { r += 46; g += 34; b += 16; }
      }
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = Math.max(0, Math.min(255, r));
      raw[o + 1] = Math.max(0, Math.min(255, g));
      raw[o + 2] = Math.max(0, Math.min(255, b));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}
const IMG_SCRATCH = makeImage('scratch');
const IMG_CRACK = makeImage('crack');
const IMG_SCUFF = makeImage('scuff');

/* ---------- Tiện ích ---------- */
const getUser = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
function deliveredOrder(userId, avoidWarranty, avoidReturn) {
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? AND status = 'delivered' ORDER BY id").all(userId);
  for (const o of orders) {
    if (avoidWarranty && db.prepare("SELECT id FROM warranties WHERE order_id = ? AND status IN ('requested','accepted','received','active')").get(o.id)) continue;
    if (avoidReturn && db.prepare("SELECT id FROM returns WHERE order_id = ? AND status IN ('requested','approved')").get(o.id)) continue;
    return o;
  }
  return orders[0] || null;
}
const fmtDay = (d) => String(d).slice(0, 10).split('-').reverse().join('/');
function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ---------- Các mục dữ liệu mẫu ---------- */
const report = [];
function note(msg) { report.push(msg); console.log(' -', msg); }

function seedReturn({ email, type, reason, images, finalStatus }) {
  const u = getUser(email);
  if (!u) return note(`BỎ QUA đổi/trả (${email}): chưa có khách ảo — hãy chạy seed-customers.js trước`);
  const dup = db.prepare(
    'SELECT r.id FROM returns r JOIN orders o ON o.id = r.order_id WHERE o.user_id = ? AND r.reason = ?'
  ).get(u.id, reason);
  if (dup) return note(`Đã có sẵn: ${type === 'exchange' ? 'đổi' : 'trả'} hàng của ${u.name}`);
  const order = deliveredOrder(u.id, false, true);
  if (!order) return note(`BỎ QUA đổi/trả (${email}): khách chưa có đơn đã giao`);
  const info = db.prepare('INSERT INTO returns (order_id, type, reason, images) VALUES (?, ?, ?, ?)')
    .run(order.id, type, reason, JSON.stringify(images));
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(info.lastInsertRowid);
  const label = type === 'exchange' ? '🔄 Yêu cầu đổi hàng' : '↩️ Yêu cầu trả hàng';
  postAftersalesCard(u.id, { refType: 'return', refId: ret.id, content: `${label} — Đơn #${order.id}: ${reason.slice(0, 200)}` });
  if (finalStatus && finalStatus !== 'requested') {
    db.prepare('UPDATE returns SET status = ? WHERE id = ?').run(finalStatus, ret.id);
  }
  note(`Đổi/trả: ${u.name} — đơn #${order.id} — trạng thái ${finalStatus || 'requested'}`);
}

function seedWarranty({ email, reason, images, stage, saleId }) {
  const u = getUser(email);
  if (!u) return note(`BỎ QUA bảo hành (${email}): chưa có khách ảo — hãy chạy seed-customers.js trước`);
  const dup = db.prepare(
    'SELECT w.id FROM warranties w JOIN orders o ON o.id = w.order_id WHERE o.user_id = ? AND w.reason = ?'
  ).get(u.id, reason);
  if (dup) return note(`Đã có sẵn: bảo hành của ${u.name}`);
  const order = deliveredOrder(u.id, true, false);
  if (!order) return note(`BỎ QUA bảo hành (${email}): khách chưa có đơn đã giao phù hợp`);
  const info = db.prepare(
    "INSERT INTO warranties (order_id, months, start_date, end_date, status, reason, images) VALUES (?, 0, NULL, NULL, 'requested', ?, ?)"
  ).run(order.id, reason, JSON.stringify(images));
  const w = db.prepare('SELECT * FROM warranties WHERE id = ?').get(info.lastInsertRowid);
  postAftersalesCard(u.id, { refType: 'warranty', refId: w.id, content: `🛡️ Yêu cầu bảo hành — Đơn #${order.id}: ${reason.slice(0, 200)}` });

  if (stage === 'requested') return note(`Bảo hành: ${u.name} — đơn #${order.id} — Chờ duyệt`);
  if (stage === 'rejected') {
    db.prepare("UPDATE warranties SET status = 'rejected' WHERE id = ?").run(w.id);
    return note(`Bảo hành: ${u.name} — đơn #${order.id} — Từ chối`);
  }
  db.prepare("UPDATE warranties SET status = 'accepted' WHERE id = ?").run(w.id);
  if (stage === 'accepted') return note(`Bảo hành: ${u.name} — đơn #${order.id} — Đã chấp nhận`);

  const noteText = 'Hàng nhận lại nguyên vẹn, đúng như ảnh khách gửi';
  const recvAt = `${daysAgo(1)} 09:15:00`;
  db.prepare("UPDATE warranties SET status = 'received', received_note = ?, received_at = ? WHERE id = ?")
    .run(noteText, recvAt, w.id);
  if (stage === 'received') return note(`Bảo hành: ${u.name} — đơn #${order.id} — Đã nhận hàng`);

  // stage === 'active': cấp 12 tháng (bắt đầu 10 ngày trước) + chuông + tin nhắn chat như luồng thật
  const start = daysAgo(10);
  const end = addMonths(start, 12);
  db.prepare("UPDATE warranties SET months = 12, start_date = ?, end_date = ?, status = 'active' WHERE id = ?")
    .run(start, end, w.id);
  const detail = `Sản phẩm của bạn được bảo hành 12 tháng (từ ${fmtDay(start)} đến ${fmtDay(end)}). Tình trạng hàng shop đã nhận lại: ${noteText}.`;
  db.prepare('INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)')
    .run(u.id, 'warranty', `🛡️ Bảo hành đơn #${order.id} đã được chấp nhận`, detail, '/don-hang');
  if (saleId) {
    postChatNotice(u.id, saleId, `🛡️ Shop đã chấp nhận bảo hành cho đơn #${order.id}. ${detail} Cảm ơn bạn đã tin tưởng BI99!`);
  }
  note(`Bảo hành: ${u.name} — đơn #${order.id} — Đang hiệu lực 12 tháng (+ thông báo chuông & chat)`);
}

/* ---------- Chạy ---------- */
console.log('Đang tạo dữ liệu mẫu hậu mãi...');
const sale = db.prepare("SELECT id FROM users WHERE role = 'sale' ORDER BY id LIMIT 1").get();
seedReturn({ email: 'hung.bv@demo.vn', type: 'exchange', reason: 'Khóa kéo túi bị kẹt, kéo không trơn như lúc mới mua, nhờ shop kiểm tra giúp', images: [IMG_CRACK, IMG_SCRATCH], finalStatus: 'requested' });
seedReturn({ email: 'yen.dh@demo.vn', type: 'return', reason: 'Dây thắt lưng bị sờn ở mép, không giống hình trên web', images: [IMG_SCUFF], finalStatus: 'approved' });
seedWarranty({ email: 'mai.dt@demo.vn', reason: 'Quai xách bị bong chỉ ở mối nối, càng dùng càng toác ra', images: [IMG_SCRATCH, IMG_CRACK], stage: 'requested', saleId: sale?.id });
seedWarranty({ email: 'thao.dt@demo.vn', reason: 'Da ở góc ví bị nứt nhỏ, nhờ shop xem có xử lý được không', images: [IMG_CRACK], stage: 'accepted', saleId: sale?.id });
seedWarranty({ email: 'son.tc@demo.vn', reason: 'Khóa bấm của túi không còn ăn, bấm vào là bung ra', images: [IMG_SCUFF], stage: 'received', saleId: sale?.id });
seedWarranty({ email: 'duc.cv@demo.vn', reason: 'Đường may ở đáy túi bị bung một đoạn khoảng 3cm', images: [IMG_SCRATCH], stage: 'active', saleId: sale?.id });
seedWarranty({ email: 'ngan.vtk@demo.vn', reason: 'Muốn bảo hành vì da hơi cứng, chưa mềm như mong đợi', images: [IMG_SCUFF], stage: 'rejected', saleId: sale?.id });
console.log(`Hoàn tất ${report.length} mục. Mở trang quản trị -> tab Bảo hành để xem; đăng nhập các khách @demo.vn (mật khẩu demo123) để xem thẻ trong chat tư vấn.`);
