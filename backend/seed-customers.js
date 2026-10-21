// ============================================================
// Seed 15 khách hàng ảo trải đủ 5 hạng cho hệ thống hạng BI99
// Cách chạy (trong thư mục backend):  node seed-customers.js
// - Mật khẩu chung cho cả 15 tài khoản: demo123
// - Mỗi khách có sẵn đơn hàng ĐÃ THANH TOÁN (payment_status='verified', đã giao)
//   nên hạng tính đúng ngay khi mở trang quản trị / trang "Hạng của tôi".
// - Chạy lại nhiều lần an toàn: khách nào đã có (theo email) sẽ bị bỏ qua.
// ============================================================
const bcrypt = require('bcryptjs');
const db = require('./db');
const { computeTier, TIER_MAP } = require('./lib/tiers');

const PASSWORD = 'demo123';

// Mỗi khách: các số trong orders là TỔNG TIỀN từng đơn (đã gồm ship 30.000đ/đơn).
// Hàng được ghép tự động từ sản phẩm thật trong kho để khớp đúng tổng.
const CUSTOMERS = [
  // --- Tiềm năng: chưa mua đơn nào ---
  { name: 'Trần Thu Hằng', email: 'hang.tt@demo.vn', phone: '0912001001', orders: [] },
  { name: 'Phạm Đức Anh', email: 'anh.pd@demo.vn', phone: '0912001002', orders: [] },
  { name: 'Vũ Ngọc Linh', email: 'linh.vn@demo.vn', phone: '0912001003', orders: [] },
  // --- Mới: đúng 1 đơn ---
  { name: 'Lê Hoàng Nam', email: 'nam.lh@demo.vn', phone: '0912001004', orders: [920000] },
  { name: 'Đặng Thu Thảo', email: 'thao.dt@demo.vn', phone: '0912001005', orders: [1480000] },
  { name: 'Bùi Văn Hùng', email: 'hung.bv@demo.vn', phone: '0912001006', orders: [2420000] },
  // --- Thường xuyên: 2–4 đơn, tổng dưới 10 triệu ---
  { name: 'Ngô Thanh Tùng', email: 'tung.nt@demo.vn', phone: '0912001007', orders: [1920000, 2480000] },
  { name: 'Đỗ Hải Yến', email: 'yen.dh@demo.vn', phone: '0912001008', orders: [1020000, 1620000, 2220000] },
  { name: 'Hồ Quang Huy', email: 'huy.hq@demo.vn', phone: '0912001009', orders: [780000, 1280000, 1920000, 3020000] },
  // --- Trung thành: ≥5 đơn hoặc tổng ≥10 triệu ---
  { name: 'Chu Văn Đức', email: 'duc.cv@demo.vn', phone: '0912001010', orders: [3930000, 3530000, 3930000] }, // 3 đơn, 11.39tr -> hạng theo tiền
  { name: 'Dương Thị Mai', email: 'mai.dt@demo.vn', phone: '0912001011', orders: [1480000, 1680000, 1780000, 1880000, 1980000] }, // 5 đơn, 8.8tr -> hạng theo số đơn
  { name: 'Trịnh Công Sơn', email: 'son.tc@demo.vn', phone: '0912001012', orders: [1980000, 2180000, 2380000, 2480000, 2580000, 2680000] }, // 6 đơn, 14.28tr
  // --- VIP: tổng ≥20 triệu ---
  { name: 'Nguyễn Quốc Huy', email: 'huy.nq@demo.vn', phone: '0912001013', orders: [2980000, 3280000, 3480000, 3680000, 3980000, 4280000] }, // 21.68tr
  { name: 'Võ Thị Kim Ngân', email: 'ngan.vtk@demo.vn', phone: '0912001014', orders: [2980000, 3180000, 3280000, 3380000, 3480000, 3580000, 3680000, 3980000] }, // 27.54tr
  { name: 'Hoàng Gia Bảo', email: 'bao.hg@demo.vn', phone: '0912001015', orders: [2680000, 2880000, 2980000, 3080000, 3180000, 3280000, 3280000, 3380000, 3480000, 3580000, 3680000] }, // 35.48tr
];

const SHIP_FEE = 30000;
const METHODS = ['cod', 'bank', 'momo'];
const ADDRESSES = [
  '12 Nguyễn Huệ, Hội An, Đà Nẵng',
  '45 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
  '78 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
  '23 Phan Chu Trinh, Hải Châu, Đà Nẵng',
  '56 Nguyễn Trãi, Thanh Xuân, Hà Nội',
];

// Ghép danh sách món từ sản phẩm thật để tổng tiền món = target (tham lam, món đắt trước;
// phần lẻ nhỏ hơn giá món rẻ nhất được cộng vào đơn giá món cuối — như giá sale thực tế).
function buildItems(products, target) {
  const items = [];
  let remaining = target;
  const byPriceDesc = [...products].sort((a, b) => b.price - a.price);
  const cheapest = byPriceDesc[byPriceDesc.length - 1];
  while (remaining > 0) {
    const pick = byPriceDesc.find((p) => p.price <= remaining) || cheapest;
    if (pick.price > remaining) {
      // Còn lẻ nhỏ hơn mọi giá: cộng vào món cuối (hoặc tạo món đầu với giá đúng phần còn lại)
      if (items.length === 0) items.push({ product_id: pick.id, product_name: pick.name, quantity: 1, price: remaining });
      else items[items.length - 1].price += remaining;
      remaining = 0;
      break;
    }
    const found = items.find((i) => i.product_id === pick.id);
    if (found) found.quantity += 1;
    else items.push({ product_id: pick.id, product_name: pick.name, quantity: 1, price: pick.price });
    remaining -= pick.price;
  }
  return items;
}

function run() {
  const products = db.prepare('SELECT id, name, price FROM products WHERE price > 0 ORDER BY price DESC').all();
  if (products.length < 3) {
    console.error('Kho chưa có đủ sản phẩm để tạo đơn mẫu. Hãy nạp sản phẩm trước.');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const insUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role, phone, created_at) VALUES (?, ?, ?, 'customer', ?, ?)"
  );
  const insOrder = db.prepare(
    `INSERT INTO orders (user_id, customer_name, phone, address, total, status,
                         payment_method, payment_status, shipping_fee, discount_total,
                         shipping_method_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'delivered', ?, 'verified', ?, 0, 1, ?)`
  );
  const insItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
  );
  const insPayment = db.prepare(
    "INSERT INTO payments (order_id, method, amount, status, verified_at, note, created_at) VALUES (?, ?, ?, 'verified', ?, 'Seed khách ảo — hệ thống hạng', ?)"
  );

  let created = 0;
  let skipped = 0;
  const report = [];
  db.transaction(() => {
    CUSTOMERS.forEach((c, ci) => {
      const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(c.email);
      if (exists) { skipped++; return; }
      const userDate = `2026-0${7 + (ci % 2)}-${String(5 + ci).padStart(2, '0')} 09:00:00`;
      const userId = insUser.run(c.name, c.email, hash, c.phone, userDate).lastInsertRowid;
      let totalSpent = 0;
      c.orders.forEach((orderTotal, oi) => {
        const month = 8 + ((ci + oi) % 3); // rải tháng 8–10/2026
        const day = String(2 + ((ci * 3 + oi * 7) % 24)).padStart(2, '0');
        const createdAt = `2026-${String(month).padStart(2, '0')}-${day} 10:30:00`;
        const method = METHODS[(ci + oi) % METHODS.length];
        const orderId = insOrder.run(
          userId, c.name, c.phone, ADDRESSES[(ci + oi) % ADDRESSES.length],
          orderTotal, method, SHIP_FEE, createdAt
        ).lastInsertRowid;
        const items = buildItems(products, orderTotal - SHIP_FEE);
        for (const it of items) insItem.run(orderId, it.product_id, it.product_name, it.quantity, it.price);
        insPayment.run(orderId, method, orderTotal, createdAt, createdAt);
        totalSpent += orderTotal;
      });
      created++;
      report.push({ name: c.name, email: c.email, orders: c.orders.length, total: totalSpent, tier: TIER_MAP[computeTier(c.orders.length, totalSpent)].name });
    });
  })();

  console.log(`\nĐã tạo ${created} khách ảo mới, bỏ qua ${skipped} khách đã có. Mật khẩu chung: ${PASSWORD}\n`);
  for (const r of report) {
    console.log(`- ${r.name} <${r.email}> — ${r.orders} đơn, tổng ${r.total.toLocaleString('vi-VN')}đ — hạng ${r.tier}`);
  }
  console.log('\nMở trang quản trị > Người dùng để xem hạng, hoặc đăng nhập bằng 1 tài khoản trên để xem trang "Hạng của tôi".');
}

run();
