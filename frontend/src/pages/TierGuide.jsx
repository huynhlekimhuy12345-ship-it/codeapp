// Trang Phân hạng riêng — phong cách THẺ THÀNH VIÊN KIM LOẠI (demo đã duyệt 2026-10-21):
// 5 tấm thẻ kim loại xếp bậc thang đi lên, rê chuột nghiêng 3D + vệt sáng lướt theo trỏ,
// bấm vào thẻ xem khung đặc quyền chi tiết ngay bên dưới, cuối trang là bảng so sánh.
// Mở công khai; khách đã đăng nhập thấy thêm hạng của mình, trạng thái và khoảng còn thiếu.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { api, fmtVND } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useStore } from '../context/StoreContext';
import './TierGuide.css';

const TIER_ORDER = ['potential', 'bronze', 'silver', 'gold', 'diamond'];
// Cấu hình thẻ theo hạng (khớp backend; nếu đã đăng nhập sẽ ưu tiên số liệu từ API)
const TIER_CONFIG = {
  potential: { cards: 1, percent: 10 },
  bronze: { cards: 1, percent: 10 },
  silver: { cards: 2, percent: 10 },
  gold: { cards: 2, percent: 15 },
  diamond: { cards: 3, percent: 15 },
};
const THRESHOLDS = {
  potential: (t) => t('tier.thresholdPotential'),
  bronze: (t) => t('tier.thresholdBronze', { count: 2 }),
  silver: (t) => t('tier.thresholdSilver', { amount: fmtVND(5000000) }),
  gold: (t) => t('tier.thresholdGold', { amount: fmtVND(10000000) }),
  diamond: (t) => t('tier.thresholdDiamond', { amount: fmtVND(20000000) }),
};

// Một tấm thẻ kim loại NGANG (chủ shop chốt 2026-10-22): thánh thú nằm trọn khung trái,
// bên phải là tên hạng màu sáng + tên thánh thú bạch kim lì + tên thành viên; bấm thẻ xem đặc quyền.
// Rê chuột nghiêng 3D nhẹ + vệt sáng chạy theo vị trí trỏ.
const BEAST_IMG = {
  potential: '/images/beasts-guide/potential.webp',
  bronze: '/images/beasts-guide/bronze.webp',
  silver: '/images/beasts-guide/silver.webp',
  gold: '/images/beasts-guide/gold.webp',
  diamond: '/images/beasts-guide/diamond.webp',
};

function MetalCard({ tierKey, name, beastName, memberName, memberLabel, status, statusLabel, selected, onSelect }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 6}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 7}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <button
      type="button"
      ref={ref}
      className={`metal-card metal-${tierKey}${selected ? ' selected' : ''}`}
      onClick={onSelect}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-pressed={selected}
    >
      <span className="metal-shine" aria-hidden />
      <span className={`metal-art beast-${tierKey}`} aria-hidden>
        <img src={BEAST_IMG[tierKey]} alt="" />
        <span className="metal-member">{memberLabel}</span>
      </span>
      <span className="metal-info">
        <span className="metal-top">
          <span className="metal-brand">BI99</span>
          {status && <span className={`metal-status st-${status}`}>{statusLabel}</span>}
        </span>
        <span className="metal-name">{name}</span>
        <span className="metal-beast">{beastName}</span>
        <span className="metal-bottom">
          <span className="metal-holder">{memberName}</span>
        </span>
      </span>
    </button>
  );
}

export default function TierGuide() {
  const { t } = useLang();
  const { user } = useStore();
  const [params] = useSearchParams();
  const [mine, setMine] = useState(null);
  const focusKey = TIER_ORDER.includes(params.get('tier')) ? params.get('tier') : null;
  const [selected, setSelected] = useState(focusKey);

  useEffect(() => {
    if (!user) { setMine(null); return; }
    api.getMyTier().then(setMine).catch(() => setMine(null));
  }, [user]);

  const myKey = mine?.tier?.key || null;
  useEffect(() => {
    if (focusKey) setSelected(focusKey);
    else if (!selected && myKey) setSelected(myKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, myKey]);

  useEffect(() => {
    if (focusKey) {
      const el = document.getElementById('metal-detail');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [focusKey]);

  const tierName = (key) => t(`tier.name.${key}`);
  const myIdx = myKey ? TIER_ORDER.indexOf(myKey) : -1;
  const stats = mine?.stats || null;
  const next = mine?.next || null;

  const cfgFor = (key) => {
    const fromApi = (mine?.tiers || []).find((x) => x.key === key);
    return fromApi || TIER_CONFIG[key];
  };
  const statusFor = (key) => {
    if (!mine) return null;
    const idx = TIER_ORDER.indexOf(key);
    if (idx === myIdx) return 'current';
    return idx < myIdx ? 'achieved' : 'locked';
  };
  const gapFor = (key) => {
    if (!stats || TIER_ORDER.indexOf(key) <= myIdx) return null;
    let gap = null;
    if (key === 'bronze' && stats.order_count < 2)
      gap = t('tier.gapOrders', { count: 2 - stats.order_count });
    else if (key === 'silver' && stats.total_spent < 5000000)
      gap = t('tier.gapSpent', { amount: fmtVND(5000000 - stats.total_spent) });
    else if (key === 'gold' && stats.total_spent < 10000000)
      gap = t('tier.gapSpent', { amount: fmtVND(10000000 - stats.total_spent) });
    else if (key === 'diamond' && stats.total_spent < 20000000)
      gap = t('tier.gapSpent', { amount: fmtVND(20000000 - stats.total_spent) });
    return gap ? t('tier.gapLabel', { gap }) : null;
  };

  const tiers = useMemo(() => TIER_ORDER.map((key) => ({ key, ...cfgFor(key) })), [mine]);
  const selKey = selected && TIER_ORDER.includes(selected) ? selected : (myKey || 'potential');
  const selTier = tiers.find((x) => x.key === selKey) || tiers[0];
  const selStatus = statusFor(selKey);
  const selGap = gapFor(selKey);

  // Thanh tiến trình lên hạng kế (cho dải thông tin của khách)
  let progressPct = null;
  let progressText = null;
  if (mine && next) {
    if (next.need?.spent != null) {
      progressPct = Math.round((stats.total_spent / (stats.total_spent + next.need.spent)) * 100);
      progressText = t('tier.remainingSpent', { amount: fmtVND(next.need.spent) });
    } else if (next.need?.orders != null) {
      progressPct = Math.round((stats.order_count / (stats.order_count + next.need.orders)) * 100);
      progressText = t('tier.remainingOrders', { count: next.need.orders });
    }
  }

  return (
    <div className="container page">
      <PageTitle title={t('tier.guideTitle')} />
      <h1 className="page-title">🏆 {t('tier.guideTitle')}</h1>
      <p className="guide-intro">{t('tier.guideIntro')}</p>

      {user && mine && (
        <div className="guide-mine">
          <span className={`tier-badge tier-${myKey} guide-mine-badge`}>
            {myKey === 'diamond' ? '💎 ' : ''}{tierName(myKey)}
          </span>
          <div className="guide-mine-mid">
            <span className="guide-mine-stats">
              {stats.order_count} {t('tier.ordersLabel')} · {fmtVND(stats.total_spent)}
            </span>
            {next && progressPct != null ? (
              <span className="guide-mine-progress">
                <span className="guide-mine-track">
                  <span className="guide-mine-fill" style={{ width: `${progressPct}%` }} />
                </span>
                <span className="guide-mine-next">
                  {t('tier.nextTier')}: <strong>{tierName(next.key)}</strong> — {progressText} ({progressPct}%)
                </span>
              </span>
            ) : (
              <span className="guide-mine-next">💎 {t('tier.maxTier')}</span>
            )}
          </div>
          <Link to="/hang-cua-toi" className="btn btn-outline guide-mine-link">{t('tier.viewMine')}</Link>
        </div>
      )}
      {user && !mine && <p className="muted">{t('tier.loading')}</p>}

      <h2 className="guide-section-title">{t('tier.howToTitle')}</h2>
      <div className="metal-stage">
        {tiers.map((tr, i) => {
          const st = statusFor(tr.key);
          return (
            <div key={tr.key} className="metal-step" style={{ '--step': i }}>
              <MetalCard
                tierKey={tr.key}
                name={tierName(tr.key)}
                beastName={t(`tier.beast.${tr.key}`)}
                memberName={user?.name || t('tier.memberGuest')}
                memberLabel={t('tier.memberLabel')}
                status={st}
                statusLabel={st ? t(st === 'current' ? 'tier.statusCurrent' : st === 'achieved' ? 'tier.statusAchieved' : 'tier.statusLocked') : null}
                selected={selKey === tr.key}
                onSelect={() => setSelected(tr.key)}
              />
            </div>
          );
        })}
      </div>

      <div className="metal-detail" id="metal-detail">
        <div className="metal-detail-head">
          <h3>{t('tier.perksTitle', { name: tierName(selTier.key) })}</h3>
          {selStatus && (
            <span className={`guide-status st-${selStatus}`}>
              {t(selStatus === 'current' ? 'tier.statusCurrent' : selStatus === 'achieved' ? 'tier.statusAchieved' : 'tier.statusLocked')}
            </span>
          )}
        </div>
        <ul className="guide-perks">
          <li>🎟️ {t('tier.perkCards', { count: selTier.cards, percent: selTier.percent })}</li>
          <li>⏳ {t('tier.perkExpiry')}</li>
          <li>🎯 {t('tier.perkCondition', { text: THRESHOLDS[selTier.key](t) })}</li>
        </ul>
        {selGap && <p className="guide-gap">📌 {selGap}</p>}
      </div>

      <h2 className="guide-section-title">{t('tier.benefitsTitle')}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>{t('tier.colTier')}</th><th>{t('tier.colCards')}</th><th>{t('tier.colThreshold')}</th></tr>
          </thead>
          <tbody>
            {tiers.map((tr) => (
              <tr
                key={tr.key}
                className={tr.key === myKey ? 'guide-current-row' : ''}
                onClick={() => setSelected(tr.key)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span className={`tier-badge tier-${tr.key}`}>
                    {tr.key === 'diamond' ? '💎 ' : ''}{tierName(tr.key)}
                  </span>
                </td>
                <td>{t('tier.cardsPerMonth', { count: tr.cards, percent: tr.percent })}</td>
                <td>{THRESHOLDS[tr.key](t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!user && (
        <div className="guide-guest-cta">
          <p>{t('tier.guestCta')}</p>
          <div className="guide-guest-actions">
            <Link to="/dang-nhap" className="btn btn-primary">{t('tier.guestLogin')}</Link>
            <Link to="/dang-ky" className="btn btn-outline">{t('tier.guestRegister')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
