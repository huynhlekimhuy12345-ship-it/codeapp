// Quản lý đơn hàng: khách đặt hàng, admin cập nhật trạng thái
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');
const { validateVoucher } = require('./vouchers');

const router = express.Router();

// Lấy đơn hàng kèm chi tiết sản phẩm và lịch sử trạng thái
function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  order.history = db.prepare(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id DESC'
  ).all(id);
  return order;
}

// Luồng trạng thái hợp lệ: chờ xác nhận → đã xác nhận → đang giao → đã giao
// Chỉ được hủy khi chưa giao xong; đơn đã hủy / đã giao không chuyển đi đâu nữa
const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

// Ghi lịch sử trạng thái, dùng tên thật từ phiên đăng nhập (không cho giả mạo nhãn)
function actorName(req) {
  const row = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  return row ? row.name : (req.user.email || '');
}

function writeHistory(orderId, fromStatus, toStatus, req, reason = '') {
  db.prepare(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).run(orderId, fromStatus, toStatus, actorName(req), reason || '');
}

// Hoàn lại tồn kho cho toàn bộ sản phẩm trong đơn
// Item có variant_id → hoàn vào product_variants.stock, còn lại hoàn vào products.stock
function restoreStock(orderId) {
  const items = db.prepare(
    'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?'
  ).all(orderId);
  const updProduct = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  const updVariant = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?');
  for (const i of items) {
    if (i.variant_id) updVariant.run(i.quantity, i.variant_id);
    else if (i.product_id) updProduct.run(i.quantity, i.product_id);
  }
}

// Nhãn tiếng Việt cho phương thức thanh toán (hiển thị trong lịch sử đơn)
const PAYMENT_LABELS = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
};

// ============================================================
// POST /api/orders — khách hàng đã đăng nhập đặt hàng
// body: { customer_name, phone, address,
//         items: [{ product_id, variant_id?, quantity }],
//         shipping_method_id, voucher_code?, payment_method (cod|bank|momo), note? }
// Toàn bộ tạo đơn chạy trong 1 transaction:
//   validate item (SP/variant, kho, giá server-side) → trừ kho + ghi movement OUT
//   → voucher (validate lại, tăng used_count) → phí ship (lấy từ DB)
//   → INSERT orders/payments/shippings + lịch sử tạo đơn
// ============================================================
router.post('/', auth, (req, res) => {
  const { customer_name, phone, address, items, shipping_method_id, voucher_code, payment_method, note } = req.body || {};

  // Validate thông tin giao hàng
  if (!customer_name || !phone || !address)
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, số điện thoại, địa chỉ' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Giỏ hàng trống' });

  // Validate phương thức thanh toán
  const pm = payment_method || 'cod';
  if (!['cod', 'bank', 'momo'].includes(pm))
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ' });

  // Phí ship lấy server-side từ DB theo shipping_method_id (không tin fee client gửi)
  const method = db.prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1')
    .get(shipping_method_id);
  if (!method)
    return res.status(400).json({ error: 'Phương thức vận chuyển không tồn tại hoặc đã tắt' });
  const shipping_fee = method.fee;

  const createOrder = db.transaction((items) => {
    let subtotal = 0;
    const lines = [];

    // 0. Giá sale sự kiện: nếu đang có sự kiện diễn ra, SP thuộc sự kiện được
    //    tính theo sale_price (server-side, không tin giá client gửi)
    const nowIso = new Date().toISOString();
    const liveEvent = db
      .prepare(
        `SELECT id FROM promo_events WHERE is_active = 1
         AND (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)
         ORDER BY id DESC LIMIT 1`
      )
      .get(nowIso, nowIso);
    const salePrices = new Map();
    if (liveEvent) {
      for (const r of db
        .prepare('SELECT product_id, sale_price FROM promo_event_products WHERE event_id = ?')
        .all(liveEvent.id)) {
        salePrices.set(r.product_id, r.sale_price);
      }
    }

    // 1. Validate từng item: SP tồn tại; variant (nếu có) phải active + đủ kho
    for (const it of items) {
      const qty = parseInt(it.quantity) || 0;
      if (qty <= 0) throw new Error('Số lượng sản phẩm không hợp lệ');
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
      if (!p) throw new Error(`Sản phẩm #${it.product_id} không tồn tại`);

      const basePrice = salePrices.get(p.id) ?? p.price;
      let unitPrice = basePrice;
      let variantId = null;
      let variantSku = '';
      if (it.variant_id) {
        // Dòng có biến thể: giá = giá gốc (hoặc giá sale sự kiện) + price_delta, kho riêng của biến thể
        const v = db.prepare(
          'SELECT * FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1'
        ).get(it.variant_id, p.id);
        if (!v) throw new Error(`Biến thể của "${p.name}" không tồn tại hoặc đã tắt`);
        if (v.stock < qty) throw new Error(`"${p.name} (${v.sku})" chỉ còn ${v.stock} sản phẩm trong kho`);
        unitPrice = basePrice + (v.price_delta || 0);
        variantId = v.id;
        variantSku = v.sku;
      } else {
        // Dòng không biến thể: giữ hành vi cũ (kho + giá gốc của sản phẩm)
        if (p.stock < qty) throw new Error(`"${p.name}" chỉ còn ${p.stock} sản phẩm trong kho`);
      }

      subtotal += unitPrice * qty;
      lines.push({
        product_id: p.id,
        variant_id: variantId,
        variant_sku: variantSku,
        product_name: p.name,
        quantity: qty,
        price: unitPrice,
      });
    }

    // 2. Validate voucher server-side (không tin client); tính discount
    let discount_total = 0;
    let voucherRow = null;
    const code = (voucher_code || '').toString().trim();
    if (code) {
      const r = validateVoucher(db, code, subtotal);
      if (!r.valid) {
        const msgs = {
          NOT_FOUND: 'Mã khuyến mãi không tồn tại',
          INACTIVE: 'Mã khuyến mãi đã bị tắt',
          EXPIRED: 'Mã khuyến mãi đã hết hạn',
          MIN_ORDER: 'Đơn hàng chưa đạt giá trị tối thiểu để dùng mã này',
          LIMIT_REACHED: 'Mã khuyến mãi đã hết lượt sử dụng',
        };
        throw new Error(msgs[r.reason] || 'Mã khuyến mãi không hợp lệ');
      }
      discount_total = r.discount;
      voucherRow = r.voucher;
    }

    // 3. Tổng đơn = tạm tính + phí ship - giảm giá (không âm)
    const total = Math.max(0, subtotal + shipping_fee - discount_total);

    // 4. INSERT orders với các cột mới
    const info = db.prepare(
      `INSERT INTO orders (user_id, customer_name, phone, address, total,
                            payment_method, payment_status, shipping_fee, discount_total,
                            shipping_method_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(
      req.user.id, customer_name.trim(), phone.trim(), address.trim(), total,
      pm, shipping_fee, discount_total, method.id
    );
    const orderId = info.lastInsertRowid;

    // 5. INSERT order_items + trừ kho + ghi movement OUT cho mỗi dòng
    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, variant_sku, product_name, quantity, price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const decProductStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    const decVariantStock = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?');
    for (const l of lines) {
      insItem.run(orderId, l.product_id, l.variant_id, l.variant_sku, l.product_name, l.quantity, l.price);
      if (l.variant_id) {
        decVariantStock.run(l.quantity, l.variant_id);
        db.logStockMovement({ variant_id: l.variant_id, product_id: l.product_id, type: 'OUT', qty: l.quantity, ref_type: 'order', ref_id: orderId, note: 'Bán hàng — đơn #' + orderId });
      } else {
        decProductStock.run(l.quantity, l.product_id);
        db.logStockMovement({ product_id: l.product_id, type: 'OUT', qty: l.quantity, ref_type: 'order', ref_id: orderId, note: 'Bán hàng — đơn #' + orderId });
      }
    }

    // 6. Tăng used_count của voucher (atomic trong cùng transaction)
    if (voucherRow) {
      db.prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?').run(voucherRow.id);
    }

    // 7. Tạo payment: INSERT trực tiếp (đơn giản hơn gọi HTTP nội bộ)
    const paymentNote = pm === 'momo' ? 'Chờ webhook MoMo' : (note || '').toString().trim();
    db.prepare(
      `INSERT INTO payments (order_id, method, amount, status, note)
       VALUES (?, ?, ?, 'pending', ?)`
    ).run(orderId, pm, total, paymentNote);

    // 8. Tạo dòng shippings cho đơn (status mặc định 'preparing')
    db.prepare(
      'INSERT INTO shippings (order_id, method_id, fee) VALUES (?, ?, ?)'
    ).run(orderId, method.id, shipping_fee);

    // 9. Ghi lịch sử: đơn mới tạo, kèm danh tính khách hàng (tên + SĐT)
    db.prepare(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_name, reason)
       VALUES (?, NULL, 'pending', ?, ?)`
    ).run(
      orderId,
      `${customer_name.trim()} (${phone.trim()})`,
      `Đơn hàng mới được tạo — ${PAYMENT_LABELS[pm]}`
    );

    return orderId;
  });

  try {
    const orderId = createOrder(items);
    const payment = db.prepare('SELECT id, method, amount, status FROM payments WHERE order_id = ?').get(orderId);
    res.status(201).json({ order: getOrderWithItems(orderId), payment });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/orders — khách xem đơn của mình, admin xem tất cả (?status= để lọc)
router.get('/', auth, (req, res) => {
  const { status } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role !== 'admin') { conds.push('o.user_id = ?'); params.push(req.user.id); }
  if (status) { conds.push('o.status = ?'); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const orders = db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count,
            u.email AS user_email
     FROM orders o LEFT JOIN users u ON u.id = o.user_id
     ${where} ORDER BY o.created_at DESC`
  ).all(...params);
  res.json({ orders });
});

// GET /api/orders/:id — chủ đơn hoặc admin
router.get('/:id', auth, (req, res) => {
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (req.user.role !== 'admin' && order.user_id !== req.user.id)
    return res.status(403).json({ error: 'Bạn không có quyền xem đơn hàng này' });
  res.json({ order });
});

// PUT /api/orders/:id/status — admin cập nhật trạng thái (tuân thủ luồng chặt chẽ)
router.put('/:id/status', auth, staffOnly, (req, res) => {
  const { status, reason } = req.body || {};
  const valid = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
  if (!valid.includes(status))
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const change = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return null;
    const from = order.status;
    if (!(STATUS_FLOW[from] || []).includes(status))
      throw new Error(`Không thể chuyển đơn từ "${from}" sang "${status}"`);
    if (status === 'cancelled' && !(reason || '').trim())
      throw new Error('Hủy đơn hàng phải ghi rõ lý do');
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    // Hủy đơn → hoàn lại toàn bộ tồn kho đã trừ
    if (status === 'cancelled') restoreStock(order.id);
    writeHistory(order.id, from, status, req, (reason || '').trim());
  });

  try {
    change();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const order = getOrderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ order });
});

// DELETE /api/orders/:id — admin xóa đơn (tự động hoàn tồn kho nếu đơn chưa bị hủy)
router.delete('/:id', auth, staffOnly, (req, res) => {
  const remove = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return null;
    // Đơn chưa hủy → hoàn tồn kho trước khi xóa (đơn đã hủy kho đã hoàn)
    if (order.status !== 'cancelled') restoreStock(order.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    return order;
  });

  let order;
  try { order = remove(); } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ ok: true });
});

// ============================================================
// PUT /api/orders/:id/cancel — khách tự hủy đơn hàng của mình
// Điều kiện: đúng chủ đơn + đơn đang ở trạng thái 'pending' (chờ xác nhận).
// Transaction: status → 'cancelled', hoàn tồn kho (restoreStock đã hỗ trợ variant),
// ghi lịch sử {from:'pending', to:'cancelled', actor_name lấy từ phiên đăng nhập}.
// Lý do hủy là bắt buộc (thiếu → 400).
// ============================================================
router.put('/:id/cancel', auth, (req, res) => {
  const { reason } = req.body || {};
  if (!(reason || '').trim())
    return res.status(400).json({ error: 'Vui lòng ghi rõ lý do hủy đơn hàng' });

  let notFound = false;
  const doCancel = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) { notFound = true; return; }
    // Chỉ chủ đơn được tự hủy (admin hủy giúp khách dùng route PUT /:id/status)
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      const e = new Error('Bạn không có quyền hủy đơn hàng này');
      e.statusCode = 403;
      throw e;
    }
    // Chỉ đơn đang chờ xác nhận mới được khách tự hủy
    if (order.status !== 'pending') {
      const e = new Error(
        `Chỉ đơn hàng đang "Chờ xác nhận" mới có thể hủy (trạng thái hiện tại: "${order.status}")`
      );
      e.statusCode = 400;
      throw e;
    }
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    // Hoàn lại toàn bộ tồn kho đã trừ (hỗ trợ cả variant)
    restoreStock(order.id);
    writeHistory(order.id, 'pending', 'cancelled', req, reason.trim());
  });

  try {
    doCancel();
  } catch (e) {
    return res.status(e.statusCode || 400).json({ error: e.message });
  }
  if (notFound) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  res.json({ order: getOrderWithItems(req.params.id) });
});

// ============================================================
// PUT /api/orders/:id/shipping-info — admin sửa thông tin giao hàng
// body: { customer_name?, phone?, address? } — trường nào bỏ trống thì giữ nguyên.
// Chỉ cho đơn pending/confirmed (400 nếu đơn đã sang giai đoạn giao hàng).
// Ghi lịch sử với note 'Cập nhật thông tin giao hàng', không đổi trạng thái đơn.
// ============================================================
router.put('/:id/shipping-info', auth, staffOnly, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  if (!['pending', 'confirmed'].includes(order.status))
    return res.status(400).json({
      error: 'Chỉ đơn hàng chưa giao (Chờ xác nhận / Đã xác nhận) mới được sửa thông tin giao hàng',
    });

  const { customer_name, phone, address } = req.body || {};
  const name = (customer_name || '').toString().trim() || order.customer_name;
  const ph = (phone || '').toString().trim() || order.phone;
  const addr = (address || '').toString().trim() || order.address;

  const update = db.transaction(() => {
    db.prepare('UPDATE orders SET customer_name = ?, phone = ?, address = ? WHERE id = ?')
      .run(name, ph, addr, order.id);
    // Ghi lịch sử dạng ghi chú: from = to = trạng thái hiện tại (không đổi status)
    writeHistory(order.id, order.status, order.status, req, 'Cập nhật thông tin giao hàng');
  });
  update();

  res.json({ order: getOrderWithItems(req.params.id) });
});

module.exports = router;
