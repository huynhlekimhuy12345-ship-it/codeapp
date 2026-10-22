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
      CHECK(status IN ('requested','approved','received','rejected','completed')),
    refund_amount INTEGER NOT NULL DEFAULT 0,
    reject_reason TEXT NOT NULL DEFAULT '',
    received_note TEXT NOT NULL DEFAULT '',
    received_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Sự kiện săn thẻ trên trang Khuyến mãi (chỉ Admin tạo/phát hành)
  CREATE TABLE IF NOT EXISTS hunt_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Từng loại thẻ trong một sự kiện săn: % giảm + hạn dùng (ngày) + số lượng phát hành
  CREATE TABLE IF NOT EXISTS hunt_card_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES hunt_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT '',
    percent INTEGER NOT NULL DEFAULT 0,
    valid_days INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 0
  );

  -- Chi tiết từng món trong một yêu cầu đổi/trả (snapshot tại thời điểm khách gửi)
  CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL DEFAULT '',
    variant_sku TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    restocked_qty INTEGER NOT NULL DEFAULT 0
  );

  -- Bảo hành theo đơn hàng
  CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    months INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK(status IN ('requested','accepted','received','active','expired','void','rejected')),
    reason TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT '[]',
    received_note TEXT NOT NULL DEFAULT '',
    received_at TEXT
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

  -- Thông báo / tin tức của shop: hiện banner trang chủ + chuông thông báo mọi tài khoản
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    badge TEXT NOT NULL DEFAULT '',
    cta_text TEXT NOT NULL DEFAULT '',
    cta_link TEXT NOT NULL DEFAULT '',
    show_on_banner INTEGER NOT NULL DEFAULT 1,
    send_notification INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'customer',
    customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_id INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Thông báo riêng cho từng tài khoản (vd: khách được báo khi đơn đổi trạng thái)
  CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'order',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Mốc đơn hàng mà từng nhân viên đã xem (đếm số đơn mới cho ô đỏ ở thanh bên quản trị)
  CREATE TABLE IF NOT EXISTS staff_order_seen (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_order_id INTEGER NOT NULL DEFAULT 0
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

  -- Thẻ discount theo hạng khách hàng (phát hành theo tháng, mỗi thẻ dùng cho 1 sản phẩm)
  CREATE TABLE IF NOT EXISTS discount_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    percent INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','used','expired')),
    issued_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    used_order_id INTEGER,
    used_product_id INTEGER,
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
addColumnIfMissing('announcements', 'image_url', "image_url TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('contact_messages', 'content_vi', "content_vi TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('announcements', 'created_by', "created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
addColumnIfMissing('announcements', 'image_caption', "image_caption TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('announcements', 'image_zoom', 'image_zoom REAL NOT NULL DEFAULT 1');
addColumnIfMissing('announcements', 'image_pos_x', 'image_pos_x INTEGER NOT NULL DEFAULT 50');
addColumnIfMissing('announcements', 'image_pos_y', 'image_pos_y INTEGER NOT NULL DEFAULT 50');
addColumnIfMissing('orders', 'shipping_fee', 'shipping_fee INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'discount_total', 'discount_total INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'shipping_method_id', 'shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL');
// Thời điểm khách bấm "Hài lòng với đơn hàng": đơn được ghi điểm hạng ngay và khóa đổi/trả.
addColumnIfMissing('orders', 'satisfied_at', 'satisfied_at TEXT DEFAULT NULL');
// Hạng cao nhất hệ thống đã ghi nhận cho khách (để phát hiện THĂNG HẠNG và báo chuông).
// NULL = khách cũ chưa đồng bộ lần nào; khách mới đăng ký được gán sẵn 'potential'.
addColumnIfMissing('users', 'known_tier', 'known_tier TEXT DEFAULT NULL');

// --- Hậu mãi vào chat: ảnh minh họa cho đổi/trả, lý do + ảnh cho bảo hành,
//     và thẻ yêu cầu (kind/ref) trong tin nhắn chat ---
addColumnIfMissing('returns', 'images', "images TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('warranties', 'reason', "reason TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('warranties', 'images', "images TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('chat_messages', 'kind', "kind TEXT NOT NULL DEFAULT 'text'");
addColumnIfMissing('chat_messages', 'ref_type', 'ref_type TEXT');
addColumnIfMissing('chat_messages', 'ref_id', 'ref_id INTEGER');

// --- Đổi/trả chi tiết theo món: cột ghi chú/lý do cho returns + bảng return_items ---
addColumnIfMissing('returns', 'reject_reason', "reject_reason TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('returns', 'received_note', "received_note TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('returns', 'received_at', 'received_at TEXT');

// --- Nới trạng thái đổi/trả cho DB cũ: thêm 'received' (đã nhận lại hàng) vào CHECK ---
(function widenReturnStatuses() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'returns'").get();
  if (!row || !row.sql || row.sql.includes("'received'")) return;
  const oldCols = db.prepare('PRAGMA table_info(returns)').all().map((c) => c.name);
  const newCols = ['id', 'order_id', 'type', 'reason', 'status', 'refund_amount', 'reject_reason', 'received_note', 'received_at', 'created_at', 'images'];
  const copyCols = newCols.filter((c) => oldCols.includes(c));
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE returns_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('return','exchange')),
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK(status IN ('requested','approved','received','rejected','completed')),
      refund_amount INTEGER NOT NULL DEFAULT 0,
      reject_reason TEXT NOT NULL DEFAULT '',
      received_note TEXT NOT NULL DEFAULT '',
      received_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      images TEXT NOT NULL DEFAULT '[]'
    )`);
    db.exec(`INSERT INTO returns_new (${copyCols.join(', ')}) SELECT ${copyCols.join(', ')} FROM returns`);
    db.exec('DROP TABLE returns');
    db.exec('ALTER TABLE returns_new RENAME TO returns');
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* bỏ qua */ }
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
})();

// --- Thẻ săn sale: nguồn thẻ trong discount_cards (monthly = thẻ tháng, hunt = thẻ săn) ---
addColumnIfMissing('discount_cards', 'source', "source TEXT NOT NULL DEFAULT 'monthly'");
addColumnIfMissing('discount_cards', 'hunt_event_id', 'hunt_event_id INTEGER');
addColumnIfMissing('discount_cards', 'hunt_type_id', 'hunt_type_id INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS idx_discount_cards_hunt_type ON discount_cards(hunt_type_id)');
db.exec(`CREATE TABLE IF NOT EXISTS hunt_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS hunt_card_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES hunt_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  percent INTEGER NOT NULL DEFAULT 0,
  valid_days INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER NOT NULL DEFAULT 0
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_hunt_types_event ON hunt_card_types(event_id)');

// Bảng chi tiết món đổi/trả cho DB cũ (DB mới đã tạo ở khối CREATE TABLE phía trên)
db.exec(`CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL DEFAULT '',
  variant_sku TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  restocked_qty INTEGER NOT NULL DEFAULT 0
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id)');

// --- Nới trạng thái bảo hành cho DB cũ: bản cũ chỉ cho active/expired/void, luồng mới
// có thêm requested/accepted/received/rejected -> dựng lại bảng, giữ nguyên dữ liệu ---
(function widenWarrantyStatuses() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'warranties'").get();
  if (!row || !row.sql || row.sql.includes("'requested'")) return;
  const oldCols = db.prepare('PRAGMA table_info(warranties)').all().map((c) => c.name);
  const newCols = ['id', 'order_id', 'months', 'start_date', 'end_date', 'status', 'reason', 'images', 'received_note', 'received_at'];
  const copyCols = newCols.filter((c) => oldCols.includes(c));
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(`CREATE TABLE warranties_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      months INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'requested'
        CHECK(status IN ('requested','accepted','received','active','expired','void','rejected')),
      reason TEXT NOT NULL DEFAULT '',
      images TEXT NOT NULL DEFAULT '[]',
      received_note TEXT NOT NULL DEFAULT '',
      received_at TEXT
    )`);
    db.exec(`INSERT INTO warranties_new (${copyCols.join(', ')}) SELECT ${copyCols.join(', ')} FROM warranties`);
    db.exec('DROP TABLE warranties');
    db.exec('ALTER TABLE warranties_new RENAME TO warranties');
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* bỏ qua */ }
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
})();
addColumnIfMissing('warranties', 'received_note', "received_note TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('warranties', 'received_at', 'received_at TEXT');

// --- Cột mới cho order_items ---
addColumnIfMissing('order_items', 'variant_id', 'variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL');
addColumnIfMissing('order_items', 'variant_sku', "variant_sku TEXT NOT NULL DEFAULT ''");

// --- Cột phone cho users (hồ sơ khách hàng) ---
addColumnIfMissing('users', 'phone', "phone TEXT NOT NULL DEFAULT ''");

// --- Cột name_norm cho products (tìm kiếm không dấu) ---
addColumnIfMissing('products', 'name_norm', "name_norm TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('products', 'showcase', 'showcase INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('products', 'showcase_order', 'showcase_order INTEGER NOT NULL DEFAULT 0');
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
