// Server chính: Express + API routes + phục vụ frontend build
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Trên Vercel (DB_PATH trỏ vào /tmp): chép file DB đóng gói kèm repo sang nếu /tmp chưa có
try {
  const dbTarget = process.env.DB_PATH;
  const dbBundled = path.join(__dirname, 'leather_shop.db');
  if (dbTarget && !fs.existsSync(dbTarget) && fs.existsSync(dbBundled) && path.resolve(dbTarget) !== path.resolve(dbBundled)) {
    fs.copyFileSync(dbBundled, dbTarget);
  }
} catch (e) { console.error('Không chép được DB đóng gói:', e.message); }

const db = require('./db'); // khởi tạo DB

// DB trống (chưa có user nào) thì tự seed dữ liệu mẫu
try {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) require('./seed');
} catch (e) { console.error('Auto-seed thất bại:', e.message); }

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: mặc định phản chiếu origin (dev); production nên đặt CORS_ORIGIN=https://domain1,https://domain2
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '8mb' })); // đủ chỗ cho ảnh minh họa (base64) của yêu cầu hậu mãi

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/returns', require('./routes/returns')); // đổi/trả hàng (khách yêu cầu, admin xử lý)
app.use('/api/warranties', require('./routes/warranties')); // bảo hành (khách tạo, admin quản lý)
app.use('/api/repairs', require('./routes/repairs')); // sửa chữa đồ da
app.use('/api/inventory', require('./routes/inventory')); // tồn kho, NCC, phiếu nhập
app.use('/api/payments', require('./routes/payments')); // thanh toán
app.use('/api/shipping', require('./routes/shipping')); // vận chuyển
app.use('/api/vouchers', require('./routes/vouchers')); // khuyến mãi
app.use('/api/promo-events', require('./routes/promo-events')); // sự kiện khuyến mãi
app.use('/api/reviews', require('./routes/reviews')); // đánh giá sản phẩm
app.use('/api/reports', require('./routes/reports')); // báo cáo, thống kê
app.use('/api/announcements', require('./routes/announcements')); // thông báo / tin tức
app.use('/api/chat', require('./routes/chat')); // nhắn tin khách hàng + nội bộ
app.use('/api/notifications', require('./routes/notifications')); // thông báo riêng từng tài khoản (chuông)
app.use('/api/loyalty', require('./routes/loyalty')); // hạng khách hàng + thẻ discount theo tháng
app.use('/api/hunt-events', require('./routes/hunt-events')); // sự kiện săn thẻ ở trang Khuyến mãi (chỉ Admin tạo)

// Kiểm tra sức khỏe server
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Phục vụ frontend đã build (nếu có thư mục ../frontend/dist)
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Không tìm thấy API' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
