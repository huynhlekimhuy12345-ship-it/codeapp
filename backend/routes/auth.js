// Routes xác thực: đăng ký / đăng nhập (email hoặc số điện thoại) /
// đăng nhập Google / quên mật khẩu / thông tin user hiện tại
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { auth, signToken } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');

const router = express.Router();

// ============================================================
// Rate-limit chống brute-force cho /api/auth/login:
// tối đa 10 lần đăng nhập / phút / IP → 429 (in-memory)
// ============================================================
const loginAttempts = new Map(); // ip -> { count, resetAt }
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60 * 1000;

function loginRateLimit(req, res, next) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();

  // Dọn dẹp entry hết hạn (tránh phình Map) khi đã đông
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts) {
      if (v.resetAt <= now) loginAttempts.delete(k);
    }
  }

  let entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }
  if (entry.count > LOGIN_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 1 phút',
    });
  }
  next();
}

// Ghi nhận 1 lần đăng nhập thất bại (chỉ đếm sai, không đếm lần đúng)
function recordLoginFailure(req) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }
  entry.count += 1;
}

// Rate-limit đăng ký: tối đa 10 tài khoản/giờ/IP (chống spam)
const registerAttempts = new Map();
const REGISTER_LIMIT = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
function registerRateLimit(req, res, next) {
  const ip = String(req.ip || (req.connection && req.connection.remoteAddress) || 'unknown');
  const now = Date.now();
  let entry = registerAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + REGISTER_WINDOW_MS };
    registerAttempts.set(ip, entry);
  }
  entry.count += 1;
  if (entry.count > REGISTER_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Bạn đã tạo quá nhiều tài khoản, vui lòng thử lại sau' });
  }
  next();
}

// ============================================================
// Định danh tài khoản: EMAIL hoặc SỐ ĐIỆN THOẠI (1 ô duy nhất)
// - Email: chuẩn hóa chữ thường.
// - SĐT: bỏ khoảng trắng/dấu chấm, phải là 10 số bắt đầu bằng 0.
// Tài khoản đăng ký bằng SĐT: cột email (NOT NULL + UNIQUE) lưu dạng
// "<sđt>@sdt.bi99" — chỉ dùng nội bộ, KHÔNG bao giờ hiện cho khách
// (publicUser sẽ ẩn đi và trả phone thay thế).
// ============================================================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9}$/;
const PHONE_EMAIL_DOMAIN = '@sdt.bi99';

function parseIdentifier(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (EMAIL_RE.test(v)) return { kind: 'email', value: v.toLowerCase() };
  const digits = v.replace(/[\s.]/g, '');
  if (PHONE_RE.test(digits)) return { kind: 'phone', value: digits };
  return null;
}

async function findUserByIdentifier(idf) {
  if (!idf) return null;
  if (idf.kind === 'email')
    return db.prepare('SELECT * FROM users WHERE email = ?').get(idf.value);
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(idf.value);
}

// Bản user an toàn để trả về frontend: ẩn email nội bộ của tài khoản SĐT.
function publicUser(u) {
  if (!u) return u;
  const isPhoneAccount = typeof u.email === 'string' && u.email.endsWith(PHONE_EMAIL_DOMAIN);
  return {
    id: u.id,
    name: u.name,
    email: isPhoneAccount ? null : u.email,
    phone: u.phone || null,
    role: u.role,
    created_at: u.created_at,
  };
}

// Cột users.auth_provider có thể chưa tồn tại nếu user chưa chạy migration
// 2026-10-30 — kiểm tra 1 lần rồi nhớ kết quả (chưa có -> coi mọi tài khoản là 'local').
let _hasProviderCol = null;
async function hasProviderColumn() {
  if (_hasProviderCol !== null) return _hasProviderCol;
  try {
    const r = await db.prepare(
      "SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'auth_provider'"
    ).get();
    _hasProviderCol = !!(r && Number(r.c) > 0);
  } catch {
    _hasProviderCol = false;
  }
  return _hasProviderCol;
}

function passwordPolicyOk(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ''));
}

// Quà chào mừng thành viên mới: voucher -15% dùng 1 lần (hạn 30 ngày) + báo chuông.
// Mã RIÊNG theo từng khách (chỉ khách đó biết) nên đặt usage_limit = 1 là đủ an toàn.
// Lỗi ở bước tặng quà không được làm hỏng việc tạo tài khoản.
async function issueWelcomeGift(user) {
  try {
    let vcode = null;
    for (let i = 0; i < 5 && !vcode; i++) {
      const cand = `MOI15-${user.id}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const dup = await db.prepare('SELECT id FROM vouchers WHERE code = ?').get(cand);
      if (!dup) vcode = cand;
    }
    if (vcode) {
      const expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await db.prepare(
        'INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(vcode, 'percent', 15, 0, expiry, 1, 1);
      await db.prepare(
        'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
      ).run(
        user.id,
        'voucher',
        '🎁 Quà chào mừng thành viên mới!',
        `Chào ${user.name}! BI99 tặng bạn voucher giảm 15% cho đơn hàng đầu tiên. Mã của bạn: ${vcode} — dùng được 1 lần, hạn 30 ngày. Nhập mã ở bước thanh toán nhé!`,
        '/cua-hang'
      );
    }
  } catch (e) { console.error('welcome voucher:', e); }
}

// POST /api/auth/register — đăng ký bằng email HOẶC số điện thoại
router.post('/register', registerRateLimit, async (req, res) => {
  try {
    const { name, password } = req.body || {};
    const idf = parseIdentifier(req.body && (req.body.identifier || req.body.email));
    if (!name || !idf || !password)
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email hoặc số điện thoại, mật khẩu' });
    if (!passwordPolicyOk(password))
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số' });

    const exists = await findUserByIdentifier(idf);
    if (exists) return res.status(400).json({ error: 'Bạn đã có tài khoản rồi' });

    const nameTaken = await db.prepare('SELECT id FROM users WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (nameTaken) return res.status(400).json({ error: 'Tên này đã xuất hiện, vui lòng chọn tên khác' });

    const emailVal = idf.kind === 'email' ? idf.value : `${idf.value}${PHONE_EMAIL_DOMAIN}`;
    const phoneVal = idf.kind === 'phone' ? idf.value : '';
    const hash = bcrypt.hashSync(password, 10);
    const withProvider = await hasProviderColumn();
    const info = withProvider
      ? await db.prepare(
          "INSERT INTO users (name, email, phone, password_hash, known_tier, auth_provider) VALUES (?, ?, ?, ?, 'potential', 'local')"
        ).run(name.trim(), emailVal, phoneVal, hash)
      : await db.prepare(
          "INSERT INTO users (name, email, phone, password_hash, known_tier) VALUES (?, ?, ?, ?, 'potential')"
        ).run(name.trim(), emailVal, phoneVal, hash);
    const raw = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const user = publicUser(raw);

    await issueWelcomeGift(user);

    res.status(201).json({ user, token: signToken(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/auth/login — đăng nhập bằng email HOẶC số điện thoại
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { password } = req.body || {};
    const idf = parseIdentifier(req.body && (req.body.identifier || req.body.email));
    if (!idf || !password)
      return res.status(400).json({ error: 'Vui lòng nhập email hoặc số điện thoại và mật khẩu' });

    const raw = await findUserByIdentifier(idf);
    if (!raw || !raw.password_hash || !bcrypt.compareSync(password, raw.password_hash)) {
      recordLoginFailure(req);
      return res.status(401).json({ error: 'Email/số điện thoại hoặc mật khẩu không đúng' });
    }

    const user = publicUser(raw);
    res.json({ user, token: signToken(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/auth/google — đăng nhập/đăng ký bằng Google (nhận ID token từ frontend).
// QUY TẮC CHẶN TRÙNG (user chốt 30/10): một email chỉ có MỘT tài khoản —
// email đã có tài khoản thường thì CHẶN, không tạo tài khoản thứ hai.
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập Google' });

    let payload = null;
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      if (!r.ok) throw new Error('tokeninfo ' + r.status);
      payload = await r.json();
    } catch {
      return res.status(401).json({ error: 'Không xác thực được tài khoản Google, vui lòng thử lại' });
    }
    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID)
      return res.status(401).json({ error: 'Không xác thực được tài khoản Google, vui lòng thử lại' });

    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || payload.email_verified === 'false' || payload.email_verified === false)
      return res.status(400).json({ error: 'Tài khoản Google chưa xác thực email' });

    const existing = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      const provider = existing.auth_provider || 'local';
      if (provider !== 'google')
        return res.status(400).json({ error: 'Bạn đã có tài khoản rồi — vui lòng đăng nhập bằng email và mật khẩu' });
      const user = publicUser(existing);
      return res.json({ user, token: signToken(user) });
    }

    // Tài khoản Google mới
    let displayName = String(payload.name || '').trim() || email.split('@')[0];
    const nameTaken = await db.prepare('SELECT id FROM users WHERE LOWER(name) = LOWER(?)').get(displayName);
    if (nameTaken) displayName = `${displayName} ${Math.floor(100 + Math.random() * 900)}`;

    const randomSecret = crypto.randomBytes(32).toString('hex');
    const hash = bcrypt.hashSync(randomSecret, 10);
    const withProvider = await hasProviderColumn();
    if (!withProvider)
      return res.status(400).json({ error: 'Đăng nhập Google chưa được bật trên hệ thống, vui lòng đăng ký bằng email hoặc số điện thoại' });
    const info = await db.prepare(
      "INSERT INTO users (name, email, phone, password_hash, known_tier, auth_provider) VALUES (?, ?, '', ?, 'potential', 'google')"
    ).run(displayName, email, hash);
    const raw = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const user = publicUser(raw);

    await issueWelcomeGift(user);

    res.status(201).json({ user, token: signToken(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// POST /api/auth/forgot — xin mã xác nhận 6 số đặt lại mật khẩu.
// Luôn trả về thông báo chung dù tài khoản có tồn tại hay không (tránh lộ thông tin).
router.post('/forgot', async (req, res) => {
  const generic = { message: 'Nếu tài khoản tồn tại, mã xác nhận đã được gửi tới email/số điện thoại của bạn' };
  try {
    const idf = parseIdentifier(req.body && (req.body.identifier || req.body.email));
    if (!idf) return res.json(generic);
    const user = await findUserByIdentifier(idf);
    if (!user) return res.json(generic);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    try {
      await db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
      await db.prepare('INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES (?, ?, ?)').run(user.id, codeHash, expires);
    } catch (e) {
      // Bảng password_resets chưa được tạo (chưa chạy migration) — vẫn trả thông báo chung.
      console.error('forgot store:', e);
      return res.json(generic);
    }

    if (idf.kind === 'email') {
      await sendMail({
        to: idf.value,
        subject: 'BI99 — Mã đặt lại mật khẩu',
        text: `Xin chào ${user.name},\n\nMã xác nhận đặt lại mật khẩu của bạn là: ${code}\nMã có hiệu lực 10 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.\n\nBI99 — Đồ da thật Hội An`,
      });
    } else {
      // Chưa có nhà cung cấp SMS/Zalo: ghi log server để shop xử lý/giúp khách.
      console.log(`[SMS chưa cấu hình] Mã đặt lại mật khẩu cho SĐT ${idf.value}: ${code}`);
    }
    return res.json(generic);
  } catch (e) { console.error(e); return res.json(generic); }
});

// POST /api/auth/reset — nhập mã + mật khẩu mới
router.post('/reset', async (req, res) => {
  try {
    const { code, password } = req.body || {};
    const idf = parseIdentifier(req.body && (req.body.identifier || req.body.email));
    if (!idf || !code || !password)
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    if (!passwordPolicyOk(password))
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số' });

    const invalid = { error: 'Mã xác nhận không đúng hoặc đã hết hạn' };
    const user = await findUserByIdentifier(idf);
    if (!user) return res.status(400).json(invalid);

    let row = null;
    try {
      row = await db.prepare(
        'SELECT * FROM password_resets WHERE user_id = ? AND used = 0 ORDER BY id DESC'
      ).get(user.id);
    } catch (e) { console.error('reset lookup:', e); }
    if (!row) return res.status(400).json(invalid);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
      return res.status(400).json(invalid);
    }
    if (Number(row.attempts || 0) >= 5) {
      await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
      return res.status(400).json(invalid);
    }
    const codeHash = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
    if (codeHash !== row.code_hash) {
      await db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?').run(row.id);
      return res.status(400).json(invalid);
    }

    const hash = bcrypt.hashSync(password, 10);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const raw = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!raw) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user: publicUser(raw) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
