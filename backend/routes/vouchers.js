// CRUD voucher khuyến mãi (admin) + validate mã ở checkout (customer)
// Convention: dùng db better-sqlite3 đồng bộ, middleware { auth, staffOnly } như routes/products.js
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Chuẩn hoá code: chữ hoa, bỏ khoảng trắng
function normCode(code) {
  return String(code || '').trim().toUpperCase();
}

// Kiểm tra định dạng expiry có phải ngày hợp lệ không
function parseExpiry(expiry) {
  if (!expiry) return null; // không giới hạn thời gian
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Validate dữ liệu tạo/sửa voucher, trả về { ok, error, clean }
function validatePayload(body, isCreate) {
  const clean = {};
  if (isCreate) {
    clean.code = normCode(body.code);
    if (!clean.code) return { ok: false, error: 'Mã voucher là bắt buộc' };
    if (!['percent', 'fixed'].includes(body.type))
      return { ok: false, error: 'Loại voucher phải là percent hoặc fixed' };
    clean.type = body.type;
  }
  if (body.value !== undefined) {
    const value = parseInt(body.value);
    if (isNaN(value) || value <= 0)
      return { ok: false, error: 'Giá trị voucher phải là số nguyên dương' };
    const type = isCreate ? body.type : null;
    if (type === 'percent' || body.type === 'percent') {
      if (value < 1 || value > 100)
        return { ok: false, error: 'Voucher phần trăm chỉ được từ 1 đến 100' };
    }
    clean.value = value;
  } else if (isCreate) {
    return { ok: false, error: 'Giá trị voucher là bắt buộc' };
  }
  if (body.min_order !== undefined) {
    const minOrder = parseInt(body.min_order) || 0;
    if (minOrder < 0) return { ok: false, error: 'Đơn tối thiểu không được âm' };
    clean.min_order = minOrder;
  } else if (isCreate) {
    clean.min_order = 0;
  }
  if (body.expiry !== undefined) {
    if (body.expiry) {
      const iso = parseExpiry(body.expiry);
      if (!iso) return { ok: false, error: 'Ngày hết hạn không hợp lệ' };
      if (new Date(iso).getTime() <= Date.now())
        return { ok: false, error: 'Ngày hết hạn phải ở tương lai' };
      clean.expiry = iso;
    } else {
      clean.expiry = null;
    }
  }
  if (body.usage_limit !== undefined) {
    const limit = parseInt(body.usage_limit) || 0;
    if (limit < 0) return { ok: false, error: 'Giới hạn lượt dùng không được âm' };
    clean.usage_limit = limit;
  } else if (isCreate) {
    clean.usage_limit = 0; // 0 = không giới hạn
  }
  if (body.is_active !== undefined) {
    clean.is_active = body.is_active ? 1 : 0;
  }
  return { ok: true, clean };
}

// ============================================================
// HÀM DÙNG CHUNG CHO W3 (checkout) — server-side, không tin client
// ============================================================
// validateVoucher(db, code, orderTotal)
//   → { valid: true, voucher, discount, final_total }
//   → { valid: false, reason } với reason là mã lỗi máy đọc được:
//       'NOT_FOUND' | 'INACTIVE' | 'EXPIRED' | 'MIN_ORDER' | 'LIMIT_REACHED'
// discount = percent ? floor(total*value/100) : min(value, total)
// Nhận db qua tham số để W3 gọi được TRONG transaction đặt đơn.
function validateVoucher(dbConn, code, orderTotal) {
  const total = parseInt(orderTotal) || 0;
  const v = dbConn.prepare('SELECT * FROM vouchers WHERE code = ?').get(normCode(code));
  if (!v) return { valid: false, reason: 'NOT_FOUND' };
  if (!v.is_active) return { valid: false, reason: 'INACTIVE' };
  if (v.expiry && new Date(v.expiry).getTime() <= Date.now())
    return { valid: false, reason: 'EXPIRED' };
  if (total < (v.min_order || 0)) return { valid: false, reason: 'MIN_ORDER' };
  if (v.usage_limit > 0 && v.used_count >= v.usage_limit)
    return { valid: false, reason: 'LIMIT_REACHED' };
  const discount =
    v.type === 'percent' ? Math.floor((total * v.value) / 100) : Math.min(v.value, total);
  return { valid: true, voucher: v, discount, final_total: total - discount };
}

// Thông điệp tiếng Việt cho reason ở API validate (customer)
const REASON_MSG = {
  NOT_FOUND: 'Mã khuyến mãi không tồn tại',
  INACTIVE: 'Mã khuyến mãi đã bị tắt',
  EXPIRED: 'Mã khuyến mãi đã hết hạn',
  MIN_ORDER: 'Đơn hàng chưa đạt giá trị tối thiểu để dùng mã này',
  LIMIT_REACHED: 'Mã khuyến mãi đã hết lượt sử dụng',
};

// GET /api/vouchers — admin: danh sách, lọc ?is_active=1|0
router.get('/', auth, staffOnly, (req, res) => {
  const conds = [];
  const params = [];
  if (req.query.is_active !== undefined && req.query.is_active !== '') {
    conds.push('is_active = ?');
    params.push(req.query.is_active ? 1 : 0);
  }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const vouchers = db
    .prepare(`SELECT * FROM vouchers ${where} ORDER BY id DESC`)
    .all(...params);
  res.json({ vouchers });
});

// POST /api/vouchers — admin: tạo mới
router.post('/', auth, staffOnly, (req, res) => {
  const { ok, error, clean } = validatePayload(req.body || {}, true);
  if (!ok) return res.status(400).json({ error });
  const exists = db.prepare('SELECT id FROM vouchers WHERE code = ?').get(clean.code);
  if (exists) return res.status(409).json({ error: 'Mã voucher đã tồn tại' });
  const info = db
    .prepare(
      `INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(clean.code, clean.type, clean.value, clean.min_order, clean.expiry, clean.usage_limit);
  res.status(201).json({ voucher: db.prepare('SELECT * FROM vouchers WHERE id = ?').get(info.lastInsertRowid) });
});

// PUT /api/vouchers/:id — admin: sửa value/min_order/expiry/usage_limit/is_active
router.put('/:id', auth, staffOnly, (req, res) => {
  const v = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Không tìm thấy voucher' });
  const { ok, error, clean } = validatePayload(req.body || {}, false);
  if (!ok) return res.status(400).json({ error });
  // Percent không cho quá 100 kể cả khi sửa (type lấy từ bản ghi hiện có)
  if (clean.value !== undefined && v.type === 'percent' && (clean.value < 1 || clean.value > 100))
    return res.status(400).json({ error: 'Voucher phần trăm chỉ được từ 1 đến 100' });
  const sets = [];
  const params = [];
  for (const k of ['value', 'min_order', 'expiry', 'usage_limit', 'is_active']) {
    if (clean[k] !== undefined) { sets.push(`${k} = ?`); params.push(clean[k]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
  params.push(req.params.id);
  db.prepare(`UPDATE vouchers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ voucher: db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id) });
});

// DELETE /api/vouchers/:id — admin: chỉ tắt nếu đã có lượt dùng, không xóa cứng
router.delete('/:id', auth, staffOnly, (req, res) => {
  const v = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Không tìm thấy voucher' });
  if (v.used_count > 0)
    return res.status(409).json({ error: 'Voucher đã được dùng, chỉ có thể tắt (is_active = 0)' });
  db.prepare('DELETE FROM vouchers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa voucher' });
});

// POST /api/vouchers/validate — customer dùng ở checkout (preview, không trừ lượt)
router.post('/validate', auth, (req, res) => {
  const { code, order_total } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Thiếu mã voucher' });
  const r = validateVoucher(db, code, order_total);
  if (!r.valid)
    return res.json({ valid: false, reason: r.reason, message: REASON_MSG[r.reason] });
  res.json({ valid: true, discount: r.discount, final_total: r.final_total });
});

module.exports = router;
module.exports.validateVoucher = validateVoucher;
