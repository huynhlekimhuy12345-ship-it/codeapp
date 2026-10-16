// Đánh giá sản phẩm: khách xem review đã duyệt, khách đã đăng nhập gửi/sửa review,
// admin kiểm duyệt (duyệt/từ chối) và xóa
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Chuẩn hoá 1 review thành JSON cho frontend
const REVIEW_COLS = `
  r.id, r.product_id, r.user_id, r.rating, r.comment, r.is_approved, r.created_at,
  u.name AS user_name`;

// GET /api/reviews?product_id= — công khai: chỉ review đã duyệt, kèm tên người viết, mới nhất trước.
// Trả thêm summary {avg_rating, count} khi có product_id.
// GET /api/reviews?mine=1 — cần auth: review của chính mình (kể cả chưa duyệt)
router.get('/', (req, res) => {
  const { product_id, mine } = req.query;

  // Review của chính mình: cần đăng nhập (không yêu cầu auth cho toàn route vì public)
  if (mine === '1') {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Cần đăng nhập để xem đánh giá của bạn' });
    const jwt = require('jsonwebtoken');
    const { auth, staffOnly } = require('../middleware/auth');
    let userId;
    try {
      userId = jwt.verify(token, JWT_SECRET).id;
    } catch (e) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
    const reviews = db.prepare(
      `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`
    ).all(userId);
    return res.json({ reviews });
  }

  const conds = ['r.is_approved = 1'];
  const params = [];
  if (product_id) { conds.push('r.product_id = ?'); params.push(product_id); }
  const where = 'WHERE ' + conds.join(' AND ');

  const reviews = db.prepare(
    `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
     ${where} ORDER BY r.created_at DESC`
  ).all(...params);

  const out = { reviews };
  if (product_id) {
    const s = db.prepare(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
       FROM reviews WHERE product_id = ? AND is_approved = 1`
    ).get(product_id);
    out.summary = { avg_rating: s.avg_rating || 0, count: s.count || 0 };
  }
  res.json(out);
});

// GET /api/reviews/pending — admin: danh sách review chờ duyệt
router.get('/pending', auth, staffOnly, (req, res) => {
  const reviews = db.prepare(
    `SELECT ${REVIEW_COLS}, p.name AS product_name
     FROM reviews r LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE r.is_approved = 0 ORDER BY r.created_at DESC`
  ).all();
  res.json({ reviews });
});

// POST /api/reviews — cần đăng nhập: {product_id, rating 1-5, comment}
// Mỗi user chỉ 1 review / 1 sản phẩm (409 nếu đã tồn tại)
router.post('/', auth, (req, res) => {
  const { product_id, rating, comment } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'Thiếu sản phẩm' });
  const r = parseInt(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5)
    return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });

  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  const dup = db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?')
    .get(product_id, req.user.id);
  if (dup)
    return res.status(409).json({ error: 'Bạn đã đánh giá sản phẩm này rồi', review_id: dup.id });

  const info = db.prepare(
    'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
  ).run(product_id, req.user.id, r, (comment || '').trim());
  const review = db.prepare(
    `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
  ).get(info.lastInsertRowid);
  res.status(201).json({ review });
});

// PUT /api/reviews/:id — sửa review của chính mình (rating, comment)
router.put('/:id', auth, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
  if (review.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn chỉ được sửa đánh giá của chính mình' });

  const { rating, comment } = req.body || {};
  const r = parseInt(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5)
    return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });

  db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?')
    .run(r, (comment || '').trim(), req.params.id);
  const updated = db.prepare(
    `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
  ).get(req.params.id);
  res.json({ review: updated });
});

// PUT /api/reviews/:id/approve — admin: duyệt hoặc từ chối {is_approved: 1|0}
router.put('/:id/approve', auth, staffOnly, (req, res) => {
  const { is_approved } = req.body || {};
  if (![0, 1, '0', '1', true, false].includes(is_approved))
    return res.status(400).json({ error: 'is_approved phải là 0 hoặc 1' });
  const info = db.prepare('UPDATE reviews SET is_approved = ? WHERE id = ?')
    .run(is_approved ? 1 : 0, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
  res.json({ message: is_approved ? 'Đã duyệt đánh giá' : 'Đã từ chối đánh giá' });
});

// DELETE /api/reviews/:id — admin, hoặc chủ review
router.delete('/:id', auth, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
  if (req.user.role !== 'admin' && review.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền xóa đánh giá này' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa đánh giá' });
});

module.exports = router;
