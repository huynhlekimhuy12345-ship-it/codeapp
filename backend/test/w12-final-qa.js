// W12 — Kiểm thử tích hợp E2E & hồi quy CUỐI (branch feat/audit-fixes)
// Chạy: node test/w12-final-qa.js
// Script tự khởi động server với DB tạm /tmp/w12-qa-test.db (KHÔNG đụng leather_shop.db),
// chạy kịch bản E2E chính + hồi quy luồng cũ, in bảng PASS/FAIL rồi tắt server.
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_DIR = path.join(__dirname, '..');
const DB_PATH = '/tmp/w12-qa-test.db';
const PORT = 5599;
const BASE = `http://127.0.0.1:${PORT}`;

// Xoá DB cũ của lần chạy trước
for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  try { fs.unlinkSync(f); } catch {}
}

const results = [];
function step(id, desc, expect, cond, actual) {
  const pass = !!cond;
  results.push({ id, desc, expect, actual: actual || '', pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${id}] ${desc}${pass ? '' : `  → KỲ VỌNG: ${expect} | THỰC TẾ: ${actual}`}`);
  return pass;
}

async function api(method, p, { token, body, query } = {}) {
  let url = BASE + p;
  if (query) url += '?' + new URLSearchParams(query).toString();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// Đọc trực tiếp DB test (để kiểm stock, movement, refunded...)
function dbq(sql, ...params) {
  const out = execFileSync('node', ['-e', `
    process.env.DB_PATH = ${JSON.stringify(DB_PATH)};
    const db = require(${JSON.stringify(BACKEND_DIR + '/db.js')});
    const rows = db.prepare(${JSON.stringify(sql)}).all(${params.map((p) => JSON.stringify(p)).join(',')});
    console.log(JSON.stringify(rows));
  `], { cwd: BACKEND_DIR });
  return JSON.parse(out.toString());
}

async function main() {
  const server = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(PORT), DB_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
    if (i === 99) throw new Error('Server không khởi động được');
  }
  console.log('== Server đã chạy, bắt đầu QA ==\n');

  const q = dbq; // alias

  try {
    // ============ SETUP ============
    console.log('--- Setup: tài khoản ---');
    let r = await api('POST', '/api/auth/register', { body: { name: 'Admin QA', email: 'admin@qa.local', password: 'matkhau1' } });
    step('S0.1', 'Đăng ký admin', '201', r.status === 201, r.status);
    r = await api('POST', '/api/auth/register', { body: { name: 'Khách QA', email: 'cust@qa.local', password: 'matkhau1' } });
    step('S0.2', 'Đăng ký customer', '201', r.status === 201, r.status);
    execFileSync('node', ['-e', `
      process.env.DB_PATH = ${JSON.stringify(DB_PATH)};
      const db = require(${JSON.stringify(BACKEND_DIR + '/db.js')});
      db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@qa.local'").run();
    `], { cwd: BACKEND_DIR });
    r = await api('POST', '/api/auth/login', { body: { email: 'admin@qa.local', password: 'matkhau1' } });
    const tokenAdmin = r.json && r.json.token;
    step('S0.3', 'Đăng nhập admin', '200 + token', r.status === 200 && !!tokenAdmin, r.status);
    r = await api('POST', '/api/auth/login', { body: { email: 'cust@qa.local', password: 'matkhau1' } });
    const tokenCust = r.json && r.json.token;
    step('S0.4', 'Đăng nhập customer', '200 + token', r.status === 200 && !!tokenCust, r.status);

    // ============ BƯỚC 1: tạo SP + variant ============
    console.log('\n--- B1: Tạo sản phẩm + variant ---');
    r = await api('POST', '/api/products', { token: tokenAdmin, body: { name: 'Ví da QA', price: 150000, stock: 0 } });
    const pid = r.json && r.json.product && r.json.product.id;
    step('E1.1', 'Admin tạo sản phẩm Ví da QA', '201 + id', r.status === 201 && !!pid, r.status);
    r = await api('POST', `/api/products/${pid}/variants`, { token: tokenAdmin, body: { sku: 'TEST-QA-1', color: 'Nâu', size: 'M', price_delta: 0, stock: 10 } });
    const vid = r.json && r.json.variant && r.json.variant.id;
    step('E1.2', 'Admin tạo variant TEST-QA-1 stock=10', '201', r.status === 201 && !!vid, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    let vrow = q('SELECT stock FROM product_variants WHERE id = ?', vid)[0];
    step('E1.3', 'Variant stock trong DB = 10', '10', vrow && vrow.stock === 10, vrow && vrow.stock);
    const mov = q("SELECT type, qty FROM stock_movements WHERE variant_id = ? AND type='IN'", vid);
    step('E1.4', 'Movement IN ghi cho variant_create', 'IN qty=10', mov.length === 1 && mov[0].qty === 10, JSON.stringify(mov));

    // ============ BƯỚC 2: voucher ============
    console.log('\n--- B2: Voucher QA20 ---');
    r = await api('POST', '/api/vouchers', { token: tokenAdmin, body: { code: 'QA20', type: 'fixed', value: 20000, min_order: 50000 } });
    const voucherId = r.json && r.json.voucher && r.json.voucher.id;
    step('E2.1', 'Admin tạo voucher QA20 fixed 20000 min 50000', '201', r.status === 201 && !!voucherId, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`);

    // Shipping method Nhanh fee 50000
    r = await api('POST', '/api/shipping/methods', { token: tokenAdmin, body: { name: 'Nhanh', fee: 50000, eta_days: 1 } });
    const shipMethodId = r.json && r.json.method && r.json.method.id;
    step('E2.2', 'Admin tạo shipping method Nhanh fee=50000', '201', r.status === 201 && !!shipMethodId, r.status);

    // ============ BƯỚC 3+4: customer đặt đơn 2 variant + voucher + bank ============
    console.log('\n--- B3/B4: Đặt đơn (2 variant + QA20 + Nhanh + bank) ---');
    r = await api('POST', '/api/orders', {
      token: tokenCust,
      body: {
        customer_name: 'Khách QA', phone: '0909000111', address: 'Số 1 Đà Nẵng',
        items: [{ product_id: pid, variant_id: vid, quantity: 2 }],
        shipping_method_id: shipMethodId,
        voucher_code: 'QA20', payment_method: 'bank',
      },
    });
    const order = r.json && r.json.order;
    const payment = r.json && r.json.payment;
    step('E4.1', 'Đặt đơn thành công', '201', r.status === 201 && !!order, `${r.status} ${(r.json && r.json.error) || ''}`);
    const expectedTotal = 2 * 150000 - 20000 + 50000; // 330000
    step('E4.2', 'Total = subtotal - 20000 + 50000', `330000`, order && order.total === expectedTotal, order && order.total);
    step('E4.3', 'discount_total = 20000', '20000', order && order.discount_total === 20000, order && order.discount_total);
    vrow = q('SELECT stock FROM product_variants WHERE id = ?', vid)[0];
    step('E4.4', 'Variant stock 10 → 8', '8', vrow && vrow.stock === 8, vrow && vrow.stock);
    const movOut = q("SELECT type, qty, ref_type FROM stock_movements WHERE variant_id = ? AND type='OUT'", vid);
    step('E4.5', 'Movement OUT qty=2 ref=order', 'OUT qty=2', movOut.length === 1 && movOut[0].qty === 2 && movOut[0].ref_type === 'order', JSON.stringify(movOut));
    step('E4.6', 'Payment pending được tạo', 'pending', payment && payment.status === 'pending', payment && payment.status);
    const shipRow = q('SELECT status, fee FROM shippings WHERE order_id = ?', order.id)[0];
    step('E4.7', 'Shippings preparing được tạo', 'preparing fee=50000', shipRow && shipRow.status === 'preparing' && shipRow.fee === 50000, JSON.stringify(shipRow));
    const vch = q('SELECT used_count FROM vouchers WHERE id = ?', voucherId)[0];
    step('E4.8', 'Voucher used_count tăng 1', '1', vch && vch.used_count === 1, vch && vch.used_count);
    const orderId = order.id;
    const paymentId = payment.id;
    const shippingId = q('SELECT id FROM shippings WHERE order_id = ?', orderId)[0].id;

    // ============ BƯỚC 5: gửi proof ============
    console.log('\n--- B5: Gửi proof_url ---');
    r = await api('PUT', `/api/payments/${paymentId}/proof`, { token: tokenCust, body: { proof_url: 'https://img.test/proof.jpg' } });
    step('E5.1', 'PUT proof_url → 200', '200', r.status === 200 && r.json.payment.proof_url === 'https://img.test/proof.jpg', `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);

    // ============ BƯỚC 6: admin verify ============
    console.log('\n--- B6: Admin verify payment ---');
    r = await api('PUT', `/api/payments/${paymentId}/verify`, { token: tokenAdmin, body: { action: 'verified', note: 'Đã nhận tiền' } });
    step('E6.1', 'Verify payment → verified', 'verified', r.status === 200 && r.json.payment.status === 'verified', `${r.status} ${r.json.payment && r.json.payment.status}`);
    const ordPay = q('SELECT payment_status FROM orders WHERE id = ?', orderId)[0];
    step('E6.2', 'orders.payment_status đồng bộ verified', 'verified', ordPay && ordPay.payment_status === 'verified', ordPay && ordPay.payment_status);

    // ============ BƯỚC 7: shipping tracking ============
    console.log('\n--- B7: Shipping tracking shipped → delivered ---');
    r = await api('PUT', `/api/shipping/${shippingId}`, { token: tokenAdmin, body: { tracking_code: 'GHN-QA-001', status: 'shipped' } });
    step('E7.1', 'Shipping → shipped (kèm tracking)', 'shipped', r.status === 200 && r.json.shipping.status === 'shipped', `${r.status} ${r.json.shipping && r.json.shipping.status}`);
    r = await api('PUT', `/api/shipping/${shippingId}`, { token: tokenAdmin, body: { status: 'delivered' } });
    step('E7.2', 'Shipping → delivered', 'delivered', r.status === 200 && r.json.shipping.status === 'delivered', `${r.status} ${r.json.shipping && r.json.shipping.status}`);
    const ordSt = q('SELECT status FROM orders WHERE id = ?', orderId)[0];
    step('E7.3', 'orders.status KHÔNG bị shipping động chạm', 'pending', ordSt && ordSt.status === 'pending', ordSt && ordSt.status);

    // ============ BƯỚC 8: state machine orders ============
    console.log('\n--- B8: Order confirmed → shipping → delivered ---');
    for (const [from, to] of [['confirmed', 'confirmed'], ['shipping', 'shipping'], ['delivered', 'delivered']]) {
      r = await api('PUT', `/api/orders/${orderId}/status`, { token: tokenAdmin, body: { status: to } });
      step(`E8.${to}`, `Order → ${to}`, to, r.status === 200 && r.json.order.status === to, `${r.status} ${(r.json.order && r.json.order.status) || (r.json && r.json.error)}`);
    }

    // ============ BƯỚC 9: return → approve → complete + refund 50000 ============
    console.log('\n--- B9: Đổi/trả hàng + refund + hoàn kho ---');
    r = await api('POST', '/api/returns', { token: tokenCust, body: { order_id: orderId, type: 'return', reason: 'Không vừa ý' } });
    const returnId = r.json && r.json.return && r.json.return.id;
    step('E9.1', 'Customer tạo return (đơn delivered)', '201', r.status === 201 && !!returnId, `${r.status} ${(r.json && r.json.error) || ''}`);
    r = await api('PUT', `/api/returns/${returnId}`, { token: tokenAdmin, body: { action: 'approved' } });
    step('E9.2', 'Admin approve return', 'approved', r.status === 200 && r.json.return.status === 'approved', `${r.status} ${(r.json.return && r.json.return.status) || (r.json && r.json.error)}`);
    r = await api('PUT', `/api/returns/${returnId}`, { token: tokenAdmin, body: { action: 'completed', refund_amount: 50000 } });
    step('E9.3', 'Admin complete + refund 50000', 'completed', r.status === 200 && r.json.return.status === 'completed', `${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
    const payRow = q('SELECT status FROM payments WHERE id = ?', paymentId)[0];
    step('E9.4', 'Payments → refunded', 'refunded', payRow && payRow.status === 'refunded', payRow && payRow.status);
    vrow = q('SELECT stock FROM product_variants WHERE id = ?', vid)[0];
    step('E9.5', 'Variant stock hoàn 8 → 10', '10', vrow && vrow.stock === 10, vrow && vrow.stock);
    const movIn = q("SELECT type, qty, ref_type, ref_id FROM stock_movements WHERE variant_id = ? AND type='IN' AND ref_type='return'", vid);
    step('E9.6', 'Movement IN (return) ghi hoàn kho', 'IN qty=2', movIn.length === 1 && movIn[0].qty === 2, JSON.stringify(movIn));

    // ============ BƯỚC 10: warranty + review ============
    console.log('\n--- B10: Warranty + review ---');
    r = await api('POST', '/api/warranties', { token: tokenCust, body: { order_id: orderId, months: 12 } });
    step('E10.1', 'Customer tạo warranty 12 tháng', '201 active', r.status === 201 && r.json.warranty && r.json.warranty.status === 'active', `${r.status} ${(r.json && r.json.error) || ''}`);
    r = await api('POST', '/api/reviews', { token: tokenCust, body: { product_id: pid, rating: 5, comment: 'Da rất đẹp!' } });
    const reviewId = r.json && r.json.review && r.json.review.id;
    step('E10.2', 'Customer tạo review cho SP', '201', r.status === 201 && !!reviewId, `${r.status} ${(r.json && r.json.error) || ''}`);
    r = await api('PUT', `/api/reviews/${reviewId}/approve`, { token: tokenAdmin, body: { is_approved: 1 } });
    step('E10.3', 'Admin duyệt review', '200', r.status === 200, r.status);
    r = await api('GET', '/api/reviews', { query: { product_id: pid } });
    step('E10.4', 'Public thấy review đã duyệt + summary', '1 review, avg=5', r.status === 200 && r.json.reviews.length === 1 && r.json.summary && r.json.summary.avg_rating === 5, `${r.status} ${JSON.stringify(r.json.summary)}`);

    // ============ BƯỚC 11: reports/summary ============
    console.log('\n--- B11: Báo cáo ---');
    r = await api('GET', '/api/reports/summary', { token: tokenAdmin });
    const s = r.json || {};
    const revOk = s.revenue_today === expectedTotal && s.revenue_month === expectedTotal;
    step('E11.1', '/api/reports/summary có số liệu', `revenue=${expectedTotal}`, r.status === 200 && revOk, `${r.status} revenue_today=${s.revenue_today} revenue_month=${s.revenue_month} orders_today=${s.orders_today} customers=${s.customers_count}`);
    step('E11.2', 'customers_count >= 1', '>=1', s.customers_count >= 1, s.customers_count);

    // ============ HỒI QUY LUỒNG CŨ ============
    console.log('\n--- HỒI QUY: luồng cũ ---');
    // R1: CRUD danh mục
    r = await api('POST', '/api/categories', { token: tokenAdmin, body: { name: 'Danh mục QA', description: 'test' } });
    const catId = r.json && r.json.category && r.json.category.id;
    step('R1.1', 'CRUD: tạo danh mục', '201', r.status === 201 && !!catId, r.status);
    r = await api('PUT', `/api/categories/${catId}`, { token: tokenAdmin, body: { name: 'Danh mục QA2', description: 'test' } });
    step('R1.2', 'CRUD: sửa danh mục', '200', r.status === 200, r.status);
    r = await api('DELETE', `/api/categories/${catId}`, { token: tokenAdmin });
    step('R1.3', 'CRUD: xóa danh mục', '200', r.status === 200, r.status);

    // R2: CRUD sản phẩm cũ
    r = await api('POST', '/api/products', { token: tokenAdmin, body: { name: 'SP cũ QA', price: 100000, stock: 5 } });
    const oldPid = r.json && r.json.product && r.json.product.id;
    step('R2.1', 'CRUD: tạo SP', '201', r.status === 201 && !!oldPid, r.status);
    r = await api('GET', `/api/products/${oldPid}`);
    step('R2.2', 'Xem chi tiết SP (public)', '200', r.status === 200, r.status);
    r = await api('PUT', `/api/products/${oldPid}`, { token: tokenAdmin, body: { name: 'SP cũ QA', price: 100000, stock: 5 } });
    step('R2.3', 'CRUD: sửa SP', '200', r.status === 200, r.status);

    // R3: đặt đơn KHÔNG variant → trừ products.stock
    r = await api('POST', '/api/orders', {
      token: tokenCust,
      body: {
        customer_name: 'Khách QA', phone: '0909000111', address: 'Số 1 Đà Nẵng',
        items: [{ product_id: oldPid, quantity: 2 }],
        shipping_method_id: shipMethodId, payment_method: 'cod',
      },
    });
    const oldOrder = r.json && r.json.order;
    step('R3.1', 'Đặt đơn không variant', '201', r.status === 201 && !!oldOrder, `${r.status} ${(r.json && r.json.error) || ''}`);
    const pStock = q('SELECT stock FROM products WHERE id = ?', oldPid)[0];
    step('R3.2', 'products.stock 5 → 3', '3', pStock && pStock.stock === 3, pStock && pStock.stock);

    // R4: hủy đơn pending → hoàn kho cũ
    r = await api('PUT', `/api/orders/${oldOrder.id}/status`, { token: tokenAdmin, body: { status: 'cancelled', reason: 'Test hủy' } });
    step('R4.1', 'Hủy đơn pending (admin)', 'cancelled', r.status === 200 && r.json.order.status === 'cancelled', `${r.status} ${(r.json && r.json.error) || ''}`);
    const pStock2 = q('SELECT stock FROM products WHERE id = ?', oldPid)[0];
    step('R4.2', 'products.stock hoàn 3 → 5', '5', pStock2 && pStock2.stock === 5, pStock2 && pStock2.stock);

    // R5: đăng nhập admin / phân quyền cũ
    r = await api('POST', '/api/auth/login', { body: { email: 'cust@qa.local', password: 'matkhau1' } });
    step('R5.1', 'Customer KHÔNG gọi được API admin (vouchers)', '403', (await api('GET', '/api/vouchers', { token: r.json.token })).status === 403, '');
    r = await api('GET', '/api/orders', { token: tokenAdmin });
    step('R5.2', 'Admin xem được tất cả đơn', '200', r.status === 200 && Array.isArray(r.json.orders), r.status);
    r = await api('POST', '/api/products', { body: { name: 'X', price: 1 } });
    step('R5.3', 'Không token → 401', '401', r.status === 401, r.status);

    // R6: đặt đơn vượt kho → 400 (hành vi cũ)
    r = await api('POST', '/api/orders', {
      token: tokenCust,
      body: {
        customer_name: 'K', phone: '0909', address: 'A',
        items: [{ product_id: oldPid, quantity: 99 }],
        shipping_method_id: shipMethodId, payment_method: 'cod',
      },
    });
    step('R6.1', 'Đặt quá kho → 400', '400', r.status === 400, `${r.status} ${(r.json && r.json.error) || ''}`);

    // R7: trạng thái sai luồng → 400
    r = await api('POST', '/api/orders', {
      token: tokenCust,
      body: {
        customer_name: 'K', phone: '0909', address: 'A',
        items: [{ product_id: oldPid, quantity: 1 }],
        shipping_method_id: shipMethodId, payment_method: 'cod',
      },
    });
    const o2 = r.json.order;
    r = await api('PUT', `/api/orders/${o2.id}/status`, { token: tokenAdmin, body: { status: 'delivered' } });
    step('R7.1', 'Nhảy pending → delivered bị chặn', '400', r.status === 400, `${r.status} ${(r.json && r.json.error) || ''}`);

    // R8: hủy đơn đã delivered bị chặn
    r = await api('PUT', `/api/orders/${orderId}/status`, { token: tokenAdmin, body: { status: 'cancelled', reason: 'x' } });
    step('R8.1', 'Hủy đơn delivered bị chặn', '400', r.status === 400, `${r.status} ${(r.json && r.json.error) || ''}`);

    // R9: duplicate SKU → 409
    r = await api('POST', `/api/products/${pid}/variants`, { token: tokenAdmin, body: { sku: 'TEST-QA-1', stock: 1 } });
    step('R9.1', 'Trùng SKU → 409', '409', r.status === 409, r.status);

    // R10: sửa stock variant trực tiếp → 400
    r = await api('PUT', `/api/products/variants/${vid}`, { token: tokenAdmin, body: { stock: 99 } });
    step('R10.1', 'Sửa stock variant trực tiếp → 400', '400', r.status === 400, `${r.status} ${(r.json && r.json.error) || ''}`);

    // R11: return cho đơn chưa delivered → 403
    r = await api('POST', '/api/returns', { token: tokenCust, body: { order_id: o2.id, type: 'return', reason: 'test' } });
    step('R11.1', 'Return đơn chưa delivered → 403', '403', r.status === 403, `${r.status} ${(r.json && r.json.error) || ''}`);

    console.log('\n== Kết quả ==');
  } catch (e) {
    console.log('\nLỖI NGOẠI LỆ TRONG SCRIPT: ' + e.message + '\n' + e.stack);
  } finally {
    const pass = results.filter((x) => x.pass).length;
    const fail = results.filter((x) => !x.pass).length;
    console.log(`\n### TỔNG: ${pass} PASS / ${fail} FAIL (tổng ${results.length})`);
    server.kill('SIGTERM');
  }
}

main();
