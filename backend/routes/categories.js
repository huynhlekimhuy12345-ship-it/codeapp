// CRUD danh mục sản phẩm
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories — công khai; kèm số sản phẩm từng danh mục + số sản phẩm chưa phân loại
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c ORDER BY c.name
  `).all();
  const uncategorized = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id IS NULL').get().c;
  res.json({ categories: rows, uncategorized_count: uncategorized });
});

// GET /api/categories/:id/products — nhân viên xem sản phẩm thuộc danh mục
// (id = 'none' → sản phẩm chưa phân loại). Số liệu lấy trực tiếp từ kho sản phẩm nên luôn khớp thực tế.
router.get('/:id/products', auth, staffOnly, (req, res) => {
  const products = req.params.id === 'none'
    ? db.prepare('SELECT id, name, price, stock, image_url FROM products WHERE category_id IS NULL ORDER BY name').all()
    : db.prepare('SELECT id, name, price, stock, image_url FROM products WHERE category_id = ? ORDER BY name').all(req.params.id);
  res.json({ products });
});

// GET /api/categories/:id — công khai
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
  res.json({ category: row });
});

// POST /api/categories — admin
router.post('/', auth, staffOnly, (req, res) => {
  const { name, description } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Tên danh mục là bắt buộc' });
  try {
    const info = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
      .run(name.trim(), (description || '').trim());
    res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: 'Tên danh mục đã tồn tại' });
  }
});

// PUT /api/categories/:id — admin
router.put('/:id', auth, staffOnly, (req, res) => {
  const { name, description } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Tên danh mục là bắt buộc' });
  try {
    const info = db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
      .run(name.trim(), (description || '').trim(), req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) });
  } catch (e) {
    res.status(400).json({ error: 'Tên danh mục đã tồn tại' });
  }
});

// DELETE /api/categories/:id — admin
router.delete('/:id', auth, staffOnly, (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
  res.json({ message: 'Đã xóa danh mục' });
});

module.exports = router;
