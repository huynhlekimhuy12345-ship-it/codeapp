// CRUD bài viết Blog — port từ web artifact BI99 (server/src/actions.ts)
// Khách chỉ xem bài đã xuất bản; admin (token) xem được cả bản nháp qua ?all=1
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_IMAGE_HOSTS = new Set(['images.unsplash.com']);

// Chuyển tiêu đề tiếng Việt thành slug không dấu, duy nhất trong bảng
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Chỉ cho ảnh nội bộ hoặc host đã duyệt (Unsplash); chống ép trình duyệt
// của khách tải tài nguyên từ host lạ.
function safeImageUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (v.startsWith('./')) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(u.hostname)) return v;
  } catch { /* bỏ qua */ }
  return '';
}

async function uniqueSlug(title, excludeId) {
  const base = slugify(title) || 'bai-viet';
  const rows = excludeId
    ? await db.prepare('SELECT slug FROM posts WHERE id != ?').all(excludeId)
    : await db.prepare('SELECT slug FROM posts').all();
  const taken = new Set(rows.map((r) => r.slug));
  let slug = base;
  let n = 2;
  while (taken.has(slug)) { slug = `${base}-${n}`; n += 1; }
  return slug;
}

// GET /api/posts?all=1&limit= — công khai (chỉ bài published), admin xem tất cả
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const wantAll = req.query.all === '1' || req.query.all === 'true';
    let isAdmin = false;
    if (wantAll) {
      // Kiểm tra quyền admin thủ công vì route này vừa công khai vừa cần auth khi all=1
      const { auth, staffOnly, JWT_SECRET } = require('../middleware/auth');
      const jwt = require('jsonwebtoken');
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        isAdmin = payload && ['admin', 'sale'].includes(payload.role);
      } catch { isAdmin = false; }
      if (!isAdmin) return res.status(403).json({ error: 'Chỉ quản trị viên mới xem được bản nháp' });
    }
    const where = isAdmin ? '' : "WHERE status = 'published'";
    const posts = await db
      .prepare(`SELECT * FROM posts ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(limit);
    res.json({ posts });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/posts/:slug — công khai, chỉ bài đã xuất bản
router.get('/:slug', async (req, res) => {
  try {
    const post = await db
      .prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'")
      .get(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json({ post });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/posts — admin
router.post('/', auth, staffOnly, async (req, res) => {
  try {
    const { title, cover_image_url, excerpt, content, status } = req.body || {};
    if (!title || !String(title).trim())
      return res.status(400).json({ error: 'Tiêu đề bài viết là bắt buộc' });
    const st = status === 'published' ? 'published' : 'draft';
    const now = new Date().toISOString();
    const slug = await uniqueSlug(title);
    const info = await db.prepare(
      `INSERT INTO posts (title, slug, cover_image_url, excerpt, content, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(title.trim(), slug, safeImageUrl(cover_image_url), excerpt || '', content || '', st, now, now);
    res.status(201).json({ id: info.lastInsertRowid, slug });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/posts/:id — admin
router.put('/:id', auth, staffOnly, async (req, res) => {
  try {
    const { title, cover_image_url, excerpt, content, status } = req.body || {};
    if (!title || !String(title).trim())
      return res.status(400).json({ error: 'Tiêu đề bài viết là bắt buộc' });
    const st = status === 'published' ? 'published' : 'draft';
    const now = new Date().toISOString();
    const info = await db.prepare(
      `UPDATE posts SET title = ?, cover_image_url = ?, excerpt = ?, content = ?,
       status = ?, updated_at = ? WHERE id = ?`
    ).run(title.trim(), safeImageUrl(cover_image_url), excerpt || '', content || '', st, now, req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/posts/:id — admin
router.delete('/:id', auth, staffOnly, async (req, res) => {
  try {
    const info = await db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
