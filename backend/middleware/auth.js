// Middleware xác thực JWT và phân quyền admin
const jwt = require('jsonwebtoken');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET chưa được cấu hình. Hãy đặt JWT_SECRET trong biến môi trường trước khi chạy production.');
  }
  JWT_SECRET = 'dev-only-secret-khong-dung-cho-production';
}

// Cảnh báo khi chạy với secret mặc định (chỉ an toàn cho dev local)
if (!process.env.JWT_SECRET) {
  console.warn(
    '[CẢNH BÁO BẢO MẬT] JWT_SECRET chưa được đặt trong biến môi trường — đang dùng secret mặc định. ' +
    'Hãy đặt JWT_SECRET trong file .env trước khi chạy production, nếu không token có thể bị giả mạo.'
  );
}

// Đọc token từ header Authorization: Bearer <token>
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Thiếu token xác thực' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET); // { id, email, role }
  } catch (e) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
  // Role luôn lấy từ DB, KHÔNG tin role ghi trong token: đổi vai trò (lên admin/sale
  // hay hạ xuống khách) phải có hiệu lực ngay ở request kế tiếp, không cần đăng nhập lại.
  if (process.env.DB_MOCK === '1') { req.user = payload; return next(); }
  try {
    const db = require('../db');
    const row = await db.prepare('SELECT role FROM users WHERE id = ?').get(payload.id);
    if (!row) return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    req.user = { ...payload, role: row.role };
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
}

// Chỉ cho admin đi tiếp
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Chỉ quản trị viên mới được thực hiện' });
}

// Cho admin và nhân viên sale đi tiếp (mọi nghiệp vụ trừ quản lý tài khoản)
function staffOnly(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'sale')) return next();
  return res.status(403).json({ error: 'Chỉ quản trị viên và nhân viên sale mới được thực hiện' });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { auth, adminOnly, staffOnly, signToken, JWT_SECRET };
