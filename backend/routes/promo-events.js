// CRUD sự kiện khuyến mãi (admin) + bật/tắt + lấy sự kiện đang chạy (public cho landing page)
// Convention: better-sqlite3 đồng bộ, middleware { auth, staffOnly } như routes/vouchers.js
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

function normSlug(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}
function parseISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function parseCodes(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(',');
  return [...new Set(arr.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
}

// Validate payload tạo/sửa, trả về { ok, error, clean }
async function validatePayload(body, isCreate, selfId) {
  const clean = {};
  const cur = !isCreate && selfId
    ? await db.prepare('SELECT start_at, end_at FROM promo_events WHERE id = ?').get(selfId)
    : null;
  if (isCreate || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) return { ok: false, error: 'Tên sự kiện là bắt buộc' };
    clean.name = name;
  }
  if (isCreate || body.slug !== undefined) {
    const slug = normSlug(body.slug || body.name);
    if (!slug) return { ok: false, error: 'Slug không hợp lệ' };
    const dup = await db.prepare('SELECT id FROM promo_events WHERE slug = ?').get(slug);
    if (dup && dup.id !== selfId) return { ok: false, error: 'Slug đã tồn tại' };
    clean.slug = slug;
  }
  for (const k of ['title', 'subtitle']) {
    if (body[k] !== undefined) clean[k] = String(body[k] || '').trim();
  }
  for (const k of ['start_at', 'end_at']) {
    if (body[k] !== undefined) {
      if (!body[k]) { clean[k] = null; continue; }
      const iso = parseISO(body[k]);
      if (!iso) return { ok: false, error: `Thời gian ${k} không hợp lệ` };
      clean[k] = iso;
    }
  }
  const start = clean.start_at !== undefined ? clean.start_at : (cur ? cur.start_at : undefined);
  const end = clean.end_at !== undefined ? clean.end_at : (cur ? cur.end_at : undefined);
  if (start && end && new Date(end) <= new Date(start))
    return { ok: false, error: 'Thời gian kết thúc phải sau thời gian bắt đầu' };
  if (body.voucher_codes !== undefined) {
    const codes = parseCodes(body.voucher_codes);
    for (const c of codes) {
      const v = await db.prepare('SELECT id FROM vouchers WHERE code = ?').get(c);
      if (!v) return { ok: false, error: `Mã voucher "${c}" không tồn tại` };
    }
    clean.voucher_codes = JSON.stringify(codes);
  }
  if (body.is_active !== undefined) clean.is_active = body.is_active ? 1 : 0;
  return { ok: true, clean };
}

function withCodes(row) {
  if (!row) return row;
  let codes = [];
  try { codes = JSON.parse(row.voucher_codes || '[]'); } catch (e) { codes = []; }
  return { ...row, voucher_codes: codes };
}

// GET /api/promo-events — admin: danh sách (mới nhất trước)
router.get('/', auth, staffOnly, async (req, res) => {
  try {
  const rows = await db.prepare('SELECT * FROM promo_events ORDER BY id DESC').all();
  res.json({ events: rows.map(withCodes) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/promo-events/active — public: sự kiện đang diễn ra, hoặc sự kiện
// sắp tới gần nhất (để landing page đếm ngược). Kèm voucher đang bật và
// sản phẩm sale của sự kiện.
router.get('/active', async (req, res) => {
  try {
  const now = new Date().toISOString();
  let row = await db
    .prepare(
      `SELECT * FROM promo_events WHERE is_active = 1
       AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
       ORDER BY id DESC LIMIT 1`
    )
    .get(now, now);
  let status = 'live';
  if (!row) {
    row = await db
      .prepare(
        `SELECT * FROM promo_events WHERE is_active = 1
         AND start_at IS NOT NULL AND start_at > ?
         ORDER BY start_at ASC LIMIT 1`
      )
      .get(now);
    status = 'upcoming';
  }
  if (!row) return res.json({ event: null, status: null, vouchers: [], products: [] });
  const event = withCodes(row);
  const vouchers = event.voucher_codes.length
    ? await db
        .prepare(
          `SELECT code, type, value, min_order, usage_limit, used_count FROM vouchers
           WHERE is_active = 1 AND code IN (${event.voucher_codes.map(() => '?').join(',')})`
        )
        .all(...event.voucher_codes)
    : [];
  const products = (await db
    .prepare(
      `SELECT ep.product_id AS id, ep.sale_price, p.name, p.price, p.image_url, p.stock
       FROM promo_event_products ep JOIN products p ON p.id = ep.product_id
       WHERE ep.event_id = ? ORDER BY ep.id`
    )
    .all(event.id))
    .map((r) => ({
      ...r,
      discount_percent: r.price > 0 ? Math.round((1 - r.sale_price / r.price) * 100) : 0,
    }));
  res.json({ event, status, vouchers, products });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/promo-events — admin: tạo mới (mặc định tắt)
router.post('/', auth, staffOnly, async (req, res) => {
  try {
  const { ok, error, clean } = await validatePayload(req.body || {}, true, null);
  if (!ok) return res.status(400).json({ error });
  const info = await db
    .prepare(
      `INSERT INTO promo_events (name, slug, title, subtitle, start_at, end_at, voucher_codes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      clean.name, clean.slug, clean.title || '', clean.subtitle || '',
      clean.start_at || null, clean.end_at || null,
      clean.voucher_codes || '[]', clean.is_active || 0
    );
  const row = await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ event: withCodes(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/promo-events/:id — admin: sửa
router.put('/:id', auth, staffOnly, async (req, res) => {
  try {
  const cur = await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const { ok, error, clean } = await validatePayload(req.body || {}, false, cur.id);
  if (!ok) return res.status(400).json({ error });
  const keys = ['name', 'slug', 'title', 'subtitle', 'start_at', 'end_at', 'voucher_codes', 'is_active'];
  const sets = [], params = [];
  for (const k of keys) {
    if (clean[k] !== undefined) { sets.push(`${k} = ?`); params.push(clean[k]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
  sets.push(`updated_at = datetime('now')`);
  params.push(cur.id);
  await db.prepare(`UPDATE promo_events SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ event: withCodes(await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(cur.id)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/promo-events/:id/toggle — admin: bật/tắt; đồng bộ voucher liên kết
router.put('/:id/toggle', auth, staffOnly, async (req, res) => {
  try {
  const cur = await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const next = cur.is_active ? 0 : 1;
  const codes = parseCodes(cur.voucher_codes ? JSON.parse(cur.voucher_codes || '[]') : []);
  const txn = db.transaction(async () => {
    await db.prepare(`UPDATE promo_events SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(next, cur.id);
    for (const c of codes) {
      await db.prepare('UPDATE vouchers SET is_active = ? WHERE code = ?').run(next, c);
    }
  });
  await txn();
  const row = withCodes(await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(cur.id));
  res.json({ event: row, vouchers_synced: codes });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/promo-events/:id — admin: xóa (kèm sản phẩm trong sự kiện;
// nếu sự kiện đang bật thì tắt voucher liên kết để không còn mã mồ côi)
router.delete('/:id', auth, staffOnly, async (req, res) => {
  try {
  const cur = await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const codes = parseCodes(cur.voucher_codes ? JSON.parse(cur.voucher_codes || '[]') : []);
  const txn = db.transaction(async () => {
    if (cur.is_active) {
      for (const c of codes) {
        await db.prepare('UPDATE vouchers SET is_active = 0 WHERE code = ?').run(c);
      }
    }
    await db.prepare('DELETE FROM promo_events WHERE id = ?').run(cur.id);
  });
  await txn();
  res.json({ message: 'Đã xóa sự kiện', vouchers_deactivated: cur.is_active ? codes : [] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// ============ Sản phẩm trong sự kiện (admin) ============

async function getEventOr404(id, res) {
  const ev = await db.prepare('SELECT * FROM promo_events WHERE id = ?').get(id);
  if (!ev) { res.status(404).json({ error: 'Không tìm thấy sự kiện' }); return null; }
  return ev;
}

// GET /api/promo-events/:id/products — admin: danh sách SP trong sự kiện
router.get('/:id/products', auth, staffOnly, async (req, res) => {
  try {
  if (!(await getEventOr404(req.params.id, res))) return;
  const rows = (await db
    .prepare(
      `SELECT ep.product_id, ep.sale_price, p.name, p.price, p.image_url, p.stock
       FROM promo_event_products ep JOIN products p ON p.id = ep.product_id
       WHERE ep.event_id = ? ORDER BY ep.id`
    )
    .all(req.params.id))
    .map((r) => ({
      ...r,
      discount_percent: r.price > 0 ? Math.round((1 - r.sale_price / r.price) * 100) : 0,
    }));
  res.json({ products: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/promo-events/:id/products — admin: thêm SP vào sự kiện
router.post('/:id/products', auth, staffOnly, async (req, res) => {
  try {
  if (!(await getEventOr404(req.params.id, res))) return;
  const product_id = parseInt(req.body.product_id) || 0;
  const sale_price = parseInt(req.body.sale_price) || 0;
  const p = await db.prepare('SELECT id, name, price FROM products WHERE id = ?').get(product_id);
  if (!p) return res.status(400).json({ error: 'Sản phẩm không tồn tại' });
  if (sale_price <= 0) return res.status(400).json({ error: 'Giá sale phải lớn hơn 0' });
  if (sale_price >= p.price)
    return res.status(400).json({ error: `Giá sale phải thấp hơn giá gốc (${p.price.toLocaleString('vi-VN')}₫)` });
  const dup = await db
    .prepare('SELECT id FROM promo_event_products WHERE event_id = ? AND product_id = ?')
    .get(req.params.id, product_id);
  if (dup) return res.status(400).json({ error: 'Sản phẩm đã có trong sự kiện' });
  await db.prepare(
    'INSERT INTO promo_event_products (event_id, product_id, sale_price) VALUES (?, ?, ?)'
  ).run(req.params.id, product_id, sale_price);
  res.status(201).json({ message: 'Đã thêm sản phẩm vào sự kiện' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/promo-events/:id/products/:product_id — admin: đổi giá sale
router.put('/:id/products/:product_id', auth, staffOnly, async (req, res) => {
  try {
  if (!(await getEventOr404(req.params.id, res))) return;
  const link = await db
    .prepare('SELECT ep.id, p.price FROM promo_event_products ep JOIN products p ON p.id = ep.product_id WHERE ep.event_id = ? AND ep.product_id = ?')
    .get(req.params.id, req.params.product_id);
  if (!link) return res.status(404).json({ error: 'Sản phẩm không có trong sự kiện' });
  const sale_price = parseInt(req.body.sale_price) || 0;
  if (sale_price <= 0) return res.status(400).json({ error: 'Giá sale phải lớn hơn 0' });
  if (sale_price >= link.price)
    return res.status(400).json({ error: `Giá sale phải thấp hơn giá gốc (${link.price.toLocaleString('vi-VN')}₫)` });
  await db.prepare('UPDATE promo_event_products SET sale_price = ? WHERE id = ?').run(sale_price, link.id);
  res.json({ message: 'Đã cập nhật giá sale' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/promo-events/:id/products/:product_id — admin: gỡ SP khỏi sự kiện
router.delete('/:id/products/:product_id', auth, staffOnly, async (req, res) => {
  try {
  if (!(await getEventOr404(req.params.id, res))) return;
  const r = await db
    .prepare('DELETE FROM promo_event_products WHERE event_id = ? AND product_id = ?')
    .run(req.params.id, req.params.product_id);
  if (!r.changes) return res.status(404).json({ error: 'Sản phẩm không có trong sự kiện' });
  res.json({ message: 'Đã gỡ sản phẩm khỏi sự kiện' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
