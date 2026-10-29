// Quản trị người dùng (admin + sale xem; đổi vai trò/xóa chỉ admin)
const express = require('express');
const db = require('../db');
const { auth, adminOnly, staffOnly } = require('../middleware/auth');
const { computeTier, TIER_MAP, SETTLED_SQL } = require('../lib/tiers');

const router = express.Router();

// GET /api/users/me — khách xem hồ sơ của mình
router.get('/me', auth, async (req, res) => {
  try {
    const user = await db.prepare(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
    ).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/users/me — khách cập nhật tên/SĐT của mình
router.put('/me', auth, async (req, res) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !String(name).trim())
      return res.status(400).json({ error: 'Tên không được để trống' });
    const nameTaken = await db.prepare('SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ?').get(String(name).trim(), req.user.id);
    if (nameTaken) return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại' });
    await db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(
      String(name).trim(), String(phone || '').trim(), req.user.id
    );
    const user = await db.prepare(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
    ).get(req.user.id);
    res.json({ user });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/users — admin/sale xem danh sách, kèm số đơn/tổng chi và hạng của từng khách.
// Số đơn/tổng chi tính theo ĐIỂM HẠNG (chỉ đơn verified + đã chốt điểm, trừ tiền đã hoàn)
// để hạng hiển thị ở admin khớp đúng hạng thật của khách (lib/tiers.userStats).
router.get('/', auth, staffOnly, async (req, res) => {
  try {
    const rows = await db.prepare(`
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
      GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at
      ORDER BY u.created_at DESC
    `).all();
    const tier_counts = { diamond: 0, gold: 0, silver: 0, bronze: 0, potential: 0 };
    const users = rows.map((u) => {
      if (u.role !== 'customer') return { ...u, tier: null };
      const key = computeTier(u.order_count, u.total_spent);
      tier_counts[key]++;
      return { ...u, tier: { key, name: TIER_MAP[key].name } };
    });
    res.json({ users, tier_counts });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/users/:id/role — admin đổi vai trò
router.put('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!['admin', 'sale', 'customer'].includes(role))
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
    if (parseInt(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'Không thể tự hạ quyền chính mình' });
    const info = await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user: await db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/users/top-customers — admin/sale: top khách hàng tiềm năng theo tổng tiền đã mua
// Tính theo ĐIỂM HẠNG: chỉ đơn verified, chưa hủy và ĐÃ CHỐT ĐIỂM (khớp userStats trong lib/tiers).
router.get('/top-customers', auth, staffOnly, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT u.id, u.name, u.email, u.phone,
             COUNT(o.id) AS order_count,
             COALESCE(SUM(o.total), 0) AS total_spent,
             MAX(o.created_at) AS last_order_at
      FROM users u
      JOIN orders o ON o.user_id = u.id
        AND o.payment_status = 'verified' AND o.status != 'cancelled'
        AND ${SETTLED_SQL}
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name, u.email, u.phone
      ORDER BY total_spent DESC, order_count DESC
      LIMIT 10
    `).all();
    const customers = rows.map((c) => {
      const key = computeTier(c.order_count, c.total_spent);
      return { ...c, tier: { key, name: TIER_MAP[key].name } };
    });
    res.json({ customers });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/users/:id/purchases — admin/sale: một khách đã mua những gì
router.get('/:id/purchases', auth, staffOnly, async (req, res) => {
  try {
    const customer = await db.prepare(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?'
    ).get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    const orders = await db.prepare(
      'SELECT id, total, status, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC'
    ).all(req.params.id);
    const itemsStmt = db.prepare(
      'SELECT id, product_name, quantity, price FROM order_items WHERE order_id = ? ORDER BY id'
    );
    for (const o of orders) o.items = await itemsStmt.all(o.id);
    const summary = await db.prepare(`
      SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
      FROM orders WHERE user_id = ? AND payment_status = 'verified' AND status != 'cancelled'
    `).get(req.params.id);
    const topProducts = await db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.price) AS total_amount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ? AND o.payment_status = 'verified' AND o.status != 'cancelled'
      GROUP BY oi.product_name
      ORDER BY total_qty DESC, total_amount DESC
      LIMIT 5
    `).all(req.params.id);
    const tierKey = customer.role === 'customer'
      ? computeTier(summary.order_count, summary.total_spent)
      : null;
    res.json({
      customer,
      summary,
      tier: tierKey ? { key: tierKey, name: TIER_MAP[tierKey].name } : null,
      top_products: topProducts,
      orders,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
