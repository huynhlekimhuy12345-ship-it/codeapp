var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// db.js
var require_db = __commonJS({
  "db.js"(exports2, module2) {
    var Database = require("better-sqlite3");
    var path2 = require("path");
    var dbPath = process.env.DB_PATH || path2.join(__dirname, "leather_shop.db");
    var db2 = new Database(dbPath);
    db2.pragma("journal_mode = WAL");
    db2.pragma("foreign_keys = ON");
    try {
      const userSql = db2.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get()?.sql || "";
      if (userSql && !userSql.includes("'sale'")) {
        const idxSqls = db2.prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL"
        ).all().map((r) => r.sql);
        db2.exec("PRAGMA foreign_keys=OFF");
        db2.exec("BEGIN");
        try {
          const newSql = userSql.replace("CHECK(role IN ('admin','customer'))", "CHECK(role IN ('admin','sale','customer'))").replace(/^CREATE TABLE users/, "CREATE TABLE users_new");
          db2.exec(newSql);
          const cols = db2.prepare("PRAGMA table_info(users)").all().map((c) => c.name).join(", ");
          db2.exec(`INSERT INTO users_new (${cols}) SELECT ${cols} FROM users`);
          db2.exec("DROP TABLE users");
          db2.exec("ALTER TABLE users_new RENAME TO users");
          for (const q of idxSqls) db2.exec(q);
          db2.exec("COMMIT");
          console.log("  - Migration: \u0111\xE3 th\xEAm role sale v\xE0o b\u1EA3ng users");
        } catch (e) {
          db2.exec("ROLLBACK");
          throw e;
        }
        db2.exec("PRAGMA foreign_keys=ON");
      }
    } catch (e) {
      console.error("  - Migration role sale th\u1EA5t b\u1EA1i:", e.message);
    }
    db2.exec(`
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

  -- Blog: b\xE0i vi\u1EBFt chia s\u1EBB v\u1EC1 \u0111\u1ED3 da (port t\u1EEB web artifact BI99)
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

  -- Li\xEAn h\u1EC7: tin nh\u1EAFn kh\xE1ch g\u1EEDi t\u1EEB trang Li\xEAn h\u1EC7
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
  -- AUDIT-FIXES MIGRATION (Giai \u0111o\u1EA1n 1)
  -- Idempotent: to\xE0n b\u1ED9 d\xF9ng CREATE TABLE IF NOT EXISTS,
  -- ch\u1EA1y l\u1EA1i nhi\u1EC1u l\u1EA7n kh\xF4ng l\u1ED7i, kh\xF4ng m\u1EA5t d\u1EEF li\u1EC7u c\u0169
  -- =====================================================

  -- Bi\u1EBFn th\u1EC3 s\u1EA3n ph\u1EA9m (m\xE0u/size): m\u1ED7i bi\u1EBFn th\u1EC3 c\xF3 SKU ri\xEAng v\xE0 kho ri\xEAng
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

  -- \u1EA2nh s\u1EA3n ph\u1EA9m: \u1EA3nh chung c\u1EE7a s\u1EA3n ph\u1EA9m ho\u1EB7c \u1EA3nh ri\xEAng t\u1EEBng bi\u1EBFn th\u1EC3
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Nh\xE0 cung c\u1EA5p
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- \u0110\u01A1n nh\u1EADp h\xE0ng t\u1EEB nh\xE0 cung c\u1EA5p
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK(status IN ('draft','confirmed','received','cancelled')),
    total INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Chi ti\u1EBFt \u0111\u01A1n nh\u1EADp: s\u1ED1 l\u01B0\u1EE3ng v\xE0 gi\xE1 nh\u1EADp t\u1EEBng s\u1EA3n ph\u1EA9m/bi\u1EBFn th\u1EC3
  CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price INTEGER NOT NULL DEFAULT 0
  );

  -- Nh\u1EADt k\xFD bi\u1EBFn \u0111\u1ED9ng kho (nh\u1EADp / xu\u1EA5t / \u0111i\u1EC1u ch\u1EC9nh)
  -- B\u1EAFt bu\u1ED9c \xEDt nh\u1EA5t m\u1ED9t trong product_id / variant_id NOT NULL
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

  -- Thanh to\xE1n c\u1EE7a \u0111\u01A1n h\xE0ng (1 \u0111\u01A1n h\xE0ng = 1 b\u1EA3n ghi thanh to\xE1n)
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

  -- Ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n (seed s\u1EB5n 3 g\xF3i)
  CREATE TABLE IF NOT EXISTS shipping_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fee INTEGER NOT NULL DEFAULT 0,
    eta_days INTEGER NOT NULL DEFAULT 3,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  -- V\u1EADn chuy\u1EC3n c\u1EE7a \u0111\u01A1n h\xE0ng (1 \u0111\u01A1n h\xE0ng = 1 b\u1EA3n ghi v\u1EADn chuy\u1EC3n)
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

  -- \u0110\u1ED5i / tr\u1EA3 h\xE0ng
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

  -- S\u1EF1 ki\u1EC7n s\u0103n th\u1EBB tr\xEAn trang Khuy\u1EBFn m\xE3i (ch\u1EC9 Admin t\u1EA1o/ph\xE1t h\xE0nh)
  CREATE TABLE IF NOT EXISTS hunt_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- T\u1EEBng lo\u1EA1i th\u1EBB trong m\u1ED9t s\u1EF1 ki\u1EC7n s\u0103n: % gi\u1EA3m + h\u1EA1n d\xF9ng (ng\xE0y) + s\u1ED1 l\u01B0\u1EE3ng ph\xE1t h\xE0nh
  CREATE TABLE IF NOT EXISTS hunt_card_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES hunt_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT '',
    percent INTEGER NOT NULL DEFAULT 0,
    valid_days INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 0
  );

  -- Chi ti\u1EBFt t\u1EEBng m\xF3n trong m\u1ED9t y\xEAu c\u1EA7u \u0111\u1ED5i/tr\u1EA3 (snapshot t\u1EA1i th\u1EDDi \u0111i\u1EC3m kh\xE1ch g\u1EEDi)
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

  -- B\u1EA3o h\xE0nh theo \u0111\u01A1n h\xE0ng
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

  -- S\u1EEDa ch\u1EEFa / b\u1EA3o d\u01B0\u1EE1ng
  CREATE TABLE IF NOT EXISTS repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    fee INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'received'
      CHECK(status IN ('received','repairing','done','returned')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Voucher / m\xE3 gi\u1EA3m gi\xE1 (usage_limit = 0 ngh\u0129a l\xE0 kh\xF4ng gi\u1EDBi h\u1EA1n)
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

  -- Th\xF4ng b\xE1o / tin t\u1EE9c c\u1EE7a shop: hi\u1EC7n banner trang ch\u1EE7 + chu\xF4ng th\xF4ng b\xE1o m\u1ECDi t\xE0i kho\u1EA3n
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

  -- Th\xF4ng b\xE1o ri\xEAng cho t\u1EEBng t\xE0i kho\u1EA3n (vd: kh\xE1ch \u0111\u01B0\u1EE3c b\xE1o khi \u0111\u01A1n \u0111\u1ED5i tr\u1EA1ng th\xE1i)
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

  -- M\u1ED1c \u0111\u01A1n h\xE0ng m\xE0 t\u1EEBng nh\xE2n vi\xEAn \u0111\xE3 xem (\u0111\u1EBFm s\u1ED1 \u0111\u01A1n m\u1EDBi cho \xF4 \u0111\u1ECF \u1EDF thanh b\xEAn qu\u1EA3n tr\u1ECB)
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

  -- Th\u1EBB discount theo h\u1EA1ng kh\xE1ch h\xE0ng (ph\xE1t h\xE0nh theo th\xE1ng, m\u1ED7i th\u1EBB d\xF9ng cho 1 s\u1EA3n ph\u1EA9m)
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

  -- \u0110\xE1nh gi\xE1 s\u1EA3n ph\u1EA9m (admin ki\u1EC3m duy\u1EC7t qua is_approved)
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
    function normVi(text) {
      return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, (m) => m === "\u0111" ? "d" : "D").toLowerCase();
    }
    function addColumnIfMissing(table, columnName, columnDef) {
      const cols = db2.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some((c) => c.name === columnName)) {
        db2.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      }
    }
    addColumnIfMissing("orders", "payment_method", "payment_method TEXT NOT NULL DEFAULT 'cod'");
    addColumnIfMissing("orders", "payment_status", "payment_status TEXT NOT NULL DEFAULT 'pending'");
    addColumnIfMissing("announcements", "image_url", "image_url TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("contact_messages", "content_vi", "content_vi TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("announcements", "created_by", "created_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
    addColumnIfMissing("announcements", "image_caption", "image_caption TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("announcements", "image_zoom", "image_zoom REAL NOT NULL DEFAULT 1");
    addColumnIfMissing("announcements", "image_pos_x", "image_pos_x INTEGER NOT NULL DEFAULT 50");
    addColumnIfMissing("announcements", "image_pos_y", "image_pos_y INTEGER NOT NULL DEFAULT 50");
    addColumnIfMissing("orders", "shipping_fee", "shipping_fee INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("orders", "discount_total", "discount_total INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("orders", "shipping_method_id", "shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL");
    addColumnIfMissing("orders", "satisfied_at", "satisfied_at TEXT DEFAULT NULL");
    addColumnIfMissing("users", "known_tier", "known_tier TEXT DEFAULT NULL");
    addColumnIfMissing("returns", "images", "images TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing("warranties", "reason", "reason TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("warranties", "images", "images TEXT NOT NULL DEFAULT '[]'");
    addColumnIfMissing("chat_messages", "kind", "kind TEXT NOT NULL DEFAULT 'text'");
    addColumnIfMissing("chat_messages", "ref_type", "ref_type TEXT");
    addColumnIfMissing("chat_messages", "ref_id", "ref_id INTEGER");
    addColumnIfMissing("returns", "reject_reason", "reject_reason TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("returns", "received_note", "received_note TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("returns", "received_at", "received_at TEXT");
    (function widenReturnStatuses() {
      const row = db2.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'returns'").get();
      if (!row || !row.sql || row.sql.includes("'received'")) return;
      const oldCols = db2.prepare("PRAGMA table_info(returns)").all().map((c) => c.name);
      const newCols = ["id", "order_id", "type", "reason", "status", "refund_amount", "reject_reason", "received_note", "received_at", "created_at", "images"];
      const copyCols = newCols.filter((c) => oldCols.includes(c));
      db2.exec("PRAGMA foreign_keys = OFF");
      try {
        db2.exec("BEGIN");
        db2.exec(`CREATE TABLE returns_new (
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
        db2.exec(`INSERT INTO returns_new (${copyCols.join(", ")}) SELECT ${copyCols.join(", ")} FROM returns`);
        db2.exec("DROP TABLE returns");
        db2.exec("ALTER TABLE returns_new RENAME TO returns");
        db2.exec("COMMIT");
      } catch (e) {
        try {
          db2.exec("ROLLBACK");
        } catch {
        }
        throw e;
      } finally {
        db2.exec("PRAGMA foreign_keys = ON");
      }
    })();
    addColumnIfMissing("discount_cards", "source", "source TEXT NOT NULL DEFAULT 'monthly'");
    addColumnIfMissing("discount_cards", "hunt_event_id", "hunt_event_id INTEGER");
    addColumnIfMissing("discount_cards", "hunt_type_id", "hunt_type_id INTEGER");
    db2.exec("CREATE INDEX IF NOT EXISTS idx_discount_cards_hunt_type ON discount_cards(hunt_type_id)");
    db2.exec(`CREATE TABLE IF NOT EXISTS hunt_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
    db2.exec(`CREATE TABLE IF NOT EXISTS hunt_card_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES hunt_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  percent INTEGER NOT NULL DEFAULT 0,
  valid_days INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER NOT NULL DEFAULT 0
)`);
    db2.exec("CREATE INDEX IF NOT EXISTS idx_hunt_types_event ON hunt_card_types(event_id)");
    db2.exec(`CREATE TABLE IF NOT EXISTS return_items (
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
    db2.exec("CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id)");
    (function widenWarrantyStatuses() {
      const row = db2.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'warranties'").get();
      if (!row || !row.sql || row.sql.includes("'requested'")) return;
      const oldCols = db2.prepare("PRAGMA table_info(warranties)").all().map((c) => c.name);
      const newCols = ["id", "order_id", "months", "start_date", "end_date", "status", "reason", "images", "received_note", "received_at"];
      const copyCols = newCols.filter((c) => oldCols.includes(c));
      db2.exec("PRAGMA foreign_keys = OFF");
      try {
        db2.exec("BEGIN");
        db2.exec(`CREATE TABLE warranties_new (
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
        db2.exec(`INSERT INTO warranties_new (${copyCols.join(", ")}) SELECT ${copyCols.join(", ")} FROM warranties`);
        db2.exec("DROP TABLE warranties");
        db2.exec("ALTER TABLE warranties_new RENAME TO warranties");
        db2.exec("COMMIT");
      } catch (e) {
        try {
          db2.exec("ROLLBACK");
        } catch {
        }
        throw e;
      } finally {
        db2.exec("PRAGMA foreign_keys = ON");
      }
    })();
    addColumnIfMissing("warranties", "received_note", "received_note TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("warranties", "received_at", "received_at TEXT");
    addColumnIfMissing("order_items", "variant_id", "variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL");
    addColumnIfMissing("order_items", "variant_sku", "variant_sku TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("users", "phone", "phone TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("products", "name_norm", "name_norm TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing("products", "showcase", "showcase INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("products", "showcase_order", "showcase_order INTEGER NOT NULL DEFAULT 0");
    (function backfillNorm() {
      const rows = db2.prepare("SELECT id, name FROM products WHERE name_norm = '' OR name_norm IS NULL").all();
      if (!rows.length) return;
      const upd = db2.prepare("UPDATE products SET name_norm = ? WHERE id = ?");
      for (const r of rows) upd.run(normVi(r.name), r.id);
    })();
    for (const q of [
      "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)",
      "CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)",
      "CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id)",
      "CREATE INDEX IF NOT EXISTS idx_event_products_event ON promo_event_products(event_id)",
      "CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)",
      "CREATE INDEX IF NOT EXISTS idx_products_norm ON products(name_norm)"
    ]) db2.exec(q);
    if (db2.prepare("SELECT COUNT(*) AS c FROM shipping_methods").get().c === 0) {
      const insShip = db2.prepare(
        "INSERT INTO shipping_methods (name, fee, eta_days, is_active) VALUES (?, ?, ?, 1)"
      );
      insShip.run("Ti\xEAu chu\u1EA9n", 3e4, 3);
      insShip.run("Nhanh", 5e4, 1);
      insShip.run("H\u1ECFa t\u1ED1c", 8e4, 1);
    }
    if (!db2.prepare("SELECT id FROM vouchers WHERE code = ?").get("WELCOME10")) {
      db2.prepare(
        `INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit, used_count, is_active, created_at)
     VALUES ('WELCOME10', 'percent', 10, 200000, date('now', '+90 days'), 0, 0, 1, datetime('now'))`
      ).run();
    }
    function logStockMovement({ product_id = null, variant_id = null, type, qty, ref_type = "", ref_id = null, note = "" }) {
      if (product_id == null && variant_id == null) {
        throw new Error("logStockMovement: c\u1EA7n product_id ho\u1EB7c variant_id");
      }
      if (!["IN", "OUT", "ADJUST"].includes(type)) {
        throw new Error("logStockMovement: type ph\u1EA3i l\xE0 'IN', 'OUT' ho\u1EB7c 'ADJUST'");
      }
      const info = db2.prepare(
        `INSERT INTO stock_movements (product_id, variant_id, type, qty, ref_type, ref_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(product_id, variant_id, type, qty, ref_type, ref_id, note);
      return info.lastInsertRowid;
    }
    db2.logStockMovement = logStockMovement;
    db2.addColumnIfMissing = addColumnIfMissing;
    module2.exports = db2;
  }
});

// seed.js
var require_seed = __commonJS({
  "seed.js"() {
    var bcrypt = require("bcryptjs");
    var db2 = require_db();
    console.log("\u0110ang seed d\u1EEF li\u1EC7u...");
    var adminEmail = "admin@dodashop.vn";
    var adminExists = db2.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
    if (!adminExists) {
      db2.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run("Qu\u1EA3n tr\u1ECB vi\xEAn", adminEmail, bcrypt.hashSync("admin123", 10), "admin");
      console.log("  - \u0110\xE3 t\u1EA1o admin: admin@dodashop.vn / admin123");
    }
    var saleAccounts = [
      ["Nh\xE2n vi\xEAn sale 1", "sale@dodashop.vn", "sale123"],
      ["Nh\xE2n vi\xEAn sale 2", "sale2@dodashop.vn", "sale123"]
    ];
    for (const [name, email, password] of saleAccounts) {
      const exists = db2.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (!exists) {
        db2.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run(name, email, bcrypt.hashSync(password, 10), "sale");
        console.log(`  - \u0110\xE3 t\u1EA1o sale: ${email} / ${password}`);
      }
    }
    var categories = [
      ["V\xED da", "V\xED nam, v\xED n\u1EEF l\xE0m t\u1EEB da b\xF2 th\u1EADt, da c\xE1 s\u1EA5u"],
      ["T\xFAi x\xE1ch da", "T\xFAi x\xE1ch, c\u1EB7p c\xF4ng s\u1EDF, balo da cao c\u1EA5p"],
      ["Th\u1EAFt l\u01B0ng da", "Th\u1EAFt l\u01B0ng da b\xF2, da c\xE1 s\u1EA5u cho nam"],
      ["Gi\xE0y da", "Gi\xE0y t\xE2y, gi\xE0y l\u01B0\u1EDDi, boots da th\u1EADt"],
      ["\xC1o kho\xE1c da", "\xC1o kho\xE1c da b\xF2, da c\u1EEBu th\u1EDDi trang"],
      ["Ph\u1EE5 ki\u1EC7n da", "M\xF3c kh\xF3a, bao \u0111i\u1EC7n tho\u1EA1i, d\xE2y \u0111\u1ED3ng h\u1ED3 da"]
    ];
    var catIds = {};
    for (const [name, desc] of categories) {
      let row = db2.prepare("SELECT id FROM categories WHERE name = ?").get(name);
      if (!row) {
        const info = db2.prepare("INSERT INTO categories (name, description) VALUES (?, ?)").run(name, desc);
        row = { id: info.lastInsertRowid };
      }
      catIds[name] = row.id;
    }
    var U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
    var products = [
      // Ví da
      ["V\xED da b\xF2 nam cao c\u1EA5p", "V\xED da", "V\xED nam da b\xF2 th\u1EADt 100%, kh\xE2u tay t\u1EC9 m\u1EC9, nhi\u1EC1u ng\u0103n \u0111\u1EF1ng th\u1EBB v\xE0 ti\u1EC1n m\u1EB7t.", 89e4, 50, U("photo-1627123424574-724758594e93")],
      ["V\xED da n\u1EEF d\xE1ng d\xE0i", "V\xED da", "V\xED n\u1EEF d\xE1ng d\xE0i da m\u1EC1m, kh\xF3a k\xE9o YKK, nhi\u1EC1u m\xE0u sang tr\u1ECDng.", 75e4, 40, "https://images.pexels.com/photos/20015774/pexels-photo-20015774.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["V\xED da c\xE1 s\u1EA5u nam", "V\xED da", "V\xED nam v\xE2n da c\xE1 s\u1EA5u th\u1EADt, \u0111\u1EB3ng c\u1EA5p doanh nh\xE2n.", 249e4, 20, "https://images.pexels.com/photos/12865963/pexels-photo-12865963.jpeg?auto=compress&cs=tinysrgb&w=800"],
      // Túi xách da
      ["T\xFAi x\xE1ch da c\xF4ng s\u1EDF", "T\xFAi x\xE1ch da", "C\u1EB7p da c\xF4ng s\u1EDF \u0111\u1EF1ng v\u1EEBa laptop 15.6 inch, da b\xF2 s\xE1p cao c\u1EA5p.", 189e4, 25, "https://images.pexels.com/photos/10973347/pexels-photo-10973347.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["Balo da du l\u1ECBch", "T\xFAi x\xE1ch da", "Balo da b\xF2 m\u1EC1m, phong c\xE1ch vintage, s\u1EE9c ch\u1EE9a l\u1EDBn.", 159e4, 30, "https://images.pexels.com/photos/3155047/pexels-photo-3155047.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["T\xFAi \u0111eo ch\xE9o da nam", "T\xFAi x\xE1ch da", "T\xFAi \u0111eo ch\xE9o da b\xF2 nh\u1ECF g\u1ECDn, ti\u1EC7n l\u1EE3i d\u1EA1o ph\u1ED1.", 99e4, 45, "https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=800"],
      // Thắt lưng da
      ["Th\u1EAFt l\u01B0ng da b\xF2 m\u1EB7t kh\xF3a t\u1EF1 \u0111\u1ED9ng", "Th\u1EAFt l\u01B0ng da", "Th\u1EAFt l\u01B0ng da b\xF2 nguy\xEAn t\u1EA5m, kh\xF3a t\u1EF1 \u0111\u1ED9ng cao c\u1EA5p.", 49e4, 80, U("photo-1624222247344-550fb60583dc")],
      ["Th\u1EAFt l\u01B0ng da c\xE1 s\u1EA5u", "Th\u1EAFt l\u01B0ng da", "Th\u1EAFt l\u01B0ng v\xE2n c\xE1 s\u1EA5u sang tr\u1ECDng, qu\xE0 t\u1EB7ng \xFD ngh\u0129a.", 129e4, 35, "https://images.pexels.com/photos/30975839/pexels-photo-30975839.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["Th\u1EAFt l\u01B0ng da l\u1ED9n casual", "Th\u1EAFt l\u01B0ng da", "Th\u1EAFt l\u01B0ng da l\u1ED9n phong c\xE1ch tr\u1EBB trung, d\u1EC5 ph\u1ED1i \u0111\u1ED3.", 39e4, 60, "https://images.pexels.com/photos/10340815/pexels-photo-10340815.jpeg?auto=compress&cs=tinysrgb&w=800"],
      // Giày da
      ["Gi\xE0y t\xE2y da b\xF2 Oxford", "Gi\xE0y da", "Gi\xE0y t\xE2y Oxford da b\xF2 th\u1EADt, \u0111\u1EBF da kh\xE2u Goodyear.", 219e4, 30, U("photo-1614252235316-8c857d38b5f4")],
      ["Gi\xE0y l\u01B0\u1EDDi da nam", "Gi\xE0y da", "Gi\xE0y l\u01B0\u1EDDi da m\u1EC1m \xEAm ch\xE2n, phong c\xE1ch c\xF4ng s\u1EDF tr\u1EBB trung.", 149e4, 40, "https://images.pexels.com/photos/10259873/pexels-photo-10259873.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["Boots da c\u1ED5 cao", "Gi\xE0y da", "Boots da b\xF2 c\u1ED5 cao, phong c\xE1ch b\u1EE5i b\u1EB7m c\xE1 t\xEDnh.", 199e4, 25, U("photo-1520639888713-7851133b1ed0")],
      // Áo khoác da
      ["\xC1o kho\xE1c da b\xF2 biker", "\xC1o kho\xE1c da", "\xC1o kho\xE1c da b\xF2 phong c\xE1ch biker, l\xF3t n\u1EC9 \u1EA5m \xE1p.", 349e4, 15, U("photo-1551028719-00167b16eac5")],
      ["\xC1o kho\xE1c da c\u1EEBu bomber", "\xC1o kho\xE1c da", "\xC1o bomber da c\u1EEBu m\u1EC1m nh\u1EB9, form d\xE1ng hi\u1EC7n \u0111\u1EA1i.", 299e4, 18, "https://images.pexels.com/photos/16060730/pexels-photo-16060730.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["\xC1o vest da nam", "\xC1o kho\xE1c da", "\xC1o vest da sang tr\u1ECDng cho qu\xFD \xF4ng l\u1ECBch l\xE3m.", 279e4, 12, "https://images.pexels.com/photos/10854422/pexels-photo-10854422.jpeg?auto=compress&cs=tinysrgb&w=800"],
      // Phụ kiện da
      ["M\xF3c kh\xF3a da kh\u1EAFc t\xEAn", "Ph\u1EE5 ki\u1EC7n da", "M\xF3c kh\xF3a da b\xF2 kh\u1EAFc t\xEAn theo y\xEAu c\u1EA7u, qu\xE0 t\u1EB7ng \u0111\u1ED9c \u0111\xE1o.", 149e3, 100, "https://images.pexels.com/photos/15440419/pexels-photo-15440419.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["Bao da \u0111i\u1EC7n tho\u1EA1i", "Ph\u1EE5 ki\u1EC7n da", "Bao da \u0111i\u1EC7n tho\u1EA1i handmade, v\u1EEBa nhi\u1EC1u d\xF2ng m\xE1y.", 299e3, 70, "https://images.pexels.com/photos/14833708/pexels-photo-14833708.jpeg?auto=compress&cs=tinysrgb&w=800"],
      ["D\xE2y \u0111\u1ED3ng h\u1ED3 da", "Ph\u1EE5 ki\u1EC7n da", "D\xE2y \u0111\u1ED3ng h\u1ED3 da b\xF2, da c\xE1 s\u1EA5u nhi\u1EC1u size.", 349e3, 90, "https://images.pexels.com/photos/1265619/pexels-photo-1265619.jpeg?auto=compress&cs=tinysrgb&w=800"]
    ];
    var countBefore = db2.prepare("SELECT COUNT(*) AS n FROM products").get().n;
    if (countBefore === 0) {
      const ins = db2.prepare(
        "INSERT INTO products (category_id, name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const [name, cat, desc, price, stock, img] of products) {
        ins.run(catIds[cat], name, desc, price, stock, img);
      }
      console.log(`  - \u0110\xE3 th\xEAm ${products.length} s\u1EA3n ph\u1EA9m m\u1EABu`);
    } else {
      console.log(`  - \u0110\xE3 c\xF3 ${countBefore} s\u1EA3n ph\u1EA9m, b\u1ECF qua seed s\u1EA3n ph\u1EA9m`);
    }
    var blogPosts = [
      {
        "title": "C\xE1ch b\u1EA3o qu\u1EA3n \u0111\u1ED3 da b\u1EC1n \u0111\u1EB9p theo th\u1EDDi gian",
        "slug": "cach-bao-quan-do-da-ben-dep",
        "coverImageUrl": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
        "excerpt": "\u0110\u1ED3 da th\u1EADt c\xE0ng d\xF9ng c\xE0ng b\xF3ng \u0111\u1EB9p n\u1EBFu \u0111\u01B0\u1EE3c ch\u0103m s\xF3c \u0111\xFAng c\xE1ch. C\xF9ng BI99 t\xECm hi\u1EC3u c\xE1c nguy\xEAn t\u1EAFc v\u1EC7 sinh, d\u01B0\u1EE1ng \u1EA9m v\xE0 c\u1EA5t gi\u1EEF \u0111\u1EC3 chi\u1EBFc t\xFAi, v\xED da c\u1EE7a b\u1EA1n b\u1EC1n \u0111\u1EB9p nhi\u1EC1u n\u0103m.",
        "content": 'Da b\xF2 th\u1EADt l\xE0 ch\u1EA5t li\u1EC7u "s\u1ED1ng": c\xE0ng d\xF9ng l\xE2u, b\u1EC1 m\u1EB7t da c\xE0ng l\xEAn n\u01B0\u1EDBc, m\u1EC1m v\xE0 b\xF3ng \u0111\u1EB9p \u2014 ng\u01B0\u1EDDi ch\u01A1i da g\u1ECDi \u0111\xF3 l\xE0 patina. Nh\u01B0ng \u0111\u1EC3 da \u0111\u1EA1t \u0111\u01B0\u1EE3c v\u1EBB \u0111\u1EB9p \u1EA5y, b\u1EA1n c\u1EA7n ch\u0103m s\xF3c \u0111\xFAng c\xE1ch.\n\n1. V\u1EC7 sinh \u0111\xFAng c\xE1ch\nD\xF9ng kh\u0103n m\u1EC1m kh\xF4 ho\u1EB7c h\u01A1i \u1EA9m lau nh\u1EB9 b\u1EC1 m\u1EB7t \u0111\u1EC3 lo\u1EA1i b\u1ECF b\u1EE5i b\u1EA9n. Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng ng\xE2m n\u01B0\u1EDBc, kh\xF4ng d\xF9ng h\xF3a ch\u1EA5t t\u1EA9y r\u1EEDa m\u1EA1nh hay x\u0103ng, c\u1ED3n l\xEAn b\u1EC1 m\u1EB7t da. V\u1EDBi v\u1EBFt b\u1EA9n c\u1EE9ng \u0111\u1EA7u, h\xE3y d\xF9ng dung d\u1ECBch v\u1EC7 sinh chuy\xEAn d\u1EE5ng cho \u0111\u1ED3 da.\n\n2. D\u01B0\u1EE1ng \u1EA9m cho da\nSau khi v\u1EC7 sinh, thoa m\u1ED9t l\u1EDBp m\u1ECFng kem d\u01B0\u1EE1ng da (leather conditioner) ho\u1EB7c m\u1EE1 ch\u1ED3n, \u0111\u1EC3 kho\u1EA3ng 15 ph\xFAt r\u1ED3i lau l\u1EA1i b\u1EB1ng kh\u0103n s\u1EA1ch. D\u01B0\u1EE1ng \u1EA9m gi\xFAp da kh\xF4ng b\u1ECB kh\xF4 n\u1EE9t, gi\u1EEF \u0111\u1ED9 m\u1EC1m m\u1EA1i v\xE0 m\xE0u s\u1EAFc \u0111\u1EC1u \u0111\u1EB9p. Ch\u1EC9 c\u1EA7n th\u1EF1c hi\u1EC7n 1\u20132 th\xE1ng m\u1ED9t l\u1EA7n.\n\n3. C\u1EA5t gi\u1EEF n\u01A1i kh\xF4 tho\xE1ng\nKhi kh\xF4ng s\u1EED d\u1EE5ng, h\xE3y nh\u1ED3i gi\u1EA5y m\u1EC1m v\xE0o trong t\xFAi/v\xED \u0111\u1EC3 gi\u1EEF form, cho v\xE0o t\xFAi v\u1EA3i ch\u1ED1ng b\u1EE5i v\xE0 \u0111\u1EC3 n\u01A1i kh\xF4 r\xE1o, tr\xE1nh \xE1nh n\u1EAFng tr\u1EF1c ti\u1EBFp. Kh\xF4ng b\u1ECDc \u0111\u1ED3 da trong t\xFAi nilon k\xEDn v\xEC da c\u1EA7n "th\u1EDF"; m\xF4i tr\u01B0\u1EDDng \u1EA9m k\xEDn d\u1EC5 khi\u1EBFn da m\u1ED1c.\n\n4. X\u1EED l\xFD khi b\u1ECB \u01B0\u1EDBt\nN\u1EBFu \u0111\u1ED3 da d\xEDnh m\u01B0a, th\u1EA5m kh\xF4 b\u1EB1ng kh\u0103n m\u1EC1m v\xE0 \u0111\u1EC3 kh\xF4 t\u1EF1 nhi\xEAn \u1EDF nhi\u1EC7t \u0111\u1ED9 ph\xF2ng. Kh\xF4ng d\xF9ng m\xE1y s\u1EA5y hay ph\u01A1i n\u1EAFng g\u1EAFt \u2014 nhi\u1EC7t \u0111\u1ED9 cao l\xE0m da co, c\u1EE9ng v\xE0 n\u1EE9t.\n\n5. Mang \u0111i b\u1EA3o d\u01B0\u1EE1ng \u0111\u1ECBnh k\u1EF3\nV\u1EDBi s\u1EA3n ph\u1EA9m c\u1EE7a BI99, b\u1EA1n \u0111\u01B0\u1EE3c b\u1EA3o h\xE0nh 1 th\xE1ng v\xE0 h\u1ED7 tr\u1EE3 b\u1EA3o d\u01B0\u1EE1ng, \u0111\xE1nh b\xF3ng, s\u1EEDa \u0111\u01B0\u1EDDng ch\u1EC9 tr\u1ECDn \u0111\u1EDDi t\u1EA1i x\u01B0\u1EDFng. \u0110\u1EEBng ng\u1EA7n ng\u1EA1i mang s\u1EA3n ph\u1EA9m gh\xE9 x\u01B0\u1EDFng \u0111\u1EC3 th\u1EE3 da ki\u1EC3m tra v\xE0 ch\u0103m s\xF3c gi\xFAp b\u1EA1n.',
        "daysAgo": 2
      },
      {
        "title": "C\xE1ch ph\xE2n bi\u1EC7t da th\u1EADt v\xE0 da gi\u1EA3 \u0111\u01A1n gi\u1EA3n, ch\xEDnh x\xE1c",
        "slug": "cach-phan-biet-da-that-da-gia",
        "coverImageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
        "excerpt": 'Da th\u1EADt, da PU, da microfiber... th\u1ECB tr\u01B0\u1EDDng c\xF3 qu\xE1 nhi\u1EC1u lo\u1EA1i "da" khi\u1EBFn ng\u01B0\u1EDDi mua b\u1ED1i r\u1ED1i. B\xE0i vi\u1EBFt n\xE0y gi\xFAp b\u1EA1n nh\u1EADn bi\u1EBFt da b\xF2 th\u1EADt ch\u1EC9 v\u1EDBi v\xE0i thao t\xE1c \u0111\u01A1n gi\u1EA3n.',
        "content": 'Kh\xF4ng ph\u1EA3i s\u1EA3n ph\u1EA9m n\xE0o g\u1EAFn m\xE1c "da" c\u0169ng l\xE0 da th\u1EADt. D\u01B0\u1EDBi \u0111\xE2y l\xE0 nh\u1EEFng c\xE1ch ph\xE2n bi\u1EC7t \u0111\u01A1n gi\u1EA3n m\xE0 th\u1EE3 da l\xE2u n\u0103m v\u1EABn d\xF9ng.\n\n1. Quan s\xE1t b\u1EC1 m\u1EB7t\nDa th\u1EADt c\xF3 l\u1ED7 ch\xE2n l\xF4ng t\u1EF1 nhi\xEAn, v\xE2n da kh\xF4ng \u0111\u1EC1u v\xE0 kh\xF4ng l\u1EB7p l\u1EA1i theo quy lu\u1EADt. Da gi\u1EA3 (PU, simili) c\xF3 b\u1EC1 m\u1EB7t qu\xE1 \u0111\u1ED3ng \u0111\u1EC1u, v\xE2n da l\u1EB7p \u0111i l\u1EB7p l\u1EA1i nh\u01B0 \u0111\u01B0\u1EE3c in khu\xF4n.\n\n2. \u1EA4n tay ki\u1EC3m tra \u0111\u1ED9 \u0111\xE0n h\u1ED3i\nD\xF9ng ng\xF3n tay \u1EA5n m\u1EA1nh l\xEAn b\u1EC1 m\u1EB7t da r\u1ED3i th\u1EA3 ra. Da th\u1EADt s\u1EBD xu\u1EA5t hi\u1EC7n c\xE1c n\u1EBFp nh\u0103n li ti quanh ch\u1ED7 \u1EA5n v\xE0 nhanh ch\xF3ng tr\u1EDF l\u1EA1i tr\u1EA1ng th\xE1i ban \u0111\u1EA7u. Da gi\u1EA3 b\u1ECB \u1EA5n s\u1EBD kh\xF4ng t\u1EA1o n\u1EBFp nh\u0103n t\u1EF1 nhi\xEAn ho\u1EB7c \u0111\u1EC3 l\u1EA1i v\u1EBFt l\xF5m l\xE2u.\n\n3. Ki\u1EC3m tra b\u1EB1ng n\u01B0\u1EDBc\nNh\u1ECF m\u1ED9t gi\u1ECDt n\u01B0\u1EDBc l\xEAn b\u1EC1 m\u1EB7t. Da th\u1EADt th\u1EA5m n\u01B0\u1EDBc t\u1EEB t\u1EEB v\xE0 \u0111\u1EC3 l\u1EA1i v\u1EC7t s\u1EABm m\xE0u khi th\u1EA5m. Da gi\u1EA3 c\xF3 l\u1EDBp ph\u1EE7 nh\u1EF1a n\xEAn n\u01B0\u1EDBc \u0111\u1ECDng th\xE0nh gi\u1ECDt, tr\u01B0\u1EE3t \u0111i m\xE0 kh\xF4ng th\u1EA5m.\n\n4. Ng\u1EEDi m\xF9i\nDa th\u1EADt c\xF3 m\xF9i ngai ng\xE1i \u0111\u1EB7c tr\u01B0ng c\u1EE7a da thu\u1ED9c. Da gi\u1EA3 th\u01B0\u1EDDng c\xF3 m\xF9i nh\u1EF1a, m\xF9i h\xF3a ch\u1EA5t h\u1EAFc.\n\n5. Ki\u1EC3m tra m\u1EB7t tr\xE1i v\xE0 c\u1EA1nh c\u1EAFt\nM\u1EB7t tr\xE1i c\u1EE7a da th\u1EADt l\xE0 l\u1EDBp da l\u1ED9n x\xF9 x\xEC, s\u1EDD v\xE0o th\u1EA5y nh\xE1m tay. Da gi\u1EA3 m\u1EB7t tr\xE1i th\u01B0\u1EDDng l\xE0 l\u1EDBp v\u1EA3i ho\u1EB7c foam tr\u01A1n. \u1EDE c\u1EA1nh c\u1EAFt, da th\u1EADt cho th\u1EA5y c\xE1c s\u1EE3i da x\u1ED1p \u0111an xen, c\xF2n da gi\u1EA3 l\u1ED9 r\xF5 l\u1EDBp nh\u1EF1a v\xE0 l\u1EDBp v\u1EA3i n\u1EC1n.\n\nL\u01B0u \xFD: m\u1ED9t s\u1ED1 lo\u1EA1i da gi\u1EA3 cao c\u1EA5p (microfiber) kh\xE1 gi\u1ED1ng da th\u1EADt. C\xE1ch ch\u1EAFc ch\u1EAFn nh\u1EA5t l\xE0 mua t\u1EA1i x\u01B0\u1EDFng, c\u1EEDa h\xE0ng uy t\xEDn c\xF3 cam k\u1EBFt ch\u1EA5t li\u1EC7u v\xE0 ch\xEDnh s\xE1ch b\u1EA3o h\xE0nh r\xF5 r\xE0ng \u2014 nh\u01B0 cam k\u1EBFt da b\xF2 th\u1EADt 100% t\u1EA1i BI99.',
        "daysAgo": 6
      },
      {
        "title": "G\u1EE3i \xFD ph\u1ED1i \u0111\u1ED3 v\u1EDBi t\xFAi da cho qu\xFD \xF4ng l\u1ECBch l\xE3m",
        "slug": "phoi-do-voi-tui-da-quy-ong",
        "coverImageUrl": "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1200&q=80",
        "excerpt": "M\u1ED9t chi\u1EBFc t\xFAi da \u0111\xFAng gu c\xF3 th\u1EC3 n\xE2ng t\u1EA7m c\u1EA3 b\u1ED9 trang ph\u1EE5c. Kh\xE1m ph\xE1 c\xE1c nguy\xEAn t\u1EAFc ph\u1ED1i m\xE0u v\xE0 ch\u1ECDn ki\u1EC3u t\xFAi da ph\xF9 h\u1EE3p v\u1EDBi phong c\xE1ch c\xF4ng s\u1EDF, d\u1EA1o ph\u1ED1 hay du l\u1ECBch.",
        "content": 'T\xFAi da kh\xF4ng ch\u1EC9 l\xE0 v\u1EADt \u0111\u1EF1ng \u0111\u1ED3 \u2014 \u0111\xF3 l\xE0 tuy\xEAn ng\xF4n phong c\xE1ch. D\u01B0\u1EDBi \u0111\xE2y l\xE0 nh\u1EEFng nguy\xEAn t\u1EAFc ph\u1ED1i \u0111\u1ED3 v\u1EDBi t\xFAi da \u0111\u01B0\u1EE3c nhi\u1EC1u qu\xFD \xF4ng tin d\xF9ng.\n\n1. \u0110\u1ED3ng \u0111i\u1EC7u m\xE0u v\u1EDBi gi\xE0y v\xE0 th\u1EAFt l\u01B0ng\nNguy\xEAn t\u1EAFc kinh \u0111i\u1EC3n: m\xE0u t\xFAi da n\xEAn c\xF9ng t\xF4ng v\u1EDBi gi\xE0y da v\xE0 th\u1EAFt l\u01B0ng. N\xE2u \u0111i v\u1EDBi n\xE2u, \u0111en \u0111i v\u1EDBi \u0111en. S\u1EF1 \u0111\u1ED3ng \u0111i\u1EC7u n\xE0y t\u1EA1o t\u1ED5ng th\u1EC3 ch\u1EC9n chu, sang tr\u1ECDng m\xE0 kh\xF4ng c\u1EA7n c\u1ED1 g\u1EAFng.\n\n2. Ch\u1ECDn ki\u1EC3u t\xFAi theo ho\xE0n c\u1EA3nh\n\u0110i l\xE0m c\xF4ng s\u1EDF: t\xFAi x\xE1ch tay (briefcase) ho\u1EB7c t\xFAi \u0111eo ch\xE9o d\xE1ng \u0111\u1EE9ng, m\xE0u n\xE2u s\u1EABm ho\u1EB7c \u0111en, phom c\u1EE9ng c\xE1p. D\u1EA1o ph\u1ED1 cu\u1ED1i tu\u1EA7n: t\xFAi \u0111eo ch\xE9o nh\u1ECF g\u1ECDn m\xE0u n\xE2u b\xF2 s\xE1ng, ph\u1ED1i c\xF9ng \xE1o thun, s\u01A1 mi kho\xE1c ngo\xE0i v\xE0 gi\xE0y sneaker da. Du l\u1ECBch: balo da ho\u1EB7c t\xFAi tr\u1ED1ng (duffle) r\u1ED9ng r\xE3i, da s\xE1p c\xE0ng d\xF9ng c\xE0ng \u0111\u1EB9p v\xE0 kh\xF4ng ng\u1EA1i va qu\u1EC7t.\n\n3. C\xE2n \u0111\u1ED1i k\xEDch th\u01B0\u1EDBc t\xFAi v\u1EDBi v\xF3c d\xE1ng\nNg\u01B0\u1EDDi cao l\u1EDBn h\u1EE3p v\u1EDBi t\xFAi kh\u1ED5 l\u1EDBn; ng\u01B0\u1EDDi nh\u1ECF nh\u1EAFn n\xEAn ch\u1ECDn t\xFAi v\u1EEBa v\xE0 nh\u1ECF \u0111\u1EC3 t\u1ED5ng th\u1EC3 c\xE2n \u0111\u1ED1i. T\xFAi qu\xE1 kh\u1ED5 so v\u1EDBi ng\u01B0\u1EDDi m\u1EB7c s\u1EBD "nu\u1ED1t" m\u1EA5t trang ph\u1EE5c.\n\n4. \u0110\u1EC3 ch\u1EA5t da l\xE0m \u0111i\u1EC3m nh\u1EA5n\nKhi \u0111\xE3 mang t\xFAi da th\u1EADt v\u1EDBi v\xE2n da \u0111\u1EB9p, h\xE3y gi\u1EEF trang ph\u1EE5c \u0111\u01A1n gi\u1EA3n: \xE1o tr\u01A1n, qu\u1EA7n t\u1ED1i m\xE0u. Chi\u1EBFc t\xFAi s\u1EBD t\u1EF1 l\xEAn ti\u1EBFng. Ng\u01B0\u1EE3c l\u1EA1i, trang ph\u1EE5c nhi\u1EC1u h\u1ECDa ti\u1EBFt \u0111i c\xF9ng t\xFAi da tr\u01A1n l\xE0 l\u1EF1a ch\u1ECDn an to\xE0n.\n\n5. Ch\u0103m s\xF3c \u0111\u1EC3 t\xFAi lu\xF4n "c\xF3 h\u1ED3n"\nM\u1ED9t chi\u1EBFc t\xFAi da b\xF3ng \u0111\u1EB9p, l\xEAn patina \u0111\u1EC1u m\xE0u lu\xF4n g\xE2y \u1EA5n t\u01B0\u1EE3ng h\u01A1n t\xFAi m\u1EDBi tinh. H\xE3y d\u01B0\u1EE1ng da \u0111\u1ECBnh k\u1EF3 v\xE0 d\xF9ng t\xFAi th\u01B0\u1EDDng xuy\xEAn \u2014 da th\u1EADt \u0111\u1EB9p l\xEAn ch\xEDnh nh\u1EDD \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.',
        "daysAgo": 11
      },
      {
        "title": "Quy tr\xECnh ch\u1EBF t\xE1c m\u1ED9t chi\u1EBFc t\xFAi da th\u1EE7 c\xF4ng t\u1EA1i x\u01B0\u1EDFng",
        "slug": "quy-trinh-che-tac-tui-da-thu-cong",
        "coverImageUrl": "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80",
        "excerpt": "T\u1EEB t\u1EA5m da b\xF2 nguy\xEAn mi\u1EBFng \u0111\u1EBFn chi\u1EBFc t\xFAi ho\xE0n thi\u1EC7n tr\xEAn tay b\u1EA1n l\xE0 h\xE0nh tr\xECnh qua 7 c\xF4ng \u0111o\u1EA1n th\u1EE7 c\xF4ng t\u1EC9 m\u1EC9. M\u1EDDi b\u1EA1n gh\xE9 th\u0103m x\u01B0\u1EDFng c\u1EE7a BI99 qua b\xE0i vi\u1EBFt n\xE0y.",
        "content": "M\u1ED7i chi\u1EBFc t\xFAi da th\u1EE7 c\xF4ng t\u1EA1i BI99 m\u1EA5t t\u1EEB 6 \u0111\u1EBFn 10 gi\u1EDD ch\u1EBF t\xE1c li\xEAn t\u1EE5c. Kh\xE1c v\u1EDBi h\xE0ng s\u1EA3n xu\u1EA5t h\xE0ng lo\u1EA1t, m\u1ECDi c\xF4ng \u0111o\u1EA1n \u0111\u1EC1u qua tay ng\u01B0\u1EDDi th\u1EE3.\n\nB\u01B0\u1EDBc 1: Ch\u1ECDn da\nTh\u1EE3 ch\u1ECDn t\u1EA5m da b\xF2 thu\u1ED9c th\u1EA3o m\u1ED9c (vegetable-tanned), ki\u1EC3m tra \u0111\u1ED9 d\xE0y, v\xE2n da, v\u1EBFt s\u1EB9o t\u1EF1 nhi\xEAn. Ch\u1EC9 ph\u1EA7n da l\u01B0ng \u2014 ph\u1EA7n \u0111\u1EB9p v\xE0 b\u1EC1n nh\u1EA5t c\u1EE7a t\u1EA5m da \u2014 m\u1EDBi d\xF9ng l\xE0m th\xE2n t\xFAi.\n\nB\u01B0\u1EDBc 2: C\u1EAFt r\u1EADp\nR\u1EADp gi\u1EA5y \u0111\u01B0\u1EE3c \u0111\u1EB7t l\xEAn da, c\u1EAFt b\u1EB1ng dao chuy\xEAn d\u1EE5ng theo th\u1EDB da \u0111\u1EC3 s\u1EA3n ph\u1EA9m kh\xF4ng b\u1ECB gi\xE3n, bi\u1EBFn d\u1EA1ng khi s\u1EED d\u1EE5ng l\xE2u d\xE0i.\n\nB\u01B0\u1EDBc 3: L\u1EA1ng m\u1ECFng v\xE0 x\u1EED l\xFD c\u1EA1nh\nC\xE1c m\xE9p gh\xE9p \u0111\u01B0\u1EE3c l\u1EA1ng m\u1ECFng \u0111\u1EC3 \u0111\u01B0\u1EDDng may kh\xF4ng b\u1ECB c\u1ED9m. C\u1EA1nh da \u0111\u01B0\u1EE3c m\xE0i, nhu\u1ED9m v\xE0 \u0111\xE1nh b\xF3ng nhi\u1EC1u l\u1EDBp b\u1EB1ng s\xE1p ong cho \u0111\u1EBFn khi m\u1ECBn v\xE0 b\xF3ng.\n\nB\u01B0\u1EDBc 4: \u0110\u1EE5c l\u1ED7 v\xE0 kh\xE2u tay\nTh\u1EE3 d\xF9ng d\xF9i \u0111\u1EE5c t\u1EEBng l\u1ED7 may theo kho\u1EA3ng c\xE1ch \u0111\u1EC1u t\u0103m t\u1EAFp, r\u1ED3i kh\xE2u b\u1EB1ng k\u1EF9 thu\u1EADt kh\xE2u hai kim (saddle stitch) v\u1EDBi ch\u1EC9 s\xE1p \u2014 \u0111\u01B0\u1EDDng kh\xE2u b\u1EC1n h\u01A1n m\xE1y may v\xEC \u0111\u1EE9t m\u1ED9t m\u0169i, m\u0169i c\xF2n l\u1EA1i v\u1EABn gi\u1EEF ch\u1EAFc.\n\nB\u01B0\u1EDBc 5: G\u1EAFn ph\u1EE5 ki\u1EC7n\nKh\xF3a, khoen, \u0111inh t\xE1n b\u1EB1ng \u0111\u1ED3ng thau nguy\xEAn ch\u1EA5t \u0111\u01B0\u1EE3c g\u1EAFn v\xE0 ki\u1EC3m tra \u0111\u1ED9 ch\u1EAFc ch\u1EAFn, \u0111\u1ED9 m\u01B0\u1EE3t khi \u0111\xF3ng m\u1EDF.\n\nB\u01B0\u1EDBc 6: Ho\xE0n thi\u1EC7n v\xE0 l\xEAn d\u1EA7u\nTo\xE0n b\u1ED9 s\u1EA3n ph\u1EA9m \u0111\u01B0\u1EE3c thoa d\u1EA7u d\u01B0\u1EE1ng, \u0111\xE1nh b\xF3ng th\u1EE7 c\xF4ng, ki\u1EC3m tra t\u1EEBng \u0111\u01B0\u1EDDng ch\u1EC9 tr\u01B0\u1EDBc khi \u0111\xF3ng g\xF3i.\n\n\u0110\xF3 l\xE0 l\xFD do m\u1ED9t chi\u1EBFc t\xFAi da th\u1EE7 c\xF4ng c\xF3 th\u1EC3 \u0111\u1ED3ng h\xE0nh c\xF9ng b\u1EA1n 5\u201310 n\u0103m, c\xE0ng d\xF9ng c\xE0ng \u0111\u1EB9p \u2014 v\xE0 lu\xF4n mang d\u1EA5u \u1EA5n ri\xEAng kh\xF4ng chi\u1EBFc n\xE0o gi\u1ED1ng chi\u1EBFc n\xE0o.",
        "daysAgo": 18
      }
    ];
    var blogBefore = db2.prepare("SELECT COUNT(*) AS n FROM posts").get().n;
    if (blogBefore === 0) {
      const insPost = db2.prepare(
        "INSERT INTO posts (title, slug, cover_image_url, excerpt, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const p of blogPosts) {
        const d = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1e3).toISOString();
        insPost.run(p.title, p.slug, p.coverImageUrl, p.excerpt, p.content, "published", d, d);
      }
      console.log(`  - \u0110\xE3 th\xEAm ${blogPosts.length} b\xE0i vi\u1EBFt blog m\u1EABu`);
    } else {
      console.log(`  - \u0110\xE3 c\xF3 ${blogBefore} b\xE0i vi\u1EBFt, b\u1ECF qua seed blog`);
    }
    var sampleAnnouncements = [
      {
        title: "Sale 11.11 \u2014 \u01AFu \u0111\xE3i l\u1EDBn nh\u1EA5t n\u0103m s\u1EAFp b\u1EAFt \u0111\u1EA7u",
        content: "T\u1EEB 00:00 ng\xE0y 11/11, to\xE0n b\u1ED9 v\xED da, t\xFAi x\xE1ch v\xE0 th\u1EAFt l\u01B0ng gi\u1EA3m \u0111\u1EBFn 30%, k\xE8m voucher SALE1111 gi\u1EA3m th\xEAm 11% cho \u0111\u01A1n t\u1EEB 500.000\u0111. S\u1ED1 l\u01B0\u1EE3ng voucher c\xF3 h\u1EA1n \u2014 l\u01B0u m\xE3 ngay t\u1EEB h\xF4m nay.",
        badge: "Khuy\u1EBFn m\xE3i s\u1EAFp di\u1EC5n ra",
        cta_text: "S\u0103n sale ngay",
        cta_link: "/khuyen-mai",
        image_url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1200&q=80",
        image_caption: "V\xED da b\xF2 BI99",
        show_on_banner: 1,
        send_notification: 1,
        daysAgo: 0
      },
      {
        title: "Ch\xEDnh s\xE1ch b\u1EA3o h\xE0nh 1 th\xE1ng cho m\u1ECDi s\u1EA3n ph\u1EA9m da th\u1EADt",
        content: "T\u1EEB nay, m\u1ECDi s\u1EA3n ph\u1EA9m da th\u1EADt t\u1EA1i BI99 \u0111\u1EC1u \u0111\u01B0\u1EE3c b\u1EA3o h\xE0nh 1 th\xE1ng v\u1EC1 \u0111\u01B0\u1EDDng ch\u1EC9, kh\xF3a k\xE9o v\xE0 l\u1ED7i ch\u1EA5t li\u1EC7u; h\u1ED7 tr\u1EE3 \u0111\xE1nh b\xF3ng, d\u01B0\u1EE1ng da mi\u1EC5n ph\xED trong 6 th\xE1ng \u0111\u1EA7u.",
        badge: "Ch\xEDnh s\xE1ch m\u1EDBi",
        cta_text: "",
        cta_link: "",
        image_url: "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1200&q=80",
        image_caption: "Th\u1EAFt l\u01B0ng da b\xF2 BI99",
        show_on_banner: 0,
        send_notification: 1,
        daysAgo: 2
      },
      {
        title: "B\u1ED9 s\u01B0u t\u1EADp Thu \u2014 \u0110\xF4ng 2026 v\u1EEBa c\u1EADp b\u1EBFn",
        content: "12 m\u1EABu t\xFAi x\xE1ch v\xE0 v\xED da b\xF2 s\xE1p m\u1EDBi v\u1EDBi t\xF4ng n\xE2u cognac ch\u1EE7 \u0111\u1EA1o \u0111\xE3 c\xF3 m\u1EB7t t\u1EA1i c\u1EEDa h\xE0ng v\xE0 tr\xEAn website. Gh\xE9 xem v\xE0 tr\u1EA3i nghi\u1EC7m ch\u1EA5t da th\u1EADt ngay h\xF4m nay.",
        badge: "H\xE0ng m\u1EDBi v\u1EC1",
        cta_text: "Kh\xE1m ph\xE1 ngay",
        cta_link: "/bo-suu-tap",
        image_url: "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80",
        image_caption: "T\xFAi x\xE1ch da b\xF2 BI99",
        show_on_banner: 0,
        send_notification: 0,
        daysAgo: 4
      }
    ];
    var annIns = db2.prepare(
      "INSERT INTO announcements (title, content, badge, cta_text, cta_link, image_url, image_caption, show_on_banner, send_notification, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
    );
    var annAdded = 0;
    for (const a of sampleAnnouncements) {
      const exists = db2.prepare("SELECT id FROM announcements WHERE title = ?").get(a.title);
      if (!exists) {
        const d = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1e3).toISOString().slice(0, 19).replace("T", " ");
        annIns.run(
          a.title,
          a.content,
          a.badge,
          a.cta_text,
          a.cta_link,
          a.image_url,
          a.image_caption,
          a.show_on_banner,
          a.send_notification,
          d,
          d
        );
        annAdded++;
      }
    }
    console.log(annAdded > 0 ? `  - \u0110\xE3 th\xEAm ${annAdded} th\xF4ng b\xE1o m\u1EABu` : "  - \u0110\xE3 c\xF3 th\xF4ng b\xE1o, b\u1ECF qua seed announcements");
    console.log("Seed ho\xE0n t\u1EA5t!");
  }
});

// middleware/auth.js
var require_auth = __commonJS({
  "middleware/auth.js"(exports2, module2) {
    var jwt = require("jsonwebtoken");
    var JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh. H\xE3y \u0111\u1EB7t JWT_SECRET trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng tr\u01B0\u1EDBc khi ch\u1EA1y production.");
      }
      JWT_SECRET = "dev-only-secret-khong-dung-cho-production";
    }
    if (!process.env.JWT_SECRET) {
      console.warn(
        "[C\u1EA2NH B\xC1O B\u1EA2O M\u1EACT] JWT_SECRET ch\u01B0a \u0111\u01B0\u1EE3c \u0111\u1EB7t trong bi\u1EBFn m\xF4i tr\u01B0\u1EDDng \u2014 \u0111ang d\xF9ng secret m\u1EB7c \u0111\u1ECBnh. H\xE3y \u0111\u1EB7t JWT_SECRET trong file .env tr\u01B0\u1EDBc khi ch\u1EA1y production, n\u1EBFu kh\xF4ng token c\xF3 th\u1EC3 b\u1ECB gi\u1EA3 m\u1EA1o."
      );
    }
    function auth(req, res, next) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: "Thi\u1EBFu token x\xE1c th\u1EF1c" });
      try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
      } catch (e) {
        return res.status(401).json({ error: "Token kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n" });
      }
    }
    function adminOnly(req, res, next) {
      if (req.user && req.user.role === "admin") return next();
      return res.status(403).json({ error: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi \u0111\u01B0\u1EE3c th\u1EF1c hi\u1EC7n" });
    }
    function staffOnly(req, res, next) {
      if (req.user && (req.user.role === "admin" || req.user.role === "sale")) return next();
      return res.status(403).json({ error: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn v\xE0 nh\xE2n vi\xEAn sale m\u1EDBi \u0111\u01B0\u1EE3c th\u1EF1c hi\u1EC7n" });
    }
    function signToken(user) {
      return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
    }
    module2.exports = { auth, adminOnly, staffOnly, signToken, JWT_SECRET };
  }
});

// routes/auth.js
var require_auth2 = __commonJS({
  "routes/auth.js"(exports2, module2) {
    var express2 = require("express");
    var bcrypt = require("bcryptjs");
    var db2 = require_db();
    var { auth, signToken } = require_auth();
    var router = express2.Router();
    var loginAttempts = /* @__PURE__ */ new Map();
    var LOGIN_LIMIT = 10;
    var LOGIN_WINDOW_MS = 60 * 1e3;
    function loginRateLimit(req, res, next) {
      const ip = String(req.ip || req.connection && req.connection.remoteAddress || "unknown");
      const now = Date.now();
      if (loginAttempts.size > 5e3) {
        for (const [k, v] of loginAttempts) {
          if (v.resetAt <= now) loginAttempts.delete(k);
        }
      }
      let entry = loginAttempts.get(ip);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        loginAttempts.set(ip, entry);
      }
      if (entry.count > LOGIN_LIMIT) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1e3);
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({
          error: "Qu\xE1 nhi\u1EC1u l\u1EA7n \u0111\u0103ng nh\u1EADp th\u1EA5t b\u1EA1i, vui l\xF2ng th\u1EED l\u1EA1i sau 1 ph\xFAt"
        });
      }
      next();
    }
    function recordLoginFailure(req) {
      const ip = String(req.ip || req.connection && req.connection.remoteAddress || "unknown");
      const now = Date.now();
      let entry = loginAttempts.get(ip);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        loginAttempts.set(ip, entry);
      }
      entry.count += 1;
    }
    var registerAttempts = /* @__PURE__ */ new Map();
    var REGISTER_LIMIT = 10;
    var REGISTER_WINDOW_MS = 60 * 60 * 1e3;
    function registerRateLimit(req, res, next) {
      const ip = String(req.ip || req.connection && req.connection.remoteAddress || "unknown");
      const now = Date.now();
      let entry = registerAttempts.get(ip);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + REGISTER_WINDOW_MS };
        registerAttempts.set(ip, entry);
      }
      entry.count += 1;
      if (entry.count > REGISTER_LIMIT) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1e3);
        res.set("Retry-After", String(retryAfter));
        return res.status(429).json({ error: "B\u1EA1n \u0111\xE3 t\u1EA1o qu\xE1 nhi\u1EC1u t\xE0i kho\u1EA3n, vui l\xF2ng th\u1EED l\u1EA1i sau" });
      }
      next();
    }
    router.post("/register", registerRateLimit, (req, res) => {
      const { name, email, password } = req.body || {};
      if (!name || !email || !password)
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 h\u1ECD t\xEAn, email, m\u1EADt kh\u1EA9u" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
        return res.status(400).json({ error: "Email kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng" });
      if (password.length < 8)
        return res.status(400).json({ error: "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 8 k\xFD t\u1EF1" });
      const exists = db2.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
      if (exists) return res.status(400).json({ error: "Email \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD" });
      const hash = bcrypt.hashSync(password, 10);
      const info = db2.prepare(
        "INSERT INTO users (name, email, password_hash, known_tier) VALUES (?, ?, ?, 'potential')"
      ).run(name.trim(), email.trim().toLowerCase(), hash);
      const user = db2.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ user, token: signToken(user) });
    });
    router.post("/login", loginRateLimit, (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password)
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp email v\xE0 m\u1EADt kh\u1EA9u" });
      const user = db2.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        recordLoginFailure(req);
        return res.status(401).json({ error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng" });
      }
      const safe = { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
      res.json({ user: safe, token: signToken(safe) });
    });
    router.get("/me", auth, (req, res) => {
      const user = db2.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(req.user.id);
      if (!user) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" });
      res.json({ user });
    });
    module2.exports = router;
  }
});

// routes/categories.js
var require_categories = __commonJS({
  "routes/categories.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    router.get("/", (req, res) => {
      const rows = db2.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c ORDER BY c.name
  `).all();
      const uncategorized = db2.prepare("SELECT COUNT(*) AS c FROM products WHERE category_id IS NULL").get().c;
      res.json({ categories: rows, uncategorized_count: uncategorized });
    });
    router.get("/:id/products", auth, staffOnly, (req, res) => {
      const products = req.params.id === "none" ? db2.prepare("SELECT id, name, price, stock, image_url FROM products WHERE category_id IS NULL ORDER BY name").all() : db2.prepare("SELECT id, name, price, stock, image_url FROM products WHERE category_id = ? ORDER BY name").all(req.params.id);
      res.json({ products });
    });
    router.get("/:id", (req, res) => {
      const row = db2.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
      if (!row) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y danh m\u1EE5c" });
      res.json({ category: row });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { name, description } = req.body || {};
      if (!String(name || "").trim()) return res.status(400).json({ error: "T\xEAn danh m\u1EE5c l\xE0 b\u1EAFt bu\u1ED9c" });
      try {
        const info = db2.prepare("INSERT INTO categories (name, description) VALUES (?, ?)").run(name.trim(), (description || "").trim());
        res.status(201).json({ category: db2.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid) });
      } catch (e) {
        res.status(400).json({ error: "T\xEAn danh m\u1EE5c \u0111\xE3 t\u1ED3n t\u1EA1i" });
      }
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { name, description } = req.body || {};
      if (!String(name || "").trim()) return res.status(400).json({ error: "T\xEAn danh m\u1EE5c l\xE0 b\u1EAFt bu\u1ED9c" });
      try {
        const info = db2.prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?").run(name.trim(), (description || "").trim(), req.params.id);
        if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y danh m\u1EE5c" });
        res.json({ category: db2.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id) });
      } catch (e) {
        res.status(400).json({ error: "T\xEAn danh m\u1EE5c \u0111\xE3 t\u1ED3n t\u1EA1i" });
      }
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const info = db2.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y danh m\u1EE5c" });
      res.json({ message: "\u0110\xE3 x\xF3a danh m\u1EE5c" });
    });
    module2.exports = router;
  }
});

// routes/products.js
var require_products = __commonJS({
  "routes/products.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    function normVi(text) {
      return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, (m) => m === "\u0111" ? "d" : "D").toLowerCase();
    }
    function liveSaleMap() {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const ev = db2.prepare(
        `SELECT id FROM promo_events WHERE is_active = 1
       AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
       ORDER BY id DESC LIMIT 1`
      ).get(now, now);
      const map = /* @__PURE__ */ new Map();
      if (ev) {
        for (const r of db2.prepare("SELECT product_id, sale_price FROM promo_event_products WHERE event_id = ?").all(ev.id)) map.set(r.product_id, r.sale_price);
      }
      return map;
    }
    function withSale(p, saleMap) {
      if (!p) return p;
      const sp = saleMap.get(p.id);
      if (sp && p.price > 0) {
        p.sale_price = sp;
        p.discount_percent = Math.round((1 - sp / p.price) * 100);
      }
      return p;
    }
    var SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;
    router.get("/", (req, res) => {
      const { category, search, sort, min_price, max_price, showcase } = req.query;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
      const offset = (page - 1) * limit;
      const conds = [];
      if (showcase === "1") conds.push("p.showcase = 1");
      const params = [];
      if (category) {
        conds.push("p.category_id = ?");
        params.push(category);
      }
      if (search) {
        const norm = normVi(search);
        conds.push("(p.name LIKE ? OR p.description LIKE ? OR p.name_norm LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${norm}%`);
      }
      if (min_price !== void 0 && min_price !== "") {
        conds.push("p.price >= ?");
        params.push(parseInt(min_price) || 0);
      }
      if (max_price !== void 0 && max_price !== "") {
        conds.push("p.price <= ?");
        params.push(parseInt(max_price) || 0);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const sorts = {
        "price-asc": "p.price ASC",
        "price-desc": "p.price DESC",
        "newest": "p.created_at DESC",
        "oldest": "p.id ASC",
        "name": "p.name ASC"
      };
      const orderBy = showcase === "1" ? "ORDER BY p.showcase_order ASC, p.id ASC" : "ORDER BY " + (sorts[sort] || "p.id DESC");
      const total = db2.prepare(`SELECT COUNT(*) AS n FROM products p ${where}`).get(...params).n;
      const saleMap = liveSaleMap();
      const products = db2.prepare(`${SELECT} ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset).map((p) => withSale(p, saleMap));
      if (products.length) {
        const ids = products.map((p) => p.id);
        const vc = db2.prepare(
          `SELECT product_id, COUNT(*) AS c FROM product_variants
       WHERE product_id IN (${ids.map(() => "?").join(",")}) AND is_active = 1 GROUP BY product_id`
        ).all(...ids);
        const vcMap = new Map(vc.map((r) => [r.product_id, r.c]));
        for (const p of products) p.variant_count = vcMap.get(p.id) || 0;
      }
      res.json({ products, page, limit, total, totalPages: Math.ceil(total / limit) });
    });
    router.get("/:id", (req, res) => {
      const p = db2.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
      if (!p) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      withSale(p, liveSaleMap());
      p.variants = getActiveVariants(p.id);
      p.images = getProductImages(p.id);
      res.json({ product: p });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { category_id, name, description, price, stock, image_url } = req.body || {};
      if (!String(name || "").trim() || price === void 0)
        return res.status(400).json({ error: "T\xEAn v\xE0 gi\xE1 s\u1EA3n ph\u1EA9m l\xE0 b\u1EAFt bu\u1ED9c" });
      const priceNum = parseInt(price) || 0;
      const stockNum = parseInt(stock) || 0;
      if (priceNum < 0 || stockNum < 0)
        return res.status(400).json({ error: "Gi\xE1 v\xE0 t\u1ED3n kho kh\xF4ng \u0111\u01B0\u1EE3c \xE2m" });
      const info = db2.prepare(
        `INSERT INTO products (category_id, name, description, price, stock, image_url, name_norm)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        category_id || null,
        String(name).trim(),
        (description || "").trim(),
        priceNum,
        stockNum,
        (image_url || "").trim(),
        normVi(name)
      );
      res.status(201).json({ product: db2.prepare(`${SELECT} WHERE p.id = ?`).get(info.lastInsertRowid) });
    });
    router.put("/showcase", auth, staffOnly, (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isFinite) : [];
      if (ids.length > 10) return res.status(400).json({ error: "B\u1ED9 s\u01B0u t\u1EADp tr\u01B0ng b\xE0y t\u1ED1i \u0111a 10 s\u1EA3n ph\u1EA9m" });
      const tx = db2.transaction(() => {
        db2.prepare("UPDATE products SET showcase = 0, showcase_order = 0").run();
        const upd = db2.prepare("UPDATE products SET showcase = 1, showcase_order = ? WHERE id = ?");
        ids.forEach((id, i) => upd.run(i + 1, id));
      });
      tx();
      const products = db2.prepare(`${SELECT} WHERE p.showcase = 1 ORDER BY p.showcase_order ASC, p.id ASC`).all().map((x) => withSale(x, liveSaleMap()));
      res.json({ products });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { category_id, name, description, price, stock, image_url } = req.body || {};
      if (!String(name || "").trim())
        return res.status(400).json({ error: "T\xEAn s\u1EA3n ph\u1EA9m kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
      const priceNum = parseInt(price) || 0;
      const stockNum = parseInt(stock) || 0;
      if (priceNum < 0 || stockNum < 0)
        return res.status(400).json({ error: "Gi\xE1 v\xE0 t\u1ED3n kho kh\xF4ng \u0111\u01B0\u1EE3c \xE2m" });
      const info = db2.prepare(
        `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?,
     name_norm = ? WHERE id = ?`
      ).run(
        category_id || null,
        String(name).trim(),
        (description || "").trim(),
        priceNum,
        stockNum,
        (image_url || "").trim(),
        normVi(name),
        req.params.id
      );
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      res.json({ product: db2.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id) });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const info = db2.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      res.json({ message: "\u0110\xE3 x\xF3a s\u1EA3n ph\u1EA9m" });
    });
    function getActiveVariants(productId) {
      return db2.prepare("SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC").all(productId);
    }
    function getProductImages(productId) {
      return db2.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC").all(productId);
    }
    router.get("/:id/variants", (req, res) => {
      const p = db2.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
      if (!p) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      res.json({ variants: getActiveVariants(req.params.id) });
    });
    router.post("/:id/variants", auth, staffOnly, (req, res) => {
      const { sku, color, size, price_delta, stock } = req.body || {};
      const cleanSku = String(sku || "").trim();
      if (!cleanSku) return res.status(400).json({ error: "SKU l\xE0 b\u1EAFt bu\u1ED9c v\xE0 ph\u1EA3i duy nh\u1EA5t" });
      const p = db2.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
      if (!p) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      const dup = db2.prepare("SELECT id FROM product_variants WHERE sku = ?").get(cleanSku);
      if (dup) return res.status(409).json({ error: `SKU "${cleanSku}" \u0111\xE3 t\u1ED3n t\u1EA1i` });
      const initStock = Math.max(0, parseInt(stock) || 0);
      try {
        const variant = db2.transaction(() => {
          const info = db2.prepare(
            `INSERT INTO product_variants (product_id, sku, color, size, price_delta, stock)
         VALUES (?, ?, ?, ?, ?, ?)`
          ).run(
            req.params.id,
            cleanSku,
            String(color || "").trim(),
            String(size || "").trim(),
            parseInt(price_delta) || 0,
            initStock
          );
          if (initStock > 0) {
            db2.logStockMovement({
              variant_id: info.lastInsertRowid,
              type: "IN",
              qty: initStock,
              ref_type: "variant_create",
              ref_id: info.lastInsertRowid,
              note: `T\u1EA1o bi\u1EBFn th\u1EC3 ${cleanSku}`
            });
          }
          return db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(info.lastInsertRowid);
        })();
        res.status(201).json({ variant });
      } catch (e) {
        if (String(e.message).includes("UNIQUE"))
          return res.status(409).json({ error: `SKU "${cleanSku}" \u0111\xE3 t\u1ED3n t\u1EA1i` });
        throw e;
      }
    });
    router.put("/variants/:variantId", auth, staffOnly, (req, res) => {
      if (req.body && req.body.stock !== void 0)
        return res.status(400).json({
          error: "Kh\xF4ng \u0111\u01B0\u1EE3c s\u1EEDa t\u1ED3n kho tr\u1EF1c ti\u1EBFp t\u1EA1i \u0111\xE2y. H\xE3y d\xF9ng phi\u1EBFu nh\u1EADp h\xE0ng ho\u1EB7c phi\u1EBFu \u0111i\u1EC1u ch\u1EC9nh kho."
        });
      const v = db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(req.params.variantId);
      if (!v) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bi\u1EBFn th\u1EC3" });
      const { color, size, price_delta, is_active } = req.body || {};
      db2.prepare(
        `UPDATE product_variants SET color = ?, size = ?, price_delta = ?, is_active = ? WHERE id = ?`
      ).run(
        color !== void 0 ? String(color).trim() : v.color,
        size !== void 0 ? String(size).trim() : v.size,
        price_delta !== void 0 ? parseInt(price_delta) || 0 : v.price_delta,
        is_active !== void 0 ? is_active ? 1 : 0 : v.is_active,
        req.params.variantId
      );
      res.json({ variant: db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(req.params.variantId) });
    });
    router.delete("/variants/:variantId", auth, staffOnly, (req, res) => {
      const v = db2.prepare("SELECT id FROM product_variants WHERE id = ?").get(req.params.variantId);
      if (!v) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bi\u1EBFn th\u1EC3" });
      db2.prepare("UPDATE product_variants SET is_active = 0 WHERE id = ?").run(req.params.variantId);
      res.json({ message: "\u0110\xE3 \u1EA9n bi\u1EBFn th\u1EC3" });
    });
    router.get("/:id/images", (req, res) => {
      const p = db2.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
      if (!p) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      res.json({ images: getProductImages(req.params.id) });
    });
    router.post("/:id/images", auth, staffOnly, (req, res) => {
      const { image_url, variant_id, sort_order } = req.body || {};
      const url = String(image_url || "").trim();
      if (!url) return res.status(400).json({ error: "image_url l\xE0 b\u1EAFt bu\u1ED9c" });
      const p = db2.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
      if (!p) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      let vid = null;
      if (variant_id !== void 0 && variant_id !== null && variant_id !== "") {
        const v = db2.prepare("SELECT id FROM product_variants WHERE id = ? AND product_id = ?").get(variant_id, req.params.id);
        if (!v) return res.status(400).json({ error: "variant_id kh\xF4ng thu\u1ED9c s\u1EA3n ph\u1EA9m n\xE0y" });
        vid = v.id;
      }
      const info = db2.prepare(
        `INSERT INTO product_images (product_id, variant_id, image_url, sort_order)
     VALUES (?, ?, ?, ?)`
      ).run(req.params.id, vid, url, parseInt(sort_order) || 0);
      res.status(201).json({ image: db2.prepare("SELECT * FROM product_images WHERE id = ?").get(info.lastInsertRowid) });
    });
    router.delete("/images/:imageId", auth, staffOnly, (req, res) => {
      const info = db2.prepare("DELETE FROM product_images WHERE id = ?").run(req.params.imageId);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u1EA3nh" });
      res.json({ message: "\u0110\xE3 x\xF3a \u1EA3nh" });
    });
    module2.exports = router;
  }
});

// routes/vouchers.js
var require_vouchers = __commonJS({
  "routes/vouchers.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    function normCode(code) {
      return String(code || "").trim().toUpperCase();
    }
    function parseExpiry(expiry) {
      if (!expiry) return null;
      const d = new Date(expiry);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    function validatePayload(body, isCreate) {
      const clean = {};
      if (isCreate) {
        clean.code = normCode(body.code);
        if (!clean.code) return { ok: false, error: "M\xE3 voucher l\xE0 b\u1EAFt bu\u1ED9c" };
        if (!["percent", "fixed"].includes(body.type))
          return { ok: false, error: "Lo\u1EA1i voucher ph\u1EA3i l\xE0 percent ho\u1EB7c fixed" };
        clean.type = body.type;
      }
      if (body.value !== void 0) {
        const value = parseInt(body.value);
        if (isNaN(value) || value <= 0)
          return { ok: false, error: "Gi\xE1 tr\u1ECB voucher ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn d\u01B0\u01A1ng" };
        const type = isCreate ? body.type : null;
        if (type === "percent" || body.type === "percent") {
          if (value < 1 || value > 100)
            return { ok: false, error: "Voucher ph\u1EA7n tr\u0103m ch\u1EC9 \u0111\u01B0\u1EE3c t\u1EEB 1 \u0111\u1EBFn 100" };
        }
        clean.value = value;
      } else if (isCreate) {
        return { ok: false, error: "Gi\xE1 tr\u1ECB voucher l\xE0 b\u1EAFt bu\u1ED9c" };
      }
      if (body.min_order !== void 0) {
        const minOrder = parseInt(body.min_order) || 0;
        if (minOrder < 0) return { ok: false, error: "\u0110\u01A1n t\u1ED1i thi\u1EC3u kh\xF4ng \u0111\u01B0\u1EE3c \xE2m" };
        clean.min_order = minOrder;
      } else if (isCreate) {
        clean.min_order = 0;
      }
      if (body.expiry !== void 0) {
        if (body.expiry) {
          const iso = parseExpiry(body.expiry);
          if (!iso) return { ok: false, error: "Ng\xE0y h\u1EBFt h\u1EA1n kh\xF4ng h\u1EE3p l\u1EC7" };
          if (new Date(iso).getTime() <= Date.now())
            return { ok: false, error: "Ng\xE0y h\u1EBFt h\u1EA1n ph\u1EA3i \u1EDF t\u01B0\u01A1ng lai" };
          clean.expiry = iso;
        } else {
          clean.expiry = null;
        }
      }
      if (body.usage_limit !== void 0) {
        const limit = parseInt(body.usage_limit) || 0;
        if (limit < 0) return { ok: false, error: "Gi\u1EDBi h\u1EA1n l\u01B0\u1EE3t d\xF9ng kh\xF4ng \u0111\u01B0\u1EE3c \xE2m" };
        clean.usage_limit = limit;
      } else if (isCreate) {
        clean.usage_limit = 0;
      }
      if (body.is_active !== void 0) {
        clean.is_active = body.is_active ? 1 : 0;
      }
      return { ok: true, clean };
    }
    function validateVoucher(dbConn, code, orderTotal) {
      const total = parseInt(orderTotal) || 0;
      const v = dbConn.prepare("SELECT * FROM vouchers WHERE code = ?").get(normCode(code));
      if (!v) return { valid: false, reason: "NOT_FOUND" };
      if (!v.is_active) return { valid: false, reason: "INACTIVE" };
      if (v.expiry && new Date(v.expiry).getTime() <= Date.now())
        return { valid: false, reason: "EXPIRED" };
      if (total < (v.min_order || 0)) return { valid: false, reason: "MIN_ORDER" };
      if (v.usage_limit > 0 && v.used_count >= v.usage_limit)
        return { valid: false, reason: "LIMIT_REACHED" };
      const discount = v.type === "percent" ? Math.floor(total * v.value / 100) : Math.min(v.value, total);
      return { valid: true, voucher: v, discount, final_total: total - discount };
    }
    var REASON_MSG = {
      NOT_FOUND: "M\xE3 khuy\u1EBFn m\xE3i kh\xF4ng t\u1ED3n t\u1EA1i",
      INACTIVE: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 b\u1ECB t\u1EAFt",
      EXPIRED: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 h\u1EBFt h\u1EA1n",
      MIN_ORDER: "\u0110\u01A1n h\xE0ng ch\u01B0a \u0111\u1EA1t gi\xE1 tr\u1ECB t\u1ED1i thi\u1EC3u \u0111\u1EC3 d\xF9ng m\xE3 n\xE0y",
      LIMIT_REACHED: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 h\u1EBFt l\u01B0\u1EE3t s\u1EED d\u1EE5ng"
    };
    router.get("/", auth, staffOnly, (req, res) => {
      const conds = [];
      const params = [];
      if (req.query.is_active !== void 0 && req.query.is_active !== "") {
        conds.push("is_active = ?");
        params.push(req.query.is_active ? 1 : 0);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const vouchers = db2.prepare(`SELECT * FROM vouchers ${where} ORDER BY id DESC`).all(...params);
      res.json({ vouchers });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { ok, error, clean } = validatePayload(req.body || {}, true);
      if (!ok) return res.status(400).json({ error });
      const exists = db2.prepare("SELECT id FROM vouchers WHERE code = ?").get(clean.code);
      if (exists) return res.status(409).json({ error: "M\xE3 voucher \u0111\xE3 t\u1ED3n t\u1EA1i" });
      const info = db2.prepare(
        `INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(clean.code, clean.type, clean.value, clean.min_order, clean.expiry, clean.usage_limit, clean.is_active ?? 1);
      res.status(201).json({ voucher: db2.prepare("SELECT * FROM vouchers WHERE id = ?").get(info.lastInsertRowid) });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const v = db2.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
      if (!v) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y voucher" });
      const { ok, error, clean } = validatePayload(req.body || {}, false);
      if (!ok) return res.status(400).json({ error });
      if (clean.value !== void 0 && v.type === "percent" && (clean.value < 1 || clean.value > 100))
        return res.status(400).json({ error: "Voucher ph\u1EA7n tr\u0103m ch\u1EC9 \u0111\u01B0\u1EE3c t\u1EEB 1 \u0111\u1EBFn 100" });
      const sets = [];
      const params = [];
      for (const k of ["value", "min_order", "expiry", "usage_limit", "is_active"]) {
        if (clean[k] !== void 0) {
          sets.push(`${k} = ?`);
          params.push(clean[k]);
        }
      }
      if (!sets.length) return res.status(400).json({ error: "Kh\xF4ng c\xF3 tr\u01B0\u1EDDng n\xE0o \u0111\u1EC3 c\u1EADp nh\u1EADt" });
      params.push(req.params.id);
      db2.prepare(`UPDATE vouchers SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      res.json({ voucher: db2.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id) });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const v = db2.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
      if (!v) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y voucher" });
      if (v.used_count > 0)
        return res.status(409).json({ error: "Voucher \u0111\xE3 \u0111\u01B0\u1EE3c d\xF9ng, ch\u1EC9 c\xF3 th\u1EC3 t\u1EAFt (is_active = 0)" });
      db2.prepare("DELETE FROM vouchers WHERE id = ?").run(req.params.id);
      res.json({ message: "\u0110\xE3 x\xF3a voucher" });
    });
    router.post("/validate", auth, (req, res) => {
      const { code, order_total } = req.body || {};
      if (!code) return res.status(400).json({ error: "Thi\u1EBFu m\xE3 voucher" });
      const r = validateVoucher(db2, code, order_total);
      if (!r.valid)
        return res.json({ valid: false, reason: r.reason, message: REASON_MSG[r.reason] });
      res.json({ valid: true, discount: r.discount, final_total: r.final_total });
    });
    module2.exports = router;
    module2.exports.validateVoucher = validateVoucher;
  }
});

// lib/tiers.js
var require_tiers = __commonJS({
  "lib/tiers.js"(exports2, module2) {
    var db2 = require_db();
    var TIERS = [
      { key: "diamond", name: "Kim c\u01B0\u01A1ng", cards: 3, percent: 15 },
      { key: "gold", name: "V\xE0ng", cards: 2, percent: 15 },
      { key: "silver", name: "B\u1EA1c", cards: 2, percent: 10 },
      { key: "bronze", name: "\u0110\u1ED3ng", cards: 1, percent: 10 },
      { key: "potential", name: "Ti\u1EC1m n\u0103ng", cards: 1, percent: 10 }
    ];
    var TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));
    var TIER_ORDER = ["potential", "bronze", "silver", "gold", "diamond"];
    var DIAMOND_MIN_SPENT = 2e7;
    var GOLD_MIN_SPENT = 1e7;
    var SILVER_MIN_SPENT = 5e6;
    var BRONZE_MIN_ORDERS = 2;
    function computeTier(orderCount, totalSpent) {
      if (totalSpent >= DIAMOND_MIN_SPENT) return "diamond";
      if (totalSpent >= GOLD_MIN_SPENT) return "gold";
      if (totalSpent >= SILVER_MIN_SPENT) return "silver";
      if (orderCount >= BRONZE_MIN_ORDERS) return "bronze";
      return "potential";
    }
    var SETTLE_DAYS = 7;
    var SETTLED_SQL = `(
  o.satisfied_at IS NOT NULL
  OR (
    o.status = 'delivered'
    AND COALESCE(
      (SELECT MAX(h.created_at) FROM order_status_history h WHERE h.order_id = o.id AND h.to_status = 'delivered'),
      o.created_at
    ) <= datetime('now', '-${SETTLE_DAYS} days')
    AND NOT EXISTS (
      SELECT 1 FROM returns r WHERE r.order_id = o.id AND r.status IN ('requested', 'approved', 'received')
    )
  )
)`;
    function deliveredAtOf(orderId) {
      const r = db2.prepare(
        "SELECT MAX(created_at) AS d FROM order_status_history WHERE order_id = ? AND to_status = 'delivered'"
      ).get(orderId);
      return r && r.d ? r.d : null;
    }
    function parseDbTime(s) {
      if (!s) return null;
      const str = String(s);
      return /* @__PURE__ */ new Date(str.replace(" ", "T") + (str.endsWith("Z") ? "" : "Z"));
    }
    function settleInfo(order) {
      const delivered_at = deliveredAtOf(order.id);
      const base = delivered_at || (order.status === "delivered" ? order.created_at : null);
      let points_settled = false;
      if (order.satisfied_at) points_settled = true;
      else if (order.status === "delivered" && base) {
        const open = db2.prepare(
          "SELECT 1 FROM returns WHERE order_id = ? AND status IN ('requested', 'approved', 'received')"
        ).get(order.id);
        if (!open && Date.now() - parseDbTime(base).getTime() >= SETTLE_DAYS * 24 * 3600 * 1e3) points_settled = true;
      }
      const return_deadline = base ? new Date(parseDbTime(base).getTime() + SETTLE_DAYS * 24 * 3600 * 1e3).toISOString().slice(0, 19).replace("T", " ") : null;
      return { delivered_at, return_deadline, points_settled };
    }
    function userStats(userId) {
      const r = db2.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(o.created_at) AS last_order_at
    FROM orders o
    WHERE o.user_id = ? AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
  `).get(userId);
      const refunded = db2.prepare(`
    SELECT COALESCE(SUM(r.refund_amount), 0) AS v
    FROM returns r JOIN orders o ON o.id = r.order_id
    WHERE o.user_id = ? AND r.status = 'completed'
      AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
  `).get(userId).v;
      return {
        order_count: r.order_count,
        total_spent: Math.max(0, (r.total_spent || 0) - (refunded || 0)),
        last_order_at: r.last_order_at
      };
    }
    function tierInfo(userId) {
      const stats = userStats(userId);
      const tierKey = computeTier(stats.order_count, stats.total_spent);
      const idx = TIER_ORDER.indexOf(tierKey);
      let next = null;
      if (idx >= 0 && idx < TIER_ORDER.length - 1) {
        const nextKey = TIER_ORDER[idx + 1];
        let need = {};
        if (nextKey === "bronze") need = { orders: Math.max(0, BRONZE_MIN_ORDERS - stats.order_count) };
        else if (nextKey === "silver") need = { spent: Math.max(0, SILVER_MIN_SPENT - stats.total_spent) };
        else if (nextKey === "gold") need = { spent: Math.max(0, GOLD_MIN_SPENT - stats.total_spent) };
        else if (nextKey === "diamond") need = { spent: Math.max(0, DIAMOND_MIN_SPENT - stats.total_spent) };
        next = { key: nextKey, name: TIER_MAP[nextKey].name, need };
      }
      return { tier: TIER_MAP[tierKey], stats, next };
    }
    function checkTierUpgrade(userId) {
      const user = db2.prepare("SELECT known_tier FROM users WHERE id = ?").get(userId);
      if (!user) return false;
      const current = tierInfo(userId).tier.key;
      if (user.known_tier == null) {
        db2.prepare("UPDATE users SET known_tier = ? WHERE id = ?").run(current, userId);
        return false;
      }
      if (TIER_ORDER.indexOf(current) > TIER_ORDER.indexOf(user.known_tier)) {
        const tier = TIER_MAP[current];
        db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        ).run(
          userId,
          "tier_up",
          `\u{1F389} Ch\xFAc m\u1EEBng! B\u1EA1n \u0111\xE3 th\u0103ng h\u1EA1ng ${tier.name}`,
          `B\u1EA1n v\u1EEBa l\xEAn h\u1EA1ng ${tier.name} \u2014 m\u1ED7i th\xE1ng b\u1EA1n nh\u1EADn ${tier.cards} th\u1EBB gi\u1EA3m ${tier.percent}% cho 1 s\u1EA3n ph\u1EA9m. B\u1EA5m \u0111\u1EC3 xem th\u1EBB v\xE0 \u0111\u1EB7c quy\u1EC1n h\u1EA1ng c\u1EE7a b\u1EA1n.`,
          "/hang-cua-toi"
        );
        db2.prepare("UPDATE users SET known_tier = ? WHERE id = ?").run(current, userId);
        return true;
      }
      return false;
    }
    function maskName(name) {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "***";
      if (parts.length === 1) return parts[0].slice(0, 1) + "***";
      const last = parts[parts.length - 1];
      return [...parts.slice(0, -1), last.slice(0, 1) + "***"].join(" ");
    }
    module2.exports = { TIERS, TIER_MAP, TIER_ORDER, computeTier, userStats, tierInfo, maskName, checkTierUpgrade, SETTLE_DAYS, SETTLED_SQL, deliveredAtOf, parseDbTime, settleInfo };
  }
});

// routes/orders.js
var require_orders = __commonJS({
  "routes/orders.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { validateVoucher } = require_vouchers();
    var { settleInfo, checkTierUpgrade, tierInfo } = require_tiers();
    var router = express2.Router();
    function getOrderWithItems(id) {
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) return null;
      order.items = db2.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);
      order.history = db2.prepare(
        "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id DESC"
      ).all(id);
      return order;
    }
    var STATUS_FLOW = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["delivered", "cancelled"],
      delivered: [],
      cancelled: []
    };
    function actorName(req) {
      const row = db2.prepare("SELECT name FROM users WHERE id = ?").get(req.user.id);
      return row ? row.name : req.user.email || "";
    }
    function writeHistory(orderId, fromStatus, toStatus, req, reason = "") {
      db2.prepare(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
     VALUES (?, ?, ?, ?, ?)`
      ).run(orderId, fromStatus, toStatus, actorName(req), reason || "");
    }
    function restoreStock(orderId) {
      const items = db2.prepare(
        "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?"
      ).all(orderId);
      const updProduct = db2.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      const updVariant = db2.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?");
      for (const i of items) {
        if (i.variant_id) updVariant.run(i.quantity, i.variant_id);
        else if (i.product_id) updProduct.run(i.quantity, i.product_id);
      }
    }
    var PAYMENT_LABELS = {
      cod: "Thanh to\xE1n khi nh\u1EADn h\xE0ng (COD)",
      bank: "Chuy\u1EC3n kho\u1EA3n ng\xE2n h\xE0ng",
      momo: "V\xED MoMo"
    };
    router.post("/", auth, (req, res) => {
      const { customer_name, phone, address, items, shipping_method_id, voucher_code, discount_card_code, payment_method, note } = req.body || {};
      if (!customer_name || !phone || !address)
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 h\u1ECD t\xEAn, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i, \u0111\u1ECBa ch\u1EC9" });
      if (!/^[0-9+ ]{9,15}$/.test(String(phone).trim()))
        return res.status(400).json({ error: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7" });
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Gi\u1ECF h\xE0ng tr\u1ED1ng" });
      const pm = payment_method || "cod";
      if (!["cod", "bank", "momo"].includes(pm))
        return res.status(400).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n kh\xF4ng h\u1EE3p l\u1EC7" });
      const method = db2.prepare("SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1").get(shipping_method_id);
      if (!method)
        return res.status(400).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 t\u1EAFt" });
      const shipping_fee = method.fee;
      const createOrder = db2.transaction((items2) => {
        let subtotal = 0;
        const lines = [];
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        const liveEvent = db2.prepare(
          `SELECT id FROM promo_events WHERE is_active = 1
         AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
         ORDER BY id DESC LIMIT 1`
        ).get(nowIso, nowIso);
        const salePrices = /* @__PURE__ */ new Map();
        if (liveEvent) {
          for (const r of db2.prepare("SELECT product_id, sale_price FROM promo_event_products WHERE event_id = ?").all(liveEvent.id)) {
            salePrices.set(r.product_id, r.sale_price);
          }
        }
        const pIds = [...new Set(items2.map((it) => it.product_id))];
        const pRows = pIds.length ? db2.prepare(`SELECT * FROM products WHERE id IN (${pIds.map(() => "?").join(",")})`).all(...pIds) : [];
        const pById = new Map(pRows.map((r) => [r.id, r]));
        const vIds = [...new Set(items2.map((it) => it.variant_id).filter(Boolean))];
        const vRows = vIds.length ? db2.prepare(`SELECT * FROM product_variants WHERE id IN (${vIds.map(() => "?").join(",")}) AND is_active = 1`).all(...vIds) : [];
        const vById = new Map(vRows.map((r) => [r.id, r]));
        const vProductIds = new Set(
          (pIds.length ? db2.prepare(`SELECT DISTINCT product_id FROM product_variants WHERE product_id IN (${pIds.map(() => "?").join(",")}) AND is_active = 1`).all(...pIds) : []).map((r) => r.product_id)
        );
        for (const it of items2) {
          const qty = parseInt(it.quantity) || 0;
          if (qty <= 0) throw new Error("S\u1ED1 l\u01B0\u1EE3ng s\u1EA3n ph\u1EA9m kh\xF4ng h\u1EE3p l\u1EC7");
          const p = pById.get(it.product_id);
          if (!p) throw new Error(`S\u1EA3n ph\u1EA9m #${it.product_id} kh\xF4ng t\u1ED3n t\u1EA1i`);
          const basePrice = salePrices.get(p.id) ?? p.price;
          let unitPrice = basePrice;
          let variantId = null;
          let variantSku = "";
          if (it.variant_id) {
            const v = vById.get(it.variant_id);
            if (!v || v.product_id !== p.id) throw new Error(`Bi\u1EBFn th\u1EC3 c\u1EE7a "${p.name}" kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 t\u1EAFt`);
            if (v.stock < qty) throw new Error(`"${p.name} (${v.sku})" ch\u1EC9 c\xF2n ${v.stock} s\u1EA3n ph\u1EA9m trong kho`);
            unitPrice = basePrice + (v.price_delta || 0);
            variantId = v.id;
            variantSku = v.sku;
          } else {
            if (vProductIds.has(p.id)) throw new Error(`"${p.name}" c\xF3 nhi\u1EC1u m\xE0u s\u1EAFc/k\xEDch th\u01B0\u1EDBc \u2014 vui l\xF2ng ch\u1ECDn tr\u01B0\u1EDBc khi \u0111\u1EB7t h\xE0ng`);
            if (p.stock < qty) throw new Error(`"${p.name}" ch\u1EC9 c\xF2n ${p.stock} s\u1EA3n ph\u1EA9m trong kho`);
          }
          subtotal += unitPrice * qty;
          lines.push({
            product_id: p.id,
            variant_id: variantId,
            variant_sku: variantSku,
            product_name: p.name,
            quantity: qty,
            price: unitPrice
          });
        }
        let discount_total = 0;
        let voucherRow = null;
        const code = (voucher_code || "").toString().trim();
        const cardCodeEarly = (discount_card_code || "").toString().trim();
        if (code && cardCodeEarly)
          throw new Error("Ch\u1EC9 d\xF9ng 1 lo\u1EA1i \u01B0u \u0111\xE3i cho m\u1ED7i \u0111\u01A1n: m\xE3 khuy\u1EBFn m\xE3i ho\u1EB7c th\u1EBB h\u1EA1ng kh\xE1ch h\xE0ng");
        if (code) {
          const r = validateVoucher(db2, code, subtotal);
          if (!r.valid) {
            const msgs = {
              NOT_FOUND: "M\xE3 khuy\u1EBFn m\xE3i kh\xF4ng t\u1ED3n t\u1EA1i",
              INACTIVE: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 b\u1ECB t\u1EAFt",
              EXPIRED: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 h\u1EBFt h\u1EA1n",
              MIN_ORDER: "\u0110\u01A1n h\xE0ng ch\u01B0a \u0111\u1EA1t gi\xE1 tr\u1ECB t\u1ED1i thi\u1EC3u \u0111\u1EC3 d\xF9ng m\xE3 n\xE0y",
              LIMIT_REACHED: "M\xE3 khuy\u1EBFn m\xE3i \u0111\xE3 h\u1EBFt l\u01B0\u1EE3t s\u1EED d\u1EE5ng"
            };
            throw new Error(msgs[r.reason] || "M\xE3 khuy\u1EBFn m\xE3i kh\xF4ng h\u1EE3p l\u1EC7");
          }
          discount_total = r.discount;
          voucherRow = r.voucher;
        }
        let cardRow = null;
        let cardProductId = null;
        const cardCode = cardCodeEarly.toUpperCase();
        if (cardCode) {
          const nowJs = (() => {
            const d = /* @__PURE__ */ new Date();
            const p = (n) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
          })();
          cardRow = db2.prepare(
            "SELECT * FROM discount_cards WHERE code = ? AND user_id = ? AND status = 'unused' AND expires_at >= ?"
          ).get(cardCode, req.user.id, nowJs);
          if (!cardRow) throw new Error("Th\u1EBB discount kh\xF4ng h\u1EE3p l\u1EC7, \u0111\xE3 d\xF9ng ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n");
          const top = lines.reduce((a, b) => b.price > (a ? a.price : 0) ? b : a, null);
          discount_total = Math.floor(top.price * cardRow.percent / 100);
          cardProductId = top.product_id;
        }
        const total = Math.max(0, subtotal + shipping_fee - discount_total);
        const info = db2.prepare(
          `INSERT INTO orders (user_id, customer_name, phone, address, total,
                            payment_method, payment_status, shipping_fee, discount_total,
                            shipping_method_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
        ).run(
          req.user.id,
          customer_name.trim(),
          phone.trim(),
          address.trim(),
          total,
          pm,
          shipping_fee,
          discount_total,
          method.id
        );
        const orderId = info.lastInsertRowid;
        const insItem = db2.prepare(
          `INSERT INTO order_items (order_id, product_id, variant_id, variant_sku, product_name, quantity, price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const decProductStock = db2.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        const decVariantStock = db2.prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ?");
        for (const l of lines) {
          insItem.run(orderId, l.product_id, l.variant_id, l.variant_sku, l.product_name, l.quantity, l.price);
          if (l.variant_id) {
            decVariantStock.run(l.quantity, l.variant_id);
            db2.logStockMovement({ variant_id: l.variant_id, product_id: l.product_id, type: "OUT", qty: l.quantity, ref_type: "order", ref_id: orderId, note: "B\xE1n h\xE0ng \u2014 \u0111\u01A1n #" + orderId });
          } else {
            decProductStock.run(l.quantity, l.product_id);
            db2.logStockMovement({ product_id: l.product_id, type: "OUT", qty: l.quantity, ref_type: "order", ref_id: orderId, note: "B\xE1n h\xE0ng \u2014 \u0111\u01A1n #" + orderId });
          }
        }
        if (voucherRow) {
          db2.prepare("UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?").run(voucherRow.id);
        }
        if (cardRow) {
          const upd = db2.prepare(
            "UPDATE discount_cards SET status = 'used', used_order_id = ?, used_product_id = ? WHERE id = ? AND status = 'unused'"
          ).run(orderId, cardProductId, cardRow.id);
          if (!upd.changes) throw new Error("Th\u1EBB discount \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng");
        }
        const paymentNote = pm === "momo" ? "Ch\u1EDD webhook MoMo" : (note || "").toString().trim();
        db2.prepare(
          `INSERT INTO payments (order_id, method, amount, status, note)
       VALUES (?, ?, ?, 'pending', ?)`
        ).run(orderId, pm, total, paymentNote);
        db2.prepare(
          "INSERT INTO shippings (order_id, method_id, fee) VALUES (?, ?, ?)"
        ).run(orderId, method.id, shipping_fee);
        db2.prepare(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
       VALUES (?, NULL, 'pending', ?, ?)`
        ).run(
          orderId,
          `${customer_name.trim()} (${phone.trim()})`,
          `\u0110\u01A1n h\xE0ng m\u1EDBi \u0111\u01B0\u1EE3c t\u1EA1o \u2014 ${PAYMENT_LABELS[pm]}`
        );
        return orderId;
      });
      try {
        const orderId = createOrder(items);
        const payment = db2.prepare("SELECT id, method, amount, status FROM payments WHERE order_id = ?").get(orderId);
        res.status(201).json({ order: getOrderWithItems(orderId), payment });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    });
    router.get("/", auth, (req, res) => {
      const { status } = req.query;
      const conds = [];
      const params = [];
      if (req.user.role !== "admin") {
        conds.push("o.user_id = ?");
        params.push(req.user.id);
      }
      if (status) {
        conds.push("o.status = ?");
        params.push(status);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const orders = db2.prepare(
        `SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count,
            u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY o.created_at DESC`
      ).all(...params);
      if (req.user.role === "customer") {
        for (const o of orders) Object.assign(o, settleInfo(o));
      }
      res.json({ orders });
    });
    router.post("/:id/confirm-satisfied", auth, (req, res) => {
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      if (order.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n v\u1EDBi \u0111\u01A1n h\xE0ng n\xE0y" });
      if (order.status !== "delivered")
        return res.status(400).json({ error: "Ch\u1EC9 \u0111\u01A1n h\xE0ng \u0111\xE3 giao m\u1EDBi x\xE1c nh\u1EADn h\xE0i l\xF2ng \u0111\u01B0\u1EE3c" });
      if (order.satisfied_at) return res.json({ ok: true, already: true, tier: tierInfo(req.user.id).tier });
      const open = db2.prepare(
        "SELECT id FROM returns WHERE order_id = ? AND status IN ('requested','approved','received')"
      ).get(order.id);
      if (open)
        return res.status(409).json({ error: "\u0110\u01A1n \u0111ang c\xF3 y\xEAu c\u1EA7u \u0111\u1ED5i/tr\u1EA3 \u0111ang \u0111\u01B0\u1EE3c x\u1EED l\xFD, ch\u01B0a th\u1EC3 x\xE1c nh\u1EADn h\xE0i l\xF2ng" });
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      db2.prepare("UPDATE orders SET satisfied_at = ? WHERE id = ?").run(now, order.id);
      const upgraded = checkTierUpgrade(req.user.id);
      res.json({ ok: true, upgraded, tier: tierInfo(req.user.id).tier });
    });
    router.get("/new-count", auth, staffOnly, (req, res) => {
      const row = db2.prepare("SELECT last_seen_order_id FROM staff_order_seen WHERE user_id = ?").get(req.user.id);
      if (!row) {
        const maxId = db2.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM orders").get().m;
        db2.prepare("INSERT INTO staff_order_seen (user_id, last_seen_order_id) VALUES (?, ?)").run(req.user.id, maxId);
        return res.json({ count: 0, watermark: maxId });
      }
      const count = db2.prepare("SELECT COUNT(*) AS c FROM orders WHERE id > ?").get(row.last_seen_order_id).c;
      res.json({ count, watermark: row.last_seen_order_id });
    });
    router.post("/mark-seen", auth, staffOnly, (req, res) => {
      const maxId = db2.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM orders").get().m;
      db2.prepare(
        `INSERT INTO staff_order_seen (user_id, last_seen_order_id) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_seen_order_id = excluded.last_seen_order_id`
      ).run(req.user.id, maxId);
      res.json({ ok: true, watermark: maxId });
    });
    router.get("/:id", auth, (req, res) => {
      const order = getOrderWithItems(req.params.id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      if (req.user.role !== "admin" && order.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem \u0111\u01A1n h\xE0ng n\xE0y" });
      res.json({ order });
    });
    router.put("/:id/status", auth, staffOnly, (req, res) => {
      const { status, reason } = req.body || {};
      const valid = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
      if (!valid.includes(status))
        return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7" });
      const change = db2.transaction(() => {
        const order2 = db2.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
        if (!order2) return null;
        const from = order2.status;
        if (!(STATUS_FLOW[from] || []).includes(status))
          throw new Error(`Kh\xF4ng th\u1EC3 chuy\u1EC3n \u0111\u01A1n t\u1EEB "${from}" sang "${status}"`);
        if (status === "cancelled" && !(reason || "").trim())
          throw new Error("H\u1EE7y \u0111\u01A1n h\xE0ng ph\u1EA3i ghi r\xF5 l\xFD do");
        db2.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, order2.id);
        if (status === "cancelled") restoreStock(order2.id);
        writeHistory(order2.id, from, status, req, (reason || "").trim());
      });
      try {
        change();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      const order = getOrderWithItems(req.params.id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      if (order.user_id) {
        const LABELS = {
          pending: "Ch\u1EDD x\xE1c nh\u1EADn",
          confirmed: "\u0110\xE3 x\xE1c nh\u1EADn",
          shipping: "\u0110ang giao h\xE0ng",
          delivered: "\u0110\xE3 giao th\xE0nh c\xF4ng",
          cancelled: "\u0110\xE3 h\u1EE7y"
        };
        const CONTENTS = {
          pending: `\u0110\u01A1n h\xE0ng #${order.id} c\u1EE7a b\u1EA1n \u0111ang ch\u1EDD x\xE1c nh\u1EADn.`,
          confirmed: `\u0110\u01A1n h\xE0ng #${order.id} c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn, shop \u0111ang chu\u1EA9n b\u1ECB h\xE0ng.`,
          shipping: `\u0110\u01A1n h\xE0ng #${order.id} c\u1EE7a b\u1EA1n \u0111ang \u0111\u01B0\u1EE3c giao \u0111\u1EBFn b\u1EA1n.`,
          delivered: `\u0110\u01A1n h\xE0ng #${order.id} \u0111\xE3 giao th\xE0nh c\xF4ng. C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 mua s\u1EAFm t\u1EA1i BI99!`,
          cancelled: `\u0110\u01A1n h\xE0ng #${order.id} c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB h\u1EE7y.${reason ? " L\xFD do: " + String(reason) : ""}`
        };
        try {
          db2.prepare(
            "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
          ).run(
            order.user_id,
            "order",
            `\u0110\u01A1n h\xE0ng #${order.id} \u2014 ${LABELS[status] || status}`,
            CONTENTS[status] || `\u0110\u01A1n h\xE0ng #${order.id} c\u1EE7a b\u1EA1n v\u1EEBa \u0111\u1ED5i tr\u1EA1ng th\xE1i.`,
            "/don-hang"
          );
        } catch (e) {
        }
      }
      res.json({ order });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const remove = db2.transaction(() => {
        const order2 = db2.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
        if (!order2) return null;
        if (order2.status !== "cancelled") restoreStock(order2.id);
        db2.prepare("DELETE FROM orders WHERE id = ?").run(order2.id);
        return order2;
      });
      let order;
      try {
        order = remove();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      res.json({ ok: true });
    });
    router.put("/:id/cancel", auth, (req, res) => {
      const { reason } = req.body || {};
      if (!(reason || "").trim())
        return res.status(400).json({ error: "Vui l\xF2ng ghi r\xF5 l\xFD do h\u1EE7y \u0111\u01A1n h\xE0ng" });
      let notFound = false;
      const doCancel = db2.transaction(() => {
        const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
        if (!order) {
          notFound = true;
          return;
        }
        if (req.user.role !== "admin" && order.user_id !== req.user.id) {
          const e = new Error("B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n h\u1EE7y \u0111\u01A1n h\xE0ng n\xE0y");
          e.statusCode = 403;
          throw e;
        }
        if (order.status !== "pending") {
          const e = new Error(
            `Ch\u1EC9 \u0111\u01A1n h\xE0ng \u0111ang "Ch\u1EDD x\xE1c nh\u1EADn" m\u1EDBi c\xF3 th\u1EC3 h\u1EE7y (tr\u1EA1ng th\xE1i hi\u1EC7n t\u1EA1i: "${order.status}")`
          );
          e.statusCode = 400;
          throw e;
        }
        db2.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
        restoreStock(order.id);
        writeHistory(order.id, "pending", "cancelled", req, reason.trim());
      });
      try {
        doCancel();
      } catch (e) {
        return res.status(e.statusCode || 400).json({ error: e.message });
      }
      if (notFound) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      res.json({ order: getOrderWithItems(req.params.id) });
    });
    router.put("/:id/shipping-info", auth, staffOnly, (req, res) => {
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      if (!["pending", "confirmed"].includes(order.status))
        return res.status(400).json({
          error: "Ch\u1EC9 \u0111\u01A1n h\xE0ng ch\u01B0a giao (Ch\u1EDD x\xE1c nh\u1EADn / \u0110\xE3 x\xE1c nh\u1EADn) m\u1EDBi \u0111\u01B0\u1EE3c s\u1EEDa th\xF4ng tin giao h\xE0ng"
        });
      const { customer_name, phone, address } = req.body || {};
      const name = (customer_name || "").toString().trim() || order.customer_name;
      const ph = (phone || "").toString().trim() || order.phone;
      const addr = (address || "").toString().trim() || order.address;
      const update = db2.transaction(() => {
        db2.prepare("UPDATE orders SET customer_name = ?, phone = ?, address = ? WHERE id = ?").run(name, ph, addr, order.id);
        writeHistory(order.id, order.status, order.status, req, "C\u1EADp nh\u1EADt th\xF4ng tin giao h\xE0ng");
      });
      update();
      res.json({ order: getOrderWithItems(req.params.id) });
    });
    module2.exports = router;
  }
});

// routes/users.js
var require_users = __commonJS({
  "routes/users.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, adminOnly, staffOnly } = require_auth();
    var { computeTier, TIER_MAP, SETTLED_SQL } = require_tiers();
    var router = express2.Router();
    router.get("/me", auth, (req, res) => {
      const user = db2.prepare(
        "SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?"
      ).get(req.user.id);
      if (!user) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" });
      res.json({ user });
    });
    router.put("/me", auth, (req, res) => {
      const { name, phone } = req.body || {};
      if (!name || !String(name).trim())
        return res.status(400).json({ error: "T\xEAn kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
      db2.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(
        String(name).trim(),
        String(phone || "").trim(),
        req.user.id
      );
      const user = db2.prepare(
        "SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?"
      ).get(req.user.id);
      res.json({ user });
    });
    router.get("/", auth, staffOnly, (req, res) => {
      const rows = db2.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
      COALESCE(SUM(CASE WHEN o.payment_status = 'verified' AND o.status != 'cancelled' AND ${SETTLED_SQL} THEN 1 ELSE 0 END), 0) AS order_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'verified' AND o.status != 'cancelled' AND ${SETTLED_SQL} THEN o.total ELSE 0 END), 0)
        - COALESCE((
            SELECT SUM(r.refund_amount) FROM returns r JOIN orders o ON o.id = r.order_id
            WHERE o.user_id = u.id AND r.status = 'completed'
              AND o.payment_status = 'verified' AND o.status != 'cancelled' AND ${SETTLED_SQL}
          ), 0) AS total_spent
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
      const tier_counts = { diamond: 0, gold: 0, silver: 0, bronze: 0, potential: 0 };
      const users = rows.map((u) => {
        if (u.role !== "customer") return { ...u, tier: null };
        const key = computeTier(u.order_count, u.total_spent);
        tier_counts[key]++;
        return { ...u, tier: { key, name: TIER_MAP[key].name } };
      });
      res.json({ users, tier_counts });
    });
    router.put("/:id/role", auth, adminOnly, (req, res) => {
      const { role } = req.body || {};
      if (!["admin", "sale", "customer"].includes(role))
        return res.status(400).json({ error: "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7" });
      if (parseInt(req.params.id) === req.user.id)
        return res.status(400).json({ error: "Kh\xF4ng th\u1EC3 t\u1EF1 h\u1EA1 quy\u1EC1n ch\xEDnh m\xECnh" });
      const info = db2.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" });
      res.json({ user: db2.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(req.params.id) });
    });
    router.get("/top-customers", auth, staffOnly, (req, res) => {
      const rows = db2.prepare(`
    SELECT u.id, u.name, u.email, u.phone,
           COUNT(o.id) AS order_count,
           COALESCE(SUM(o.total), 0) AS total_spent,
           MAX(o.created_at) AS last_order_at
    FROM users u
    JOIN orders o ON o.user_id = u.id
      AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
    WHERE u.role = 'customer'
    GROUP BY u.id
    ORDER BY total_spent DESC, order_count DESC
    LIMIT 10
  `).all();
      const customers = rows.map((c) => {
        const key = computeTier(c.order_count, c.total_spent);
        return { ...c, tier: { key, name: TIER_MAP[key].name } };
      });
      res.json({ customers });
    });
    router.get("/:id/purchases", auth, staffOnly, (req, res) => {
      const customer = db2.prepare(
        "SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?"
      ).get(req.params.id);
      if (!customer) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng" });
      const orders = db2.prepare(
        "SELECT id, total, status, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC"
      ).all(req.params.id);
      const itemsStmt = db2.prepare(
        "SELECT id, product_name, quantity, price FROM order_items WHERE order_id = ? ORDER BY id"
      );
      for (const o of orders) o.items = itemsStmt.all(o.id);
      const summary = db2.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
    FROM orders WHERE user_id = ? AND payment_status = 'verified' AND status != 'cancelled'
  `).get(req.params.id);
      const topProducts = db2.prepare(`
    SELECT oi.product_name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.price) AS total_amount
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = ? AND o.payment_status = 'verified' AND o.status != 'cancelled'
    GROUP BY oi.product_name
    ORDER BY total_qty DESC, total_amount DESC
    LIMIT 5
  `).all(req.params.id);
      const tierKey = customer.role === "customer" ? computeTier(summary.order_count, summary.total_spent) : null;
      res.json({
        customer,
        summary,
        tier: tierKey ? { key: tierKey, name: TIER_MAP[tierKey].name } : null,
        top_products: topProducts,
        orders
      });
    });
    module2.exports = router;
  }
});

// routes/posts.js
var require_posts = __commonJS({
  "routes/posts.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    var ALLOWED_IMAGE_HOSTS = /* @__PURE__ */ new Set(["images.unsplash.com"]);
    function slugify(text) {
      return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    function safeImageUrl(raw) {
      const v = String(raw || "").trim();
      if (!v) return "";
      if (v.startsWith("/") && !v.startsWith("//")) return v;
      if (v.startsWith("./")) return v;
      try {
        const u = new URL(v);
        if (u.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(u.hostname)) return v;
      } catch {
      }
      return "";
    }
    function uniqueSlug(title, excludeId) {
      const base = slugify(title) || "bai-viet";
      const rows = excludeId ? db2.prepare("SELECT slug FROM posts WHERE id != ?").all(excludeId) : db2.prepare("SELECT slug FROM posts").all();
      const taken = new Set(rows.map((r) => r.slug));
      let slug = base;
      let n = 2;
      while (taken.has(slug)) {
        slug = `${base}-${n}`;
        n += 1;
      }
      return slug;
    }
    router.get("/", (req, res) => {
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const wantAll = req.query.all === "1" || req.query.all === "true";
      let isAdmin = false;
      if (wantAll) {
        const { auth: auth2, staffOnly: staffOnly2, JWT_SECRET } = require_auth();
        const jwt = require("jsonwebtoken");
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        try {
          const payload = jwt.verify(token, JWT_SECRET);
          isAdmin = payload && ["admin", "sale"].includes(payload.role);
        } catch {
          isAdmin = false;
        }
        if (!isAdmin) return res.status(403).json({ error: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi xem \u0111\u01B0\u1EE3c b\u1EA3n nh\xE1p" });
      }
      const where = isAdmin ? "" : "WHERE status = 'published'";
      const posts = db2.prepare(`SELECT * FROM posts ${where} ORDER BY created_at DESC LIMIT ?`).all(limit);
      res.json({ posts });
    });
    router.get("/:slug", (req, res) => {
      const post = db2.prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'").get(req.params.slug);
      if (!post) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i vi\u1EBFt" });
      res.json({ post });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { title, cover_image_url, excerpt, content, status } = req.body || {};
      if (!title || !String(title).trim())
        return res.status(400).json({ error: "Ti\xEAu \u0111\u1EC1 b\xE0i vi\u1EBFt l\xE0 b\u1EAFt bu\u1ED9c" });
      const st = status === "published" ? "published" : "draft";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const slug = uniqueSlug(title);
      const info = db2.prepare(
        `INSERT INTO posts (title, slug, cover_image_url, excerpt, content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(title.trim(), slug, safeImageUrl(cover_image_url), excerpt || "", content || "", st, now, now);
      res.status(201).json({ id: info.lastInsertRowid, slug });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { title, cover_image_url, excerpt, content, status } = req.body || {};
      if (!title || !String(title).trim())
        return res.status(400).json({ error: "Ti\xEAu \u0111\u1EC1 b\xE0i vi\u1EBFt l\xE0 b\u1EAFt bu\u1ED9c" });
      const st = status === "published" ? "published" : "draft";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const info = db2.prepare(
        `UPDATE posts SET title = ?, cover_image_url = ?, excerpt = ?, content = ?,
     status = ?, updated_at = ? WHERE id = ?`
      ).run(title.trim(), safeImageUrl(cover_image_url), excerpt || "", content || "", st, now, req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i vi\u1EBFt" });
      res.json({ ok: true });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const info = db2.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i vi\u1EBFt" });
      res.json({ ok: true });
    });
    module2.exports = router;
  }
});

// routes/contact.js
var require_contact = __commonJS({
  "routes/contact.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    var contactAttempts = /* @__PURE__ */ new Map();
    function contactRateLimit(req, res, next) {
      const ip = String(req.ip || req.connection && req.connection.remoteAddress || "unknown");
      const now = Date.now();
      let entry = contactAttempts.get(ip);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + 60 * 1e3 };
        contactAttempts.set(ip, entry);
      }
      entry.count += 1;
      if (entry.count > 10) return res.status(429).json({ error: "B\u1EA1n g\u1EEDi qu\xE1 nhi\u1EC1u tin nh\u1EAFn, vui l\xF2ng th\u1EED l\u1EA1i sau" });
      next();
    }
    router.post("/", contactRateLimit, (req, res) => {
      const { name, phone, email, content, content_vi } = req.body || {};
      if (!name || !String(name).trim() || !content || !String(content).trim())
        return res.status(400).json({ error: "Vui l\xF2ng \u0111i\u1EC1n H\u1ECD t\xEAn v\xE0 N\u1ED9i dung tin nh\u1EAFn" });
      const wordCount = String(content).trim().split(/\s+/).length;
      if (wordCount > 300)
        return res.status(400).json({ error: "N\u1ED9i dung tin nh\u1EAFn t\u1ED1i \u0111a 300 t\u1EEB" });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const translated = String(content_vi || "").trim().slice(0, 1e4);
      const info = db2.prepare(
        "INSERT INTO contact_messages (name, phone, email, content, content_vi, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(name.trim(), String(phone || "").trim(), String(email || "").trim(), content.trim(), translated, now);
      res.status(201).json({ id: info.lastInsertRowid });
    });
    router.get("/", auth, staffOnly, (req, res) => {
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
      const messages = db2.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ?").all(limit).map((m) => ({ ...m, is_read: m.is_read === 1 }));
      res.json({ messages });
    });
    router.put("/:id/read", auth, staffOnly, (req, res) => {
      const isRead = req.body && req.body.is_read === false ? 0 : 1;
      const info = db2.prepare("UPDATE contact_messages SET is_read = ? WHERE id = ?").run(isRead, req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y tin nh\u1EAFn" });
      res.json({ ok: true });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const info = db2.prepare("DELETE FROM contact_messages WHERE id = ?").run(req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y tin nh\u1EAFn" });
      res.json({ ok: true });
    });
    module2.exports = router;
  }
});

// lib/images.js
var require_images = __commonJS({
  "lib/images.js"(exports2, module2) {
    var MAX_IMAGES = 3;
    var MAX_IMAGE_CHARS = 15e5;
    var DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    function validateImages(images) {
      if (!Array.isArray(images) || images.length === 0)
        return { error: "Vui l\xF2ng \u0111\xEDnh k\xE8m \xEDt nh\u1EA5t 1 \u1EA3nh minh h\u1ECDa" };
      if (images.length > MAX_IMAGES)
        return { error: `T\u1ED1i \u0111a ${MAX_IMAGES} \u1EA3nh minh h\u1ECDa` };
      for (const img of images) {
        if (typeof img !== "string" || !DATA_URL_RE.test(img))
          return { error: "\u1EA2nh minh h\u1ECDa kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng" };
        if (img.length > MAX_IMAGE_CHARS)
          return { error: "\u1EA2nh minh h\u1ECDa qu\xE1 l\u1EDBn, vui l\xF2ng ch\u1ECDn \u1EA3nh nh\u1ECF h\u01A1n" };
      }
      return { value: JSON.stringify(images) };
    }
    function parseImages(raw) {
      if (Array.isArray(raw)) return raw;
      try {
        const v = JSON.parse(raw || "[]");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    }
    module2.exports = { validateImages, parseImages, MAX_IMAGES };
  }
});

// lib/chatCard.js
var require_chatCard = __commonJS({
  "lib/chatCard.js"(exports2, module2) {
    var db2 = require_db();
    function postAftersalesCard(customerId, { refType, refId, content }) {
      let conv = db2.prepare(
        "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
      ).get(customerId);
      if (!conv) {
        const info = db2.prepare(
          "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
        ).run(customerId, customerId);
        conv = db2.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid);
        db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(conv.id, customerId);
      }
      const msg = db2.prepare(
        "INSERT INTO chat_messages (conversation_id, sender_id, content, kind, ref_type, ref_id) VALUES (?, ?, ?, 'aftersales', ?, ?)"
      ).run(conv.id, customerId, content, refType, refId);
      db2.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);
      db2.prepare("UPDATE conversation_participants SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(msg.lastInsertRowid, conv.id, customerId);
      return conv.id;
    }
    function postChatNotice(customerId, senderId, content) {
      if (!customerId) return null;
      let conv = db2.prepare(
        "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
      ).get(customerId);
      if (!conv) {
        const info = db2.prepare(
          "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
        ).run(customerId, senderId);
        conv = db2.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid);
        db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(conv.id, customerId);
      }
      db2.prepare("INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)").run(conv.id, senderId, content);
      db2.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);
      return conv.id;
    }
    module2.exports = { postAftersalesCard, postChatNotice };
  }
});

// routes/returns.js
var require_returns = __commonJS({
  "routes/returns.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { validateImages, parseImages } = require_images();
    var { deliveredAtOf, parseDbTime, SETTLE_DAYS } = require_tiers();
    var { postAftersalesCard, postChatNotice } = require_chatCard();
    var router = express2.Router();
    var withImages = (row) => row ? { ...row, images: parseImages(row.images) } : row;
    function attachItems(rows) {
      if (!rows.length) return rows;
      const ids = rows.map((r) => r.id);
      const items = db2.prepare(`SELECT * FROM return_items WHERE return_id IN (${ids.map(() => "?").join(",")}) ORDER BY id`).all(...ids);
      const byReturn = {};
      for (const it of items) (byReturn[it.return_id] = byReturn[it.return_id] || []).push(it);
      return rows.map((r) => ({ ...r, items: byReturn[r.id] || [] }));
    }
    var getReturnFull = (id) => {
      const ret = db2.prepare("SELECT * FROM returns WHERE id = ?").get(id);
      return ret ? attachItems([withImages(ret)])[0] : null;
    };
    var ACTION_FLOW = {
      requested: ["approved", "rejected"],
      approved: ["received", "completed"],
      received: ["completed"],
      rejected: [],
      completed: []
    };
    function getOrderForUser(orderId, user) {
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
      if (!order) return { error: 404, message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" };
      if (!["admin", "sale"].includes(user.role) && order.user_id !== user.id)
        return { error: 403, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n v\u1EDBi \u0111\u01A1n h\xE0ng n\xE0y" };
      return { order };
    }
    function notifyCustomer(order, ret, title, content, senderId) {
      if (!order.user_id) return;
      try {
        db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        ).run(order.user_id, "return", title, content, "/don-hang");
      } catch (e) {
      }
      try {
        postChatNotice(order.user_id, senderId, content);
      } catch (e) {
      }
    }
    function applyRestock(ret, restock) {
      if (!Array.isArray(restock)) return;
      for (const entry of restock) {
        const item = db2.prepare("SELECT * FROM return_items WHERE id = ? AND return_id = ?").get(parseInt(entry.id), ret.id);
        if (!item) continue;
        const qty = Math.max(0, Math.min(parseInt(entry.qty) || 0, item.quantity - item.restocked_qty));
        if (qty <= 0) continue;
        if (item.variant_id) {
          db2.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(qty, item.variant_id);
        } else if (item.product_id) {
          db2.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(qty, item.product_id);
        }
        db2.prepare("UPDATE return_items SET restocked_qty = restocked_qty + ? WHERE id = ?").run(qty, item.id);
        db2.logStockMovement({
          product_id: item.product_id,
          variant_id: item.variant_id,
          type: "IN",
          qty,
          ref_type: "return",
          ref_id: ret.id,
          note: `\u0110\u1ED5i/tr\u1EA3 #${ret.id} \u2014 nh\u1EADp kho l\u1EA1i t\u1EEB \u0111\u01A1n #${ret.order_id}`
        });
      }
    }
    router.post("/", auth, (req, res) => {
      const { order_id, type, reason, images, items } = req.body || {};
      if (!order_id)
        return res.status(400).json({ error: "Thi\u1EBFu order_id" });
      if (!["return", "exchange"].includes(type))
        return res.status(400).json({ error: 'type ph\u1EA3i l\xE0 "return" (tr\u1EA3) ho\u1EB7c "exchange" (\u0111\u1ED5i)' });
      if (!(reason || "").trim())
        return res.status(400).json({ error: "Vui l\xF2ng ghi r\xF5 l\xFD do \u0111\u1ED5i/tr\u1EA3" });
      const img = validateImages(images);
      if (img.error) return res.status(400).json({ error: img.error });
      const { order, error, message } = getOrderForUser(order_id, req.user);
      if (error) return res.status(error).json({ error: message });
      if (order.status !== "delivered")
        return res.status(403).json({ error: "Ch\u1EC9 \u0111\u01A1n h\xE0ng \u0111\xE3 giao m\u1EDBi \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u \u0111\u1ED5i/tr\u1EA3" });
      if (order.satisfied_at)
        return res.status(400).json({ error: "B\u1EA1n \u0111\xE3 x\xE1c nh\u1EADn h\xE0i l\xF2ng v\u1EDBi \u0111\u01A1n n\xE0y n\xEAn kh\xF4ng th\u1EC3 \u0111\u1ED5i/tr\u1EA3 n\u1EEFa" });
      const deliveredBase = deliveredAtOf(order.id) || order.created_at;
      if (deliveredBase && Date.now() - parseDbTime(deliveredBase).getTime() > SETTLE_DAYS * 24 * 3600 * 1e3)
        return res.status(400).json({ error: `\u0110\xE3 qu\xE1 ${SETTLE_DAYS} ng\xE0y k\u1EC3 t\u1EEB ng\xE0y giao h\xE0ng, \u0111\u01A1n kh\xF4ng c\xF2n \u0111\u01B0\u1EE3c \u0111\u1ED5i/tr\u1EA3` });
      const existing = db2.prepare(`SELECT id FROM returns WHERE order_id = ? AND status IN ('requested','approved','received')`).get(order.id);
      if (existing)
        return res.status(409).json({ error: "\u0110\u01A1n n\xE0y \u0111\xE3 c\xF3 y\xEAu c\u1EA7u \u0111\u1ED5i/tr\u1EA3 \u0111ang \u0111\u01B0\u1EE3c x\u1EED l\xFD" });
      const orderItems = db2.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all(order.id);
      const returnedBefore = db2.prepare(
        `SELECT ri.order_item_id AS oid, COALESCE(SUM(ri.quantity), 0) AS q
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.order_id = ? AND r.status = 'completed' GROUP BY ri.order_item_id`
      ).all(order.id);
      const returnedMap = Object.fromEntries(returnedBefore.map((x) => [x.oid, x.q]));
      let chosen;
      if (Array.isArray(items) && items.length) {
        chosen = [];
        for (const entry of items) {
          const oi = orderItems.find((x) => x.id === parseInt(entry.order_item_id));
          if (!oi) return res.status(400).json({ error: "S\u1EA3n ph\u1EA9m kh\xF4ng thu\u1ED9c \u0111\u01A1n h\xE0ng n\xE0y" });
          const remain = oi.quantity - (returnedMap[oi.id] || 0);
          const qty = parseInt(entry.quantity);
          if (!qty || qty < 1 || qty > remain)
            return res.status(400).json({ error: `S\u1ED1 l\u01B0\u1EE3ng \u0111\u1ED5i/tr\u1EA3 c\u1EE7a "${oi.product_name}" ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn ${remain}` });
          chosen.push({ oi, qty });
        }
      } else {
        chosen = orderItems.map((oi) => ({ oi, qty: oi.quantity - (returnedMap[oi.id] || 0) })).filter((c) => c.qty > 0);
      }
      if (!chosen.length)
        return res.status(400).json({ error: "Kh\xF4ng c\xF2n s\u1EA3n ph\u1EA9m n\xE0o \u0111\u1EC3 \u0111\u1ED5i/tr\u1EA3 trong \u0111\u01A1n n\xE0y" });
      const createTx = db2.transaction(() => {
        const info = db2.prepare("INSERT INTO returns (order_id, type, reason, images) VALUES (?, ?, ?, ?)").run(order.id, type, reason.trim(), img.value);
        const retId = info.lastInsertRowid;
        const insItem = db2.prepare(
          `INSERT INTO return_items (return_id, order_item_id, product_id, variant_id, product_name, variant_sku, price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const { oi, qty } of chosen) {
          insItem.run(retId, oi.id, oi.product_id, oi.variant_id, oi.product_name, oi.variant_sku || "", oi.price, qty);
        }
        return retId;
      });
      const ret = getReturnFull(createTx());
      if (order.user_id) {
        const label = type === "exchange" ? "\u{1F504} Y\xEAu c\u1EA7u \u0111\u1ED5i h\xE0ng" : "\u21A9\uFE0F Y\xEAu c\u1EA7u tr\u1EA3 h\xE0ng";
        const itemText = ret.items.map((i) => `${i.product_name} \xD7${i.quantity}`).join(", ");
        postAftersalesCard(order.user_id, {
          refType: "return",
          refId: ret.id,
          content: `${label} \u2014 \u0110\u01A1n #${order.id}: ${itemText}. L\xFD do: ${reason.trim().slice(0, 160)}`
        });
      }
      res.status(201).json({ return: ret });
    });
    router.get("/", auth, (req, res) => {
      const { status } = req.query;
      const conds = [];
      const params = [];
      if (req.user.role === "customer") {
        conds.push("o.user_id = ?");
        params.push(req.user.id);
      }
      if (status) {
        conds.push("r.status = ?");
        params.push(status);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const list = db2.prepare(
        `SELECT r.*, o.customer_name, o.total AS order_total
       FROM returns r JOIN orders o ON o.id = r.order_id
       ${where} ORDER BY r.id DESC`
      ).all(...params);
      res.json({ returns: attachItems(list.map(withImages)) });
    });
    router.get("/:id", auth, (req, res) => {
      const ret = db2.prepare("SELECT * FROM returns WHERE id = ?").get(req.params.id);
      if (!ret) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y y\xEAu c\u1EA7u" });
      const { error, message } = getOrderForUser(ret.order_id, req.user);
      if (error) return res.status(error).json({ error: message });
      res.json({ return: getReturnFull(ret.id) });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { action, refund_amount, reason, note, restock } = req.body || {};
      if (!["approved", "rejected", "received", "completed"].includes(action))
        return res.status(400).json({ error: "action ph\u1EA3i l\xE0 approved / rejected / received / completed" });
      if (action === "rejected" && !(reason || "").trim())
        return res.status(400).json({ error: "T\u1EEB ch\u1ED1i ph\u1EA3i ghi r\xF5 l\xFD do \u0111\u1EC3 kh\xE1ch h\xE0ng bi\u1EBFt" });
      let result;
      try {
        result = db2.transaction(() => {
          const ret2 = db2.prepare("SELECT * FROM returns WHERE id = ?").get(req.params.id);
          if (!ret2) return null;
          if (!(ACTION_FLOW[ret2.status] || []).includes(action))
            throw new Error(`Kh\xF4ng th\u1EC3 chuy\u1EC3n y\xEAu c\u1EA7u t\u1EEB "${ret2.status}" sang "${action}"`);
          const order2 = db2.prepare("SELECT * FROM orders WHERE id = ?").get(ret2.order_id);
          if (action === "approved") {
            db2.prepare("UPDATE returns SET status = 'approved' WHERE id = ?").run(ret2.id);
          } else if (action === "rejected") {
            db2.prepare("UPDATE returns SET status = 'rejected', reject_reason = ? WHERE id = ?").run(reason.trim().slice(0, 500), ret2.id);
          } else if (action === "received") {
            const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
            db2.prepare("UPDATE returns SET status = 'received', received_note = ?, received_at = ? WHERE id = ?").run(String(note || "").trim().slice(0, 500), now, ret2.id);
            applyRestock(ret2, restock);
          } else if (action === "completed") {
            applyRestock(ret2, restock);
            const items = db2.prepare("SELECT price, quantity FROM return_items WHERE return_id = ?").all(ret2.id);
            const suggested = items.reduce((s, i) => s + i.price * i.quantity, 0);
            const refund = refund_amount === void 0 || refund_amount === null ? suggested : parseInt(refund_amount) || 0;
            if (refund < 0 || refund > order2.total)
              throw new Error(`S\u1ED1 ti\u1EC1n ho\xE0n ph\u1EA3i t\u1EEB 0 \u0111\u1EBFn ${order2.total.toLocaleString("vi-VN")} \u20AB (t\u1ED5ng \u0111\u01A1n)`);
            db2.prepare("UPDATE returns SET status = 'completed', refund_amount = ? WHERE id = ?").run(refund, ret2.id);
            if (refund > 0) {
              const payment = db2.prepare("SELECT * FROM payments WHERE order_id = ?").get(ret2.order_id);
              if (payment && refund >= order2.total) {
                db2.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(payment.id);
                db2.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(order2.id);
              }
            }
          }
          return { ret: ret2, order: order2 };
        })();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      if (!result) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y y\xEAu c\u1EA7u" });
      const { ret, order } = result;
      const fresh = getReturnFull(ret.id);
      const typeLabel = ret.type === "exchange" ? "\u0111\u1ED5i h\xE0ng" : "tr\u1EA3 h\xE0ng";
      if (action === "approved") {
        notifyCustomer(
          order,
          fresh,
          `\u2705 Y\xEAu c\u1EA7u ${typeLabel} \u0111\u01A1n #${ret.order_id} \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn`,
          `\u2705 Shop \u0111\xE3 ch\u1EA5p nh\u1EADn y\xEAu c\u1EA7u ${typeLabel} cho \u0111\u01A1n #${ret.order_id}. B\u1EA1n vui l\xF2ng \u0111\xF3ng g\xF3i v\xE0 g\u1EEDi h\xE0ng v\u1EC1 shop gi\xFAp shop nh\xE9. Shop s\u1EBD th\xF4ng b\xE1o ngay khi nh\u1EADn \u0111\u01B0\u1EE3c h\xE0ng.`,
          req.user.id
        );
      } else if (action === "rejected") {
        notifyCustomer(
          order,
          fresh,
          `\u274C Y\xEAu c\u1EA7u ${typeLabel} \u0111\u01A1n #${ret.order_id} b\u1ECB t\u1EEB ch\u1ED1i`,
          `\u274C Shop r\u1EA5t ti\u1EBFc, y\xEAu c\u1EA7u ${typeLabel} cho \u0111\u01A1n #${ret.order_id} ch\u01B0a \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn. L\xFD do: ${fresh.reject_reason}. B\u1EA1n c\u1EA7n h\u1ED7 tr\u1EE3 th\xEAm c\u1EE9 nh\u1EAFn cho shop nh\xE9.`,
          req.user.id
        );
      } else if (action === "received") {
        notifyCustomer(
          order,
          fresh,
          `\u{1F4E5} Shop \u0111\xE3 nh\u1EADn l\u1EA1i h\xE0ng c\u1EE7a \u0111\u01A1n #${ret.order_id}`,
          `\u{1F4E5} Shop \u0111\xE3 nh\u1EADn l\u1EA1i h\xE0ng c\u1EE7a \u0111\u01A1n #${ret.order_id}${fresh.received_note ? `. T\xECnh tr\u1EA1ng h\xE0ng nh\u1EADn l\u1EA1i: ${fresh.received_note}` : ""}. Shop \u0111ang ho\xE0n t\u1EA5t th\u1EE7 t\u1EE5c cho b\u1EA1n.`,
          req.user.id
        );
      } else if (action === "completed") {
        const refundText = fresh.refund_amount > 0 ? ` S\u1ED1 ti\u1EC1n ho\xE0n l\u1EA1i cho b\u1EA1n: ${fresh.refund_amount.toLocaleString("vi-VN")} \u20AB.` : "";
        notifyCustomer(
          order,
          fresh,
          `\u21A9\uFE0F Y\xEAu c\u1EA7u ${typeLabel} \u0111\u01A1n #${ret.order_id} \u0111\xE3 ho\xE0n t\u1EA5t`,
          `\u21A9\uFE0F Y\xEAu c\u1EA7u ${typeLabel} cho \u0111\u01A1n #${ret.order_id} \u0111\xE3 x\u1EED l\xFD xong.${refundText} C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 tin t\u01B0\u1EDFng BI99!`,
          req.user.id
        );
      }
      res.json({ return: fresh });
    });
    module2.exports = router;
  }
});

// routes/warranties.js
var require_warranties = __commonJS({
  "routes/warranties.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { validateImages, parseImages } = require_images();
    var { postAftersalesCard, postChatNotice } = require_chatCard();
    var router = express2.Router();
    var withImages = (row) => row ? { ...row, images: parseImages(row.images) } : row;
    function getOrderForUser(orderId, user) {
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
      if (!order) return { error: 404, message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" };
      if (!["admin", "sale"].includes(user.role) && order.user_id !== user.id)
        return { error: 403, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n v\u1EDBi \u0111\u01A1n h\xE0ng n\xE0y" };
      return { order };
    }
    function addMonths(dateStr, months) {
      const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
      d.setMonth(d.getMonth() + months);
      return d.toISOString().slice(0, 10);
    }
    function today() {
      return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
    router.post("/", auth, (req, res) => {
      const { order_id, months, reason, images } = req.body || {};
      if (!order_id)
        return res.status(400).json({ error: "Thi\u1EBFu order_id" });
      const isCustomerSelf = req.user.role === "customer";
      const { order, error, message } = getOrderForUser(order_id, req.user);
      if (error) return res.status(error).json({ error: message });
      if (isCustomerSelf) {
        if (order.status !== "delivered")
          return res.status(403).json({ error: "Ch\u1EC9 \u0111\u01A1n h\xE0ng \u0111\xE3 giao m\u1EDBi \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u b\u1EA3o h\xE0nh" });
        if (!(reason || "").trim())
          return res.status(400).json({ error: "Vui l\xF2ng ghi r\xF5 l\xFD do / t\xECnh tr\u1EA1ng c\u1EA7n b\u1EA3o h\xE0nh" });
        const img = validateImages(images);
        if (img.error) return res.status(400).json({ error: img.error });
        const existing2 = db2.prepare("SELECT id FROM warranties WHERE order_id = ? AND status IN ('requested','accepted','received','active')").get(order.id);
        if (existing2)
          return res.status(409).json({ error: "\u0110\u01A1n n\xE0y \u0111\xE3 c\xF3 y\xEAu c\u1EA7u b\u1EA3o h\xE0nh \u0111ang x\u1EED l\xFD ho\u1EB7c \u0111ang hi\u1EC7u l\u1EF1c" });
        const info2 = db2.prepare(
          `INSERT INTO warranties (order_id, months, start_date, end_date, status, reason, images)
         VALUES (?, 0, NULL, NULL, 'requested', ?, ?)`
        ).run(order.id, reason.trim(), img.value);
        const warranty2 = db2.prepare("SELECT * FROM warranties WHERE id = ?").get(info2.lastInsertRowid);
        if (order.user_id) {
          postAftersalesCard(order.user_id, {
            refType: "warranty",
            refId: warranty2.id,
            content: `\u{1F6E1}\uFE0F Y\xEAu c\u1EA7u b\u1EA3o h\xE0nh \u2014 \u0110\u01A1n #${order.id}: ${reason.trim().slice(0, 200)}`
          });
        }
        return res.status(201).json({ warranty: withImages(warranty2) });
      }
      const n = parseInt(months);
      if (!n || n <= 0 || n > 120)
        return res.status(400).json({ error: "S\u1ED1 th\xE1ng b\u1EA3o h\xE0nh ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 120" });
      const existing = db2.prepare("SELECT id FROM warranties WHERE order_id = ? AND status IN ('requested','accepted','received','active')").get(order.id);
      if (existing)
        return res.status(409).json({ error: "\u0110\u01A1n n\xE0y \u0111\xE3 c\xF3 y\xEAu c\u1EA7u b\u1EA3o h\xE0nh \u0111ang x\u1EED l\xFD ho\u1EB7c \u0111ang hi\u1EC7u l\u1EF1c" });
      const start = today();
      const end = addMonths(start, n);
      const info = db2.prepare(
        `INSERT INTO warranties (order_id, months, start_date, end_date, status, reason, images)
       VALUES (?, ?, ?, ?, 'active', '', '[]')`
      ).run(order.id, n, start, end);
      const warranty = db2.prepare("SELECT * FROM warranties WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ warranty: withImages(warranty) });
    });
    router.get("/", auth, (req, res) => {
      const { status } = req.query;
      const conds = [];
      const params = [];
      if (req.user.role === "customer") {
        conds.push("o.user_id = ?");
        params.push(req.user.id);
      }
      if (status) {
        conds.push("w.status = ?");
        params.push(status);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const list = db2.prepare(
        `SELECT w.*, o.customer_name, o.total AS order_total
       FROM warranties w JOIN orders o ON o.id = w.order_id
       ${where} ORDER BY w.id DESC`
      ).all(...params);
      res.json({ warranties: list.map(withImages) });
    });
    var FLOW = {
      requested: ["accept", "reject", "void"],
      accepted: ["received", "activate", "void"],
      received: ["activate", "void"],
      active: ["extend", "void"],
      expired: ["extend", "void"],
      rejected: [],
      void: []
    };
    var fmtDay = (d) => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "";
    function notifyWarrantyCustomer(w, title, content, senderId) {
      const order = db2.prepare("SELECT user_id FROM orders WHERE id = ?").get(w.order_id);
      if (!order || !order.user_id) return;
      try {
        db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        ).run(order.user_id, "warranty", title, content, "/don-hang");
      } catch (e) {
      }
      try {
        postChatNotice(order.user_id, senderId, content);
      } catch (e) {
      }
    }
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { action, months, note } = req.body || {};
      const ACTIONS = ["accept", "reject", "received", "activate", "extend", "void"];
      if (!ACTIONS.includes(action))
        return res.status(400).json({ error: "action kh\xF4ng h\u1EE3p l\u1EC7" });
      if (action === "reject" && !String(note || "").trim())
        return res.status(400).json({ error: "T\u1EEB ch\u1ED1i ph\u1EA3i ghi r\xF5 l\xFD do (truy\u1EC1n v\xE0o tr\u01B0\u1EDDng note) \u0111\u1EC3 kh\xE1ch h\xE0ng bi\u1EBFt" });
      const w = db2.prepare("SELECT * FROM warranties WHERE id = ?").get(req.params.id);
      if (!w) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\u1EA3o h\xE0nh" });
      if (!(FLOW[w.status] || []).includes(action))
        return res.status(400).json({ error: `Kh\xF4ng th\u1EC3 th\u1EF1c hi\u1EC7n "${action}" khi b\u1EA3o h\xE0nh \u0111ang \u1EDF tr\u1EA1ng th\xE1i "${w.status}"` });
      if (action === "accept") {
        db2.prepare("UPDATE warranties SET status = 'accepted' WHERE id = ?").run(w.id);
        notifyWarrantyCustomer(
          w,
          `\u{1F6E1}\uFE0F Y\xEAu c\u1EA7u b\u1EA3o h\xE0nh \u0111\u01A1n #${w.order_id} \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn`,
          `\u{1F6E1}\uFE0F Shop \u0111\xE3 ch\u1EA5p nh\u1EADn y\xEAu c\u1EA7u b\u1EA3o h\xE0nh cho \u0111\u01A1n #${w.order_id}. B\u1EA1n vui l\xF2ng \u0111\xF3ng g\xF3i v\xE0 g\u1EEDi h\xE0ng v\u1EC1 shop gi\xFAp shop nh\xE9. Shop s\u1EBD th\xF4ng b\xE1o ngay khi nh\u1EADn \u0111\u01B0\u1EE3c h\xE0ng.`,
          req.user.id
        );
      } else if (action === "reject") {
        db2.prepare("UPDATE warranties SET status = 'rejected' WHERE id = ?").run(w.id);
        const reasonText = String(note || "").trim();
        notifyWarrantyCustomer(
          w,
          `\u274C Y\xEAu c\u1EA7u b\u1EA3o h\xE0nh \u0111\u01A1n #${w.order_id} b\u1ECB t\u1EEB ch\u1ED1i`,
          `\u274C Shop r\u1EA5t ti\u1EBFc, y\xEAu c\u1EA7u b\u1EA3o h\xE0nh cho \u0111\u01A1n #${w.order_id} ch\u01B0a \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn.${reasonText ? ` L\xFD do: ${reasonText}.` : ""} B\u1EA1n c\u1EA7n h\u1ED7 tr\u1EE3 th\xEAm c\u1EE9 nh\u1EAFn cho shop nh\xE9.`,
          req.user.id
        );
      } else if (action === "received") {
        const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
        const noteText = String(note || "").trim().slice(0, 500);
        db2.prepare("UPDATE warranties SET status = 'received', received_note = ?, received_at = ? WHERE id = ?").run(noteText, now, w.id);
        notifyWarrantyCustomer(
          w,
          `\u{1F4E5} Shop \u0111\xE3 nh\u1EADn l\u1EA1i h\xE0ng b\u1EA3o h\xE0nh c\u1EE7a \u0111\u01A1n #${w.order_id}`,
          `\u{1F4E5} Shop \u0111\xE3 nh\u1EADn l\u1EA1i h\xE0ng b\u1EA3o h\xE0nh c\u1EE7a \u0111\u01A1n #${w.order_id}${noteText ? `. T\xECnh tr\u1EA1ng h\xE0ng nh\u1EADn l\u1EA1i: ${noteText}` : ""}. Shop \u0111ang x\u1EED l\xFD b\u1EA3o h\xE0nh cho b\u1EA1n.`,
          req.user.id
        );
      } else if (action === "activate") {
        const n = parseInt(months);
        if (!n || n <= 0 || n > 120)
          return res.status(400).json({ error: "S\u1ED1 th\xE1ng b\u1EA3o h\xE0nh ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 120" });
        const start = today();
        const end = addMonths(start, n);
        db2.prepare("UPDATE warranties SET months = ?, start_date = ?, end_date = ?, status = 'active' WHERE id = ?").run(n, start, end, w.id);
        const order = db2.prepare("SELECT user_id FROM orders WHERE id = ?").get(w.order_id);
        if (order && order.user_id) {
          const updated = db2.prepare("SELECT * FROM warranties WHERE id = ?").get(w.id);
          const detail = `S\u1EA3n ph\u1EA9m c\u1EE7a b\u1EA1n \u0111\u01B0\u1EE3c b\u1EA3o h\xE0nh ${n} th\xE1ng (t\u1EEB ${fmtDay(start)} \u0111\u1EBFn ${fmtDay(end)}).` + (updated.received_note ? ` T\xECnh tr\u1EA1ng h\xE0ng shop \u0111\xE3 nh\u1EADn l\u1EA1i: ${updated.received_note}.` : "");
          try {
            db2.prepare(
              "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
            ).run(order.user_id, "warranty", `\u{1F6E1}\uFE0F B\u1EA3o h\xE0nh \u0111\u01A1n #${w.order_id} \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1EA5p nh\u1EADn`, detail, "/don-hang");
          } catch (e) {
          }
          try {
            postChatNotice(
              order.user_id,
              req.user.id,
              `\u{1F6E1}\uFE0F Shop \u0111\xE3 ch\u1EA5p nh\u1EADn b\u1EA3o h\xE0nh cho \u0111\u01A1n #${w.order_id}. ${detail} C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 tin t\u01B0\u1EDFng BI99!`
            );
          } catch (e) {
          }
        }
      } else if (action === "void") {
        db2.prepare("UPDATE warranties SET status = 'void' WHERE id = ?").run(w.id);
        notifyWarrantyCustomer(
          w,
          `\u{1F6E1}\uFE0F B\u1EA3o h\xE0nh \u0111\u01A1n #${w.order_id} \u0111\xE3 b\u1ECB h\u1EE7y`,
          `\u{1F6E1}\uFE0F B\u1EA3o h\xE0nh c\u1EE7a \u0111\u01A1n #${w.order_id} \u0111\xE3 b\u1ECB h\u1EE7y.${String(note || "").trim() ? ` Ghi ch\xFA: ${String(note).trim()}` : ""} N\u1EBFu b\u1EA1n c\u1EA7n h\u1ED7 tr\u1EE3 th\xEAm, c\u1EE9 nh\u1EAFn cho shop nh\xE9.`,
          req.user.id
        );
      } else if (action === "extend") {
        const n = parseInt(months);
        if (!n || n <= 0 || n > 120)
          return res.status(400).json({ error: "S\u1ED1 th\xE1ng gia h\u1EA1n ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 120" });
        const base = w.end_date && w.end_date >= today() ? w.end_date : today();
        const newEnd = addMonths(base, n);
        db2.prepare("UPDATE warranties SET end_date = ?, months = months + ?, status = 'active' WHERE id = ?").run(newEnd, n, w.id);
        notifyWarrantyCustomer(
          w,
          `\u{1F6E1}\uFE0F B\u1EA3o h\xE0nh \u0111\u01A1n #${w.order_id} \u0111\xE3 \u0111\u01B0\u1EE3c gia h\u1EA1n`,
          `\u{1F6E1}\uFE0F B\u1EA3o h\xE0nh c\u1EE7a \u0111\u01A1n #${w.order_id} \u0111\u01B0\u1EE3c gia h\u1EA1n th\xEAm ${n} th\xE1ng, hi\u1EC7u l\u1EF1c \u0111\u1EBFn ${fmtDay(newEnd)}. C\u1EA3m \u01A1n b\u1EA1n \u0111\xE3 tin t\u01B0\u1EDFng BI99!`,
          req.user.id
        );
      }
      const warranty = db2.prepare("SELECT * FROM warranties WHERE id = ?").get(w.id);
      res.json({ warranty: withImages(warranty) });
    });
    module2.exports = router;
  }
});

// routes/repairs.js
var require_repairs = __commonJS({
  "routes/repairs.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    db2.addColumnIfMissing(
      "repairs",
      "warranty_id",
      "warranty_id INTEGER REFERENCES warranties(id) ON DELETE SET NULL"
    );
    var VALID_STATUS = ["received", "repairing", "done", "returned"];
    function checkCustomerScope({ order_id, warranty_id }, user) {
      if (user.role === "admin") return { ok: true };
      if (order_id) {
        const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
        if (!order) return { ok: false, error: 404, message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" };
        if (order.user_id !== user.id)
          return { ok: false, error: 403, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n v\u1EDBi \u0111\u01A1n h\xE0ng n\xE0y" };
      }
      if (warranty_id) {
        const w = db2.prepare(
          `SELECT w.* FROM warranties w JOIN orders o ON o.id = w.order_id WHERE w.id = ?`
        ).get(warranty_id);
        if (!w) return { ok: false, error: 404, message: "Kh\xF4ng t\xECm th\u1EA5y b\u1EA3o h\xE0nh" };
        const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(w.order_id);
        if (!order || order.user_id !== user.id)
          return { ok: false, error: 403, message: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n v\u1EDBi b\u1EA3o h\xE0nh n\xE0y" };
      }
      return { ok: true };
    }
    router.post("/", auth, (req, res) => {
      const { order_id, warranty_id, description } = req.body || {};
      if (!(description || "").trim())
        return res.status(400).json({ error: "Vui l\xF2ng m\xF4 t\u1EA3 t\xECnh tr\u1EA1ng c\u1EA7n s\u1EEDa ch\u1EEFa" });
      const scope = checkCustomerScope({ order_id, warranty_id }, req.user);
      if (!scope.ok) return res.status(scope.error).json({ error: scope.message });
      const info = db2.prepare(
        `INSERT INTO repairs (order_id, warranty_id, description, fee, status)
       VALUES (?, ?, ?, 0, 'received')`
      ).run(order_id || null, warranty_id || null, description.trim());
      const repair = db2.prepare("SELECT * FROM repairs WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ repair });
    });
    router.get("/", auth, (req, res) => {
      const { status } = req.query;
      const conds = [];
      const params = [];
      if (req.user.role !== "admin") {
        conds.push("(o.user_id = ? OR wo.user_id = ?)");
        params.push(req.user.id, req.user.id);
      }
      if (status) {
        conds.push("r.status = ?");
        params.push(status);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const list = db2.prepare(
        `SELECT r.*, o.customer_name
       FROM repairs r
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN warranties w ON w.id = r.warranty_id
       LEFT JOIN orders wo ON wo.id = w.order_id
       ${where} ORDER BY r.id DESC`
      ).all(...params);
      res.json({ repairs: list });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const { status, fee } = req.body || {};
      if (!VALID_STATUS.includes(status))
        return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7" });
      const f = fee === void 0 ? void 0 : parseInt(fee);
      if (f !== void 0 && (isNaN(f) || f < 0))
        return res.status(400).json({ error: "Ph\xED s\u1EEDa ch\u1EEFa ph\u1EA3i >= 0" });
      const repair = db2.prepare("SELECT * FROM repairs WHERE id = ?").get(req.params.id);
      if (!repair) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\u1EBFu s\u1EEDa ch\u1EEFa" });
      db2.prepare("UPDATE repairs SET status = ?, fee = ? WHERE id = ?").run(status, f !== void 0 ? f : repair.fee, repair.id);
      const updated = db2.prepare("SELECT * FROM repairs WHERE id = ?").get(repair.id);
      res.json({ repair: updated });
    });
    module2.exports = router;
  }
});

// routes/inventory.js
var require_inventory = __commonJS({
  "routes/inventory.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    router.use(auth, staffOnly);
    var PO_STATUS_LABEL = {
      draft: "Nh\xE1p",
      confirmed: "\u0110\xE3 x\xE1c nh\u1EADn",
      received: "\u0110\xE3 nh\u1EADp kho",
      cancelled: "\u0110\xE3 h\u1EE7y"
    };
    router.get("/suppliers", (req, res) => {
      const suppliers = db2.prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
      res.json({ suppliers });
    });
    router.post("/suppliers", (req, res) => {
      const { name, phone, address, note } = req.body || {};
      if (!name || !name.trim())
        return res.status(400).json({ error: "T\xEAn nh\xE0 cung c\u1EA5p l\xE0 b\u1EAFt bu\u1ED9c" });
      const info = db2.prepare(
        `INSERT INTO suppliers (name, phone, address, note) VALUES (?, ?, ?, ?)`
      ).run(name.trim(), (phone || "").trim(), (address || "").trim(), (note || "").trim());
      res.status(201).json({ supplier: db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(info.lastInsertRowid) });
    });
    router.put("/suppliers/:id", (req, res) => {
      const { name, phone, address, note } = req.body || {};
      if (!name || !name.trim())
        return res.status(400).json({ error: "T\xEAn nh\xE0 cung c\u1EA5p l\xE0 b\u1EAFt bu\u1ED9c" });
      const info = db2.prepare(
        `UPDATE suppliers SET name = ?, phone = ?, address = ?, note = ? WHERE id = ?`
      ).run(name.trim(), (phone || "").trim(), (address || "").trim(), (note || "").trim(), req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y nh\xE0 cung c\u1EA5p" });
      res.json({ supplier: db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) });
    });
    router.delete("/suppliers/:id", (req, res) => {
      const used = db2.prepare("SELECT COUNT(*) AS n FROM purchase_orders WHERE supplier_id = ?").get(req.params.id).n;
      if (used > 0)
        return res.status(409).json({ error: `Kh\xF4ng th\u1EC3 x\xF3a: nh\xE0 cung c\u1EA5p \u0111ang c\xF3 ${used} phi\u1EBFu nh\u1EADp h\xE0ng` });
      const info = db2.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y nh\xE0 cung c\u1EA5p" });
      res.json({ message: "\u0110\xE3 x\xF3a nh\xE0 cung c\u1EA5p" });
    });
    function validateItem(item) {
      const hasVariant = item.variant_id !== void 0 && item.variant_id !== null && item.variant_id !== "";
      const hasProduct = item.product_id !== void 0 && item.product_id !== null && item.product_id !== "";
      if (hasVariant && hasProduct || !hasVariant && !hasProduct)
        return { ok: false, error: "M\u1ED7i d\xF2ng h\xE0ng ph\u1EA3i c\xF3 \u0111\xFAng 1 trong 2: variant_id ho\u1EB7c product_id" };
      const qty = parseInt(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0)
        return { ok: false, error: "S\u1ED1 l\u01B0\u1EE3ng ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn d\u01B0\u01A1ng" };
      const unitPrice = parseInt(item.unit_price);
      if (isNaN(unitPrice) || unitPrice < 0)
        return { ok: false, error: "Gi\xE1 nh\u1EADp ph\u1EA3i l\xE0 s\u1ED1 kh\xF4ng \xE2m" };
      if (hasVariant) {
        const variant = db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(item.variant_id);
        if (!variant) return { ok: false, error: `Kh\xF4ng t\xECm th\u1EA5y bi\u1EBFn th\u1EC3 #${item.variant_id}` };
        return { ok: true, variant, qty, unitPrice };
      }
      const product = db2.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id);
      if (!product) return { ok: false, error: `Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m #${item.product_id}` };
      const hasActiveVariants = db2.prepare(
        "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
      ).get(product.id).n > 0;
      if (hasActiveVariants)
        return { ok: false, error: `S\u1EA3n ph\u1EA9m "${product.name}" c\xF3 bi\u1EBFn th\u1EC3 \u2014 h\xE3y nh\u1EADp theo t\u1EEBng bi\u1EBFn th\u1EC3` };
      return { ok: true, product, qty, unitPrice };
    }
    router.get("/purchase-orders", (req, res) => {
      const orders = db2.prepare(
        `SELECT po.*, s.name AS supplier_name,
            COALESCE((SELECT SUM(pi.quantity * pi.unit_price) FROM purchase_items pi WHERE pi.po_id = po.id), 0) AS total
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     ORDER BY po.id DESC`
      ).all();
      res.json({ purchase_orders: orders.map((o) => ({ ...o, status_label: PO_STATUS_LABEL[o.status] || o.status })) });
    });
    router.get("/purchase-orders/:id", (req, res) => {
      const po = db2.prepare(
        `SELECT po.*, s.name AS supplier_name
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = ?`
      ).get(req.params.id);
      if (!po) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\u1EBFu nh\u1EADp" });
      const items = db2.prepare(
        `SELECT pi.*,
            v.sku AS variant_sku, v.color AS variant_color, v.size AS variant_size,
            p.name AS product_name
     FROM purchase_items pi
     LEFT JOIN product_variants v ON v.id = pi.variant_id
     LEFT JOIN products p ON p.id = COALESCE(pi.product_id, v.product_id)
     WHERE pi.po_id = ? ORDER BY pi.id`
      ).all(po.id);
      res.json({ purchase_order: { ...po, status_label: PO_STATUS_LABEL[po.status] || po.status }, items });
    });
    router.post("/purchase-orders", (req, res) => {
      const { supplier_id, note, items } = req.body || {};
      if (!supplier_id)
        return res.status(400).json({ error: "supplier_id l\xE0 b\u1EAFt bu\u1ED9c" });
      const supplier = db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(supplier_id);
      if (!supplier) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y nh\xE0 cung c\u1EA5p" });
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Phi\u1EBFu nh\u1EADp ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 1 d\xF2ng h\xE0ng" });
      const validated = [];
      for (let i = 0; i < items.length; i++) {
        const v = validateItem(items[i] || {});
        if (!v.ok) return res.status(400).json({ error: `D\xF2ng ${i + 1}: ${v.error}` });
        validated.push(v);
      }
      const tx = db2.transaction(() => {
        const poInfo = db2.prepare(
          `INSERT INTO purchase_orders (supplier_id, status, total, note) VALUES (?, 'draft', 0, ?)`
        ).run(supplier_id, (note || "").trim());
        const poId2 = poInfo.lastInsertRowid;
        let total = 0;
        const insItem = db2.prepare(
          `INSERT INTO purchase_items (po_id, variant_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?)`
        );
        for (const v of validated) {
          insItem.run(
            poId2,
            v.variant ? v.variant.id : null,
            v.variant ? null : v.product.id,
            v.qty,
            v.unitPrice
          );
          total += v.qty * v.unitPrice;
        }
        db2.prepare("UPDATE purchase_orders SET total = ? WHERE id = ?").run(total, poId2);
        return poId2;
      });
      const poId = tx();
      const po = db2.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(poId);
      res.status(201).json({ purchase_order: { ...po, status_label: PO_STATUS_LABEL[po.status] } });
    });
    router.put("/purchase-orders/:id/receive", (req, res) => {
      const po = db2.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
      if (!po) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\u1EBFu nh\u1EADp" });
      if (po.status === "received")
        return res.status(409).json({ error: "Phi\u1EBFu nh\u1EADp \u0111\xE3 \u0111\u01B0\u1EE3c nh\u1EADp kho tr\u01B0\u1EDBc \u0111\xF3" });
      if (po.status === "cancelled")
        return res.status(409).json({ error: "Phi\u1EBFu nh\u1EADp \u0111\xE3 b\u1ECB h\u1EE7y, kh\xF4ng th\u1EC3 nh\u1EADp kho" });
      const items = db2.prepare("SELECT * FROM purchase_items WHERE po_id = ? ORDER BY id").all(po.id);
      if (items.length === 0)
        return res.status(400).json({ error: "Phi\u1EBFu nh\u1EADp kh\xF4ng c\xF3 d\xF2ng h\xE0ng n\xE0o" });
      const tx = db2.transaction(() => {
        let total2 = 0;
        const addVariant = db2.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?");
        const addProduct = db2.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        for (const it of items) {
          if (it.variant_id) {
            const v = db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(it.variant_id);
            if (!v) throw new Error(`Kh\xF4ng t\xECm th\u1EA5y bi\u1EBFn th\u1EC3 #${it.variant_id}`);
            addVariant.run(it.quantity, it.variant_id);
            db2.logStockMovement({
              product_id: v.product_id,
              variant_id: it.variant_id,
              type: "IN",
              qty: it.quantity,
              ref_type: "purchase",
              ref_id: po.id,
              note: `Nh\u1EADp kho theo phi\u1EBFu #${po.id}`
            });
          } else {
            const p = db2.prepare("SELECT * FROM products WHERE id = ?").get(it.product_id);
            if (!p) throw new Error(`Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m #${it.product_id}`);
            const hasActiveVariants = db2.prepare(
              "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
            ).get(p.id).n > 0;
            if (hasActiveVariants)
              throw new Error(`S\u1EA3n ph\u1EA9m "${p.name}" hi\u1EC7n c\xF3 bi\u1EBFn th\u1EC3 \u2014 nh\u1EADp theo t\u1EEBng bi\u1EBFn th\u1EC3`);
            addProduct.run(it.quantity, it.product_id);
            db2.logStockMovement({
              product_id: it.product_id,
              variant_id: null,
              type: "IN",
              qty: it.quantity,
              ref_type: "purchase",
              ref_id: po.id,
              note: `Nh\u1EADp kho theo phi\u1EBFu #${po.id}`
            });
          }
          total2 += it.quantity * it.unit_price;
        }
        db2.prepare("UPDATE purchase_orders SET status = 'received', total = ? WHERE id = ?").run(total2, po.id);
        return total2;
      });
      const total = tx();
      res.json({ purchase_order: { ...db2.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(po.id), status_label: "\u0110\xE3 nh\u1EADp kho" }, total });
    });
    router.put("/purchase-orders/:id/cancel", (req, res) => {
      const po = db2.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
      if (!po) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\u1EBFu nh\u1EADp" });
      if (po.status === "received")
        return res.status(409).json({ error: "Phi\u1EBFu \u0111\xE3 nh\u1EADp kho, kh\xF4ng th\u1EC3 h\u1EE7y" });
      if (po.status === "cancelled")
        return res.status(409).json({ error: "Phi\u1EBFu \u0111\xE3 \u0111\u01B0\u1EE3c h\u1EE7y tr\u01B0\u1EDBc \u0111\xF3" });
      db2.prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(po.id);
      res.json({ purchase_order: { ...po, status: "cancelled", status_label: "\u0110\xE3 h\u1EE7y" } });
    });
    router.get("/movements", (req, res) => {
      const conds = [];
      const params = [];
      if (req.query.variant_id) {
        conds.push("sm.variant_id = ?");
        params.push(req.query.variant_id);
      } else if (req.query.product_id) {
        conds.push("sm.product_id = ?");
        params.push(req.query.product_id);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
      const movements = db2.prepare(
        `SELECT sm.*,
            p.name AS product_name,
            v.sku AS variant_sku, v.color AS variant_color, v.size AS variant_size
     FROM stock_movements sm
     LEFT JOIN products p ON p.id = sm.product_id
     LEFT JOIN product_variants v ON v.id = sm.variant_id
     ${where}
     ORDER BY sm.id DESC LIMIT ?`
      ).all(...params, limit);
      res.json({ movements });
    });
    router.post("/adjust", (req, res) => {
      const { variant_id, product_id, qty, note } = req.body || {};
      const hasVariant = variant_id !== void 0 && variant_id !== null && variant_id !== "";
      const hasProduct = product_id !== void 0 && product_id !== null && product_id !== "";
      if (hasVariant && hasProduct || !hasVariant && !hasProduct)
        return res.status(400).json({ error: "Ph\u1EA3i ch\u1EC9 \u0111\u1ECBnh \u0111\xFAng 1 trong 2: variant_id ho\u1EB7c product_id" });
      const delta = parseInt(qty);
      if (isNaN(delta) || delta === 0)
        return res.status(400).json({ error: "S\u1ED1 l\u01B0\u1EE3ng \u0111i\u1EC1u ch\u1EC9nh ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn kh\xE1c 0" });
      if (!note || !note.trim())
        return res.status(400).json({ error: "Ghi ch\xFA (note) l\xE0 b\u1EAFt bu\u1ED9c khi \u0111i\u1EC1u ch\u1EC9nh kho" });
      let row, targetType;
      if (hasVariant) {
        row = db2.prepare("SELECT * FROM product_variants WHERE id = ?").get(variant_id);
        targetType = "variant";
      } else {
        row = db2.prepare("SELECT * FROM products WHERE id = ?").get(product_id);
        targetType = "product";
        const hasActiveVariants = db2.prepare(
          "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
        ).get(product_id).n > 0;
        if (hasActiveVariants)
          return res.status(400).json({ error: "S\u1EA3n ph\u1EA9m c\xF3 bi\u1EBFn th\u1EC3 \u2014 h\xE3y \u0111i\u1EC1u ch\u1EC9nh theo t\u1EEBng bi\u1EBFn th\u1EC3" });
      }
      if (!row) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y m\u1EB7t h\xE0ng c\u1EA7n \u0111i\u1EC1u ch\u1EC9nh" });
      if (row.stock + delta < 0)
        return res.status(409).json({ error: `T\u1ED3n kho kh\xF4ng \u0111\u1EE7 (\u0111ang c\xF3 ${row.stock}, mu\u1ED1n ${delta > 0 ? "+" : ""}${delta})` });
      const tx = db2.transaction(() => {
        if (targetType === "variant") {
          db2.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(delta, row.id);
          db2.logStockMovement({
            product_id: row.product_id,
            variant_id: row.id,
            type: "ADJUST",
            qty: delta,
            ref_type: "adjust",
            ref_id: null,
            note: note.trim()
          });
          return db2.prepare("SELECT stock FROM product_variants WHERE id = ?").get(row.id).stock;
        }
        db2.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(delta, row.id);
        db2.logStockMovement({
          product_id: row.id,
          variant_id: null,
          type: "ADJUST",
          qty: delta,
          ref_type: "adjust",
          ref_id: null,
          note: note.trim()
        });
        return db2.prepare("SELECT stock FROM products WHERE id = ?").get(row.id).stock;
      });
      const newStock = tx();
      res.json({ message: "\u0110\xE3 \u0111i\u1EC1u ch\u1EC9nh t\u1ED3n kho", stock: newStock });
    });
    router.get("/low-stock", (req, res) => {
      const threshold = Math.max(0, parseInt(req.query.threshold) || 5);
      const products = db2.prepare(
        `SELECT p.id AS product_id, NULL AS variant_id, p.name AS product_name, NULL AS variant_sku,
            p.stock, NULL AS variant_color, NULL AS variant_size, 'product' AS kind
     FROM products p
     WHERE p.stock <= ?
       AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
     ORDER BY p.stock ASC`
      ).all(threshold);
      const variants = db2.prepare(
        `SELECT v.product_id, v.id AS variant_id, p.name AS product_name, v.sku AS variant_sku,
            v.stock, v.color AS variant_color, v.size AS variant_size, 'variant' AS kind
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.is_active = 1 AND v.stock <= ?
     ORDER BY v.stock ASC`
      ).all(threshold);
      res.json({ threshold, low_stock: [...products, ...variants].sort((a, b) => a.stock - b.stock) });
    });
    router.get("/items", (req, res) => {
      const q = (req.query.q || "").trim();
      const conds = [];
      const params = [];
      if (q) {
        conds.push("p.name LIKE ?");
        params.push(`%${q}%`);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const products = db2.prepare(
        `SELECT p.id, p.name, p.stock, p.price FROM products p ${where} ORDER BY p.name LIMIT 100`
      ).all(...params);
      const variants = db2.prepare(
        `SELECT v.id, v.product_id, v.sku, v.color, v.size, v.stock
     FROM product_variants v
     WHERE v.is_active = 1 AND v.product_id IN (${products.map(() => "?").join(",") || "NULL"})
     ORDER BY v.id`
      ).all(...products.map((p) => p.id));
      const byProduct = {};
      for (const v of variants) (byProduct[v.product_id] = byProduct[v.product_id] || []).push(v);
      res.json({ items: products.map((p) => ({ ...p, variants: byProduct[p.id] || [] })) });
    });
    module2.exports = router;
  }
});

// routes/payments.js
var require_payments = __commonJS({
  "routes/payments.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { checkTierUpgrade } = require_tiers();
    var router = express2.Router();
    var METHODS = ["cod", "bank", "momo"];
    var STATUSES = ["pending", "verified", "failed", "refunded"];
    var STATUS_LABEL = { pending: "Ch\u1EDD duy\u1EC7t", verified: "\u0110\xE3 x\xE1c nh\u1EADn", failed: "Th\u1EA5t b\u1EA1i", refunded: "\u0110\xE3 ho\xE0n ti\u1EC1n" };
    function getPaymentFull(id) {
      return db2.prepare(
        `SELECT p.*,
            o.customer_name, o.phone, o.address, o.status AS order_status,
            o.payment_method AS order_payment_method, o.user_id,
            u.email AS user_email
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.id = ?`
      ).get(id);
    }
    router.post("/", auth, (req, res) => {
      const { order_id, method, proof_url } = req.body || {};
      if (!order_id) return res.status(400).json({ error: "Thi\u1EBFu order_id" });
      if (!METHODS.includes(method))
        return res.status(400).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n kh\xF4ng h\u1EE3p l\u1EC7 (cod/bank/momo)" });
      const order = db2.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      if (req.user.role !== "admin" && order.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n thanh to\xE1n cho \u0111\u01A1n h\xE0ng n\xE0y" });
      const exists = db2.prepare("SELECT id FROM payments WHERE order_id = ?").get(order.id);
      if (exists)
        return res.status(409).json({ error: "\u0110\u01A1n h\xE0ng n\xE0y \u0111\xE3 c\xF3 b\u1EA3n ghi thanh to\xE1n" });
      const note = method === "momo" ? "Ch\u1EDD webhook MoMo" : "";
      const create = db2.transaction(() => {
        const info = db2.prepare(
          `INSERT INTO payments (order_id, method, amount, status, proof_url, note)
       VALUES (?, ?, ?, 'pending', ?, ?)`
        ).run(order.id, method, order.total, (proof_url || "").trim(), note);
        db2.prepare(
          `UPDATE orders SET payment_method = ?, payment_status = 'pending' WHERE id = ?`
        ).run(method, order.id);
        return info.lastInsertRowid;
      });
      const paymentId = create();
      res.status(201).json({ payment: getPaymentFull(paymentId) });
    });
    router.get("/", auth, (req, res) => {
      const { order_id, status } = req.query;
      const conds = [];
      const params = [];
      if (req.user.role !== "admin") {
        conds.push("o.user_id = ?");
        params.push(req.user.id);
      }
      if (order_id) {
        conds.push("p.order_id = ?");
        params.push(order_id);
      }
      if (status) {
        if (!STATUSES.includes(status))
          return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i l\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7" });
        conds.push("p.status = ?");
        params.push(status);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const payments = db2.prepare(
        `SELECT p.*,
            o.customer_name, o.phone, o.status AS order_status, o.user_id,
            u.email AS user_email
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY p.created_at DESC`
      ).all(...params);
      res.json({ payments });
    });
    router.get("/:id", auth, (req, res) => {
      const payment = getPaymentFull(req.params.id);
      if (!payment) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y thanh to\xE1n" });
      if (req.user.role !== "admin" && payment.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem thanh to\xE1n n\xE0y" });
      res.json({ payment });
    });
    router.put("/:id/proof", auth, (req, res) => {
      const { proof_url } = req.body || {};
      if (!proof_url || !String(proof_url).trim())
        return res.status(400).json({ error: "Thi\u1EBFu link \u1EA3nh b\u1EB1ng ch\u1EE9ng chuy\u1EC3n kho\u1EA3n" });
      const payment = getPaymentFull(req.params.id);
      if (!payment) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y thanh to\xE1n" });
      if (req.user.role !== "admin" && payment.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n c\u1EADp nh\u1EADt thanh to\xE1n n\xE0y" });
      if (payment.status !== "pending")
        return res.status(400).json({ error: "Ch\u1EC9 g\u1EEDi b\u1EB1ng ch\u1EE9ng khi thanh to\xE1n \u0111ang ch\u1EDD duy\u1EC7t" });
      db2.prepare("UPDATE payments SET proof_url = ? WHERE id = ?").run(String(proof_url).trim(), req.params.id);
      res.json({ payment: getPaymentFull(req.params.id) });
    });
    router.put("/:id/verify", auth, staffOnly, (req, res) => {
      const { action, note } = req.body || {};
      if (!["verified", "failed"].includes(action))
        return res.status(400).json({ error: "action ph\u1EA3i l\xE0 'verified' ho\u1EB7c 'failed'" });
      const apply = db2.transaction(() => {
        const payment = db2.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
        if (!payment) return null;
        if (payment.status !== "pending")
          throw new Error(`Ch\u1EC9 duy\u1EC7t \u0111\u01B0\u1EE3c thanh to\xE1n \u0111ang "Ch\u1EDD duy\u1EC7t" (hi\u1EC7n t\u1EA1i: ${STATUS_LABEL[payment.status]})`);
        const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
        db2.prepare(
          `UPDATE payments SET status = ?, verified_at = ?, note = ? WHERE id = ?`
        ).run(action, now, (note || "").trim(), payment.id);
        db2.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(action, payment.order_id);
        return payment.id;
      });
      let paymentId;
      try {
        paymentId = apply();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      if (!paymentId) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y thanh to\xE1n" });
      if (action === "verified") {
        try {
          const pay = db2.prepare("SELECT order_id FROM payments WHERE id = ?").get(paymentId);
          const ord = pay && db2.prepare("SELECT user_id FROM orders WHERE id = ?").get(pay.order_id);
          if (ord && ord.user_id) checkTierUpgrade(ord.user_id);
        } catch (e) {
        }
      }
      res.json({ payment: getPaymentFull(paymentId) });
    });
    router.put("/:id/refund", auth, staffOnly, (req, res) => {
      const { note } = req.body || {};
      if (!(note || "").trim())
        return res.status(400).json({ error: "Ho\xE0n ti\u1EC1n c\u1EA7n ghi r\xF5 l\xFD do (note)" });
      const apply = db2.transaction(() => {
        const payment = db2.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
        if (!payment) return null;
        if (payment.status !== "verified")
          throw new Error(`Ch\u1EC9 ho\xE0n ti\u1EC1n \u0111\u01B0\u1EE3c cho thanh to\xE1n \u0111\xE3 x\xE1c nh\u1EADn (hi\u1EC7n t\u1EA1i: ${STATUS_LABEL[payment.status]})`);
        db2.prepare(
          `UPDATE payments SET status = 'refunded', note = ? WHERE id = ?`
        ).run((note || "").trim(), payment.id);
        db2.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = ?").run(payment.order_id);
        return payment.id;
      });
      let paymentId;
      try {
        paymentId = apply();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      if (!paymentId) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y thanh to\xE1n" });
      res.json({ payment: getPaymentFull(paymentId) });
    });
    module2.exports = router;
  }
});

// routes/shipping.js
var require_shipping = __commonJS({
  "routes/shipping.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    var STATUS_FLOW = {
      preparing: ["shipped", "failed"],
      shipped: ["delivered", "failed"],
      delivered: [],
      failed: []
    };
    var STATUS_LABELS = {
      preparing: "\u0110ang chu\u1EA9n b\u1ECB",
      shipped: "\u0110\xE3 g\u1EEDi h\xE0ng",
      delivered: "\u0110\xE3 giao h\xE0ng",
      failed: "Giao th\u1EA5t b\u1EA1i"
    };
    function getShipping(id) {
      return db2.prepare(
        `SELECT s.*, m.name AS method_name
     FROM shippings s LEFT JOIN shipping_methods m ON m.id = s.method_id
     WHERE s.id = ?`
      ).get(id);
    }
    function adminIfAll(req, res, next) {
      if (req.query.all === "1") return auth(req, res, () => staffOnly(req, res, next));
      next();
    }
    router.get("/methods", adminIfAll, (req, res) => {
      const methods = req.query.all === "1" ? db2.prepare("SELECT * FROM shipping_methods ORDER BY fee ASC").all() : db2.prepare("SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY fee ASC").all();
      res.json({ methods });
    });
    router.post("/methods", auth, staffOnly, (req, res) => {
      const { name, fee, eta_days, is_active } = req.body || {};
      if (!name || !String(name).trim())
        return res.status(400).json({ error: "T\xEAn ph\u01B0\u01A1ng th\u1EE9c l\xE0 b\u1EAFt bu\u1ED9c" });
      const info = db2.prepare(
        "INSERT INTO shipping_methods (name, fee, eta_days, is_active) VALUES (?, ?, ?, ?)"
      ).run(
        String(name).trim(),
        Math.max(0, parseInt(fee) || 0),
        Math.max(0, parseInt(eta_days) || 0),
        is_active === void 0 ? 1 : is_active ? 1 : 0
      );
      res.status(201).json({
        method: db2.prepare("SELECT * FROM shipping_methods WHERE id = ?").get(info.lastInsertRowid)
      });
    });
    router.put("/methods/:id", auth, staffOnly, (req, res) => {
      const m = db2.prepare("SELECT * FROM shipping_methods WHERE id = ?").get(req.params.id);
      if (!m) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n" });
      const { name, fee, eta_days, is_active } = req.body || {};
      db2.prepare(
        "UPDATE shipping_methods SET name = ?, fee = ?, eta_days = ?, is_active = ? WHERE id = ?"
      ).run(
        name !== void 0 && String(name).trim() ? String(name).trim() : m.name,
        fee === void 0 ? m.fee : Math.max(0, parseInt(fee) || 0),
        eta_days === void 0 ? m.eta_days : Math.max(0, parseInt(eta_days) || 0),
        is_active === void 0 ? m.is_active : is_active ? 1 : 0,
        req.params.id
      );
      res.json({
        method: db2.prepare("SELECT * FROM shipping_methods WHERE id = ?").get(req.params.id)
      });
    });
    router.delete("/methods/:id", auth, staffOnly, (req, res) => {
      const m = db2.prepare("SELECT * FROM shipping_methods WHERE id = ?").get(req.params.id);
      if (!m) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n" });
      const usedByShipping = db2.prepare("SELECT COUNT(*) AS c FROM shippings WHERE method_id = ?").get(req.params.id).c;
      const usedByOrders = db2.prepare("SELECT COUNT(*) AS c FROM orders WHERE shipping_method_id = ?").get(req.params.id).c;
      if (usedByShipping > 0 || usedByOrders > 0)
        return res.status(409).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c \u0111ang \u0111\u01B0\u1EE3c \u0111\u01A1n h\xE0ng s\u1EED d\u1EE5ng, kh\xF4ng th\u1EC3 x\xF3a" });
      db2.prepare("DELETE FROM shipping_methods WHERE id = ?").run(req.params.id);
      res.json({ message: "\u0110\xE3 x\xF3a ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n" });
    });
    router.get("/", auth, (req, res) => {
      const { order_id } = req.query;
      const conds = [];
      const params = [];
      if (order_id) {
        conds.push("s.order_id = ?");
        params.push(order_id);
      }
      if (req.user.role !== "admin") {
        conds.push("o.user_id = ?");
        params.push(req.user.id);
      }
      const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
      const shippings = db2.prepare(
        `SELECT s.*, m.name AS method_name, o.customer_name, o.phone, o.total AS order_total
       FROM shippings s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN shipping_methods m ON m.id = s.method_id
       ${where} ORDER BY s.id DESC`
      ).all(...params);
      res.json({ shippings });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { order_id, method_id, tracking_code } = req.body || {};
      if (!order_id || !method_id)
        return res.status(400).json({ error: "order_id v\xE0 method_id l\xE0 b\u1EAFt bu\u1ED9c" });
      const order = db2.prepare("SELECT id FROM orders WHERE id = ?").get(order_id);
      if (!order) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng" });
      const method = db2.prepare("SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1").get(method_id);
      if (!method)
        return res.status(400).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c v\u1EADn chuy\u1EC3n kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 t\u1EAFt" });
      const exists = db2.prepare("SELECT id FROM shippings WHERE order_id = ?").get(order_id);
      if (exists)
        return res.status(409).json({ error: "\u0110\u01A1n h\xE0ng \u0111\xE3 c\xF3 th\xF4ng tin v\u1EADn chuy\u1EC3n" });
      const create = db2.transaction(() => {
        const info = db2.prepare(
          "INSERT INTO shippings (order_id, method_id, fee, tracking_code) VALUES (?, ?, ?, ?)"
        ).run(order_id, method.id, method.fee, (tracking_code || "").toString().trim());
        db2.prepare("UPDATE orders SET shipping_fee = ?, shipping_method_id = ? WHERE id = ?").run(method.fee, method.id, order_id);
        return info.lastInsertRowid;
      });
      const id = create();
      res.status(201).json({ shipping: getShipping(id) });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const ship = db2.prepare("SELECT * FROM shippings WHERE id = ?").get(req.params.id);
      if (!ship) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng tin v\u1EADn chuy\u1EC3n" });
      const { tracking_code, status } = req.body || {};
      const sets = [];
      const params = [];
      if (tracking_code !== void 0) {
        sets.push("tracking_code = ?");
        params.push(tracking_code.toString().trim());
      }
      if (status !== void 0 && status !== ship.status) {
        if (!STATUS_FLOW[status])
          return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i v\u1EADn chuy\u1EC3n kh\xF4ng h\u1EE3p l\u1EC7" });
        if (!STATUS_FLOW[ship.status].includes(status))
          return res.status(400).json({
            error: `Kh\xF4ng th\u1EC3 chuy\u1EC3n tr\u1EA1ng th\xE1i t\u1EEB "${STATUS_LABELS[ship.status]}" sang "${STATUS_LABELS[status]}"`
          });
        sets.push("status = ?");
        params.push(status);
        if (status === "shipped") sets.push("shipped_at = datetime('now')");
        if (status === "delivered") sets.push("delivered_at = datetime('now')");
      }
      if (!sets.length) return res.json({ shipping: getShipping(ship.id) });
      params.push(ship.id);
      db2.prepare(`UPDATE shippings SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      res.json({ shipping: getShipping(ship.id) });
    });
    module2.exports = router;
  }
});

// routes/promo-events.js
var require_promo_events = __commonJS({
  "routes/promo-events.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    function normSlug(s) {
      return String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function parseISO(v) {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    function parseCodes(v) {
      if (!v) return [];
      const arr = Array.isArray(v) ? v : String(v).split(",");
      return [...new Set(arr.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
    }
    function validatePayload(body, isCreate, selfId) {
      const clean = {};
      const cur = !isCreate && selfId ? db2.prepare("SELECT start_at, end_at FROM promo_events WHERE id = ?").get(selfId) : null;
      if (isCreate || body.name !== void 0) {
        const name = String(body.name || "").trim();
        if (!name) return { ok: false, error: "T\xEAn s\u1EF1 ki\u1EC7n l\xE0 b\u1EAFt bu\u1ED9c" };
        clean.name = name;
      }
      if (isCreate || body.slug !== void 0) {
        const slug = normSlug(body.slug || body.name);
        if (!slug) return { ok: false, error: "Slug kh\xF4ng h\u1EE3p l\u1EC7" };
        const dup = db2.prepare("SELECT id FROM promo_events WHERE slug = ?").get(slug);
        if (dup && dup.id !== selfId) return { ok: false, error: "Slug \u0111\xE3 t\u1ED3n t\u1EA1i" };
        clean.slug = slug;
      }
      for (const k of ["title", "subtitle"]) {
        if (body[k] !== void 0) clean[k] = String(body[k] || "").trim();
      }
      for (const k of ["start_at", "end_at"]) {
        if (body[k] !== void 0) {
          if (!body[k]) {
            clean[k] = null;
            continue;
          }
          const iso = parseISO(body[k]);
          if (!iso) return { ok: false, error: `Th\u1EDDi gian ${k} kh\xF4ng h\u1EE3p l\u1EC7` };
          clean[k] = iso;
        }
      }
      const start = clean.start_at !== void 0 ? clean.start_at : cur ? cur.start_at : void 0;
      const end = clean.end_at !== void 0 ? clean.end_at : cur ? cur.end_at : void 0;
      if (start && end && new Date(end) <= new Date(start))
        return { ok: false, error: "Th\u1EDDi gian k\u1EBFt th\xFAc ph\u1EA3i sau th\u1EDDi gian b\u1EAFt \u0111\u1EA7u" };
      if (body.voucher_codes !== void 0) {
        const codes = parseCodes(body.voucher_codes);
        for (const c of codes) {
          const v = db2.prepare("SELECT id FROM vouchers WHERE code = ?").get(c);
          if (!v) return { ok: false, error: `M\xE3 voucher "${c}" kh\xF4ng t\u1ED3n t\u1EA1i` };
        }
        clean.voucher_codes = JSON.stringify(codes);
      }
      if (body.is_active !== void 0) clean.is_active = body.is_active ? 1 : 0;
      return { ok: true, clean };
    }
    function withCodes(row) {
      if (!row) return row;
      let codes = [];
      try {
        codes = JSON.parse(row.voucher_codes || "[]");
      } catch (e) {
        codes = [];
      }
      return { ...row, voucher_codes: codes };
    }
    router.get("/", auth, staffOnly, (req, res) => {
      const rows = db2.prepare("SELECT * FROM promo_events ORDER BY id DESC").all();
      res.json({ events: rows.map(withCodes) });
    });
    router.get("/active", (req, res) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let row = db2.prepare(
        `SELECT * FROM promo_events WHERE is_active = 1
       AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
       ORDER BY id DESC LIMIT 1`
      ).get(now, now);
      let status = "live";
      if (!row) {
        row = db2.prepare(
          `SELECT * FROM promo_events WHERE is_active = 1
         AND start_at IS NOT NULL AND start_at > ?
         ORDER BY start_at ASC LIMIT 1`
        ).get(now);
        status = "upcoming";
      }
      if (!row) return res.json({ event: null, status: null, vouchers: [], products: [] });
      const event = withCodes(row);
      const vouchers = event.voucher_codes.length ? db2.prepare(
        `SELECT code, type, value, min_order, usage_limit, used_count FROM vouchers
           WHERE is_active = 1 AND code IN (${event.voucher_codes.map(() => "?").join(",")})`
      ).all(...event.voucher_codes) : [];
      const products = db2.prepare(
        `SELECT ep.product_id AS id, ep.sale_price, p.name, p.price, p.image_url, p.stock
       FROM promo_event_products ep JOIN products p ON p.id = ep.product_id
       WHERE ep.event_id = ? ORDER BY ep.id`
      ).all(event.id).map((r) => ({
        ...r,
        discount_percent: r.price > 0 ? Math.round((1 - r.sale_price / r.price) * 100) : 0
      }));
      res.json({ event, status, vouchers, products });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { ok, error, clean } = validatePayload(req.body || {}, true, null);
      if (!ok) return res.status(400).json({ error });
      const info = db2.prepare(
        `INSERT INTO promo_events (name, slug, title, subtitle, start_at, end_at, voucher_codes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        clean.name,
        clean.slug,
        clean.title || "",
        clean.subtitle || "",
        clean.start_at || null,
        clean.end_at || null,
        clean.voucher_codes || "[]",
        clean.is_active || 0
      );
      const row = db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ event: withCodes(row) });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const cur = db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(req.params.id);
      if (!cur) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
      const { ok, error, clean } = validatePayload(req.body || {}, false, cur.id);
      if (!ok) return res.status(400).json({ error });
      const keys = ["name", "slug", "title", "subtitle", "start_at", "end_at", "voucher_codes", "is_active"];
      const sets = [], params = [];
      for (const k of keys) {
        if (clean[k] !== void 0) {
          sets.push(`${k} = ?`);
          params.push(clean[k]);
        }
      }
      if (!sets.length) return res.status(400).json({ error: "Kh\xF4ng c\xF3 tr\u01B0\u1EDDng n\xE0o \u0111\u1EC3 c\u1EADp nh\u1EADt" });
      sets.push(`updated_at = datetime('now')`);
      params.push(cur.id);
      db2.prepare(`UPDATE promo_events SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      res.json({ event: withCodes(db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(cur.id)) });
    });
    router.put("/:id/toggle", auth, staffOnly, (req, res) => {
      const cur = db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(req.params.id);
      if (!cur) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
      const next = cur.is_active ? 0 : 1;
      const codes = parseCodes(cur.voucher_codes ? JSON.parse(cur.voucher_codes || "[]") : []);
      const txn = db2.transaction(() => {
        db2.prepare(`UPDATE promo_events SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(next, cur.id);
        for (const c of codes) {
          db2.prepare("UPDATE vouchers SET is_active = ? WHERE code = ?").run(next, c);
        }
      });
      txn();
      const row = withCodes(db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(cur.id));
      res.json({ event: row, vouchers_synced: codes });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const cur = db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(req.params.id);
      if (!cur) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
      const codes = parseCodes(cur.voucher_codes ? JSON.parse(cur.voucher_codes || "[]") : []);
      const txn = db2.transaction(() => {
        if (cur.is_active) {
          for (const c of codes) {
            db2.prepare("UPDATE vouchers SET is_active = 0 WHERE code = ?").run(c);
          }
        }
        db2.prepare("DELETE FROM promo_events WHERE id = ?").run(cur.id);
      });
      txn();
      res.json({ message: "\u0110\xE3 x\xF3a s\u1EF1 ki\u1EC7n", vouchers_deactivated: cur.is_active ? codes : [] });
    });
    function getEventOr404(id, res) {
      const ev = db2.prepare("SELECT * FROM promo_events WHERE id = ?").get(id);
      if (!ev) {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
        return null;
      }
      return ev;
    }
    router.get("/:id/products", auth, staffOnly, (req, res) => {
      if (!getEventOr404(req.params.id, res)) return;
      const rows = db2.prepare(
        `SELECT ep.product_id, ep.sale_price, p.name, p.price, p.image_url, p.stock
       FROM promo_event_products ep JOIN products p ON p.id = ep.product_id
       WHERE ep.event_id = ? ORDER BY ep.id`
      ).all(req.params.id).map((r) => ({
        ...r,
        discount_percent: r.price > 0 ? Math.round((1 - r.sale_price / r.price) * 100) : 0
      }));
      res.json({ products: rows });
    });
    router.post("/:id/products", auth, staffOnly, (req, res) => {
      if (!getEventOr404(req.params.id, res)) return;
      const product_id = parseInt(req.body.product_id) || 0;
      const sale_price = parseInt(req.body.sale_price) || 0;
      const p = db2.prepare("SELECT id, name, price FROM products WHERE id = ?").get(product_id);
      if (!p) return res.status(400).json({ error: "S\u1EA3n ph\u1EA9m kh\xF4ng t\u1ED3n t\u1EA1i" });
      if (sale_price <= 0) return res.status(400).json({ error: "Gi\xE1 sale ph\u1EA3i l\u1EDBn h\u01A1n 0" });
      if (sale_price >= p.price)
        return res.status(400).json({ error: `Gi\xE1 sale ph\u1EA3i th\u1EA5p h\u01A1n gi\xE1 g\u1ED1c (${p.price.toLocaleString("vi-VN")}\u20AB)` });
      const dup = db2.prepare("SELECT id FROM promo_event_products WHERE event_id = ? AND product_id = ?").get(req.params.id, product_id);
      if (dup) return res.status(400).json({ error: "S\u1EA3n ph\u1EA9m \u0111\xE3 c\xF3 trong s\u1EF1 ki\u1EC7n" });
      db2.prepare(
        "INSERT INTO promo_event_products (event_id, product_id, sale_price) VALUES (?, ?, ?)"
      ).run(req.params.id, product_id, sale_price);
      res.status(201).json({ message: "\u0110\xE3 th\xEAm s\u1EA3n ph\u1EA9m v\xE0o s\u1EF1 ki\u1EC7n" });
    });
    router.put("/:id/products/:product_id", auth, staffOnly, (req, res) => {
      if (!getEventOr404(req.params.id, res)) return;
      const link = db2.prepare("SELECT ep.id, p.price FROM promo_event_products ep JOIN products p ON p.id = ep.product_id WHERE ep.event_id = ? AND ep.product_id = ?").get(req.params.id, req.params.product_id);
      if (!link) return res.status(404).json({ error: "S\u1EA3n ph\u1EA9m kh\xF4ng c\xF3 trong s\u1EF1 ki\u1EC7n" });
      const sale_price = parseInt(req.body.sale_price) || 0;
      if (sale_price <= 0) return res.status(400).json({ error: "Gi\xE1 sale ph\u1EA3i l\u1EDBn h\u01A1n 0" });
      if (sale_price >= link.price)
        return res.status(400).json({ error: `Gi\xE1 sale ph\u1EA3i th\u1EA5p h\u01A1n gi\xE1 g\u1ED1c (${link.price.toLocaleString("vi-VN")}\u20AB)` });
      db2.prepare("UPDATE promo_event_products SET sale_price = ? WHERE id = ?").run(sale_price, link.id);
      res.json({ message: "\u0110\xE3 c\u1EADp nh\u1EADt gi\xE1 sale" });
    });
    router.delete("/:id/products/:product_id", auth, staffOnly, (req, res) => {
      if (!getEventOr404(req.params.id, res)) return;
      const r = db2.prepare("DELETE FROM promo_event_products WHERE event_id = ? AND product_id = ?").run(req.params.id, req.params.product_id);
      if (!r.changes) return res.status(404).json({ error: "S\u1EA3n ph\u1EA9m kh\xF4ng c\xF3 trong s\u1EF1 ki\u1EC7n" });
      res.json({ message: "\u0110\xE3 g\u1EE1 s\u1EA3n ph\u1EA9m kh\u1ECFi s\u1EF1 ki\u1EC7n" });
    });
    module2.exports = router;
  }
});

// routes/reviews.js
var require_reviews = __commonJS({
  "routes/reviews.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    function stripHtml(text) {
      return String(text || "").replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<style[\s\S]*?<\/style\s*>/gi, "").replace(/<[^>]*>/g, "");
    }
    var REVIEW_COLS = `
  r.id, r.product_id, r.user_id, r.rating, r.comment, r.is_approved, r.created_at,
  u.name AS user_name`;
    router.get("/", (req, res) => {
      const { product_id, mine } = req.query;
      if (mine === "1") {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: "C\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EC3 xem \u0111\xE1nh gi\xE1 c\u1EE7a b\u1EA1n" });
        const jwt = require("jsonwebtoken");
        const { auth: auth2, staffOnly: staffOnly2, JWT_SECRET } = require_auth();
        let userId;
        try {
          userId = jwt.verify(token, JWT_SECRET).id;
        } catch (e) {
          return res.status(401).json({ error: "Token kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n" });
        }
        const reviews2 = db2.prepare(
          `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`
        ).all(userId);
        return res.json({ reviews: reviews2 });
      }
      const conds = ["r.is_approved = 1"];
      const params = [];
      if (product_id) {
        conds.push("r.product_id = ?");
        params.push(product_id);
      }
      const where = "WHERE " + conds.join(" AND ");
      const reviews = db2.prepare(
        `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
     ${where} ORDER BY r.created_at DESC`
      ).all(...params);
      const out = { reviews };
      if (product_id) {
        const s = db2.prepare(
          `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
       FROM reviews WHERE product_id = ? AND is_approved = 1`
        ).get(product_id);
        out.summary = { avg_rating: s.avg_rating || 0, count: s.count || 0 };
      }
      res.json(out);
    });
    router.get("/pending", auth, staffOnly, (req, res) => {
      const reviews = db2.prepare(
        `SELECT ${REVIEW_COLS}, p.name AS product_name
     FROM reviews r LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE r.is_approved = 0 ORDER BY r.created_at DESC`
      ).all();
      res.json({ reviews });
    });
    router.post("/", auth, (req, res) => {
      const { product_id, rating, comment } = req.body || {};
      if (!product_id) return res.status(400).json({ error: "Thi\u1EBFu s\u1EA3n ph\u1EA9m" });
      const r = parseInt(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5)
        return res.status(400).json({ error: "\u0110i\u1EC3m \u0111\xE1nh gi\xE1 ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 5" });
      const product = db2.prepare("SELECT id FROM products WHERE id = ?").get(product_id);
      if (!product) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m" });
      const dup = db2.prepare("SELECT id FROM reviews WHERE product_id = ? AND user_id = ?").get(product_id, req.user.id);
      if (dup)
        return res.status(409).json({ error: "B\u1EA1n \u0111\xE3 \u0111\xE1nh gi\xE1 s\u1EA3n ph\u1EA9m n\xE0y r\u1ED3i", review_id: dup.id });
      const info = db2.prepare(
        "INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)"
      ).run(product_id, req.user.id, r, stripHtml(comment).trim());
      const review = db2.prepare(
        `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
      ).get(info.lastInsertRowid);
      res.status(201).json({ review });
    });
    router.put("/:id", auth, (req, res) => {
      const review = db2.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
      if (!review) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\xE1nh gi\xE1" });
      if (review.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n ch\u1EC9 \u0111\u01B0\u1EE3c s\u1EEDa \u0111\xE1nh gi\xE1 c\u1EE7a ch\xEDnh m\xECnh" });
      const { rating, comment } = req.body || {};
      const r = parseInt(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5)
        return res.status(400).json({ error: "\u0110i\u1EC3m \u0111\xE1nh gi\xE1 ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 5" });
      db2.prepare("UPDATE reviews SET rating = ?, comment = ? WHERE id = ?").run(r, stripHtml(comment).trim(), req.params.id);
      const updated = db2.prepare(
        `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
      ).get(req.params.id);
      res.json({ review: updated });
    });
    router.put("/:id/approve", auth, staffOnly, (req, res) => {
      const { is_approved } = req.body || {};
      if (![0, 1, "0", "1", true, false].includes(is_approved))
        return res.status(400).json({ error: "is_approved ph\u1EA3i l\xE0 0 ho\u1EB7c 1" });
      const info = db2.prepare("UPDATE reviews SET is_approved = ? WHERE id = ?").run(is_approved ? 1 : 0, req.params.id);
      if (!info.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\xE1nh gi\xE1" });
      res.json({ message: is_approved ? "\u0110\xE3 duy\u1EC7t \u0111\xE1nh gi\xE1" : "\u0110\xE3 t\u1EEB ch\u1ED1i \u0111\xE1nh gi\xE1" });
    });
    router.delete("/:id", auth, (req, res) => {
      const review = db2.prepare("SELECT * FROM reviews WHERE id = ?").get(req.params.id);
      if (!review) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\xE1nh gi\xE1" });
      if (req.user.role !== "admin" && review.user_id !== req.user.id)
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a \u0111\xE1nh gi\xE1 n\xE0y" });
      db2.prepare("DELETE FROM reviews WHERE id = ?").run(req.params.id);
      res.json({ message: "\u0110\xE3 x\xF3a \u0111\xE1nh gi\xE1" });
    });
    module2.exports = router;
  }
});

// routes/reports.js
var require_reports = __commonJS({
  "routes/reports.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    router.use(auth, staffOnly);
    var LOCAL = `date('now', 'localtime')`;
    var DEFAULT_THRESHOLD = 5;
    function isValidDate(s) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    }
    router.get("/summary", (req, res) => {
      const refundOf = (dateCond) => db2.prepare(
        `SELECT COALESCE(SUM(r.refund_amount), 0) AS v
     FROM returns r JOIN orders o ON o.id = r.order_id
     WHERE r.status = 'completed' AND o.payment_status = 'verified' AND o.status != 'cancelled'
       AND ${dateCond}`
      ).get().v;
      const revenue_today = db2.prepare(
        `SELECT COALESCE(SUM(total), 0) AS v FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND date(created_at, 'localtime') = ${LOCAL}`
      ).get().v - refundOf(`date(o.created_at, 'localtime') = ${LOCAL}`);
      const revenue_month = db2.prepare(
        `SELECT COALESCE(SUM(total), 0) AS v FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', ${LOCAL})`
      ).get().v - refundOf(`strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', ${LOCAL})`);
      const orders_today = db2.prepare(
        `SELECT COUNT(*) AS n FROM orders WHERE date(created_at, 'localtime') = ${LOCAL}`
      ).get().n;
      const orders_pending = db2.prepare(
        `SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'`
      ).get().n;
      const products_low_stock_count = db2.prepare(`SELECT COUNT(*) AS n FROM products WHERE stock <= ?`).get(DEFAULT_THRESHOLD).n + db2.prepare(`SELECT COUNT(*) AS n FROM product_variants WHERE stock <= ?`).get(DEFAULT_THRESHOLD).n;
      const customers_count = db2.prepare(
        `SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`
      ).get().n;
      res.json({
        revenue_today: Number(revenue_today) || 0,
        revenue_month: Number(revenue_month) || 0,
        orders_today,
        orders_pending,
        products_low_stock_count,
        customers_count
      });
    });
    router.get("/revenue", (req, res) => {
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const firstOfMonth = today.slice(0, 7) + "-01";
      const from = req.query.from || firstOfMonth;
      const to = req.query.to || today;
      const group = req.query.group === "month" ? "month" : "day";
      if (!isValidDate(from) || !isValidDate(to))
        return res.status(400).json({ error: "Ng\xE0y kh\xF4ng h\u1EE3p l\u1EC7, d\xF9ng \u0111\u1ECBnh d\u1EA1ng YYYY-MM-DD" });
      if (from > to)
        return res.status(400).json({ error: '"from" ph\u1EA3i nh\u1ECF h\u01A1n ho\u1EB7c b\u1EB1ng "to"' });
      const fmt = group === "month" ? "%Y-%m" : "%Y-%m-%d";
      const rows = db2.prepare(
        `SELECT strftime(?, created_at, 'localtime') AS label,
            COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
     FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND date(created_at, 'localtime') >= date(?) AND date(created_at, 'localtime') <= date(?)
     GROUP BY label`
      ).all(fmt, from, to);
      const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
      const refundRows = db2.prepare(
        `SELECT strftime(?, o.created_at, 'localtime') AS label,
            COALESCE(SUM(r.refund_amount), 0) AS refund
     FROM returns r JOIN orders o ON o.id = r.order_id
     WHERE r.status = 'completed' AND o.payment_status = 'verified' AND o.status != 'cancelled'
       AND date(o.created_at, 'localtime') >= date(?) AND date(o.created_at, 'localtime') <= date(?)
     GROUP BY label`
      ).all(fmt, from, to);
      const refundByLabel = Object.fromEntries(refundRows.map((r) => [r.label, Number(r.refund) || 0]));
      const labels = [];
      const [fy, fm, fd] = from.split("-").map(Number);
      const [ty, tm, td] = to.split("-").map(Number);
      const cursor = new Date(Date.UTC(fy, fm - 1, fd));
      const end = new Date(Date.UTC(ty, tm - 1, td));
      const seen = /* @__PURE__ */ new Set();
      while (cursor <= end) {
        const y = cursor.getUTCFullYear();
        const mo = String(cursor.getUTCMonth() + 1).padStart(2, "0");
        const dy = String(cursor.getUTCDate()).padStart(2, "0");
        const label = group === "month" ? `${y}-${mo}` : `${y}-${mo}-${dy}`;
        if (!seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      res.json(labels.map((label) => ({
        label,
        revenue: Math.max(0, (Number(byLabel[label]?.revenue) || 0) - (refundByLabel[label] || 0)),
        orders: Number(byLabel[label]?.orders) || 0
      })));
    });
    router.get("/top-products", (req, res) => {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
      const rows = db2.prepare(
        `SELECT oi.product_name,
            SUM(oi.quantity) AS qty_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.payment_status = 'verified' AND o.status != 'cancelled'
     GROUP BY oi.product_name
     ORDER BY qty_sold DESC
     LIMIT ?`
      ).all(limit);
      const returned = db2.prepare(
        `SELECT ri.product_name,
            COALESCE(SUM(ri.quantity), 0) AS qty,
            COALESCE(SUM(ri.quantity * ri.price), 0) AS revenue
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.status = 'completed'
     GROUP BY ri.product_name`
      ).all();
      const returnedMap = Object.fromEntries(returned.map((x) => [x.product_name, x]));
      res.json(rows.map((r) => {
        const back = returnedMap[r.product_name] || { qty: 0, revenue: 0 };
        return {
          product_name: r.product_name,
          qty_sold: Math.max(0, (Number(r.qty_sold) || 0) - (Number(back.qty) || 0)),
          revenue: Math.max(0, (Number(r.revenue) || 0) - (Number(back.revenue) || 0))
        };
      }).filter((r) => r.qty_sold > 0));
    });
    router.get("/low-stock", (req, res) => {
      const threshold = Math.max(0, parseInt(req.query.threshold) || DEFAULT_THRESHOLD);
      const products = db2.prepare(
        `SELECT id, name AS product_name, NULL AS sku, stock, 'product' AS type
     FROM products WHERE stock <= ?`
      ).all(threshold);
      const variants = db2.prepare(
        `SELECT pv.id, p.name AS product_name, pv.sku, pv.stock, 'variant' AS type
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.stock <= ?`
      ).all(threshold);
      res.json([...products, ...variants].sort((a, b) => a.stock - b.stock));
    });
    router.get("/orders-by-status", (req, res) => {
      const rows = db2.prepare(
        `SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC`
      ).all();
      res.json(rows.map((r) => ({ status: r.status, count: r.count })));
    });
    router.get("/payments-by-method", (req, res) => {
      const rows = db2.prepare(
        `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM payments WHERE status = 'verified' GROUP BY method ORDER BY count DESC`
      ).all();
      const refunds = db2.prepare(
        `SELECT p.method, COALESCE(SUM(r.refund_amount), 0) AS refund
     FROM returns r JOIN payments p ON p.order_id = r.order_id
     WHERE r.status = 'completed' AND p.status = 'verified'
     GROUP BY p.method`
      ).all();
      const refundMap = Object.fromEntries(refunds.map((x) => [x.method, Number(x.refund) || 0]));
      res.json(rows.map((r) => ({
        method: r.method,
        count: r.count,
        total: Math.max(0, (Number(r.total) || 0) - (refundMap[r.method] || 0))
      })));
    });
    module2.exports = router;
  }
});

// routes/announcements.js
var require_announcements = __commonJS({
  "routes/announcements.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var router = express2.Router();
    var clampZoom = (v, fb) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? Math.min(2.5, Math.max(1, n)) : fb;
    };
    var clampPos = (v, fb) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fb;
    };
    function row(r) {
      if (!r) return null;
      return {
        id: r.id,
        author_name: r.author_name || null,
        author_role: r.author_role || null,
        title: r.title,
        content: r.content || "",
        badge: r.badge || "",
        cta_text: r.cta_text || "",
        cta_link: r.cta_link || "",
        image_url: r.image_url || "",
        image_caption: r.image_caption || "",
        image_zoom: r.image_zoom != null ? Number(r.image_zoom) : 1,
        image_pos_x: r.image_pos_x != null ? Number(r.image_pos_x) : 50,
        image_pos_y: r.image_pos_y != null ? Number(r.image_pos_y) : 50,
        show_on_banner: !!r.show_on_banner,
        send_notification: !!r.send_notification,
        is_active: !!r.is_active,
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    }
    router.get("/active", (req, res) => {
      const rows = db2.prepare(
        `SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.is_active = 1 ORDER BY a.id DESC LIMIT 20`
      ).all();
      res.json({ announcements: rows.map(row) });
    });
    router.get("/", auth, staffOnly, (req, res) => {
      const rows = db2.prepare(`SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.id DESC`).all();
      res.json({ announcements: rows.map(row) });
    });
    router.post("/", auth, staffOnly, (req, res) => {
      const { title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active } = req.body || {};
      if (!(title || "").trim()) return res.status(400).json({ error: "Thi\u1EBFu ti\xEAu \u0111\u1EC1 th\xF4ng b\xE1o" });
      if (!(content || "").trim()) return res.status(400).json({ error: "Thi\u1EBFu n\u1ED9i dung th\xF4ng b\xE1o" });
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      const r = db2.prepare(
        `INSERT INTO announcements (title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        title.trim(),
        content.trim(),
        (badge || "").trim(),
        (cta_text || "").trim(),
        (cta_link || "").trim(),
        (image_url || "").trim(),
        (image_caption || "").trim(),
        clampZoom(image_zoom, 1),
        clampPos(image_pos_x, 50),
        clampPos(image_pos_y, 50),
        show_on_banner === false ? 0 : 1,
        send_notification === false ? 0 : 1,
        is_active === false ? 0 : 1,
        req.user ? req.user.id : null,
        now,
        now
      );
      res.status(201).json({ announcement: row(db2.prepare("SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?").get(r.lastInsertRowid)) });
    });
    router.put("/:id", auth, staffOnly, (req, res) => {
      const cur = db2.prepare("SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?").get(req.params.id);
      if (!cur) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng b\xE1o" });
      const { title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active } = req.body || {};
      if (title !== void 0 && !String(title).trim()) return res.status(400).json({ error: "Ti\xEAu \u0111\u1EC1 kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      db2.prepare(
        `UPDATE announcements SET title = ?, content = ?, badge = ?, cta_text = ?, cta_link = ?,
     image_url = ?, image_caption = ?, image_zoom = ?, image_pos_x = ?, image_pos_y = ?,
     show_on_banner = ?, send_notification = ?, is_active = ?, updated_at = ? WHERE id = ?`
      ).run(
        title !== void 0 ? String(title).trim() : cur.title,
        content !== void 0 ? String(content).trim() : cur.content,
        badge !== void 0 ? String(badge).trim() : cur.badge,
        cta_text !== void 0 ? String(cta_text).trim() : cur.cta_text,
        cta_link !== void 0 ? String(cta_link).trim() : cur.cta_link,
        image_url !== void 0 ? String(image_url).trim() : cur.image_url || "",
        image_caption !== void 0 ? String(image_caption).trim() : cur.image_caption || "",
        clampZoom(image_zoom, cur.image_zoom != null ? Number(cur.image_zoom) : 1),
        clampPos(image_pos_x, cur.image_pos_x != null ? Number(cur.image_pos_x) : 50),
        clampPos(image_pos_y, cur.image_pos_y != null ? Number(cur.image_pos_y) : 50),
        show_on_banner !== void 0 ? show_on_banner ? 1 : 0 : cur.show_on_banner,
        send_notification !== void 0 ? send_notification ? 1 : 0 : cur.send_notification,
        is_active !== void 0 ? is_active ? 1 : 0 : cur.is_active,
        now,
        req.params.id
      );
      res.json({ announcement: row(db2.prepare("SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?").get(req.params.id)) });
    });
    router.put("/:id/toggle", auth, staffOnly, (req, res) => {
      const cur = db2.prepare("SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?").get(req.params.id);
      if (!cur) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng b\xE1o" });
      const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      db2.prepare(`UPDATE announcements SET is_active = ?, updated_at = ? WHERE id = ?`).run(cur.is_active ? 0 : 1, now, req.params.id);
      res.json({ announcement: row(db2.prepare("SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?").get(req.params.id)) });
    });
    router.delete("/:id", auth, staffOnly, (req, res) => {
      const r = db2.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
      if (!r.changes) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng b\xE1o" });
      res.json({ ok: true });
    });
    module2.exports = router;
  }
});

// routes/chat.js
var require_chat = __commonJS({
  "routes/chat.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { parseImages } = require_images();
    var router = express2.Router();
    var STAFF = ["admin", "sale"];
    var isStaff = (u) => STAFF.includes(u.role);
    function participants(convId) {
      return db2.prepare(
        `SELECT u.id, u.name, u.role FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id = ? ORDER BY cp.joined_at`
      ).all(convId).map((p) => ({ id: p.id, name: p.name, role: p.role }));
    }
    function lastMessage(convId) {
      return db2.prepare(
        `SELECT m.id, m.sender_id, m.content, m.created_at, u.name AS sender_name
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1`
      ).get(convId) || null;
    }
    function myLastRead(convId, userId) {
      const r = db2.prepare("SELECT last_read_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?").get(convId, userId);
      return r ? r.last_read_id : null;
    }
    function unreadCount(convId, userId) {
      const lr = myLastRead(convId, userId);
      if (lr === null) return 0;
      const r = db2.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ? AND id > ? AND sender_id != ?").get(convId, lr, userId);
      return r.n;
    }
    function convShape(c, meId) {
      const parts = participants(c.id);
      const cust = c.customer_id ? db2.prepare("SELECT id, name FROM users WHERE id = ?").get(c.customer_id) : null;
      return {
        id: c.id,
        type: c.type,
        status: c.status,
        title: c.title || "",
        customer: cust ? { id: cust.id, name: cust.name } : null,
        participants: parts,
        staff_participants: parts.filter((p) => STAFF.includes(p.role)),
        last_message: lastMessage(c.id),
        unread: meId ? unreadCount(c.id, meId) : 0,
        created_at: c.created_at,
        updated_at: c.updated_at
      };
    }
    function messagesOf(convId) {
      const rows = db2.prepare(
        `SELECT m.id, m.sender_id, m.content, m.kind, m.ref_type, m.ref_id, m.created_at,
            u.name AS sender_name, u.role AS sender_role
     FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id ASC`
      ).all(convId);
      return enrichAftersales(rows);
    }
    function enrichAftersales(messages) {
      const retIds = [...new Set(messages.filter((m) => m.kind === "aftersales" && m.ref_type === "return" && m.ref_id).map((m) => m.ref_id))];
      const warIds = [...new Set(messages.filter((m) => m.kind === "aftersales" && m.ref_type === "warranty" && m.ref_id).map((m) => m.ref_id))];
      const rets = {};
      const wars = {};
      if (retIds.length) {
        db2.prepare(`SELECT * FROM returns WHERE id IN (${retIds.map(() => "?").join(",")})`).all(...retIds).forEach((r) => {
          rets[r.id] = r;
        });
      }
      if (warIds.length) {
        db2.prepare(`SELECT * FROM warranties WHERE id IN (${warIds.map(() => "?").join(",")})`).all(...warIds).forEach((w) => {
          wars[w.id] = w;
        });
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      for (const m of messages) {
        if (m.kind !== "aftersales") continue;
        if (m.ref_type === "return" && rets[m.ref_id]) {
          const r = rets[m.ref_id];
          m.aftersales = {
            ref_type: "return",
            id: r.id,
            order_id: r.order_id,
            type: r.type,
            reason: r.reason,
            images: parseImages(r.images),
            status: r.status
          };
        } else if (m.ref_type === "warranty" && wars[m.ref_id]) {
          const w = wars[m.ref_id];
          m.aftersales = {
            ref_type: "warranty",
            id: w.id,
            order_id: w.order_id,
            months: w.months,
            reason: w.reason || "",
            images: parseImages(w.images),
            status: w.status === "active" ? w.end_date && w.end_date < todayStr ? "expired" : "active" : w.status,
            end_date: w.end_date,
            received_note: w.received_note || "",
            received_at: w.received_at || null
          };
        }
      }
      return messages;
    }
    function markRead(convId, userId) {
      const r = db2.prepare("SELECT MAX(id) AS mx FROM chat_messages WHERE conversation_id = ?").get(convId);
      db2.prepare("UPDATE conversation_participants SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?").run(r.mx || 0, convId, userId);
    }
    function touch(convId) {
      db2.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);
    }
    function getConv(id) {
      return db2.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    }
    function cleanContent(v) {
      const s = String(v || "").trim();
      return s.slice(0, 2e3);
    }
    router.get("/my", auth, (req, res) => {
      const c = db2.prepare(
        "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? ORDER BY id DESC LIMIT 1"
      ).get(req.user.id);
      if (!c) return res.json({ conversation: null });
      res.json({
        conversation: { ...convShape(c, req.user.id), messages: messagesOf(c.id) }
      });
    });
    router.post("/start", auth, (req, res) => {
      const content = cleanContent(req.body.content);
      if (!content) return res.status(400).json({ error: "N\u1ED9i dung tin nh\u1EAFn tr\u1ED1ng" });
      let c = db2.prepare(
        "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active') ORDER BY id DESC LIMIT 1"
      ).get(req.user.id);
      if (!c) {
        const info = db2.prepare(
          "INSERT INTO conversations (type, customer_id, created_by, status) VALUES ('customer', ?, ?, 'waiting')"
        ).run(req.user.id, req.user.id);
        c = getConv(info.lastInsertRowid);
        db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(c.id, req.user.id);
      }
      db2.prepare("INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)").run(c.id, req.user.id, content);
      touch(c.id);
      markRead(c.id, req.user.id);
      res.json({ conversation: { ...convShape(c, req.user.id), messages: messagesOf(c.id) } });
    });
    router.post("/my/messages", auth, (req, res) => {
      const content = cleanContent(req.body.content);
      if (!content) return res.status(400).json({ error: "N\u1ED9i dung tin nh\u1EAFn tr\u1ED1ng" });
      const c = db2.prepare(
        "SELECT * FROM conversations WHERE type = 'customer' AND customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
      ).get(req.user.id);
      if (!c) return res.status(400).json({ error: "Cu\u1ED9c tr\xF2 chuy\u1EC7n ch\u01B0a \u0111\u01B0\u1EE3c nh\xE2n vi\xEAn ch\u1EA5p nh\u1EADn" });
      db2.prepare("INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)").run(c.id, req.user.id, content);
      touch(c.id);
      markRead(c.id, req.user.id);
      res.json({ ok: true, messages: messagesOf(c.id) });
    });
    router.get("/customer-conversations", auth, staffOnly, (req, res) => {
      const rows = db2.prepare(
        `SELECT * FROM conversations WHERE type = 'customer'
     ORDER BY CASE status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100`
      ).all();
      res.json({ conversations: rows.map((c) => convShape(c, req.user.id)) });
    });
    router.post("/:id/accept", auth, staffOnly, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c || c.type !== "customer") return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      if (c.status === "closed") return res.status(400).json({ error: "Cu\u1ED9c tr\xF2 chuy\u1EC7n \u0111\xE3 k\u1EBFt th\xFAc" });
      const staff = participants(c.id).filter((p) => STAFF.includes(p.role));
      const already = staff.some((p) => p.id === req.user.id);
      if (!already && staff.length >= 2) return res.status(400).json({ error: "Cu\u1ED9c tr\xF2 chuy\u1EC7n \u0111\xE3 \u0111\u1EE7 2 nh\xE2n vi\xEAn" });
      if (!already) {
        db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(c.id, req.user.id);
      }
      if (c.status === "waiting") {
        db2.prepare("UPDATE conversations SET status = 'active' WHERE id = ?").run(c.id);
      }
      touch(c.id);
      res.json({ conversation: convShape(getConv(c.id), req.user.id) });
    });
    router.post("/:id/close", auth, staffOnly, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c || c.type !== "customer") return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng \u1EDF trong cu\u1ED9c tr\xF2 chuy\u1EC7n n\xE0y" });
      db2.prepare("UPDATE conversations SET status = 'closed' WHERE id = ?").run(c.id);
      touch(c.id);
      res.json({ ok: true });
    });
    router.get("/:id/messages", auth, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      const isParticipant = myLastRead(c.id, req.user.id) !== null;
      if (c.type === "internal" && !isParticipant) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng \u1EDF trong cu\u1ED9c tr\xF2 chuy\u1EC7n n\xE0y" });
      if (c.type === "customer" && !isParticipant && !(isStaff(req.user) || c.customer_id === req.user.id)) {
        return res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n xem" });
      }
      if (isParticipant) markRead(c.id, req.user.id);
      res.json({ conversation: convShape(c, req.user.id), messages: messagesOf(c.id) });
    });
    router.post("/:id/messages", auth, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      const content = cleanContent(req.body.content);
      if (!content) return res.status(400).json({ error: "N\u1ED9i dung tin nh\u1EAFn tr\u1ED1ng" });
      const isParticipant = myLastRead(c.id, req.user.id) !== null;
      if (c.type === "customer") {
        if (c.status !== "active") return res.status(400).json({ error: "Cu\u1ED9c tr\xF2 chuy\u1EC7n ch\u01B0a m\u1EDF ho\u1EB7c \u0111\xE3 k\u1EBFt th\xFAc" });
        if (isStaff(req.user)) {
          if (!isParticipant) return res.status(403).json({ error: "H\xE3y b\u1EA5m Nh\u1EADn/Tham gia tr\u01B0\u1EDBc khi nh\u1EAFn" });
        } else if (c.customer_id !== req.user.id) {
          return res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n" });
        }
      } else if (!isParticipant) {
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng \u1EDF trong cu\u1ED9c tr\xF2 chuy\u1EC7n n\xE0y" });
      }
      db2.prepare("INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES (?, ?, ?)").run(c.id, req.user.id, content);
      touch(c.id);
      markRead(c.id, req.user.id);
      res.json({ ok: true, messages: messagesOf(c.id) });
    });
    router.post("/:id/read", auth, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng \u1EDF trong cu\u1ED9c tr\xF2 chuy\u1EC7n n\xE0y" });
      markRead(c.id, req.user.id);
      res.json({ ok: true });
    });
    router.get("/internal", auth, staffOnly, (req, res) => {
      const rows = db2.prepare(
        `SELECT c.* FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND cp.user_id = ?
     ORDER BY c.updated_at DESC`
      ).all(req.user.id);
      const staff = db2.prepare(
        "SELECT id, name, role FROM users WHERE role IN ('admin','sale') AND id != ? ORDER BY role, name"
      ).all(req.user.id).map((u) => ({ id: u.id, name: u.name, role: u.role }));
      res.json({ conversations: rows.map((c) => convShape(c, req.user.id)), staff });
    });
    router.post("/internal/direct", auth, staffOnly, (req, res) => {
      const target = db2.prepare("SELECT id, name, role FROM users WHERE id = ?").get(Number(req.body.user_id));
      if (!target || !STAFF.includes(target.role) || target.id === req.user.id) {
        return res.status(400).json({ error: "Ng\u01B0\u1EDDi nh\u1EADn kh\xF4ng h\u1EE3p l\u1EC7" });
      }
      const mine = db2.prepare(
        `SELECT c.* FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND c.title = '' AND cp.user_id = ?`
      ).all(req.user.id);
      for (const c of mine) {
        const ids = participants(c.id).map((p) => p.id).sort((a, b) => a - b);
        if (ids.length === 2 && ids[0] === Math.min(req.user.id, target.id) && ids[1] === Math.max(req.user.id, target.id)) {
          return res.json({ conversation: convShape(c, req.user.id) });
        }
      }
      const info = db2.prepare(
        "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', '', ?, 'active')"
      ).run(req.user.id);
      const conv = getConv(info.lastInsertRowid);
      db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(conv.id, req.user.id);
      db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(conv.id, target.id);
      res.json({ conversation: convShape(conv, req.user.id) });
    });
    router.post("/internal/group", auth, staffOnly, (req, res) => {
      const title = String(req.body.title || "").trim().slice(0, 80);
      if (!title) return res.status(400).json({ error: "H\xE3y \u0111\u1EB7t t\xEAn nh\xF3m" });
      const ids = [...new Set((req.body.member_ids || []).map(Number).filter((n) => Number.isFinite(n) && n !== req.user.id))];
      const valid = ids.filter((id) => {
        const u = db2.prepare("SELECT role FROM users WHERE id = ?").get(id);
        return u && STAFF.includes(u.role);
      });
      if (valid.length === 0) return res.status(400).json({ error: "H\xE3y ch\u1ECDn \xEDt nh\u1EA5t 1 th\xE0nh vi\xEAn" });
      const info = db2.prepare(
        "INSERT INTO conversations (type, title, created_by, status) VALUES ('internal', ?, ?, 'active')"
      ).run(title, req.user.id);
      const conv = getConv(info.lastInsertRowid);
      db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(conv.id, req.user.id);
      const ins = db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)");
      valid.forEach((id) => ins.run(conv.id, id));
      res.json({ conversation: convShape(conv, req.user.id) });
    });
    router.post("/:id/members", auth, staffOnly, (req, res) => {
      const c = getConv(Number(req.params.id));
      if (!c || c.type !== "internal") return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y cu\u1ED9c tr\xF2 chuy\u1EC7n" });
      if (myLastRead(c.id, req.user.id) === null) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng \u1EDF trong cu\u1ED9c tr\xF2 chuy\u1EC7n n\xE0y" });
      const target = db2.prepare("SELECT id, role FROM users WHERE id = ?").get(Number(req.body.user_id));
      if (!target || !STAFF.includes(target.role)) return res.status(400).json({ error: "Ng\u01B0\u1EDDi \u0111\u01B0\u1EE3c th\xEAm kh\xF4ng h\u1EE3p l\u1EC7" });
      if (myLastRead(c.id, target.id) !== null) return res.status(400).json({ error: "Ng\u01B0\u1EDDi n\xE0y \u0111\xE3 \u1EDF trong nh\xF3m" });
      db2.prepare("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)").run(c.id, target.id);
      res.json({ conversation: convShape(c, req.user.id) });
    });
    router.get("/staff-summary", auth, staffOnly, (req, res) => {
      const w = db2.prepare("SELECT COUNT(*) AS n FROM conversations WHERE type = 'customer' AND status = 'waiting'").get();
      const mine = db2.prepare(
        `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'internal' AND cp.user_id = ?`
      ).all(req.user.id);
      const internalUnread = mine.reduce((s, c) => s + unreadCount(c.id, req.user.id), 0);
      const myCust = db2.prepare(
        `SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE c.type = 'customer' AND cp.user_id = ? AND c.status = 'active'`
      ).all(req.user.id);
      const customerUnread = myCust.reduce((s, c) => s + unreadCount(c.id, req.user.id), 0);
      res.json({ waiting: w.n, internal_unread: internalUnread, customer_unread: customerUnread });
    });
    module2.exports = router;
  }
});

// routes/notifications.js
var require_notifications = __commonJS({
  "routes/notifications.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth } = require_auth();
    var router = express2.Router();
    router.get("/", auth, (req, res) => {
      const limit = req.query.all ? 200 : 30;
      const notifications = db2.prepare(
        "SELECT id, type, title, content, link, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?"
      ).all(req.user.id, limit);
      const unread = db2.prepare(
        "SELECT COUNT(*) AS c FROM user_notifications WHERE user_id = ? AND is_read = 0"
      ).get(req.user.id).c;
      res.json({ notifications, unread });
    });
    router.post("/read", auth, (req, res) => {
      db2.prepare("UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(req.user.id);
      res.json({ ok: true });
    });
    module2.exports = router;
  }
});

// routes/loyalty.js
var require_loyalty = __commonJS({
  "routes/loyalty.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, staffOnly } = require_auth();
    var { TIERS, TIER_MAP, computeTier, userStats, tierInfo, maskName, checkTierUpgrade, SETTLED_SQL } = require_tiers();
    var router = express2.Router();
    function currentPeriod(d = /* @__PURE__ */ new Date()) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    function validPeriod(p) {
      return /^\d{4}-\d{2}$/.test(p || "") ? p : currentPeriod();
    }
    function periodExpiry(period) {
      const [y, m] = period.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")} 23:59:59`;
    }
    function genCode(tierKey, period) {
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `BI99-${tierKey.toUpperCase()}-${period.replace("-", "")}-${rand}`;
    }
    function nowStr() {
      const d = /* @__PURE__ */ new Date();
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    function sweepExpired() {
      db2.prepare(
        "UPDATE discount_cards SET status = 'expired' WHERE status = 'unused' AND expires_at < ?"
      ).run(nowStr());
    }
    function cardConfigFor(userId) {
      const stats = userStats(userId);
      return TIER_MAP[computeTier(stats.order_count, stats.total_spent)];
    }
    function insertCard(userId, cfg, period, expires) {
      const ins = db2.prepare(
        "INSERT INTO discount_cards (user_id, code, percent, tier, period, status, expires_at) VALUES (?, ?, ?, ?, ?, 'unused', ?)"
      );
      let code = genCode(cfg.key, period);
      let tries = 0;
      while (db2.prepare("SELECT 1 FROM discount_cards WHERE code = ?").get(code) && ++tries < 10) {
        code = genCode(cfg.key, period);
      }
      ins.run(userId, code, cfg.percent, cfg.key, period, expires);
    }
    function issueForUser(userId, period) {
      const existing = db2.prepare(
        "SELECT COUNT(*) AS c FROM discount_cards WHERE user_id = ? AND period = ?"
      ).get(userId, period).c;
      if (existing > 0) return 0;
      const cfg = cardConfigFor(userId);
      const expires = periodExpiry(period);
      for (let i = 0; i < cfg.cards; i++) insertCard(userId, cfg, period, expires);
      return cfg.cards;
    }
    function topUpForUser(userId, period) {
      const existing = db2.prepare(
        "SELECT COUNT(*) AS c FROM discount_cards WHERE user_id = ? AND period = ?"
      ).get(userId, period).c;
      const cfg = cardConfigFor(userId);
      const missing = cfg.cards - existing;
      if (missing <= 0) return 0;
      const expires = periodExpiry(period);
      for (let i = 0; i < missing; i++) insertCard(userId, cfg, period, expires);
      return missing;
    }
    router.get("/me", auth, (req, res) => {
      sweepExpired();
      try {
        checkTierUpgrade(req.user.id);
      } catch (e) {
      }
      const period = currentPeriod();
      issueForUser(req.user.id, period);
      const info = tierInfo(req.user.id);
      const cards = db2.prepare(
        `SELECT id, code, percent, tier, period, status, issued_at, expires_at, used_order_id, source, hunt_event_id, hunt_type_id
     FROM discount_cards WHERE user_id = ? ORDER BY period DESC, id`
      ).all(req.user.id);
      res.json({ period, tier: info.tier, stats: info.stats, next: info.next, cards, tiers: TIERS });
    });
    router.get("/leaderboard", auth, (req, res) => {
      const rows = db2.prepare(`
    SELECT u.id, u.name, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_spent
    FROM users u
    JOIN orders o ON o.user_id = u.id AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
    WHERE u.role = 'customer'
    GROUP BY u.id
    ORDER BY total_spent DESC, order_count DESC
  `).all();
      const top = rows.slice(0, 10).map((r, i) => ({
        rank: i + 1,
        name: maskName(r.name),
        tier: computeTier(r.order_count, r.total_spent),
        total_spent: r.total_spent,
        is_me: r.id === req.user.id
      }));
      const myIdx = rows.findIndex((r) => r.id === req.user.id);
      let me;
      if (myIdx >= 0) {
        const r = rows[myIdx];
        me = { rank: myIdx + 1, total_spent: r.total_spent, order_count: r.order_count, tier: computeTier(r.order_count, r.total_spent) };
      } else {
        const s = userStats(req.user.id);
        me = { rank: null, total_spent: s.total_spent, order_count: s.order_count, tier: computeTier(s.order_count, s.total_spent) };
      }
      res.json({ top, me, total_customers: rows.length });
    });
    router.get("/admin/stats", auth, staffOnly, (req, res) => {
      sweepExpired();
      const period = validPeriod(req.query.period);
      const byStatus = db2.prepare(
        "SELECT status, COUNT(*) AS c FROM discount_cards WHERE period = ? GROUP BY status"
      ).all(period);
      const byTier = db2.prepare(
        "SELECT tier, COUNT(*) AS c FROM discount_cards WHERE period = ? GROUP BY tier"
      ).all(period);
      res.json({
        period,
        by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.c])),
        by_tier: byTier,
        tiers: TIERS
      });
    });
    function notifyNewCards(userId, count, period, isReset) {
      if (!count || count <= 0) return;
      const cfg = cardConfigFor(userId);
      const [y, m] = period.split("-");
      try {
        db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        ).run(
          userId,
          "tier_card",
          `\u{1F39F}\uFE0F B\u1EA1n nh\u1EADn \u0111\u01B0\u1EE3c ${count} th\u1EBB discount th\xE1ng ${m}/${y}`,
          `${isReset ? "Shop v\u1EEBa \u0111\u1EB7t l\u1EA1i th\u1EBB th\xE1ng n\xE0y. " : ""}B\u1EA1n c\xF3 ${count} th\u1EBB gi\u1EA3m ${cfg.percent}% cho 1 s\u1EA3n ph\u1EA9m (m\xF3n \u0111\u1EAFt nh\u1EA5t trong \u0111\u01A1n), h\u1EA1n d\xF9ng \u0111\u1EBFn cu\u1ED1i th\xE1ng ${m}/${y}. Xem th\u1EBB trong trang H\u1EA1ng c\u1EE7a t\xF4i.`,
          "/hang-cua-toi"
        );
      } catch (e) {
      }
    }
    router.post("/admin/issue", auth, staffOnly, (req, res) => {
      const period = validPeriod((req.body || {}).period);
      const customers = db2.prepare("SELECT id FROM users WHERE role = 'customer'").all();
      let issued = 0;
      let touched = 0;
      const perUser = db2.transaction(() => {
        const out = [];
        for (const c of customers) {
          const n = topUpForUser(c.id, period);
          if (n > 0) {
            issued += n;
            touched++;
            out.push([c.id, n]);
          }
        }
        return out;
      })();
      for (const [uid, n] of perUser) notifyNewCards(uid, n, period, false);
      res.json({ period, issued_cards: issued, customers: touched });
    });
    router.post("/admin/reset", auth, staffOnly, (req, res) => {
      const period = validPeriod((req.body || {}).period);
      const customers = db2.prepare("SELECT id FROM users WHERE role = 'customer'").all();
      let issued = 0;
      const perUser = [];
      const removed = db2.transaction(() => {
        const del = db2.prepare(
          "DELETE FROM discount_cards WHERE period = ? AND status IN ('unused','expired')"
        ).run(period);
        for (const c of customers) {
          const n = topUpForUser(c.id, period);
          if (n > 0) {
            issued += n;
            perUser.push([c.id, n]);
          }
        }
        return del.changes;
      })();
      for (const [uid, n] of perUser) notifyNewCards(uid, n, period, true);
      res.json({ period, removed_cards: removed, issued_cards: issued });
    });
    router.get("/admin/user-cards/:userId", auth, staffOnly, (req, res) => {
      sweepExpired();
      const cards = db2.prepare(
        "SELECT * FROM discount_cards WHERE user_id = ? ORDER BY period DESC, id"
      ).all(req.params.userId);
      res.json({ cards });
    });
    module2.exports = router;
  }
});

// routes/hunt-events.js
var require_hunt_events = __commonJS({
  "routes/hunt-events.js"(exports2, module2) {
    var express2 = require("express");
    var db2 = require_db();
    var { auth, adminOnly } = require_auth();
    var router = express2.Router();
    var MAX_PERCENT = 20;
    var MAX_DAYS = 7;
    function normTime(v) {
      const s = String(v || "").trim().replace("T", " ");
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return s + ":00";
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
      return null;
    }
    function nowLocal() {
      const d = /* @__PURE__ */ new Date();
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    function typeExpiry(event, type) {
      const start = new Date(String(event.starts_at).replace(" ", "T"));
      start.setDate(start.getDate() + type.valid_days);
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, "0");
      const d = String(start.getDate()).padStart(2, "0");
      return `${y}-${m}-${d} 23:59:59`;
    }
    function claimedCount(typeId) {
      return db2.prepare("SELECT COUNT(*) AS c FROM discount_cards WHERE hunt_type_id = ?").get(typeId).c;
    }
    function eventWithTypes(event, userId) {
      const types = db2.prepare("SELECT * FROM hunt_card_types WHERE event_id = ? ORDER BY percent DESC, id").all(event.id);
      const now = nowLocal();
      const phase = event.status !== "active" ? "closed" : now < event.starts_at ? "upcoming" : now > event.ends_at ? "ended" : "live";
      return {
        ...event,
        phase,
        types: types.map((tp) => {
          const claimed = claimedCount(tp.id);
          const mine = userId ? !!db2.prepare("SELECT 1 FROM discount_cards WHERE hunt_type_id = ? AND user_id = ?").get(tp.id, userId) : false;
          return { ...tp, claimed, remaining: Math.max(0, tp.quantity - claimed), claimed_by_me: mine };
        })
      };
    }
    var RARITY_TIERS = [
      { label: "C\u1EF1c hi\u1EBFm", weight: 8, pctMin: 18, pctMax: MAX_PERCENT, dayMin: 1, dayMax: 2, qtyMin: 1, qtyMax: 3 },
      { label: "Hi\u1EBFm", weight: 17, pctMin: 14, pctMax: 17, dayMin: 2, dayMax: 3, qtyMin: 2, qtyMax: 5 },
      { label: "May m\u1EAFn", weight: 30, pctMin: 10, pctMax: 13, dayMin: 3, dayMax: 5, qtyMin: 3, qtyMax: 7 },
      { label: "Th\u01B0\u1EDDng", weight: 45, pctMin: 5, pctMax: 9, dayMin: 5, dayMax: MAX_DAYS, qtyMin: 5, qtyMax: 10 }
    ];
    var randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    function pickTier() {
      const total = RARITY_TIERS.reduce((s, t) => s + t.weight, 0);
      let roll = Math.random() * total;
      for (const t of RARITY_TIERS) {
        roll -= t.weight;
        if (roll <= 0) return t;
      }
      return RARITY_TIERS[RARITY_TIERS.length - 1];
    }
    function randomTypes(count) {
      const n = Math.max(1, Math.min(20, parseInt(count) || 10));
      const types = [];
      for (let i = 0; i < n; i++) {
        const tier = pickTier();
        types.push({
          label: tier.label,
          percent: randInt(tier.pctMin, tier.pctMax),
          valid_days: randInt(tier.dayMin, tier.dayMax),
          quantity: randInt(tier.qtyMin, tier.qtyMax)
        });
      }
      return types.sort((a, b) => b.percent - a.percent);
    }
    router.get("/active", (req, res) => {
      let userId = null;
      const h = req.headers.authorization || "";
      if (h.startsWith("Bearer ")) {
        try {
          const jwt = require("jsonwebtoken");
          const { JWT_SECRET } = require_auth();
          userId = jwt.verify(h.slice(7), JWT_SECRET).id;
        } catch (e) {
        }
      }
      const rows = db2.prepare(
        "SELECT * FROM hunt_events WHERE status = 'active' AND ends_at >= ? ORDER BY starts_at"
      ).all(nowLocal());
      res.json({ events: rows.map((ev) => eventWithTypes(ev, userId)) });
    });
    router.post("/:id/claim", auth, (req, res) => {
      const typeId = parseInt((req.body || {}).type_id);
      if (!typeId) return res.status(400).json({ error: "Thi\u1EBFu lo\u1EA1i th\u1EBB" });
      const result = db2.transaction(() => {
        const event = db2.prepare("SELECT * FROM hunt_events WHERE id = ?").get(req.params.id);
        if (!event || event.status !== "active")
          throw new Error("S\u1EF1 ki\u1EC7n kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 \u0111\xF3ng");
        const now = nowLocal();
        if (now < event.starts_at) throw new Error("Ch\u01B0a t\u1EDBi gi\u1EDD m\u1EDF s\u0103n, b\u1EA1n quay l\u1EA1i sau nh\xE9");
        if (now > event.ends_at) throw new Error("S\u1EF1 ki\u1EC7n s\u0103n th\u1EBB \u0111\xE3 k\u1EBFt th\xFAc");
        const type = db2.prepare("SELECT * FROM hunt_card_types WHERE id = ? AND event_id = ?").get(typeId, event.id);
        if (!type) throw new Error("Lo\u1EA1i th\u1EBB kh\xF4ng thu\u1ED9c s\u1EF1 ki\u1EC7n n\xE0y");
        const mine = db2.prepare("SELECT 1 FROM discount_cards WHERE hunt_type_id = ? AND user_id = ?").get(type.id, req.user.id);
        if (mine) throw new Error("M\u1ED7i kh\xE1ch ch\u1EC9 l\u01B0u \u0111\u01B0\u1EE3c 1 th\u1EBB c\u1EE7a lo\u1EA1i n\xE0y");
        if (claimedCount(type.id) >= type.quantity)
          throw new Error("Lo\u1EA1i th\u1EBB n\xE0y \u0111\xE3 h\u1EBFt, b\u1EA1n ch\u1ECDn lo\u1EA1i kh\xE1c nh\xE9");
        const expires = typeExpiry(event, type);
        let code;
        let tries = 0;
        do {
          code = `BI99-HUNT-${event.id}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        } while (db2.prepare("SELECT 1 FROM discount_cards WHERE code = ?").get(code) && ++tries < 10);
        const info = db2.prepare(
          `INSERT INTO discount_cards (user_id, code, percent, tier, period, status, expires_at, source, hunt_event_id, hunt_type_id)
       VALUES (?, ?, ?, 'hunt', ?, 'unused', ?, 'hunt', ?, ?)`
        ).run(req.user.id, code, type.percent, String(event.starts_at).slice(0, 7), expires, event.id, type.id);
        return db2.prepare("SELECT * FROM discount_cards WHERE id = ?").get(info.lastInsertRowid);
      });
      let card;
      try {
        card = result();
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
      try {
        db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        ).run(
          req.user.id,
          "hunt_card",
          `\u{1F3AF} B\u1EA1n \u0111\xE3 s\u0103n \u0111\u01B0\u1EE3c th\u1EBB gi\u1EA3m ${card.percent}%!`,
          `Th\u1EBB ${card.code} gi\u1EA3m ${card.percent}% cho 1 s\u1EA3n ph\u1EA9m (m\xF3n \u0111\u1EAFt nh\u1EA5t trong \u0111\u01A1n), d\xF9ng \u0111\u01B0\u1EE3c \u0111\u1EBFn ${String(card.expires_at).slice(0, 10).split("-").reverse().join("/")}. Xem th\u1EBB trong trang H\u1EA1ng c\u1EE7a t\xF4i.`,
          "/hang-cua-toi"
        );
      } catch (e) {
      }
      res.status(201).json({ card });
    });
    router.get("/admin", auth, adminOnly, (req, res) => {
      const rows = db2.prepare("SELECT * FROM hunt_events ORDER BY id DESC").all();
      res.json({ events: rows.map((ev) => eventWithTypes(ev, null)) });
    });
    router.post("/admin/random-preview", auth, adminOnly, (req, res) => {
      const { count } = req.body || {};
      res.json({ types: randomTypes(count) });
    });
    router.post("/admin", auth, adminOnly, (req, res) => {
      const { name, mode } = req.body || {};
      const starts = normTime(req.body && req.body.starts_at);
      const ends = normTime(req.body && req.body.ends_at);
      if (!(name || "").trim()) return res.status(400).json({ error: "Nh\u1EADp t\xEAn s\u1EF1 ki\u1EC7n" });
      if (!starts || !ends) return res.status(400).json({ error: "Gi\u1EDD m\u1EDF s\u0103n / gi\u1EDD k\u1EBFt th\xFAc kh\xF4ng h\u1EE3p l\u1EC7" });
      if (ends <= starts) return res.status(400).json({ error: "Gi\u1EDD k\u1EBFt th\xFAc ph\u1EA3i sau gi\u1EDD m\u1EDF s\u0103n" });
      let types;
      if (mode === "random") {
        types = randomTypes(req.body.type_count);
      } else {
        types = Array.isArray(req.body.types) ? req.body.types : [];
        if (!types.length) return res.status(400).json({ error: "S\u1EF1 ki\u1EC7n ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 1 lo\u1EA1i th\u1EBB" });
        for (const tp of types) {
          const p = parseInt(tp.percent);
          const d = parseInt(tp.valid_days);
          const q = parseInt(tp.quantity);
          if (!p || p < 1 || p > MAX_PERCENT)
            return res.status(400).json({ error: `% gi\u1EA3m c\u1EE7a m\u1ED7i lo\u1EA1i ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn ${MAX_PERCENT}%` });
          if (!d || d < 1 || d > MAX_DAYS)
            return res.status(400).json({ error: `H\u1EA1n d\xF9ng c\u1EE7a m\u1ED7i lo\u1EA1i ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn ${MAX_DAYS} ng\xE0y` });
          if (!q || q < 1)
            return res.status(400).json({ error: "S\u1ED1 l\u01B0\u1EE3ng m\u1ED7i lo\u1EA1i ph\u1EA3i t\u1EEB 1 tr\u1EDF l\xEAn" });
        }
        types = types.map((tp) => ({
          label: String(tp.label || "Th\u1EBB s\u0103n sale").slice(0, 40),
          percent: parseInt(tp.percent),
          valid_days: parseInt(tp.valid_days),
          quantity: parseInt(tp.quantity)
        }));
      }
      const id = db2.transaction(() => {
        const info = db2.prepare(
          "INSERT INTO hunt_events (name, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?)"
        ).run(name.trim(), starts, ends, req.user.id);
        const eventId = info.lastInsertRowid;
        const ins = db2.prepare(
          "INSERT INTO hunt_card_types (event_id, label, percent, valid_days, quantity) VALUES (?, ?, ?, ?, ?)"
        );
        for (const tp of types) ins.run(eventId, tp.label, tp.percent, tp.valid_days, tp.quantity);
        return eventId;
      })();
      const event = db2.prepare("SELECT * FROM hunt_events WHERE id = ?").get(id);
      try {
        const fmtT = (s) => `${String(s).slice(11, 16)} ng\xE0y ${String(s).slice(0, 10).split("-").reverse().join("/")}`;
        const maxPercent = Math.max(...types.map((x) => x.percent));
        const totalCards = types.reduce((n, x) => n + x.quantity, 0);
        const title = `\u{1F3AF} S\u1EF1 ki\u1EC7n s\u0103n th\u1EBB: ${event.name}`;
        const content = `S\u1EF1 ki\u1EC7n "${event.name}" s\u1EBD m\u1EDF s\u0103n l\xFAc ${fmtT(event.starts_at)} \u2014 t\u1ED5ng ${totalCards} th\u1EBB, gi\u1EA3m t\u1EDBi ${maxPercent}% cho 1 s\u1EA3n ph\u1EA9m. V\xE0o trang Khuy\u1EBFn m\xE3i \u0111\u1EC3 \u0111\u1EBFm ng\u01B0\u1EE3c v\xE0 s\u0103n th\u1EBB ngay khi m\u1EDF!`;
        const customers = db2.prepare("SELECT id FROM users WHERE role = 'customer'").all();
        const insNotif = db2.prepare(
          "INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)"
        );
        db2.transaction(() => {
          for (const c of customers) insNotif.run(c.id, "hunt_event", title, content, "/khuyen-mai");
        })();
        const { postChatNotice } = require_chatCard();
        for (const c of customers) {
          const conv = db2.prepare(
            "SELECT id FROM conversations WHERE type = 'customer' AND customer_id = ? AND status IN ('waiting','active')"
          ).get(c.id);
          if (conv) {
            try {
              postChatNotice(c.id, req.user.id, `\u{1F3AF} ${content}`);
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
      res.status(201).json({ event: eventWithTypes(event, null) });
    });
    router.put("/admin/:id", auth, adminOnly, (req, res) => {
      const { status } = req.body || {};
      if (!["active", "closed"].includes(status))
        return res.status(400).json({ error: "status ph\u1EA3i l\xE0 active / closed" });
      const event = db2.prepare("SELECT * FROM hunt_events WHERE id = ?").get(req.params.id);
      if (!event) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
      db2.prepare("UPDATE hunt_events SET status = ? WHERE id = ?").run(status, event.id);
      res.json({ event: eventWithTypes({ ...event, status }, null) });
    });
    router.delete("/admin/:id", auth, adminOnly, (req, res) => {
      const event = db2.prepare("SELECT * FROM hunt_events WHERE id = ?").get(req.params.id);
      if (!event) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y s\u1EF1 ki\u1EC7n" });
      const claimed = db2.prepare("SELECT COUNT(*) AS c FROM discount_cards WHERE hunt_event_id = ?").get(event.id).c;
      if (claimed > 0)
        return res.status(400).json({ error: "\u0110\xE3 c\xF3 kh\xE1ch l\u01B0u th\u1EBB c\u1EE7a s\u1EF1 ki\u1EC7n n\xE0y \u2014 ch\u1EC9 c\xF3 th\u1EC3 \u0110\xF3ng, kh\xF4ng x\xF3a \u0111\u01B0\u1EE3c" });
      db2.transaction(() => {
        db2.prepare("DELETE FROM hunt_card_types WHERE event_id = ?").run(event.id);
        db2.prepare("DELETE FROM hunt_events WHERE id = ?").run(event.id);
      })();
      res.json({ ok: true });
    });
    module2.exports = router;
  }
});

// server.js
require("dotenv").config();
var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
try {
  const dbTarget = process.env.DB_PATH;
  const dbBundled = path.join(__dirname, "leather_shop.db");
  if (dbTarget && !fs.existsSync(dbTarget) && fs.existsSync(dbBundled) && path.resolve(dbTarget) !== path.resolve(dbBundled)) {
    fs.copyFileSync(dbBundled, dbTarget);
  }
} catch (e) {
  console.error("Kh\xF4ng ch\xE9p \u0111\u01B0\u1EE3c DB \u0111\xF3ng g\xF3i:", e.message);
}
var db = require_db();
try {
  if (db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0) require_seed();
} catch (e) {
  console.error("Auto-seed th\u1EA5t b\u1EA1i:", e.message);
}
var app = express();
var PORT = process.env.PORT || 5e3;
var corsOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(express.json({ limit: "8mb" }));
app.use("/api/auth", require_auth2());
app.use("/api/categories", require_categories());
app.use("/api/products", require_products());
app.use("/api/orders", require_orders());
app.use("/api/users", require_users());
app.use("/api/posts", require_posts());
app.use("/api/contact", require_contact());
app.use("/api/returns", require_returns());
app.use("/api/warranties", require_warranties());
app.use("/api/repairs", require_repairs());
app.use("/api/inventory", require_inventory());
app.use("/api/payments", require_payments());
app.use("/api/shipping", require_shipping());
app.use("/api/vouchers", require_vouchers());
app.use("/api/promo-events", require_promo_events());
app.use("/api/reviews", require_reviews());
app.use("/api/reports", require_reports());
app.use("/api/announcements", require_announcements());
app.use("/api/chat", require_chat());
app.use("/api/notifications", require_notifications());
app.use("/api/loyalty", require_loyalty());
app.use("/api/hunt-events", require_hunt_events());
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
var distDir = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y API" });
    res.sendFile(path.join(distDir, "index.html"));
  });
}
app.listen(PORT, () => {
  console.log(`Server \u0111ang ch\u1EA1y t\u1EA1i http://localhost:${PORT}`);
});
