// Đánh giá sản phẩm: khách xem review đã duyệt, khách đã đăng nhập gửi/sửa review,
// admin kiểm duyệt (duyệt/từ chối) và xóa
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Loại bỏ thẻ HTML khỏi comment (chống XSS khi client khác render innerHTML)
function stripHtml(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[^>]*>/g, '');
}

// Chuẩn hoá 1 review thành JSON cho frontend
const REVIEW_COLS = `
  r.id, r.product_id, r.user_id, r.rating, r.comment, r.is_approved, r.created_at,
  u.name AS user_name`;

// GET /api/reviews?product_id= — công khai: chỉ review đã duyệt, kèm tên người viết, mới nhất trước.
// Trả thêm summary {avg_rating, count} khi có product_id.
// GET /api/reviews?mine=1 — cần auth: review của chính mình (kể cả chưa duyệt)
router.get('/', async (req, res) => {
  try {
    const { product_id, mine } = req.query;

    // Review của chính mình: cần đăng nhập (không yêu cầu auth cho toàn route vì public)
    if (mine === '1') {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Cần đăng nhập để xem đánh giá của bạn' });
      const jwt = require('jsonwebtoken');
      const { auth, staffOnly, JWT_SECRET } = require('../middleware/auth');
      let userId;
      try {
        userId = jwt.verify(token, JWT_SECRET).id;
      } catch (e) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
      }
      const reviews = await db.prepare(
        `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
         WHERE r.user_id = ? ORDER BY r.created_at DESC`
      ).all(userId);
      return res.json({ reviews });
    }

    const conds = ['r.is_approved = 1'];
    const params = [];
    if (product_id) { conds.push('r.product_id = ?'); params.push(product_id); }
    const where = 'WHERE ' + conds.join(' AND ');

    const reviews = await db.prepare(
      `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       ${where} ORDER BY r.created_at DESC`
    ).all(...params);

    const out = { reviews };
    if (product_id) {
      const s = await db.prepare(
        `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg_rating
         FROM reviews WHERE product_id = ? AND is_approved = 1`
      ).get(product_id);
      out.summary = { avg_rating: s.avg_rating || 0, count: s.count || 0 };
    }
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/reviews/pending — admin: danh sách review chờ duyệt
router.get('/pending', auth, staffOnly, async (req, res) => {
  try {
    const reviews = await db.prepare(
      `SELECT ${REVIEW_COLS}, p.name AS product_name
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN products p ON p.id = r.product_id
       WHERE r.is_approved = 0 ORDER BY r.created_at DESC`
    ).all();
    res.json({ reviews });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/reviews — cần đăng nhập: {product_id, rating 1-5, comment}
// Mỗi user chỉ 1 review / 1 sản phẩm (409 nếu đã tồn tại)
router.post('/', auth, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body || {};
    if (!product_id) return res.status(400).json({ error: 'Thiếu sản phẩm' });
    const r = parseInt(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5)
      return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });

    const product = await db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

    // GAP-12: chỉ đánh giá được sản phẩm đã mua và nhận hàng
    const bought = await db.prepare(
      `SELECT oi.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND o.status = 'delivered' AND oi.product_id = ? LIMIT 1`
    ).get(req.user.id, product_id);
    if (!bought)
      return res.status(403).json({ error: 'Chỉ đánh giá được sản phẩm bạn đã mua và nhận hàng' });

    const dup = await db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?')
      .get(product_id, req.user.id);
    if (dup)
      return res.status(409).json({ error: 'Bạn đã đánh giá sản phẩm này rồi', review_id: dup.id });

    const info = await db.prepare(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).run(product_id, req.user.id, r, stripHtml(comment).trim());
    const review = await db.prepare(
      `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    ).get(info.lastInsertRowid);
    res.status(201).json({ review });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/reviews/:id — sửa review của chính mình (rating, comment)
router.put('/:id', auth, async (req, res) => {
  try {
    const review = await db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    if (review.user_id !== req.user.id)
      return res.status(403).json({ error: 'Bạn chỉ được sửa đánh giá của chính mình' });

    const { rating, comment } = req.body || {};
    const r = parseInt(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5)
      return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });

    await db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?')
      .run(r, stripHtml(comment).trim(), req.params.id);
    const updated = await db.prepare(
      `SELECT ${REVIEW_COLS} FROM reviews r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    ).get(req.params.id);
    res.json({ review: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/reviews/:id/approve — admin: duyệt hoặc từ chối {is_approved: 1|0}
router.put('/:id/approve', auth, staffOnly, async (req, res) => {
  try {
    const { is_approved } = req.body || {};
    if (![0, 1, '0', '1', true, false].includes(is_approved))
      return res.status(400).json({ error: 'is_approved phải là 0 hoặc 1' });
    const info = await db.prepare('UPDATE reviews SET is_approved = ? WHERE id = ?')
      .run(is_approved ? 1 : 0, req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    res.json({ message: is_approved ? 'Đã duyệt đánh giá' : 'Đã từ chối đánh giá' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/reviews/:id — admin, hoặc chủ review
router.delete('/:id', auth, async (req, res) => {
  try {
    const review = await db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
    if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    if (req.user.role !== 'admin' && review.user_id !== req.user.id)
      return res.status(403).json({ error: 'Bạn không có quyền xóa đánh giá này' });
    await db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
    res.json({ message: 'Đã xóa đánh giá' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
