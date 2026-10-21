// Hạng khách hàng + thẻ discount theo tháng (BI99)
// - Mỗi tháng, mỗi khách được phát hành số thẻ theo hạng hiện tại (mã riêng từng khách).
// - Mỗi thẻ giảm % cho 1 sản phẩm (món đắt nhất trong đơn), hết hạn cuối tháng phát hành.
// - Phát hành lười: khi khách mở trang hạng HOẶC admin/sale bấm phát hành hàng loạt.
// - Admin/sale: xem thống kê thẻ theo tháng, phát hành, đặt lại (xóa thẻ chưa dùng + phát hành lại).
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');
const { TIERS, TIER_MAP, computeTier, userStats, tierInfo, maskName } = require('../lib/tiers');

const router = express.Router();

function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function validPeriod(p) {
  return /^\d{4}-\d{2}$/.test(p || '') ? p : currentPeriod();
}
// Hạn dùng: 23:59:59 ngày cuối của tháng phát hành (giờ địa phương)
function periodExpiry(period) {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')} 23:59:59`;
}
function genCode(tierKey, period) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BI99-${tierKey.toUpperCase()}-${period.replace('-', '')}-${rand}`;
}
// Thẻ quá hạn mà còn 'unused' -> chuyển 'expired'
function sweepExpired() {
  db.prepare(
    "UPDATE discount_cards SET status = 'expired' WHERE status = 'unused' AND expires_at < datetime('now','localtime')"
  ).run();
}
// Cấu hình thẻ của 1 khách theo hạng hiện tại
function cardConfigFor(userId) {
  const stats = userStats(userId);
  return TIER_MAP[computeTier(stats.order_count, stats.total_spent)];
}
function insertCard(userId, cfg, period, expires) {
  const ins = db.prepare(
    "INSERT INTO discount_cards (user_id, code, percent, tier, period, status, expires_at) VALUES (?, ?, ?, ?, ?, 'unused', ?)"
  );
  let code = genCode(cfg.key, period);
  let tries = 0;
  while (db.prepare('SELECT 1 FROM discount_cards WHERE code = ?').get(code) && ++tries < 10) {
    code = genCode(cfg.key, period);
  }
  ins.run(userId, code, cfg.percent, cfg.key, period, expires);
}
// Phát hành thẻ cho 1 khách ở 1 kỳ; đã có thẻ kỳ đó thì bỏ qua. Trả số thẻ mới tạo.
function issueForUser(userId, period) {
  const existing = db.prepare(
    'SELECT COUNT(*) AS c FROM discount_cards WHERE user_id = ? AND period = ?'
  ).get(userId, period).c;
  if (existing > 0) return 0;
  const cfg = cardConfigFor(userId);
  const expires = periodExpiry(period);
  for (let i = 0; i < cfg.cards; i++) insertCard(userId, cfg, period, expires);
  return cfg.cards;
}
// Bù đủ định mức thẻ của kỳ: thẻ đã dùng vẫn tính trong định mức (không cấp trùng phần đã dùng),
// phần chưa dùng bị xóa khi đặt lại sẽ được cấp mới. Trả số thẻ mới tạo.
function topUpForUser(userId, period) {
  const existing = db.prepare(
    'SELECT COUNT(*) AS c FROM discount_cards WHERE user_id = ? AND period = ?'
  ).get(userId, period).c;
  const cfg = cardConfigFor(userId);
  const missing = cfg.cards - existing;
  if (missing <= 0) return 0;
  const expires = periodExpiry(period);
  for (let i = 0; i < missing; i++) insertCard(userId, cfg, period, expires);
  return missing;
}

// GET /api/loyalty/me — khách xem hạng, tiến trình thăng hạng và thẻ của mình
router.get('/me', auth, (req, res) => {
  sweepExpired();
  const period = currentPeriod();
  issueForUser(req.user.id, period);
  const info = tierInfo(req.user.id);
  const cards = db.prepare(
    `SELECT id, code, percent, tier, period, status, issued_at, expires_at, used_order_id
     FROM discount_cards WHERE user_id = ? ORDER BY period DESC, id`
  ).all(req.user.id);
  res.json({ period, tier: info.tier, stats: info.stats, next: info.next, cards, tiers: TIERS });
});

// GET /api/loyalty/leaderboard — top 10 theo tổng chi, tên che một phần + vị trí của chính khách
router.get('/leaderboard', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS total_spent
    FROM users u
    JOIN orders o ON o.user_id = u.id AND o.payment_status = 'verified' AND o.status != 'cancelled'
    WHERE u.role = 'customer'
    GROUP BY u.id
    ORDER BY total_spent DESC, order_count DESC
  `).all();
  const top = rows.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    name: maskName(r.name),
    tier: computeTier(r.order_count, r.total_spent),
    total_spent: r.total_spent,
    is_me: r.id === req.user.id,
  }));
  const myIdx = rows.findIndex((r) => r.id === req.user.id);
  let me;
  if (myIdx >= 0) {
    const r = rows[myIdx];
    me = { rank: myIdx + 1, total_spent: r.total_spent, order_count: r.order_count, tier: computeTier(r.order_count, r.total_spent) };
  } else {
    const s = userStats(req.user.id);
    me = { rank: null, total_spent: s.total_spent, order_count: s.order_count, tier: computeTier(s.order_count, s.total_spent) };
  }
  res.json({ top, me, total_customers: rows.length });
});

// GET /api/loyalty/admin/stats?period=YYYY-MM — thống kê thẻ 1 kỳ (admin/sale xem)
router.get('/admin/stats', auth, staffOnly, (req, res) => {
  sweepExpired();
  const period = validPeriod(req.query.period);
  const byStatus = db.prepare(
    'SELECT status, COUNT(*) AS c FROM discount_cards WHERE period = ? GROUP BY status'
  ).all(period);
  const byTier = db.prepare(
    'SELECT tier, COUNT(*) AS c FROM discount_cards WHERE period = ? GROUP BY tier'
  ).all(period);
  res.json({
    period,
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.c])),
    by_tier: byTier,
    tiers: TIERS,
  });
});

// POST /api/loyalty/admin/issue { period? } — phát hành thẻ kỳ cho mọi khách chưa có
router.post('/admin/issue', auth, staffOnly, (req, res) => {
  const period = validPeriod((req.body || {}).period);
  const customers = db.prepare("SELECT id FROM users WHERE role = 'customer'").all();
  let issued = 0;
  let touched = 0;
  db.transaction(() => {
    for (const c of customers) {
      const n = issueForUser(c.id, period);
      if (n > 0) { issued += n; touched++; }
    }
  })();
  res.json({ period, issued_cards: issued, customers: touched });
});

// POST /api/loyalty/admin/reset { period? } — xóa thẻ chưa dùng/hết hạn của kỳ rồi bù đủ định mức
// cho từng khách (thẻ đã dùng giữ nguyên lịch sử và vẫn tính trong định mức, tránh cấp trùng)
router.post('/admin/reset', auth, staffOnly, (req, res) => {
  const period = validPeriod((req.body || {}).period);
  const customers = db.prepare("SELECT id FROM users WHERE role = 'customer'").all();
  let issued = 0;
  const removed = db.transaction(() => {
    const del = db.prepare(
      "DELETE FROM discount_cards WHERE period = ? AND status IN ('unused','expired')"
    ).run(period);
    for (const c of customers) issued += topUpForUser(c.id, period);
    return del.changes;
  })();
  res.json({ period, removed_cards: removed, issued_cards: issued });
});

// GET /api/loyalty/admin/user-cards/:userId — toàn bộ thẻ của 1 khách (admin/sale xem)
router.get('/admin/user-cards/:userId', auth, staffOnly, (req, res) => {
  sweepExpired();
  const cards = db.prepare(
    'SELECT * FROM discount_cards WHERE user_id = ? ORDER BY period DESC, id'
  ).all(req.params.userId);
  res.json({ cards });
});

module.exports = router;
