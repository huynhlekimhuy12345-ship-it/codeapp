// Tồn kho & Nhà cung cấp: CRUD nhà cung cấp, phiếu nhập hàng, nhật ký xuất-nhập, điều chỉnh kho
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Tất cả endpoint trong router này đều cần đăng nhập + quyền admin
router.use(auth, adminOnly);

const PO_STATUSES = ['draft', 'confirmed', 'received', 'cancelled'];
const PO_STATUS_LABEL = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  received: 'Đã nhập kho',
  cancelled: 'Đã hủy',
};

// =====================================================
// NHÀ CUNG CẤP
// =====================================================

// GET /api/inventory/suppliers — danh sách nhà cung cấp
router.get('/suppliers', (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
  res.json({ suppliers });
});

// POST /api/inventory/suppliers — thêm nhà cung cấp
router.post('/suppliers', (req, res) => {
  const { name, phone, address, note } = req.body || {};
  if (!name || !name.trim())
    return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
  const info = db.prepare(
    `INSERT INTO suppliers (name, phone, address, note) VALUES (?, ?, ?, ?)`
  ).run(name.trim(), (phone || '').trim(), (address || '').trim(), (note || '').trim());
  res.status(201).json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid) });
});

// PUT /api/inventory/suppliers/:id — sửa nhà cung cấp
router.put('/suppliers/:id', (req, res) => {
  const { name, phone, address, note } = req.body || {};
  if (!name || !name.trim())
    return res.status(400).json({ error: 'Tên nhà cung cấp là bắt buộc' });
  const info = db.prepare(
    `UPDATE suppliers SET name = ?, phone = ?, address = ?, note = ? WHERE id = ?`
  ).run(name.trim(), (phone || '').trim(), (address || '').trim(), (note || '').trim(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' });
  res.json({ supplier: db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id) });
});

// DELETE /api/inventory/suppliers/:id — xóa (không xóa nếu còn phiếu nhập → 409)
router.delete('/suppliers/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM purchase_orders WHERE supplier_id = ?').get(req.params.id).n;
  if (used > 0)
    return res.status(409).json({ error: `Không thể xóa: nhà cung cấp đang có ${used} phiếu nhập hàng` });
  const info = db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' });
  res.json({ message: 'Đã xóa nhà cung cấp' });
});

// =====================================================
// PHIẾU NHẬP HÀNG (purchase orders)
// =====================================================

// Kiểm tra 1 dòng hàng: đúng 1 trong 2 id, qty > 0, id trỏ tới bản ghi tồn tại
// Trả về { ok, error, variant, product }
function validateItem(item) {
  const hasVariant = item.variant_id !== undefined && item.variant_id !== null && item.variant_id !== '';
  const hasProduct = item.product_id !== undefined && item.product_id !== null && item.product_id !== '';
  if ((hasVariant && hasProduct) || (!hasVariant && !hasProduct))
    return { ok: false, error: 'Mỗi dòng hàng phải có đúng 1 trong 2: variant_id hoặc product_id' };
  const qty = parseInt(item.quantity);
  if (!Number.isInteger(qty) || qty <= 0)
    return { ok: false, error: 'Số lượng phải là số nguyên dương' };
  const unitPrice = parseInt(item.unit_price);
  if (isNaN(unitPrice) || unitPrice < 0)
    return { ok: false, error: 'Giá nhập phải là số không âm' };
  if (hasVariant) {
    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.variant_id);
    if (!variant) return { ok: false, error: `Không tìm thấy biến thể #${item.variant_id}` };
    return { ok: true, variant, qty, unitPrice };
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
  if (!product) return { ok: false, error: `Không tìm thấy sản phẩm #${item.product_id}` };
  // Contract: products.stock chỉ cho SP không variant → không nhập trực tiếp vào SP có variant active
  const hasActiveVariants = db.prepare(
    "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
  ).get(product.id).n > 0;
  if (hasActiveVariants)
    return { ok: false, error: `Sản phẩm "${product.name}" có biến thể — hãy nhập theo từng biến thể` };
  return { ok: true, product, qty, unitPrice };
}

// GET /api/inventory/purchase-orders — danh sách phiếu kèm tên NCC và tổng tiền
router.get('/purchase-orders', (req, res) => {
  const orders = db.prepare(
    `SELECT po.*, s.name AS supplier_name,
            COALESCE((SELECT SUM(pi.quantity * pi.unit_price) FROM purchase_items pi WHERE pi.po_id = po.id), 0) AS total
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     ORDER BY po.id DESC`
  ).all();
  res.json({ purchase_orders: orders.map((o) => ({ ...o, status_label: PO_STATUS_LABEL[o.status] || o.status })) });
});

// GET /api/inventory/purchase-orders/:id — chi tiết 1 phiếu kèm dòng hàng
router.get('/purchase-orders/:id', (req, res) => {
  const po = db.prepare(
    `SELECT po.*, s.name AS supplier_name
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.id = ?`
  ).get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const items = db.prepare(
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

// POST /api/inventory/purchase-orders — tạo phiếu nhập (trạng thái draft)
router.post('/purchase-orders', (req, res) => {
  const { supplier_id, note, items } = req.body || {};
  if (!supplier_id)
    return res.status(400).json({ error: 'supplier_id là bắt buộc' });
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Phiếu nhập phải có ít nhất 1 dòng hàng' });

  const validated = [];
  for (let i = 0; i < items.length; i++) {
    const v = validateItem(items[i] || {});
    if (!v.ok) return res.status(400).json({ error: `Dòng ${i + 1}: ${v.error}` });
    validated.push(v);
  }

  const tx = db.transaction(() => {
    const poInfo = db.prepare(
      `INSERT INTO purchase_orders (supplier_id, status, total, note) VALUES (?, 'draft', 0, ?)`
    ).run(supplier_id, (note || '').trim());
    const poId = poInfo.lastInsertRowid;
    let total = 0;
    const insItem = db.prepare(
      `INSERT INTO purchase_items (po_id, variant_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const v of validated) {
      insItem.run(
        poId,
        v.variant ? v.variant.id : null,
        v.variant ? null : v.product.id,
        v.qty,
        v.unitPrice
      );
      total += v.qty * v.unitPrice;
    }
    db.prepare('UPDATE purchase_orders SET total = ? WHERE id = ?').run(total, poId);
    return poId;
  });

  const poId = tx();
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
  res.status(201).json({ purchase_order: { ...po, status_label: PO_STATUS_LABEL[po.status] } });
});

// PUT /api/inventory/purchase-orders/:id/receive — NHẬP KHO: cộng tồn kho + ghi nhật ký
router.put('/purchase-orders/:id/receive', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  if (po.status === 'received')
    return res.status(409).json({ error: 'Phiếu nhập đã được nhập kho trước đó' });
  if (po.status === 'cancelled')
    return res.status(409).json({ error: 'Phiếu nhập đã bị hủy, không thể nhập kho' });

  const items = db.prepare('SELECT * FROM purchase_items WHERE po_id = ? ORDER BY id').all(po.id);
  if (items.length === 0)
    return res.status(400).json({ error: 'Phiếu nhập không có dòng hàng nào' });

  const tx = db.transaction(() => {
    let total = 0;
    const addVariant = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?');
    const addProduct = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const it of items) {
      if (it.variant_id) {
        const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(it.variant_id);
        if (!v) throw new Error(`Không tìm thấy biến thể #${it.variant_id}`);
        addVariant.run(it.quantity, it.variant_id);
        db.logStockMovement({
          product_id: v.product_id, variant_id: it.variant_id,
          type: 'IN', qty: it.quantity,
          ref_type: 'purchase', ref_id: po.id,
          note: `Nhập kho theo phiếu #${po.id}`,
        });
      } else {
        const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
        if (!p) throw new Error(`Không tìm thấy sản phẩm #${it.product_id}`);
        const hasActiveVariants = db.prepare(
          "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
        ).get(p.id).n > 0;
        if (hasActiveVariants)
          throw new Error(`Sản phẩm "${p.name}" hiện có biến thể — nhập theo từng biến thể`);
        addProduct.run(it.quantity, it.product_id);
        db.logStockMovement({
          product_id: it.product_id, variant_id: null,
          type: 'IN', qty: it.quantity,
          ref_type: 'purchase', ref_id: po.id,
          note: `Nhập kho theo phiếu #${po.id}`,
        });
      }
      total += it.quantity * it.unit_price;
    }
    db.prepare("UPDATE purchase_orders SET status = 'received', total = ? WHERE id = ?").run(total, po.id);
    return total;
  });

  const total = tx();
  res.json({ purchase_order: { ...db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po.id), status_label: 'Đã nhập kho' }, total });
});

// PUT /api/inventory/purchase-orders/:id/cancel — hủy phiếu (không hủy phiếu đã nhập kho)
router.put('/purchase-orders/:id/cancel', (req, res) => {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  if (po.status === 'received')
    return res.status(409).json({ error: 'Phiếu đã nhập kho, không thể hủy' });
  if (po.status === 'cancelled')
    return res.status(409).json({ error: 'Phiếu đã được hủy trước đó' });
  db.prepare("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").run(po.id);
  res.json({ purchase_order: { ...po, status: 'cancelled', status_label: 'Đã hủy' } });
});

// =====================================================
// NHẬT KÝ BIẾN ĐỘNG KHO
// =====================================================

// GET /api/inventory/movements?product_id=&variant_id= — lịch sử xuất-nhập (lọc theo SP/biến thể)
router.get('/movements', (req, res) => {
  const conds = [];
  const params = [];
  if (req.query.variant_id) { conds.push('sm.variant_id = ?'); params.push(req.query.variant_id); }
  else if (req.query.product_id) { conds.push('sm.product_id = ?'); params.push(req.query.product_id); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));

  const movements = db.prepare(
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

// POST /api/inventory/adjust — điều chỉnh kho thủ công (qty dương/âm, note bắt buộc)
router.post('/adjust', (req, res) => {
  const { variant_id, product_id, qty, note } = req.body || {};
  const hasVariant = variant_id !== undefined && variant_id !== null && variant_id !== '';
  const hasProduct = product_id !== undefined && product_id !== null && product_id !== '';
  if ((hasVariant && hasProduct) || (!hasVariant && !hasProduct))
    return res.status(400).json({ error: 'Phải chỉ định đúng 1 trong 2: variant_id hoặc product_id' });
  const delta = parseInt(qty);
  if (isNaN(delta) || delta === 0)
    return res.status(400).json({ error: 'Số lượng điều chỉnh phải là số nguyên khác 0' });
  if (!note || !note.trim())
    return res.status(400).json({ error: 'Ghi chú (note) là bắt buộc khi điều chỉnh kho' });

  let row, targetType;
  if (hasVariant) {
    row = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variant_id);
    targetType = 'variant';
  } else {
    row = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    targetType = 'product';
    const hasActiveVariants = db.prepare(
      "SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1"
    ).get(product_id).n > 0;
    if (hasActiveVariants)
      return res.status(400).json({ error: 'Sản phẩm có biến thể — hãy điều chỉnh theo từng biến thể' });
  }
  if (!row) return res.status(404).json({ error: 'Không tìm thấy mặt hàng cần điều chỉnh' });
  if (row.stock + delta < 0)
    return res.status(409).json({ error: `Tồn kho không đủ (đang có ${row.stock}, muốn ${delta > 0 ? '+' : ''}${delta})` });

  const tx = db.transaction(() => {
    if (targetType === 'variant') {
      db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(delta, row.id);
      db.logStockMovement({
        product_id: row.product_id, variant_id: row.id,
        type: 'ADJUST', qty: delta,
        ref_type: 'adjust', ref_id: null,
        note: note.trim(),
      });
      return db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(row.id).stock;
    }
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, row.id);
    db.logStockMovement({
      product_id: row.id, variant_id: null,
      type: 'ADJUST', qty: delta,
      ref_type: 'adjust', ref_id: null,
      note: note.trim(),
    });
    return db.prepare('SELECT stock FROM products WHERE id = ?').get(row.id).stock;
  });

  const newStock = tx();
  res.json({ message: 'Đã điều chỉnh tồn kho', stock: newStock });
});

// GET /api/inventory/low-stock?threshold=5 — SP/biến thể sắp hết hàng
router.get('/low-stock', (req, res) => {
  const threshold = Math.max(0, parseInt(req.query.threshold) || 5);

  // SP không có biến thể active: dùng products.stock
  const products = db.prepare(
    `SELECT p.id AS product_id, NULL AS variant_id, p.name AS product_name, NULL AS variant_sku,
            p.stock, NULL AS variant_color, NULL AS variant_size, 'product' AS kind
     FROM products p
     WHERE p.stock <= ?
       AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
     ORDER BY p.stock ASC`
  ).all(threshold);

  // Biến thể: dùng product_variants.stock
  const variants = db.prepare(
    `SELECT v.product_id, v.id AS variant_id, p.name AS product_name, v.sku AS variant_sku,
            v.stock, v.color AS variant_color, v.size AS variant_size, 'variant' AS kind
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.is_active = 1 AND v.stock <= ?
     ORDER BY v.stock ASC`
  ).all(threshold);

  res.json({ threshold, low_stock: [...products, ...variants].sort((a, b) => a.stock - b.stock) });
});

// =====================================================
// DANH MỤC MẶT HÀNG (phục vụ chọn dòng hàng cho phiếu nhập)
// =====================================================

// GET /api/inventory/items?q= — SP kèm biến thể active (để picker chọn hàng nhập)
router.get('/items', (req, res) => {
  const q = (req.query.q || '').trim();
  const conds = [];
  const params = [];
  if (q) { conds.push('p.name LIKE ?'); params.push(`%${q}%`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const products = db.prepare(
    `SELECT p.id, p.name, p.stock, p.price FROM products p ${where} ORDER BY p.name LIMIT 100`
  ).all(...params);
  const variants = db.prepare(
    `SELECT v.id, v.product_id, v.sku, v.color, v.size, v.stock
     FROM product_variants v
     WHERE v.is_active = 1 AND v.product_id IN (${products.map(() => '?').join(',') || 'NULL'})
     ORDER BY v.id`
  ).all(...products.map((p) => p.id));
  const byProduct = {};
  for (const v of variants) (byProduct[v.product_id] = byProduct[v.product_id] || []).push(v);
  res.json({ items: products.map((p) => ({ ...p, variants: byProduct[p.id] || [] })) });
});

module.exports = router;
