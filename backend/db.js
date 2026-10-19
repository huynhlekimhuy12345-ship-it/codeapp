// Khởi tạo database SQLite và tạo bảng
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'leather_shop.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Migration: bổ sung role 'sale' cho bảng users đã tồn tại (SQLite không sửa
// được CHECK trực tiếp nên dựng lại bảng, giữ nguyên dữ liệu + index)
try {
  const userSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get()?.sql || '';
  if (userSql && !userSql.includes("'sale'")) {
    const idxSqls = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL"
    ).all().map(r => r.sql);
    db.exec('PRAGMA foreign_keys=OFF');
    db.exec('BEGIN');
    try {
      const newSql = userSql
        .replace("CHECK(role IN ('admin','customer'))", "CHECK(role IN ('admin','sale','customer'))")
        .replace(/^CREATE TABLE users/, 'CREATE TABLE users_new');
      db.exec(newSql);
      const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name).join(', ');
      db.exec(`INSERT INTO users_new (${cols}) SELECT ${cols} FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
      for (const q of idxSqls) db.exec(q);
      db.exec('COMMIT');
      console.log('  - Migration: đã thêm role sale vào bảng users');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    db.exec('PRAGMA foreign_keys=ON');
  }
} catch (e) { console.error('  - Migration role sale thất bại:', e.message); }


db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('admin','sale','customer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','confirmed','shipping','delivered','cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_name TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Blog: bài viết chia sẻ về đồ da (port từ web artifact BI99)
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    cover_image_url TEXT NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Liên hệ: tin nhắn khách gửi từ trang Liên hệ
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- =====================================================
  -- AUDIT-FIXES MIGRATION (Giai đoạn 1)
  -- Idempotent: toàn bộ dùng CREATE TABLE IF NOT EXISTS,
  -- chạy lại nhiều lần không lỗi, không mất dữ liệu cũ
  -- =====================================================

  -- Biến thể sản phẩm (màu/size): mỗi biến thể có SKU riêng và kho riêng
  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '',
    size TEXT NOT NULL DEFAULT '',
    price_delta INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ảnh sản phẩm: ảnh chung của sản phẩm hoặc ảnh riêng từng biến thể
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Nhà cung cấp
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Đơn nhập hàng từ nhà cung cấp
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK(status IN ('draft','confirmed','received','cancelled')),
    total INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Chi tiết đơn nhập: số lượng và giá nhập từng sản phẩm/biến thể
  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price INTEGER NOT NULL DEFAULT 0
  );

  -- Nhật ký biến động kho (nhập / xuất / điều chỉnh)
  -- Bắt buộc ít nhất một trong product_id / variant_id NOT NULL
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('IN','OUT','ADJUST')),
    qty INTEGER NOT NULL,
    ref_type TEXT NOT NULL DEFAULT '',
    ref_id INTEGER,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
  );

  -- Thanh toán của đơn hàng (1 đơn hàng = 1 bản ghi thanh toán)
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    method TEXT CHECK(method IN ('cod','bank','momo')),
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','verified','failed','refunded')),
    proof_url TEXT NOT NULL DEFAULT '',
    verified_at TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Phương thức vận chuyển (seed sẵn 3 gói)
  CREATE TABLE IF NOT EXISTS shipping_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fee INTEGER NOT NULL DEFAULT 0,
    eta_days INTEGER NOT NULL DEFAULT 3,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  -- Vận chuyển của đơn hàng (1 đơn hàng = 1 bản ghi vận chuyển)
  CREATE TABLE IF NOT EXISTS shippings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL,
    fee INTEGER NOT NULL DEFAULT 0,
    tracking_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'preparing'
      CHECK(status IN ('preparing','shipped','delivered','failed')),
    shipped_at TEXT,
    delivered_at TEXT
  );

  -- Đổi / trả hàng
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type TEXT CHECK(type IN ('return','exchange')),
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested','approved','rejected','completed')),
    refund_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Bảo hành theo đơn hàng
  CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    months INTEGER NOT NULL DEFAULT 12,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active','expired','void'))
  );

  -- Sửa chữa / bảo dưỡng
  CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    fee INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'received'
      CHECK(status IN ('received','repairing','done','returned')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Voucher / mã giảm giá (usage_limit = 0 nghĩa là không giới hạn)
  CREATE TABLE IF NOT EXISTS promo_event_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES promo_events(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sale_price INTEGER NOT NULL CHECK(sale_price > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS promo_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT DEFAULT '',
    subtitle TEXT DEFAULT '',
    start_at TEXT,
    end_at TEXT,
    voucher_codes TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    type TEXT CHECK(type IN ('percent','fixed')),
    value INTEGER NOT NULL DEFAULT 0,
    min_order INTEGER NOT NULL DEFAULT 0,
    expiry TEXT,
    usage_limit INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Đánh giá sản phẩm (admin kiểm duyệt qua is_approved)
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    is_approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// =====================================================
// AUDIT-FIXES MIGRATION (Giai đoạn 1): bổ sung cột cho bảng cũ
// SQLite không có ADD COLUMN IF NOT EXISTS -> guard bằng PRAGMA table_info
// =====================================================
// Chuẩn hoá tiếng Việt không dấu để tìm kiếm (vi da -> "vi da" khớp "ví da")
function normVi(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase();
}

function addColumnIfMissing(table, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  }
}

// --- Cột mới cho orders ---
addColumnIfMissing('orders', 'payment_method', "payment_method TEXT NOT NULL DEFAULT 'cod'");
addColumnIfMissing('orders', 'payment_status', "payment_status TEXT NOT NULL DEFAULT 'pending'");
addColumnIfMissing('orders', 'shipping_fee', 'shipping_fee INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'discount_total', 'discount_total INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'shipping_method_id', 'shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL');

// --- Cột mới cho order_items ---
addColumnIfMissing('order_items', 'variant_id', 'variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL');
addColumnIfMissing('order_items', 'variant_sku', "variant_sku TEXT NOT NULL DEFAULT ''");

// --- Cột phone cho users (hồ sơ khách hàng) ---
addColumnIfMissing('users', 'phone', "phone TEXT NOT NULL DEFAULT ''");

// --- Cột name_norm cho products (tìm kiếm không dấu) ---
addColumnIfMissing('products', 'name_norm', "name_norm TEXT NOT NULL DEFAULT ''");
(function backfillNorm() {
  const rows = db.prepare("SELECT id, name FROM products WHERE name_norm = '' OR name_norm IS NULL").all();
  if (!rows.length) return;
  const upd = db.prepare('UPDATE products SET name_norm = ? WHERE id = ?');
  for (const r of rows) upd.run(normVi(r.name), r.id);
})();

// --- Index cho các cột khóa ngoại hay query ---
for (const q of [
  'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_event_products_event ON promo_event_products(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)',
  'CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)',
  'CREATE INDEX IF NOT EXISTS idx_products_norm ON products(name_norm)',
]) db.exec(q);

// =====================================================
// Seed dữ liệu mẫu (idempotent: chỉ seed khi chưa có)
// =====================================================

// 3 phương thức vận chuyển mẫu (chỉ seed khi bảng còn trống)
if (db.prepare('SELECT COUNT(*) AS c FROM shipping_methods').get().c === 0) {
  const insShip = db.prepare(
    'INSERT INTO shipping_methods (name, fee, eta_days, is_active) VALUES (?, ?, ?, 1)'
  );
  insShip.run('Tiêu chuẩn', 30000, 3);
  insShip.run('Nhanh', 50000, 1);
  // Hỏa tốc: cột eta_days là INTEGER nên lưu 1 (giao trong ngày)
  insShip.run('Hỏa tốc', 80000, 1);
}

// Voucher mẫu WELCOME10: giảm 10%, đơn tối thiểu 200k, hết hạn +90 ngày
// (chỉ seed khi chưa có code này)
if (!db.prepare('SELECT id FROM vouchers WHERE code = ?').get('WELCOME10')) {
  db.prepare(
    `INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit, used_count, is_active, created_at)
     VALUES ('WELCOME10', 'percent', 10, 200000, date('now', '+90 days'), 0, 0, 1, datetime('now'))`
  ).run();
}

// =====================================================
// Helper ghi nhật ký biến động kho (mọi worker dùng chung)
// =====================================================
function logStockMovement({ product_id = null, variant_id = null, type, qty, ref_type = '', ref_id = null, note = '' }) {
  if (product_id == null && variant_id == null) {
    throw new Error('logStockMovement: cần product_id hoặc variant_id');
  }
  if (!['IN', 'OUT', 'ADJUST'].includes(type)) {
    throw new Error("logStockMovement: type phải là 'IN', 'OUT' hoặc 'ADJUST'");
  }
  const info = db
    .prepare(
      `INSERT INTO stock_movements (product_id, variant_id, type, qty, ref_type, ref_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(product_id, variant_id, type, qty, ref_type, ref_id, note);
  return info.lastInsertRowid;
}

// Gắn helper vào db để các route dùng: const db = require('./db'); db.logStockMovement({...})
db.logStockMovement = logStockMovement;
db.addColumnIfMissing = addColumnIfMissing;

module.exports = db;
