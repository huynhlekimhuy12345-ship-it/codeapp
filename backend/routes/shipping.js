// Quản lý phương thức vận chuyển và thông tin vận chuyển của đơn hàng.
//
// LƯU Ý QUAN TRỌNG: orders.status (pending→confirmed→shipping→delivered)
// do routes/orders.js quản lý nghiêm ngặt. File này KHÔNG BAO GIỜ update
// orders.status. shippings.status chỉ là thông tin theo dõi vận chuyển,
// tách biệt với trạng thái đơn hàng.
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Luồng chuyển trạng thái hợp lệ của vận đơn (theo dõi, độc lập với orders.status)
const STATUS_FLOW = {
  preparing: ['shipped', 'failed'],
  shipped: ['delivered', 'failed'],
  delivered: [],
  failed: [],
};

// Nhãn tiếng Việt cho trạng thái vận đơn
const STATUS_LABELS = {
  preparing: 'Đang chuẩn bị',
  shipped: 'Đã gửi hàng',
  delivered: 'Đã giao hàng',
  failed: 'Giao thất bại',
};

// Lấy 1 bản ghi vận chuyển kèm tên phương thức
async function getShipping(id) {
  return await db.prepare(
    `SELECT s.*, m.name AS method_name
     FROM shippings s LEFT JOIN shipping_methods m ON m.id = s.method_id
     WHERE s.id = ?`
  ).get(id);
}

// =====================================================
// PHƯƠNG THỨC VẬN CHUYỂN
// =====================================================

// Middleware: chỉ khi gọi ?all=1 mới yêu cầu quyền admin,
// còn lại route vẫn công khai như spec.
function adminIfAll(req, res, next) {
  if (req.query.all === '1') return auth(req, res, () => staffOnly(req, res, next));
  next();
}

// GET /api/shipping/methods — công khai: chỉ trả về method đang bật (checkout dùng).
// Admin gọi thêm ?all=1 để lấy toàn bộ (kể cả method đã tắt) phục vụ quản trị.
router.get('/methods', adminIfAll, async (req, res) => {
  try {
    const methods =
      req.query.all === '1'
        ? await db.prepare('SELECT * FROM shipping_methods ORDER BY fee ASC').all()
        : await db.prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY fee ASC').all();
    res.json({ methods });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/shipping/methods — admin: thêm phương thức mới
router.post('/methods', auth, staffOnly, async (req, res) => {
  try {
    const { name, fee, eta_days, is_active } = req.body || {};
    if (!name || !String(name).trim())
      return res.status(400).json({ error: 'Tên phương thức là bắt buộc' });
    const info = await db.prepare(
      'INSERT INTO shipping_methods (name, fee, eta_days, is_active) VALUES (?, ?, ?, ?)'
    ).run(
      String(name).trim(),
      Math.max(0, parseInt(fee) || 0),
      Math.max(0, parseInt(eta_days) || 0),
      is_active === undefined ? 1 : (is_active ? 1 : 0)
    );
    res.status(201).json({
      method: await db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(info.lastInsertRowid),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/shipping/methods/:id — admin: sửa phương thức
router.put('/methods/:id', auth, staffOnly, async (req, res) => {
  try {
    const m = await db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Không tìm thấy phương thức vận chuyển' });

    const { name, fee, eta_days, is_active } = req.body || {};
    await db.prepare(
      'UPDATE shipping_methods SET name = ?, fee = ?, eta_days = ?, is_active = ? WHERE id = ?'
    ).run(
      name !== undefined && String(name).trim() ? String(name).trim() : m.name,
      fee === undefined ? m.fee : Math.max(0, parseInt(fee) || 0),
      eta_days === undefined ? m.eta_days : Math.max(0, parseInt(eta_days) || 0),
      is_active === undefined ? m.is_active : (is_active ? 1 : 0),
      req.params.id
    );
    res.json({
      method: await db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(req.params.id),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/shipping/methods/:id — admin: xóa phương thức
// Không cho xóa method đang được đơn hàng / vận đơn nào dùng → 409
router.delete('/methods/:id', auth, staffOnly, async (req, res) => {
  try {
    const m = await db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Không tìm thấy phương thức vận chuyển' });

    const usedByShipping = (await db
      .prepare('SELECT COUNT(*) AS c FROM shippings WHERE method_id = ?')
      .get(req.params.id)).c;
    const usedByOrders = (await db
      .prepare('SELECT COUNT(*) AS c FROM orders WHERE shipping_method_id = ?')
      .get(req.params.id)).c;
    if (usedByShipping > 0 || usedByOrders > 0)
      return res
        .status(409)
        .json({ error: 'Phương thức đang được đơn hàng sử dụng, không thể xóa' });

    await db.prepare('DELETE FROM shipping_methods WHERE id = ?').run(req.params.id);
    res.json({ message: 'Đã xóa phương thức vận chuyển' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// =====================================================
// VẬN ĐƠN (1 đơn hàng = 1 bản ghi vận chuyển)
// =====================================================

// GET /api/shipping?order_id= — khách chỉ xem được vận đơn của đơn mình,
// admin xem tất cả
router.get('/', auth, async (req, res) => {
  try {
    const { order_id } = req.query;
    const conds = [];
    const params = [];
    if (order_id) {
      conds.push('s.order_id = ?');
      params.push(order_id);
    }
    if (req.user.role !== 'admin') {
      conds.push('o.user_id = ?');
      params.push(req.user.id);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const shippings = await db
      .prepare(
        `SELECT s.*, m.name AS method_name, o.customer_name, o.phone, o.total AS order_total
         FROM shippings s
         JOIN orders o ON o.id = s.order_id
         LEFT JOIN shipping_methods m ON m.id = s.method_id
         ${where} ORDER BY s.id DESC`
      )
      .all(...params);
    res.json({ shippings });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/shipping — admin: gán vận chuyển cho đơn hàng
// fee lấy từ shipping_methods (server-side), không tin fee từ client.
// Đồng thời UPDATE orders.shipping_fee + orders.shipping_method_id (KHÔNG chạm orders.status).
router.post('/', auth, staffOnly, async (req, res) => {
  try {
    const { order_id, method_id, tracking_code } = req.body || {};
    if (!order_id || !method_id)
      return res.status(400).json({ error: 'order_id và method_id là bắt buộc' });

    const order = await db.prepare('SELECT id FROM orders WHERE id = ?').get(order_id);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    const method = await db
      .prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1')
      .get(method_id);
    if (!method)
      return res
        .status(400)
        .json({ error: 'Phương thức vận chuyển không tồn tại hoặc đã tắt' });

    const exists = await db.prepare('SELECT id FROM shippings WHERE order_id = ?').get(order_id);
    if (exists)
      return res.status(409).json({ error: 'Đơn hàng đã có thông tin vận chuyển' });

    const create = db.transaction(async () => {
      const info = await db.prepare(
        'INSERT INTO shippings (order_id, method_id, fee, tracking_code) VALUES (?, ?, ?, ?)'
      ).run(order_id, method.id, method.fee, (tracking_code || '').toString().trim());
      await db.prepare('UPDATE orders SET shipping_fee = ?, shipping_method_id = ? WHERE id = ?')
        .run(method.fee, method.id, order_id);
      return info.lastInsertRowid;
    });

    const id = await create();
    res.status(201).json({ shipping: await getShipping(id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/shipping/:id — admin: cập nhật tracking_code, chuyển trạng thái vận đơn.
// Luồng hợp lệ: preparing → shipped/failed; shipped → delivered/failed.
// Khi chuyển sang shipped/delivered tự động set shipped_at/delivered_at.
router.put('/:id', auth, staffOnly, async (req, res) => {
  try {
    const ship = await db.prepare('SELECT * FROM shippings WHERE id = ?').get(req.params.id);
    if (!ship) return res.status(404).json({ error: 'Không tìm thấy thông tin vận chuyển' });

    const { tracking_code, status } = req.body || {};
    const sets = [];
    const params = [];

    if (tracking_code !== undefined) {
      sets.push('tracking_code = ?');
      params.push(tracking_code.toString().trim());
    }

    if (status !== undefined && status !== ship.status) {
      if (!STATUS_FLOW[status])
        return res.status(400).json({ error: 'Trạng thái vận chuyển không hợp lệ' });
      if (!STATUS_FLOW[ship.status].includes(status))
        return res.status(400).json({
          error: `Không thể chuyển trạng thái từ "${STATUS_LABELS[ship.status]}" sang "${STATUS_LABELS[status]}"`,
        });
      sets.push('status = ?');
      params.push(status);
      if (status === 'shipped') sets.push("shipped_at = datetime('now')");
      if (status === 'delivered') sets.push("delivered_at = datetime('now')");
    }

    if (!sets.length) return res.json({ shipping: await getShipping(ship.id) });

    params.push(ship.id);
    await db.prepare(`UPDATE shippings SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    res.json({ shipping: await getShipping(ship.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
