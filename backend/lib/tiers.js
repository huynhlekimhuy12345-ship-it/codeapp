// Phân hạng khách hàng BI99 — dùng chung cho loyalty, users, orders.
// Hạng tính từ đơn ĐÃ THANH TOÁN (payment_status='verified') và CHƯA HỦY — khớp quy tắc doanh thu.
// Mốc đã duyệt với chủ shop ngày 2026-10-21 (bảng hạng kim loại/quý):
//   Tiềm năng: chưa mua · Đồng: từ 2 đơn · Bạc: tổng chi ≥5.000.000đ
//   Vàng: tổng chi ≥10.000.000đ · Kim cương: tổng chi ≥20.000.000đ
// Mốc tiền cao hơn luôn thắng (ví dụ 1 đơn nhưng chi 6 triệu -> Bạc).
const db = require('../db');

const TIERS = [
  { key: 'diamond', name: 'Kim cương', cards: 3, percent: 15 },
  { key: 'gold', name: 'Vàng', cards: 2, percent: 15 },
  { key: 'silver', name: 'Bạc', cards: 2, percent: 10 },
  { key: 'bronze', name: 'Đồng', cards: 1, percent: 10 },
  { key: 'potential', name: 'Tiềm năng', cards: 1, percent: 10 },
];
const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));
const TIER_ORDER = ['potential', 'bronze', 'silver', 'gold', 'diamond'];

const DIAMOND_MIN_SPENT = 20000000;
const GOLD_MIN_SPENT = 10000000;
const SILVER_MIN_SPENT = 5000000;
const BRONZE_MIN_ORDERS = 2;

function computeTier(orderCount, totalSpent) {
  if (totalSpent >= DIAMOND_MIN_SPENT) return 'diamond';
  if (totalSpent >= GOLD_MIN_SPENT) return 'gold';
  if (totalSpent >= SILVER_MIN_SPENT) return 'silver';
  if (orderCount >= BRONZE_MIN_ORDERS) return 'bronze';
  return 'potential';
}

function userStats(userId) {
  const r = db.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
    FROM orders
    WHERE user_id = ? AND payment_status = 'verified' AND status != 'cancelled'
  `).get(userId);
  // Tổng chi thực = tổng đơn đã thanh toán - tiền đã hoàn từ đổi/trả hoàn tất
  // (đơn hoàn toàn bộ đã sang 'refunded' nên không còn trong tổng trên, không trừ 2 lần)
  const refunded = db.prepare(`
    SELECT COALESCE(SUM(r.refund_amount), 0) AS v
    FROM returns r JOIN orders o ON o.id = r.order_id
    WHERE o.user_id = ? AND r.status = 'completed'
      AND o.payment_status = 'verified' AND o.status != 'cancelled'
  `).get(userId).v;
  return {
    order_count: r.order_count,
    total_spent: Math.max(0, (r.total_spent || 0) - (refunded || 0)),
    last_order_at: r.last_order_at,
  };
}

// Hạng hiện tại + khoảng còn thiếu để lên hạng kế tiếp (need.orders hoặc need.spent)
function tierInfo(userId) {
  const stats = userStats(userId);
  const tierKey = computeTier(stats.order_count, stats.total_spent);
  const idx = TIER_ORDER.indexOf(tierKey);
  let next = null;
  if (idx >= 0 && idx < TIER_ORDER.length - 1) {
    const nextKey = TIER_ORDER[idx + 1];
    let need = {};
    if (nextKey === 'bronze') need = { orders: Math.max(0, BRONZE_MIN_ORDERS - stats.order_count) };
    else if (nextKey === 'silver') need = { spent: Math.max(0, SILVER_MIN_SPENT - stats.total_spent) };
    else if (nextKey === 'gold') need = { spent: Math.max(0, GOLD_MIN_SPENT - stats.total_spent) };
    else if (nextKey === 'diamond') need = { spent: Math.max(0, DIAMOND_MIN_SPENT - stats.total_spent) };
    next = { key: nextKey, name: TIER_MAP[nextKey].name, need };
  }
  return { tier: TIER_MAP[tierKey], stats, next };
}

// Che tên cho bảng xếp hạng: "Nguyễn Văn An" -> "Nguyễn Văn A***" (không lộ thông tin cá nhân)
function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '***';
  if (parts.length === 1) return parts[0].slice(0, 1) + '***';
  const last = parts[parts.length - 1];
  return [...parts.slice(0, -1), last.slice(0, 1) + '***'].join(' ');
}

module.exports = { TIERS, TIER_MAP, TIER_ORDER, computeTier, userStats, tierInfo, maskName };
