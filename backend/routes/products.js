// CRUD sản phẩm, hỗ trợ lọc / tìm kiếm / sắp xếp / phân trang
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

const SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

// GET /api/products?category=&search=&sort=&page=&limit= — công khai
router.get('/', (req, res) => {
  const { category, search, sort } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  const offset = (page - 1) * limit;

  const conds = [];
  const params = [];
  if (category) { conds.push('p.category_id = ?'); params.push(category); }
  if (search) { conds.push('(p.name LIKE ? OR p.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const sorts = {
    'price-asc': 'p.price ASC',
    'price-desc': 'p.price DESC',
    'newest': 'p.created_at DESC',
    'name': 'p.name ASC',
  };
  const orderBy = 'ORDER BY ' + (sorts[sort] || 'p.id DESC');

  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p ${where}`).get(...params).n;
  const products = db.prepare(`${SELECT} ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ products, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /api/products/:id — công khai (kèm biến thể đang bán + thư viện ảnh)
router.get('/:id', (req, res) => {
  const p = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  p.variants = getActiveVariants(p.id); // biến thể đang hoạt động
  p.images = getProductImages(p.id);    // ảnh sắp xếp theo sort_order
  res.json({ product: p });
});

// POST /api/products — admin
router.post('/', auth, adminOnly, (req, res) => {
  const { category_id, name, description, price, stock, image_url } = req.body || {};
  if (!name || price === undefined)
    return res.status(400).json({ error: 'Tên và giá sản phẩm là bắt buộc' });
  const info = db.prepare(
    `INSERT INTO products (category_id, name, description, price, stock, image_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    category_id || null, name.trim(), (description || '').trim(),
    parseInt(price) || 0, parseInt(stock) || 0, (image_url || '').trim()
  );
  res.status(201).json({ product: db.prepare(`${SELECT} WHERE p.id = ?`).get(info.lastInsertRowid) });
});

// PUT /api/products/:id — admin
router.put('/:id', auth, adminOnly, (req, res) => {
  const { category_id, name, description, price, stock, image_url } = req.body || {};
  const info = db.prepare(
    `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, image_url = ?
     WHERE id = ?`
  ).run(
    category_id || null, (name || '').trim(), (description || '').trim(),
    parseInt(price) || 0, parseInt(stock) || 0, (image_url || '').trim(), req.params.id
  );
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json({ product: db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id) });
});

// DELETE /api/products/:id — admin
router.delete('/:id', auth, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json({ message: 'Đã xóa sản phẩm' });
});

// ============================================================
// BIẾN THỂ (VARIANT) & THƯ VIỆN ẢNH — W1 (feat/audit-fixes)
// CONTRACT TỒN KHO: sản phẩm có variant active → cộng/trừ kho trên
// product_variants.stock, KHÔNG đụng products.stock. Mọi biến động
// kho đều phải gọi db.logStockMovement(...).
// ============================================================

// Lấy các variant đang hoạt động của 1 sản phẩm (dùng cho list & detail)
function getActiveVariants(productId) {
  return db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id ASC')
    .all(productId);
}

// Lấy ảnh của 1 sản phẩm, sắp xếp theo sort_order
function getProductImages(productId) {
  return db
    .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC')
    .all(productId);
}

// GET /api/products/:id/variants — công khai: danh sách variant đang bán
router.get('/:id/variants', (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json({ variants: getActiveVariants(req.params.id) });
});

// POST /api/products/:id/variants — admin: tạo biến thể mới
// body: { sku (bắt buộc, duy nhất), color, size, price_delta, stock }
router.post('/:id/variants', auth, adminOnly, (req, res) => {
  const { sku, color, size, price_delta, stock } = req.body || {};
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) return res.status(400).json({ error: 'SKU là bắt buộc và phải duy nhất' });
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  // Kiểm tra trùng SKU trước để trả 409 thân thiện (DB còn UNIQUE constraint chống race)
  const dup = db.prepare('SELECT id FROM product_variants WHERE sku = ?').get(cleanSku);
  if (dup) return res.status(409).json({ error: `SKU "${cleanSku}" đã tồn tại` });

  const initStock = Math.max(0, parseInt(stock) || 0);
  try {
    const variant = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO product_variants (product_id, sku, color, size, price_delta, stock)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        req.params.id, cleanSku,
        String(color || '').trim(), String(size || '').trim(),
        parseInt(price_delta) || 0, initStock
      );
      // Ghi nhật ký kho cho số lượng tồn ban đầu (nếu có)
      if (initStock > 0) {
        db.logStockMovement({
          variant_id: info.lastInsertRowid,
          type: 'IN', qty: initStock,
          ref_type: 'variant_create', ref_id: info.lastInsertRowid,
          note: `Tạo biến thể ${cleanSku}`,
        });
      }
      return db.prepare('SELECT * FROM product_variants WHERE id = ?').get(info.lastInsertRowid);
    })();
    res.status(201).json({ variant });
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(409).json({ error: `SKU "${cleanSku}" đã tồn tại` });
    throw e;
  }
});

// PUT /api/products/variants/:variantId — admin: sửa màu/size/chênh giá/trạng thái
// LƯU Ý: KHÔNG cho sửa stock trực tiếp tại đây — tồn kho phải đi qua
// phiếu nhập hàng / phiếu điều chỉnh để nhật ký kho luôn đầy đủ.
router.put('/variants/:variantId', auth, adminOnly, (req, res) => {
  if (req.body && req.body.stock !== undefined)
    return res.status(400).json({
      error: 'Không được sửa tồn kho trực tiếp tại đây. Hãy dùng phiếu nhập hàng hoặc phiếu điều chỉnh kho.',
    });
  const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.variantId);
  if (!v) return res.status(404).json({ error: 'Không tìm thấy biến thể' });
  const { color, size, price_delta, is_active } = req.body || {};
  db.prepare(
    `UPDATE product_variants SET color = ?, size = ?, price_delta = ?, is_active = ? WHERE id = ?`
  ).run(
    color !== undefined ? String(color).trim() : v.color,
    size !== undefined ? String(size).trim() : v.size,
    price_delta !== undefined ? parseInt(price_delta) || 0 : v.price_delta,
    is_active !== undefined ? (is_active ? 1 : 0) : v.is_active,
    req.params.variantId
  );
  res.json({ variant: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.variantId) });
});

// DELETE /api/products/variants/:variantId — admin: ẩn biến thể (soft delete)
// Không xóa cứng vì order_items có thể đang tham chiếu tới variant này.
router.delete('/variants/:variantId', auth, adminOnly, (req, res) => {
  const v = db.prepare('SELECT id FROM product_variants WHERE id = ?').get(req.params.variantId);
  if (!v) return res.status(404).json({ error: 'Không tìm thấy biến thể' });
  db.prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?').run(req.params.variantId);
  res.json({ message: 'Đã ẩn biến thể' });
});

// GET /api/products/:id/images — công khai: thư viện ảnh sản phẩm
router.get('/:id/images', (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json({ images: getProductImages(req.params.id) });
});

// POST /api/products/:id/images — admin: thêm ảnh
// body: { image_url (bắt buộc), variant_id (tùy chọn, phải thuộc SP này), sort_order }
router.post('/:id/images', auth, adminOnly, (req, res) => {
  const { image_url, variant_id, sort_order } = req.body || {};
  const url = String(image_url || '').trim();
  if (!url) return res.status(400).json({ error: 'image_url là bắt buộc' });
  const p = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  let vid = null;
  if (variant_id !== undefined && variant_id !== null && variant_id !== '') {
    const v = db.prepare('SELECT id FROM product_variants WHERE id = ? AND product_id = ?')
      .get(variant_id, req.params.id);
    if (!v) return res.status(400).json({ error: 'variant_id không thuộc sản phẩm này' });
    vid = v.id;
  }
  const info = db.prepare(
    `INSERT INTO product_images (product_id, variant_id, image_url, sort_order)
     VALUES (?, ?, ?, ?)`
  ).run(req.params.id, vid, url, parseInt(sort_order) || 0);
  res.status(201).json({ image: db.prepare('SELECT * FROM product_images WHERE id = ?').get(info.lastInsertRowid) });
});

// DELETE /api/products/images/:imageId — admin: xóa ảnh khỏi thư viện
router.delete('/images/:imageId', auth, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM product_images WHERE id = ?').run(req.params.imageId);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy ảnh' });
  res.json({ message: 'Đã xóa ảnh' });
});

module.exports = router;
