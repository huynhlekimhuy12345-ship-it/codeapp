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

// GET /api/products/:id — công khai
router.get('/:id', (req, res) => {
  const p = db.prepare(`${SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
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

module.exports = router;
