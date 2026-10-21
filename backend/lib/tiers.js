// Phân hạng khách hàng BI99 — dùng chung cho loyalty, users, orders.
// Hạng tính từ đơn ĐÃ THANH TOÁN (payment_status='verified') và CHƯA HỦY — khớp quy tắc doanh thu.
// Mốc đã duyệt với chủ shop ngày 2026-10-21:
//   Tiềm năng: chưa mua · Mới: 1 đơn · Thường xuyên: 2–4 đơn
//   Trung thành: ≥5 đơn hoặc tổng chi ≥10.000.000đ · VIP: tổng chi ≥20.000.000đ
const db = require('../db');

const TIERS = [
  { key: 'vip', name: 'VIP', cards: 3, percent: 15 },
  { key: 'loyal', name: 'Trung thành', cards: 2, percent: 15 },
  { key: 'regular', name: 'Thường xuyên', cards: 2, percent: 10 },
  { key: 'new', name: 'Mới', cards: 1, percent: 10 },
  { key: 'potential', name: 'Tiềm năng', cards: 1, percent: 10 },
];
const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));
const TIER_ORDER = ['potential', 'new', 'regular', 'loyal', 'vip'];

const VIP_MIN_SPENT = 20000000;
const LOYAL_MIN_SPENT = 10000000;
const LOYAL_MIN_ORDERS = 5;
const REGULAR_MIN_ORDERS = 2;

function computeTier(orderCount, totalSpent) {
  if (totalSpent >= VIP_MIN_SPENT) return 'vip';
  if (orderCount >= LOYAL_MIN_ORDERS || totalSpent >= LOYAL_MIN_SPENT) return 'loyal';
  if (orderCount >= REGULAR_MIN_ORDERS) return 'regular';
  if (orderCount >= 1) return 'new';
  return 'potential';
}

function userStats(userId) {
  const r = db.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
    FROM orders
    WHERE user_id = ? AND payment_status = 'verified' AND status != 'cancelled'
  `).get(userId);
  return { order_count: r.order_count, total_spent: r.total_spent, last_order_at: r.last_order_at };
}

// Hạng hiện tại + khoảng còn thiếu để lên hạng kế tiếp (need.orders / need.spent; either = đạt 1 trong 2 là đủ)
function tierInfo(userId) {
  const stats = userStats(userId);
  const tierKey = computeTier(stats.order_count, stats.total_spent);
  const idx = TIER_ORDER.indexOf(tierKey);
  let next = null;
  if (idx >= 0 && idx < TIER_ORDER.length - 1) {
    const nextKey = TIER_ORDER[idx + 1];
    let need = {};
    if (nextKey === 'new') need = { orders: Math.max(0, 1 - stats.order_count) };
    else if (nextKey === 'regular') need = { orders: Math.max(0, REGULAR_MIN_ORDERS - stats.order_count) };
    else if (nextKey === 'loyal') need = {
      orders: Math.max(0, LOYAL_MIN_ORDERS - stats.order_count),
      spent: Math.max(0, LOYAL_MIN_SPENT - stats.total_spent),
      either: true,
    };
    else if (nextKey === 'vip') need = { spent: Math.max(0, VIP_MIN_SPENT - stats.total_spent) };
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
