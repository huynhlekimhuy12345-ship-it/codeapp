// Seed dữ liệu mẫu cho demo (chạy 1 lần): node seed-demo.js
// Tạo: 3 sự kiện KM (+voucher, SP sale), 5 đơn hàng, 5 thanh toán,
// 2 đổi/trả, 2 bảo hành, 2 sửa chữa. Idempotent: chạy lại sẽ bỏ qua.
const db = require('./db');

const MARKER = 'demo-seed-v1';

function alreadySeeded() {
  try {
    const r = db.prepare("SELECT id FROM promo_events WHERE slug LIKE 'demo-%' LIMIT 1").get();
    return !!r;
  } catch { return false; }
}

if (alreadySeeded()) {
  console.log('Dữ liệu mẫu đã tồn tại — bỏ qua.');
  process.exit(0);
}

const now = new Date();
const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const daysFromNow = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };

const seed = db.transaction(() => {
  // ---- 1. Lấy sản phẩm thật để gắn vào đơn/sự kiện ----
  const products = db.prepare('SELECT id, name, price FROM products LIMIT 8').all();
  if (products.length < 3) throw new Error('Cần ít nhất 3 sản phẩm trong DB để seed');
  const P = (i) => products[i % products.length];

  // ---- 2. Voucher mẫu ----
  const vouchers = [
    { code: 'DEMO10', type: 'percent', value: 10, min_order: 500000, expiry: iso(daysFromNow(30)), usage_limit: 100, is_active: 1 },
    { code: 'DEMO50K', type: 'fixed', value: 50000, min_order: 1000000, expiry: iso(daysFromNow(30)), usage_limit: 50, is_active: 1 },
    { code: 'DEMO20', type: 'percent', value: 20, min_order: 2000000, expiry: iso(daysFromNow(-10)), usage_limit: 20, is_active: 0 },
  ];
  for (const v of vouchers) {
    db.prepare(`INSERT OR IGNORE INTO vouchers (code, type, value, min_order, expiry, usage_limit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(v.code, v.type, v.value, v.min_order, v.expiry, v.usage_limit, v.is_active);
  }

  // ---- 3. Sự kiện khuyến mãi mẫu ----
  const events = [
    {
      name: 'Sale Giữa Tháng 10', slug: 'demo-sale-giua-thang-10',
      title: 'Sale giữa tháng — Giảm đến 20%', subtitle: 'Áp dụng cho ví da và túi xách',
      start_at: iso(daysFromNow(-2)), end_at: iso(daysFromNow(5)),
      voucher_codes: JSON.stringify(['DEMO10', 'DEMO50K']), is_active: 1,
      products: [0, 1, 2], discount: 0.85,
    },
    {
      name: 'Sale Cuối Năm', slug: 'demo-sale-cuoi-nam',
      title: 'Sale cuối năm — Chuẩn bị lên sóng', subtitle: 'Đón chờ ưu đãi lớn nhất năm',
      start_at: iso(daysFromNow(40)), end_at: iso(daysFromNow(47)),
      voucher_codes: JSON.stringify(['DEMO20']), is_active: 0,
      products: [3, 4], discount: 0.8,
    },
    {
      name: 'Khuyến mãi khai trương', slug: 'demo-khai-truong',
      title: 'Khuyến mãi khai trương (đã kết thúc)', subtitle: 'Sự kiện mẫu đã qua',
      start_at: iso(daysFromNow(-60)), end_at: iso(daysFromNow(-53)),
      voucher_codes: JSON.stringify([]), is_active: 0,
      products: [], discount: 0.9,
    },
  ];
  const eventIds = [];
  for (const e of events) {
    const info = db.prepare(`INSERT INTO promo_events (name, slug, title, subtitle, start_at, end_at, voucher_codes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(e.name, e.slug, e.title, e.subtitle, e.start_at, e.end_at, e.voucher_codes, e.is_active);
    eventIds.push(info.lastInsertRowid);
    for (const pi of e.products) {
      const p = P(pi);
      const salePrice = Math.round(p.price * e.discount / 1000) * 1000;
      db.prepare(`INSERT OR IGNORE INTO promo_event_products (event_id, product_id, sale_price)
        VALUES (?, ?, ?)`).run(info.lastInsertRowid, p.id, salePrice);
    }
  }

  // ---- 4. Đơn hàng mẫu ----
  const customers = [
    { name: 'Nguyễn Văn An', phone: '0901112223', address: '12 Nguyễn Huệ, Q.1, TP.HCM' },
    { name: 'Trần Thị Bình', phone: '0904445556', address: '45 Lê Lợi, Hải Châu, Đà Nẵng' },
    { name: 'Lê Hoàng Cường', phone: '0917778889', address: '78 Trần Phú, Nha Trang' },
    { name: 'Phạm Thu Dung', phone: '0932223334', address: '9 Quang Trung, Hà Đông, Hà Nội' },
    { name: 'Hoàng Minh Đức', phone: '0945556667', address: '33 Điện Biên Phủ, TP. Huế' },
  ];
  const orderSpecs = [
    { ci: 0, status: 'delivered', items: [[0, 1], [1, 1]], payMethod: 'bank', payStatus: 'verified' },
    { ci: 1, status: 'shipping', items: [[2, 2]], payMethod: 'momo', payStatus: 'verified' },
    { ci: 2, status: 'confirmed', items: [[3, 1]], payMethod: 'bank', payStatus: 'pending' },
    { ci: 3, status: 'pending', items: [[4, 1], [5, 1]], payMethod: 'cod', payStatus: 'pending' },
    { ci: 4, status: 'delivered', items: [[6, 1]], payMethod: 'bank', payStatus: 'refunded' },
  ];
  const orderIds = [];
  orderSpecs.forEach((spec, idx) => {
    const c = customers[spec.ci];
    let subtotal = 0;
    for (const [pi, qty] of spec.items) subtotal += P(pi).price * qty;
    const shipFee = 30000;
    const total = subtotal + shipFee;
    const created = iso(daysFromNow(-(5 - idx) * 2));
    const info = db.prepare(`INSERT INTO orders
      (customer_name, phone, address, total, status, payment_method, payment_status, shipping_fee, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      c.name, c.phone, c.address, total, spec.status, spec.payMethod, spec.payStatus, shipFee, created);
    const oid = info.lastInsertRowid;
    orderIds.push(oid);
    for (const [pi, qty] of spec.items) {
      const p = P(pi);
      db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
        VALUES (?, ?, ?, ?, ?)`).run(oid, p.id, p.name, qty, p.price);
    }
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, created_at)
      VALUES (?, NULL, ?, ?)`).run(oid, spec.status, created);
  });

  // ---- 5. Thanh toán mẫu (khớp với đơn) ----
  const paySpecs = [
    { oi: 0, method: 'bank', status: 'verified', note: 'Đã nhận chuyển khoản' },
    { oi: 1, method: 'momo', status: 'verified', note: 'MoMo webhook OK' },
    { oi: 2, method: 'bank', status: 'pending', note: '' },
    { oi: 3, method: 'cod', status: 'pending', note: 'Thu hộ khi giao hàng' },
    { oi: 4, method: 'bank', status: 'refunded', note: 'Hoàn tiền do khách đổi ý' },
  ];
  paySpecs.forEach((ps, idx) => {
    const oid = orderIds[ps.oi];
    const amount = db.prepare('SELECT total FROM orders WHERE id = ?').get(oid).total;
    db.prepare(`INSERT INTO payments (order_id, method, amount, status, note, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      oid, ps.method, amount, ps.status, ps.note,
      ps.status === 'pending' ? null : iso(daysFromNow(-(5 - idx) * 2 + 1)),
      iso(daysFromNow(-(5 - idx) * 2)));
  });

  // ---- 6. Đổi/trả mẫu ----
  db.prepare(`INSERT INTO returns (order_id, type, reason, status, refund_amount, created_at)
    VALUES (?, 'return', 'Ví bị lỗi chỉ may, khách muốn trả hàng', 'requested', 0, ?)`).run(orderIds[0], iso(daysFromNow(-1)));
  db.prepare(`INSERT INTO returns (order_id, type, reason, status, refund_amount, created_at)
    VALUES (?, 'exchange', 'Khách muốn đổi sang màu nâu', 'approved', 0, ?)`).run(orderIds[1], iso(daysFromNow(-3)));

  // ---- 7. Bảo hành mẫu ----
  db.prepare(`INSERT INTO warranties (order_id, months, start_date, end_date, status)
    VALUES (?, 12, ?, ?, 'active')`).run(orderIds[0], iso(daysFromNow(-10)).slice(0, 10), iso(daysFromNow(355)).slice(0, 10));
  db.prepare(`INSERT INTO warranties (order_id, months, start_date, end_date, status)
    VALUES (?, 6, ?, ?, 'expired')`).run(orderIds[4], iso(daysFromNow(-400)).slice(0, 10), iso(daysFromNow(-220)).slice(0, 10));

  // ---- 8. Sửa chữa mẫu ----
  db.prepare(`INSERT INTO repairs (order_id, description, fee, status, created_at)
    VALUES (?, 'Đánh bóng lại ví da, thay khóa kéo', 150000, 'repairing', ?)`).run(orderIds[0], iso(daysFromNow(-2)));
  db.prepare(`INSERT INTO repairs (order_id, description, fee, status, created_at)
    VALUES (?, 'Bảo dưỡng định kỳ túi xách', 0, 'done', ?)`).run(orderIds[1], iso(daysFromNow(-5)));

  // ---- 9. Đánh giá mẫu (2 chờ duyệt + 3 đã duyệt) ----
  const reviewer = db.prepare("SELECT id FROM users WHERE role = 'customer' LIMIT 1").get();
  const reviewerId = reviewer ? reviewer.id : null;
  const reviewSpecs = [
    { pi: 0, rating: 5, comment: 'Ví da thật rất đẹp, đường may chắc chắn. Shop giao hàng nhanh!', approved: 0 },
    { pi: 1, rating: 4, comment: 'Chất da mềm, màu đúng hình. Sẽ ủng hộ tiếp.', approved: 0 },
    { pi: 2, rating: 5, comment: 'Túi xách da bò xịn, đựng vừa laptop 14 inch.', approved: 1 },
    { pi: 0, rating: 5, comment: 'Mua tặng bố, bố rất thích. Đóng gói cẩn thận.', approved: 1 },
    { pi: 3, rating: 3, comment: 'Sản phẩm ổn nhưng giao hơi chậm 1 ngày.', approved: 1 },
  ];
  reviewSpecs.forEach((rs, idx) => {
    db.prepare(`INSERT INTO reviews (product_id, user_id, rating, comment, is_approved, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      P(rs.pi).id, reviewerId, rs.rating, rs.comment, rs.approved, iso(daysFromNow(-(idx + 1) * 3)));
  });

  return { events: eventIds.length, orders: orderIds.length };
});

try {
  const r = seed();
  console.log(`Seed xong: ${r.events} sự kiện, ${r.orders} đơn hàng + thanh toán + hậu mãi mẫu.`);
} catch (e) {
  console.error('Seed lỗi:', e.message);
  process.exit(1);
}
