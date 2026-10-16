// Middleware xác thực JWT và phân quyền admin
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'leather-shop-secret-key';

// Cảnh báo khi chạy với secret mặc định (chỉ an toàn cho dev local)
if (!process.env.JWT_SECRET) {
  console.warn(
    '[CẢNH BÁO BẢO MẬT] JWT_SECRET chưa được đặt trong biến môi trường — đang dùng secret mặc định. ' +
    'Hãy đặt JWT_SECRET trong file .env trước khi chạy production, nếu không token có thể bị giả mạo.'
  );
}

// Đọc token từ header Authorization: Bearer <token>
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Thiếu token xác thực' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
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
