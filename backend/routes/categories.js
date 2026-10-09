// CRUD danh mục sản phẩm
const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories — công khai
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json({ categories: rows });
});

// GET /api/categories/:id — công khai
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
  res.json({ category: row });
});

// POST /api/categories — admin
router.post('/', auth, adminOnly, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Tên danh mục là bắt buộc' });
  try {
    const info = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
      .run(name.trim(), (description || '').trim());
    res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: 'Tên danh mục đã tồn tại' });
  }
});

// PUT /api/categories/:id — admin
router.put('/:id', auth, adminOnly, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Tên danh mục là bắt buộc' });
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
router.delete('/:id', auth, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
  res.json({ message: 'Đã xóa danh mục' });
});

module.exports = router;
