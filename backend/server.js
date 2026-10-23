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

// API routes — require TĨNH từng file (để công cụ đóng gói của Vercel lần ra
// và đính kèm đủ file route) + gắn qua mountRoute có vòng bảo vệ: route nào
// lỗi thì bỏ qua + ghi log, không để sập cả backend.
function mountRoute(routePath, loadModule) {
  let mod = null;
  try {
    mod = loadModule();
  } catch (e) {
    console.error('[route] SKIP', routePath, '| throw:', e.message);
    return;
  }
  const router = (typeof mod === 'function')
    ? mod
    : (mod && (mod.default || mod.router)) || null;
  if (typeof router === 'function') {
    app.use(routePath, router);
    console.log('[route] OK', routePath);
  } else {
    console.error('[route] SKIP', routePath, '| typeof export:', typeof mod, '| keys:', mod && typeof mod === 'object' ? Object.keys(mod).join(',') : '');
  }
}
mountRoute('/api/auth', () => require('./routes/auth'));
mountRoute('/api/categories', () => require('./routes/categories'));
mountRoute('/api/products', () => require('./routes/products'));
mountRoute('/api/orders', () => require('./routes/orders'));
mountRoute('/api/users', () => require('./routes/users'));
mountRoute('/api/posts', () => require('./routes/posts'));
mountRoute('/api/contact', () => require('./routes/contact'));
mountRoute('/api/returns', () => require('./routes/returns'));
mountRoute('/api/warranties', () => require('./routes/warranties'));
mountRoute('/api/repairs', () => require('./routes/repairs'));
mountRoute('/api/inventory', () => require('./routes/inventory'));
mountRoute('/api/payments', () => require('./routes/payments'));
mountRoute('/api/shipping', () => require('./routes/shipping'));
mountRoute('/api/vouchers', () => require('./routes/vouchers'));
mountRoute('/api/promo-events', () => require('./routes/promo-events'));
mountRoute('/api/reviews', () => require('./routes/reviews'));
mountRoute('/api/reports', () => require('./routes/reports'));
mountRoute('/api/announcements', () => require('./routes/announcements'));
mountRoute('/api/chat', () => require('./routes/chat'));
mountRoute('/api/notifications', () => require('./routes/notifications'));
mountRoute('/api/loyalty', () => require('./routes/loyalty'));
mountRoute('/api/hunt-events', () => require('./routes/hunt-events'));

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
