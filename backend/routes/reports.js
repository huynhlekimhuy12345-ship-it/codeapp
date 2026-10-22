// Báo cáo & thống kê cho dashboard admin — TẤT CẢ route đều yêu cầu đăng nhập admin.
// Tất cả query đều dùng aggregate SQL, không lặp query trong vòng lặp (hiệu năng).
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Bảo vệ toàn bộ router báo cáo: chỉ admin
router.use(auth, staffOnly);

// Ngày tháng trong created_at lưu theo giờ UTC (datetime('now')); 'localtime' giúp
// "hôm nay / tháng này" khớp giờ Việt Nam hiển thị trên giao diện.
const LOCAL = `date('now', 'localtime')`;

// Ngưỡng tồn kho mặc định cho cảnh báo sắp hết
const DEFAULT_THRESHOLD = 5;

// Kiểm tra chuỗi ngày YYYY-MM-DD hợp lệ (tháng/ngày tồn tại thật)
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// GET /api/reports/summary — tổng quan dashboard:
// doanh thu hôm nay / tháng này (chỉ đơn đã hoàn tất thanh toán: payment verified;
// đơn cancelled / hoàn tiền (refunded) không tính),
// số đơn hôm nay, số đơn chờ xử lý, số SP sắp hết, số khách hàng
router.get('/summary', (req, res) => {
  // Khoản hoàn từ đổi/trả đã hoàn tất, tính trên cùng tập đơn (đơn còn 'verified';
  // đơn hoàn toàn bộ đã chuyển 'refunded' nên tự bị loại, không trừ 2 lần)
  const refundOf = (dateCond) => db.prepare(
    `SELECT COALESCE(SUM(r.refund_amount), 0) AS v
     FROM returns r JOIN orders o ON o.id = r.order_id
     WHERE r.status = 'completed' AND o.payment_status = 'verified' AND o.status != 'cancelled'
       AND ${dateCond}`
  ).get().v;
  const revenue_today = db.prepare(
    `SELECT COALESCE(SUM(total), 0) AS v FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND date(created_at, 'localtime') = ${LOCAL}`
  ).get().v - refundOf(`date(o.created_at, 'localtime') = ${LOCAL}`);
  const revenue_month = db.prepare(
    `SELECT COALESCE(SUM(total), 0) AS v FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', ${LOCAL})`
  ).get().v - refundOf(`strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', ${LOCAL})`);
  const orders_today = db.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE date(created_at, 'localtime') = ${LOCAL}`
  ).get().n;
  const orders_pending = db.prepare(
    `SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'`
  ).get().n;
  // Đếm cả sản phẩm và biến thể (mỗi SKU là 1 dòng tồn kho)
  const products_low_stock_count =
    db.prepare(`SELECT COUNT(*) AS n FROM products WHERE stock <= ?`).get(DEFAULT_THRESHOLD).n +
    db.prepare(`SELECT COUNT(*) AS n FROM product_variants WHERE stock <= ?`).get(DEFAULT_THRESHOLD).n;
  const customers_count = db.prepare(
    `SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`
  ).get().n;

  res.json({
    revenue_today: Number(revenue_today) || 0,
    revenue_month: Number(revenue_month) || 0,
    orders_today,
    orders_pending,
    products_low_stock_count,
    customers_count,
  });
});

// GET /api/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|month
// Doanh thu thực tế: chỉ đơn đã hoàn tất thanh toán (payment_status = 'verified';
// đơn cancelled / hoàn tiền không tính).
// Trả về đủ mọi ngày/tháng trong khoảng (ngày không có đơn => revenue 0) để vẽ biểu đồ.
router.get('/revenue', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const from = req.query.from || firstOfMonth;
  const to = req.query.to || today;
  const group = req.query.group === 'month' ? 'month' : 'day';

  if (!isValidDate(from) || !isValidDate(to))
    return res.status(400).json({ error: 'Ngày không hợp lệ, dùng định dạng YYYY-MM-DD' });
  if (from > to)
    return res.status(400).json({ error: '"from" phải nhỏ hơn hoặc bằng "to"' });

  const fmt = group === 'month' ? '%Y-%m' : '%Y-%m-%d';
  // 1 query aggregate duy nhất cho cả khoảng
  const rows = db.prepare(
    `SELECT strftime(?, created_at, 'localtime') AS label,
            COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
     FROM orders
     WHERE payment_status = 'verified' AND status != 'cancelled'
       AND date(created_at, 'localtime') >= date(?) AND date(created_at, 'localtime') <= date(?)
     GROUP BY label`
  ).all(fmt, from, to);
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

  // Khoản hoàn đổi/trả theo cùng nhãn thời gian (tính theo ngày của đơn gốc)
  const refundRows = db.prepare(
    `SELECT strftime(?, o.created_at, 'localtime') AS label,
            COALESCE(SUM(r.refund_amount), 0) AS refund
     FROM returns r JOIN orders o ON o.id = r.order_id
     WHERE r.status = 'completed' AND o.payment_status = 'verified' AND o.status != 'cancelled'
       AND date(o.created_at, 'localtime') >= date(?) AND date(o.created_at, 'localtime') <= date(?)
     GROUP BY label`
  ).all(fmt, from, to);
  const refundByLabel = Object.fromEntries(refundRows.map((r) => [r.label, Number(r.refund) || 0]));

  // Lấp khoảng trống: sinh chuỗi nhãn từ from đến to (JS thuần, không query thêm)
  const labels = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  const seen = new Set();
  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const mo = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(cursor.getUTCDate()).padStart(2, '0');
    const label = group === 'month' ? `${y}-${mo}` : `${y}-${mo}-${dy}`;
    if (!seen.has(label)) { seen.add(label); labels.push(label); }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  res.json(labels.map((label) => ({
    label,
    revenue: Math.max(0, (Number(byLabel[label]?.revenue) || 0) - (refundByLabel[label] || 0)),
    orders: Number(byLabel[label]?.orders) || 0,
  })));
});

// GET /api/reports/top-products?limit=10 — sản phẩm bán chạy nhất,
// tính từ order_items của đơn đã hoàn tất thanh toán
router.get('/top-products', (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const rows = db.prepare(
    `SELECT oi.product_name,
            SUM(oi.quantity) AS qty_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.payment_status = 'verified' AND o.status != 'cancelled'
     GROUP BY oi.product_name
     ORDER BY qty_sold DESC
     LIMIT ?`
  ).all(limit);
  // Trừ phần đã đổi/trả hoàn tất để số bán chạy phản ánh lượng bán thực
  const returned = db.prepare(
    `SELECT ri.product_name,
            COALESCE(SUM(ri.quantity), 0) AS qty,
            COALESCE(SUM(ri.quantity * ri.price), 0) AS revenue
     FROM return_items ri JOIN returns r ON r.id = ri.return_id
     WHERE r.status = 'completed'
     GROUP BY ri.product_name`
  ).all();
  const returnedMap = Object.fromEntries(returned.map((x) => [x.product_name, x]));
  res.json(rows.map((r) => {
    const back = returnedMap[r.product_name] || { qty: 0, revenue: 0 };
    return {
      product_name: r.product_name,
      qty_sold: Math.max(0, (Number(r.qty_sold) || 0) - (Number(back.qty) || 0)),
      revenue: Math.max(0, (Number(r.revenue) || 0) - (Number(back.revenue) || 0)),
    };
  }).filter((r) => r.qty_sold > 0));
});

// GET /api/reports/low-stock?threshold=5 — sản phẩm & biến thể sắp hết hàng (kèm SKU)
router.get('/low-stock', (req, res) => {
  const threshold = Math.max(0, parseInt(req.query.threshold) || DEFAULT_THRESHOLD);
  const products = db.prepare(
    `SELECT id, name AS product_name, NULL AS sku, stock, 'product' AS type
     FROM products WHERE stock <= ?`
  ).all(threshold);
  const variants = db.prepare(
    `SELECT pv.id, p.name AS product_name, pv.sku, pv.stock, 'variant' AS type
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.stock <= ?`
  ).all(threshold);
  res.json([...products, ...variants].sort((a, b) => a.stock - b.stock));
});

// GET /api/reports/orders-by-status — phân bố đơn theo trạng thái
router.get('/orders-by-status', (req, res) => {
  const rows = db.prepare(
    `SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC`
  ).all();
  res.json(rows.map((r) => ({ status: r.status, count: r.count })));
});

// GET /api/reports/payments-by-method — thống kê thanh toán theo phương thức.
// Chỉ tính giao dịch đã hoàn tất (verified); chờ duyệt / thất bại / hoàn tiền không tính.
// Trả về mảng rỗng khi chưa có giao dịch payments nào.
router.get('/payments-by-method', (req, res) => {
  const rows = db.prepare(
    `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM payments WHERE status = 'verified' GROUP BY method ORDER BY count DESC`
  ).all();
  // Trừ khoản hoàn một phần của các đơn còn 'verified' (đơn hoàn toàn bộ đã
  // chuyển payment sang 'refunded' nên không nằm trong tổng gốc, tránh trừ 2 lần)
  const refunds = db.prepare(
    `SELECT p.method, COALESCE(SUM(r.refund_amount), 0) AS refund
     FROM returns r JOIN payments p ON p.order_id = r.order_id
     WHERE r.status = 'completed' AND p.status = 'verified'
     GROUP BY p.method`
  ).all();
  const refundMap = Object.fromEntries(refunds.map((x) => [x.method, Number(x.refund) || 0]));
  res.json(rows.map((r) => ({
    method: r.method,
    count: r.count,
    total: Math.max(0, (Number(r.total) || 0) - (refundMap[r.method] || 0)),
  })));
});

module.exports = router;
