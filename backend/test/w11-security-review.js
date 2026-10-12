// W11 — Kiểm chứng bảo mật & phân quyền (subagent review, không push git)
// Chạy: node test/w11-security-review.js
// Script tự khởi động server với DB tạm (/tmp), chạy 30+ case rồi tắt server.
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_DIR = __dirname + '/..';
const DB_PATH = '/tmp/w11-security-test.db';
const PORT = 5588;
const BASE = `http://127.0.0.1:${PORT}`;

// Xoá DB cũ của lần chạy trước
for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  try { fs.unlinkSync(f); } catch {}
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${detail && !cond ? '  → ' + detail : ''}`);
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
  return { status: res.status, json, text: json ? JSON.stringify(json) : '' };
}

async function main() {
  const server = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(PORT), DB_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

  // Chờ server sẵn sàng
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    if (i === 99) throw new Error('Server không khởi động được');
  }
  console.log('== Server đã chạy, bắt đầu test ==\n');

  try {
    // ---------- Setup: 2 customer + 1 admin ----------
    console.log('-- Setup tài khoản --');
    let r = await api('POST', '/api/auth/register', { body: { name: 'Khach A', email: 'a@test.local', password: 'matkhau1' } });
    check('Đăng ký customer A (201)', r.status === 201, r.status);
    r = await api('POST', '/api/auth/register', { body: { name: 'Khach B', email: 'b@test.local', password: 'matkhau1' } });
    check('Đăng ký customer B (201)', r.status === 201, r.status);
    r = await api('POST', '/api/auth/register', { body: { name: 'Admin', email: 'admin@test.local', password: 'matkhau1' } });
    check('Đăng ký user admin (201)', r.status === 201, r.status);

    // Nâng quyền admin trực tiếp trong DB (mô phỏng admin có sẵn)
    execFileSync('node', ['-e', `
      process.env.DB_PATH = ${JSON.stringify(DB_PATH)};
      const db = require(${JSON.stringify(BACKEND_DIR + '/db.js')});
      db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@test.local'").run();
    `], { cwd: BACKEND_DIR });
    console.log('  (đã nâng admin@test.local thành admin trong DB)');

    const login = async (email) =>
      (await api('POST', '/api/auth/login', { body: { email, password: 'matkhau1' } }));
    r = await login('a@test.local'); const tokenA = r.json.token;
    check('Login A (200 + token)', r.status === 200 && !!tokenA, r.status);
    r = await login('b@test.local'); const tokenB = r.json.token;
    check('Login B (200 + token)', r.status === 200 && !!tokenB, r.status);
    r = await login('admin@test.local'); const tokenAdmin = r.json.token;
    check('Login admin (200 + token)', r.status === 200 && !!tokenAdmin, r.status);

    // Admin tạo dữ liệu nền: phương thức ship + 2 sản phẩm
    r = await api('POST', '/api/shipping/methods', { token: tokenAdmin, body: { name: 'Giao nhanh', fee: 30000, eta_days: 2 } });
    check('Admin tạo shipping method (201)', r.status === 201, r.status);
    const shipMethodId = r.json.method.id;
    r = await api('POST', '/api/products', { token: tokenAdmin, body: { name: 'Ví da bò', price: 500000, stock: 10 } });
    check('Admin tạo sản phẩm P1 (201)', r.status === 201, r.status);
    const p1 = r.json.product.id;
    r = await api('POST', '/api/products', { token: tokenAdmin, body: { name: 'Thắt lưng da', price: 300000, stock: 10 } });
    check('Admin tạo sản phẩm P2 (201)', r.status === 201, r.status);
    const p2 = r.json.product.id;

    // A đặt đơn → admin đẩy tới delivered (để test return/warranty)
    r = await api('POST', '/api/orders', {
      token: tokenA,
      body: { customer_name: 'Khach A', phone: '0901', address: 'Hà Nội',
              items: [{ product_id: p1, quantity: 1 }],
              shipping_method_id: shipMethodId, payment_method: 'cod' },
    });
    check('A đặt đơn hàng (201)', r.status === 201, r.status + ' ' + (r.json.error || ''));
    const orderA = r.json.order.id;
    const paymentA = r.json.payment.id;
    for (const st of ['confirmed', 'shipping', 'delivered']) {
      r = await api('PUT', `/api/orders/${orderA}/status`, { token: tokenAdmin, body: { status: st } });
    }
    check('Admin đẩy đơn A tới delivered', r.status === 200 && r.json.order.status === 'delivered', r.status);

    console.log('\n-- 1. Admin endpoints: customer bị chặn, thiếu token bị 401 --');
    r = await api('GET', '/api/reports/summary', { token: tokenB });
    check('Customer GET /api/reports/summary → 403', r.status === 403, r.status);
    r = await api('GET', '/api/reports/summary');
    check('Không token GET /api/reports/summary → 401', r.status === 401, r.status);
    r = await api('POST', '/api/inventory/suppliers', { token: tokenB, body: { name: 'NCC X' } });
    check('Customer POST /api/inventory/suppliers → 403', r.status === 403, r.status);
    r = await api('POST', '/api/inventory/suppliers', { body: { name: 'NCC X' } });
    check('Không token POST /api/inventory/suppliers → 401', r.status === 401, r.status);
    r = await api('GET', '/api/vouchers', { token: tokenB });
    check('Customer GET /api/vouchers → 403', r.status === 403, r.status);
    r = await api('POST', '/api/vouchers', { token: tokenB, body: { code: 'X', type: 'percent', value: 10 } });
    check('Customer POST /api/vouchers → 403', r.status === 403, r.status);
    r = await api('POST', '/api/shipping/methods', { token: tokenB, body: { name: 'X', fee: 1 } });
    check('Customer POST /api/shipping/methods → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/payments/${paymentA}/verify`, { token: tokenB, body: { action: 'verified' } });
    check('Customer PUT /api/payments/:id/verify → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/users/${1}/role`, { token: tokenB, body: { role: 'admin' } });
    check('Customer PUT /api/users/:id/role → 403', r.status === 403, r.status);
    r = await api('POST', `/api/products/${p1}/variants`, { token: tokenB, body: { sku: 'HACK-1' } });
    check('Customer POST /api/products/:id/variants → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/orders/${orderA}/shipping-info`, { token: tokenB, body: { address: 'HACK' } });
    check('Customer PUT /api/orders/:id/shipping-info → 403', r.status === 403, r.status);

    console.log('\n-- 2. Customer isolation: A tạo, B vượt quyền phải 403 --');
    // Review: A tạo → B xóa → 403; B sửa → 403; A tự xóa → 200
    r = await api('POST', '/api/reviews', { token: tokenA, body: { product_id: p1, rating: 5, comment: 'Rất tốt' } });
    check('A tạo review (201)', r.status === 201, r.status + ' ' + (r.json.error || ''));
    const reviewA = r.json.review.id;
    r = await api('DELETE', `/api/reviews/${reviewA}`, { token: tokenB });
    check('B xóa review của A → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/reviews/${reviewA}`, { token: tokenB, body: { rating: 1, comment: 'hack' } });
    check('B sửa review của A → 403', r.status === 403, r.status);
    r = await api('DELETE', `/api/reviews/${reviewA}`, { token: tokenA });
    check('A tự xóa review của mình (200)', r.status === 200, r.status);
    // Admin xóa review của người khác → 200 (hợp lệ)
    r = await api('POST', '/api/reviews', { token: tokenA, body: { product_id: p1, rating: 4, comment: 'OK' } });
    const reviewA2 = r.json.review.id;
    r = await api('DELETE', `/api/reviews/${reviewA2}`, { token: tokenAdmin });
    check('Admin xóa review của A (200)', r.status === 200, r.status);

    // Đơn hàng: B xem đơn A → 403; B hủy đơn A → 403; B xem vận đơn đơn A → rỗng
    r = await api('GET', `/api/orders/${orderA}`, { token: tokenB });
    check('B xem đơn của A → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/orders/${orderA}/cancel`, { token: tokenB, body: { reason: 'hack' } });
    check('B hủy đơn của A → 403', r.status === 403, r.status);
    r = await api('GET', '/api/shipping', { token: tokenB, query: { order_id: orderA } });
    check('B xem vận đơn đơn A → danh sách rỗng', r.status === 200 && r.json.shippings.length === 0, r.status + ' n=' + (r.json.shippings || []).length);
    r = await api('GET', '/api/orders', { token: tokenB });
    check('B list đơn → chỉ thấy đơn của mình', r.status === 200 && !r.json.orders.some((o) => o.id === orderA), 'n=' + r.json.orders.length);

    // Payment: B xem payment của A → 403; B tạo payment cho đơn A → 403; B gửi proof → 403
    r = await api('GET', `/api/payments/${paymentA}`, { token: tokenB });
    check('B xem payment của A → 403', r.status === 403, r.status);
    r = await api('POST', '/api/payments', { token: tokenB, body: { order_id: orderA, method: 'bank' } });
    check('B tạo payment cho đơn A → 403', r.status === 403, r.status);
    r = await api('PUT', `/api/payments/${paymentA}/proof`, { token: tokenB, body: { proof_url: 'http://x/y.png' } });
    check('B gửi proof cho payment của A → 403', r.status === 403, r.status);
    r = await api('GET', '/api/payments', { token: tokenB, query: { order_id: orderA } });
    check('B lọc payment theo order_id của A → rỗng', r.status === 200 && r.json.payments.length === 0, r.status);

    // Return: A tạo → B xem → 403; B tạo cho đơn A → 403
    r = await api('POST', '/api/returns', { token: tokenA, body: { order_id: orderA, type: 'return', reason: 'Lỗi da' } });
    check('A tạo yêu cầu đổi/trả (201)', r.status === 201, r.status + ' ' + (r.json.error || ''));
    const returnA = r.json.return.id;
    r = await api('GET', `/api/returns/${returnA}`, { token: tokenB });
    check('B xem yêu cầu đổi/trả của A → 403', r.status === 403, r.status);
    r = await api('POST', '/api/returns', { token: tokenB, body: { order_id: orderA, type: 'return', reason: 'hack' } });
    check('B tạo đổi/trả cho đơn A → 403', r.status === 403, r.status);

    // Warranty: A tạo → B list không thấy; B tạo cho đơn A → 403
    r = await api('POST', '/api/warranties', { token: tokenA, body: { order_id: orderA, months: 12 } });
    check('A tạo bảo hành cho đơn đã giao (201)', r.status === 201, r.status + ' ' + (r.json.error || ''));
    r = await api('GET', '/api/warranties', { token: tokenB });
    check('B list warranty → không thấy của A', r.status === 200 && r.json.warranties.length === 0, 'n=' + r.json.warranties.length);
    r = await api('POST', '/api/warranties', { token: tokenB, body: { order_id: orderA, months: 12 } });
    check('B tạo bảo hành cho đơn A → 403', r.status === 403, r.status);

    // Repair: A tạo → B list không thấy; B tạo gắn đơn A → 403
    r = await api('POST', '/api/repairs', { token: tokenA, body: { order_id: orderA, description: 'Bong chỉ' } });
    check('A tạo phiếu sửa chữa (201)', r.status === 201, r.status + ' ' + (r.json.error || ''));
    r = await api('GET', '/api/repairs', { token: tokenB });
    check('B list repair → không thấy của A', r.status === 200 && r.json.repairs.length === 0, 'n=' + r.json.repairs.length);
    r = await api('POST', '/api/repairs', { token: tokenB, body: { order_id: orderA, description: 'hack' } });
    check('B tạo phiếu sửa chữa gắn đơn A → 403', r.status === 403, r.status);

    console.log('\n-- 3. Không lộ password_hash --');
    r = await api('GET', '/api/users/me', { token: tokenA });
    check('GET /api/users/me không lộ password_hash', r.status === 200 && !r.text.includes('password_hash'), r.status);
    r = await api('GET', '/api/auth/me', { token: tokenA });
    check('GET /api/auth/me không lộ password_hash', r.status === 200 && !r.text.includes('password_hash'), r.status);
    r = await api('GET', '/api/users', { token: tokenAdmin });
    check('GET /api/users (admin) không lộ password_hash', r.status === 200 && !r.text.includes('password_hash'), r.status);
    r = await api('POST', '/api/auth/login', { body: { email: 'a@test.local', password: 'matkhau1' } });
    check('Response login không lộ password_hash', r.status === 200 && !r.text.includes('password_hash'), r.status);
    r = await api('POST', '/api/auth/register', { body: { name: 'C', email: 'c@test.local', password: 'matkhau1' } });
    check('Response register không lộ password_hash', r.status === 201 && !r.text.includes('password_hash'), r.status);

    console.log('\n-- 4. SQL injection (better-sqlite3 prepared, kiểm tra không nối chuỗi thô) --');
    // Đếm số lần login đã thực hiện trước brute-force (mỗi lần đều tốn quota 10/phút):
    // login A, B, admin (3) + login check ở mục 3 (1) = 4
    let loginCount = 4;
    r = await api('POST', '/api/auth/login', { body: { email: "' OR '1'='1", password: 'x' } });
    loginCount += 1;
    check("Login SQLi \"' OR '1'='1\" → 401 (không đăng nhập được)", r.status === 401, r.status);
    check('Response SQLi không lộ password_hash', !r.text.includes('password_hash'));
    r = await api('GET', '/api/products', { query: { search: "' OR '1'='1' --" } });
    check('Search SQLi trả 200, JSON hợp lệ', r.status === 200 && Array.isArray(r.json.products), r.status);
    r = await api('GET', '/api/products', { query: { sort: "price;DROP TABLE users" } });
    check('Sort injection bị allowlist chặn → 200 bình thường', r.status === 200 && Array.isArray(r.json.products), r.status);

    console.log('\n-- 5. Validate đầu vào (số âm, giá trị ngoài biên) --');
    r = await api('POST', '/api/vouchers', { token: tokenAdmin, body: { code: 'T150', type: 'percent', value: 150 } });
    check('Voucher percent 150% → 400', r.status === 400, r.status);
    r = await api('POST', '/api/vouchers', { token: tokenAdmin, body: { code: 'T-5', type: 'fixed', value: -5 } });
    check('Voucher value âm → 400', r.status === 400, r.status);
    r = await api('POST', '/api/reviews', { token: tokenA, body: { product_id: p2, rating: 10, comment: 'x' } });
    check('Review rating 10 → 400', r.status === 400, r.status);
    r = await api('POST', '/api/inventory/adjust', { token: tokenAdmin, body: { product_id: p2, qty: 0, note: 'x' } });
    check('Điều chỉnh kho qty=0 → 400', r.status === 400, r.status);
    r = await api('PUT', `/api/repairs/${1}`, { token: tokenAdmin, body: { status: 'hack', fee: -5 } });
    check('Repair status lạ + fee âm → 400', r.status === 400, r.status);
    r = await api('POST', '/api/vouchers/validate', { token: tokenB, body: { code: 'KHONGTONTAI', order_total: 100 } });
    check('Customer validate voucher lạ → 200 valid:false (auth thường, không cần admin)', r.status === 200 && r.json.valid === false, r.status);

    console.log('\n-- 6. Brute-force login → 429 sau 10 lần/phút/IP --');
    const brute = [];
    for (let i = 0; i < 15; i++) {
      const rr = await api('POST', '/api/auth/login', { body: { email: 'a@test.local', password: 'sai-mat-khau' } });
      brute.push(rr.status);
    }
    const allowedBefore = 10 - loginCount; // số lần còn được phép trước khi chạm 429
    const first429Idx = brute.findIndex((s) => s === 429);
    check(`10 lần/phút/IP: ${allowedBefore} lần đầu → 401`, brute.slice(0, allowedBefore).every((s) => s === 401), brute.join(','));
    check('Các lần sau → 429', first429Idx === allowedBefore && brute.slice(allowedBefore).every((s) => s === 429), brute.join(','));
    const rr429 = await api('POST', '/api/auth/login', { body: { email: 'a@test.local', password: 'sai' } });
    check('Response 429 có message tiếng Việt', rr429.status === 429 && /Quá nhiều/.test(rr429.text), rr429.status);

    console.log('\n-- 7. Admin vẫn hoạt động bình thường (sanity) --');
    r = await api('GET', '/api/reports/summary', { token: tokenAdmin });
    check('Admin GET /api/reports/summary → 200', r.status === 200, r.status);
    r = await api('GET', `/api/payments/${paymentA}`, { token: tokenAdmin });
    check('Admin xem payment bất kỳ → 200', r.status === 200, r.status);
    r = await api('GET', '/api/shipping/methods', { token: tokenAdmin, query: { all: '1' } });
    check('Admin GET /api/shipping/methods?all=1 → 200', r.status === 200, r.status);
    r = await api('GET', '/api/shipping/methods');
    check('Public GET /api/shipping/methods → 200 (checkout)', r.status === 200, r.status);

    const fails = results.filter((x) => !x.pass);
    console.log(`\n==== KẾT QUẢ: ${results.length - fails.length}/${results.length} PASS ====`);
    if (fails.length) {
      console.log('FAIL:');
      fails.forEach((f) => console.log(' - ' + f.name + (f.detail ? ' → ' + f.detail : '')));
    }
    process.exitCode = fails.length ? 1 : 0;
  } finally {
    server.kill();
  }
}

main().catch((e) => { console.error('LỖI TEST:', e); process.exit(2); });
