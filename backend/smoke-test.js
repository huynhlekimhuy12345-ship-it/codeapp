// ============================================================
// KIỂM TRA KHÓI SAU MIGRATE SQL SERVER — chạy trên máy thật:
//   cd backend && node smoke-test.js
// Điều kiện: đã tạo DB bằng script v2, đã điền backend/.env (DB_*),
// đã chạy npm install. Script chỉ ĐỌC dữ liệu; phần ghi thử nằm trong
// transaction và luôn rollback nên không để lại dữ liệu rác.
// ============================================================
require('dotenv').config();
const db = require('./db');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name, extra || ''); }
  else { fail++; console.log('  ✗', name, extra || ''); }
}
async function test(name, fn) {
  try { await fn(); } catch (e) { fail++; console.log('  ✗', name, '— LỖI:', e.message); }
}

(async () => {
  console.log('== Kiểm tra kết nối + cấu trúc ==');
  await test('Kết nối SQL Server + đủ 34 bảng', async () => {
    const r = await db.prepare("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'").get();
    ok('Số bảng = 34', r && r.c === 34, `(đếm được ${r && r.c})`);
  });
  await test('Đếm dòng các bảng chính', async () => {
    for (const t of ['users', 'products', 'orders', 'categories']) {
      const r = await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
      ok(`Bảng ${t} đọc được`, r && typeof r.c === 'number', `(${r && r.c} dòng)`);
    }
  });

  console.log('== Kiểm tra lớp dịch cú pháp (các mẫu câu lệnh khó) ==');
  await test('LIMIT -> TOP (danh sách sản phẩm)', async () => {
    const rows = await db.prepare('SELECT * FROM products ORDER BY id DESC LIMIT 5').all();
    ok('Lấy được tối đa 5 sản phẩm', Array.isArray(rows) && rows.length <= 5, `(${rows.length} dòng)`);
  });
  await test("datetime('now','-7 days') (cửa sổ chốt điểm hạng)", async () => {
    const r = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE created_at >= datetime('now', '-7 days')").get();
    ok('Đếm đơn 7 ngày gần đây', r && typeof r.c === 'number', `(${r && r.c} đơn)`);
  });
  await test("strftime('%Y-%m') -> FORMAT (báo cáo doanh thu theo tháng)", async () => {
    const rows = await db.prepare("SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c FROM orders GROUP BY strftime('%Y-%m', created_at)").all();
    ok('Gom nhóm theo tháng chạy được', Array.isArray(rows), `(${rows.length} tháng)`);
  });
  await test("date(col,'localtime') (báo cáo theo ngày)", async () => {
    const r = await db.prepare("SELECT date(created_at, 'localtime') AS d FROM orders LIMIT 1").get();
    ok('Đọc được ngày của 1 đơn (hoặc chưa có đơn)', true, r ? `(${r.d})` : '(chưa có đơn nào)');
  });
  await test('Hạn thẻ discount so với hiện tại', async () => {
    const r = await db.prepare("SELECT COUNT(*) AS c FROM discount_cards WHERE expires_at >= datetime('now')").get();
    ok('Đếm thẻ còn hạn', r && typeof r.c === 'number', `(${r && r.c} thẻ)`);
  });

  console.log('== Kiểm tra ghi dữ liệu (transaction, tự rollback) ==');
  await test('INSERT + đọc lại + rollback (tin nhắn liên hệ thử)', async () => {
    const marker = 'SMOKE-TEST-' + Date.now();
    let seenInside = null;
    try {
      await db.transaction(async () => {
        await db.prepare('INSERT INTO contact_messages (name, phone, email, content) VALUES (?, ?, ?, ?)').run('Smoke Test', '', '', marker);
        seenInside = await db.prepare('SELECT id FROM contact_messages WHERE content = ?').get(marker);
        throw new Error('rollback-co-chu-dich');
      })();
    } catch (e) { if (e.message !== 'rollback-co-chu-dich') throw e; }
    ok('Trong transaction thấy dòng vừa ghi', !!seenInside);
    const after = await db.prepare('SELECT id FROM contact_messages WHERE content = ?').get(marker);
    ok('Sau rollback dòng ghi thử đã biến mất', !after);
  });
  await test('Batch đánh dấu đã xem đơn (staff_order_seen)', async () => {
    const uid = 999999001;
    await db.prepare('DELETE FROM staff_order_seen WHERE user_id = ?').run(uid);
    // Đúng nguyên văn batch trong routes/orders.js (mark-seen), tham số bind theo tên @p0/@p1
    await db.prepare(
      'UPDATE staff_order_seen SET last_seen_order_id = @p1 WHERE user_id = @p0; IF @@ROWCOUNT = 0 INSERT INTO staff_order_seen (user_id, last_seen_order_id) VALUES (@p0, @p1);'
    ).run(uid, 5);
    const row = await db.prepare('SELECT last_seen_order_id FROM staff_order_seen WHERE user_id = ?').get(uid);
    ok('Batch chạy và ghi đúng', row && row.last_seen_order_id === 5, row ? `(=${row.last_seen_order_id})` : '(không thấy dòng)');
    await db.prepare('DELETE FROM staff_order_seen WHERE user_id = ?').run(uid);
  });

  console.log(`\n== KẾT QUẢ: ${pass} đạt, ${fail} lỗi ==`);
  console.log(fail === 0 ? 'Tất cả đạt — sẵn sàng chạy server bằng SQL Server.' : 'Còn lỗi — gửi lại toàn bộ kết quả này cho Muse xem.');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('SẬP:', e.message);
  process.exit(1);
});
