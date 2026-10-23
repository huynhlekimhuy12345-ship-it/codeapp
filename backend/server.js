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

// API routes — nạp cách ly từng route: route nào lỗi trên môi trường deploy
// thì bỏ qua + ghi log, không để sập cả backend.
const ROUTE_TABLE = [
  ['/api/auth', './routes/auth'],
  ['/api/categories', './routes/categories'],
  ['/api/products', './routes/products'],
  ['/api/orders', './routes/orders'],
  ['/api/users', './routes/users'],
  ['/api/posts', './routes/posts'],
  ['/api/contact', './routes/contact'],
  ['/api/returns', './routes/returns'],
  ['/api/warranties', './routes/warranties'],
  ['/api/repairs', './routes/repairs'],
  ['/api/inventory', './routes/inventory'],
  ['/api/payments', './routes/payments'],
  ['/api/shipping', './routes/shipping'],
  ['/api/vouchers', './routes/vouchers'],
  ['/api/promo-events', './routes/promo-events'],
  ['/api/reviews', './routes/reviews'],
  ['/api/reports', './routes/reports'],
  ['/api/announcements', './routes/announcements'],
  ['/api/chat', './routes/chat'],
  ['/api/notifications', './routes/notifications'],
  ['/api/loyalty', './routes/loyalty'],
  ['/api/hunt-events', './routes/hunt-events'],
];
const _skippedRoutes = [];
for (const [_routePath, _routeModule] of ROUTE_TABLE) {
  try {
    const _mod = require(_routeModule);
    const _router = (typeof _mod === 'function')
      ? _mod
      : (_mod && (_mod.default || _mod.router)) || null;
    if (typeof _router === 'function') {
      app.use(_routePath, _router);
    } else {
      _skippedRoutes.push(_routePath + ' (export ' + typeof _mod + ')');
    }
  } catch (e) {
    _skippedRoutes.push(_routePath + ' (throw: ' + e.message + ')');
  }
}
if (_skippedRoutes.length) {
  console.error('[routes] BỎ QUA ' + _skippedRoutes.length + ' route lỗi:', _skippedRoutes.join(' | '));
} else {
  console.log('[routes] Đã gắn đủ ' + ROUTE_TABLE.length + ' route');
}

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
