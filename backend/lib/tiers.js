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

// --- Ghi điểm hạng: đơn CHỈ được tính điểm khi đã "chốt" (quy tắc chủ shop duyệt 2026-10-22) ---
//   1) Khách bấm xác nhận hài lòng (orders.satisfied_at), hoặc
//   2) Đã qua 7 ngày kể từ ngày GIAO HÀNG thành công và không có yêu cầu đổi/trả đang xử lý.
// Doanh thu/báo cáo KHÔNG dùng điều kiện này (vẫn tính theo thanh toán như cũ).
const SETTLE_DAYS = 7;
const SETTLED_SQL = `(
  o.satisfied_at IS NOT NULL
  OR (
    o.status = 'delivered'
    AND COALESCE(
      (SELECT MAX(h.created_at) FROM order_status_history h WHERE h.order_id = o.id AND h.to_status = 'delivered'),
      o.created_at
    ) <= datetime('now', '-${SETTLE_DAYS} days')
    AND NOT EXISTS (
      SELECT 1 FROM returns r WHERE r.order_id = o.id AND r.status IN ('requested', 'approved', 'received')
    )
  )
)`;

// Ngày giao hàng thành công của 1 đơn (từ lịch sử trạng thái; null nếu chưa giao/không có mốc)
async function deliveredAtOf(orderId) {
  const r = await db.prepare(
    "SELECT MAX(created_at) AS d FROM order_status_history WHERE order_id = ? AND to_status = 'delivered'"
  ).get(orderId);
  return r && r.d ? r.d : null;
}

// Chuỗi giờ DB 'YYYY-MM-DD HH:MM:SS' (UTC) -> Date
function parseDbTime(s) {
  if (!s) return null;
  const str = String(s);
  return new Date(str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z'));
}

// Thông tin chốt điểm của 1 đơn (cho trang Đơn hàng của khách hiển thị trạng thái)
async function settleInfo(order) {
  const delivered_at = await deliveredAtOf(order.id);
  const base = delivered_at || (order.status === 'delivered' ? order.created_at : null);
  let points_settled = false;
  if (order.satisfied_at) points_settled = true;
  else if (order.status === 'delivered' && base) {
    const open = await db.prepare(
      "SELECT 1 FROM returns WHERE order_id = ? AND status IN ('requested', 'approved', 'received')"
    ).get(order.id);
    if (!open && Date.now() - parseDbTime(base).getTime() >= SETTLE_DAYS * 24 * 3600 * 1000) points_settled = true;
  }
  const return_deadline = base
    ? new Date(parseDbTime(base).getTime() + SETTLE_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null;
  return { delivered_at, return_deadline, points_settled };
}

async function userStats(userId) {
  const r = await db.prepare(`
    SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent, MAX(o.created_at) AS last_order_at
    FROM orders o
    WHERE o.user_id = ? AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
  `).get(userId);
  // Tổng chi thực = tổng đơn đã thanh toán - tiền đã hoàn từ đổi/trả hoàn tất
  // (đơn hoàn toàn bộ đã sang 'refunded' nên không còn trong tổng trên, không trừ 2 lần)
  const refunded = (await db.prepare(`
    SELECT COALESCE(SUM(r.refund_amount), 0) AS v
    FROM returns r JOIN orders o ON o.id = r.order_id
    WHERE o.user_id = ? AND r.status = 'completed'
      AND o.payment_status = 'verified' AND o.status != 'cancelled'
      AND ${SETTLED_SQL}
  `).get(userId)).v;
  return {
    order_count: r.order_count,
    total_spent: Math.max(0, (r.total_spent || 0) - (refunded || 0)),
    last_order_at: r.last_order_at,
  };
}

// Hạng đặt tay (users.tier_override): admin đặt trực tiếp cho 1 khách, THẮNG hạng tự tính
// theo chi tiêu. NULL = tự động như cũ. Cột có thể chưa tồn tại trên DB chưa chạy SQL bổ
// sung → đọc phòng thủ: lỗi thì coi như không có đặt tay, hệ thống vẫn chạy bình thường.
async function overrideFor(userId) {
  try {
    const r = await db.prepare('SELECT tier_override FROM users WHERE id = ?').get(userId);
    return r && TIER_MAP[r.tier_override] ? r.tier_override : null;
  } catch (e) { return null; }
}
async function overrideMap() {
  try {
    const rows = await db.prepare('SELECT id, tier_override FROM users WHERE tier_override IS NOT NULL').all();
    const m = new Map();
    for (const r of rows) if (TIER_MAP[r.tier_override]) m.set(r.id, r.tier_override);
    return m;
  } catch (e) { return new Map(); }
}

// Hạng hiện tại + khoảng còn thiếu để lên hạng kế tiếp (need.orders hoặc need.spent)
async function tierInfo(userId) {
  const stats = await userStats(userId);
  const autoKey = computeTier(stats.order_count, stats.total_spent);
  const override = await overrideFor(userId);
  const manual = !!override;
  const tierKey = manual ? override : autoKey;
  const idx = TIER_ORDER.indexOf(autoKey);
  let next = null;
  if (!manual && idx >= 0 && idx < TIER_ORDER.length - 1) {
    const nextKey = TIER_ORDER[idx + 1];
    let need = {};
    if (nextKey === 'bronze') need = { orders: Math.max(0, BRONZE_MIN_ORDERS - stats.order_count) };
    else if (nextKey === 'silver') need = { spent: Math.max(0, SILVER_MIN_SPENT - stats.total_spent) };
    else if (nextKey === 'gold') need = { spent: Math.max(0, GOLD_MIN_SPENT - stats.total_spent) };
    else if (nextKey === 'diamond') need = { spent: Math.max(0, DIAMOND_MIN_SPENT - stats.total_spent) };
    next = { key: nextKey, name: TIER_MAP[nextKey].name, need };
  }
  return { tier: TIER_MAP[tierKey], stats, next, manual };
}

// Kiểm tra thăng hạng: so hạng hiện tại với hạng cao nhất đã ghi nhận (users.known_tier).
// - known_tier NULL (khách cũ chưa đồng bộ): ghi mốc hiện tại, KHÔNG báo (tránh báo nhầm hàng loạt).
// - Hạng mới CAO HƠN mốc: báo chuông "thăng hạng" + nâng mốc lên hạng mới.
// - Tụt hạng (do hoàn tiền): giữ nguyên mốc — chỉ báo khi vượt đỉnh cũ, không báo lặp.
// Trả về true nếu vừa gửi thông báo thăng hạng.
async function checkTierUpgrade(userId) {
  const user = await db.prepare('SELECT known_tier FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  const current = (await tierInfo(userId)).tier.key;
  if (user.known_tier == null) {
    await db.prepare('UPDATE users SET known_tier = ? WHERE id = ?').run(current, userId);
    return false;
  }
  if (TIER_ORDER.indexOf(current) > TIER_ORDER.indexOf(user.known_tier)) {
    const tier = TIER_MAP[current];
    await db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    ).run(
      userId,
      'tier_up',
      `🎉 Chúc mừng! Bạn đã thăng hạng ${tier.name}`,
      `Bạn vừa lên hạng ${tier.name} — mỗi tháng bạn nhận ${tier.cards} thẻ giảm ${tier.percent}% cho 1 sản phẩm. Bấm để xem thẻ và đặc quyền hạng của bạn.`,
      '/hang-cua-toi'
    );
    await db.prepare('UPDATE users SET known_tier = ? WHERE id = ?').run(current, userId);
    return true;
  }
  return false;
}

// Che tên cho bảng xếp hạng: "Nguyễn Văn An" -> "Nguyễn Văn A***" (không lộ thông tin cá nhân)
function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '***';
  if (parts.length === 1) return parts[0].slice(0, 1) + '***';
  const last = parts[parts.length - 1];
  return [...parts.slice(0, -1), last.slice(0, 1) + '***'].join(' ');
}

module.exports = { TIERS, TIER_MAP, TIER_ORDER, computeTier, userStats, tierInfo, maskName, checkTierUpgrade, SETTLE_DAYS, SETTLED_SQL, deliveredAtOf, parseDbTime, settleInfo, overrideFor, overrideMap };
