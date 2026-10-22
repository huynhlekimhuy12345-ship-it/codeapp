import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { api, fmtVND, fmtDay } from '../api';
import { useLang } from '../i18n/LanguageContext';
import './MyTier.css';

const STATUS_KEY = { unused: 'statusUnused', used: 'statusUsed', expired: 'statusExpired' };
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const TIER_ORDER = ['potential', 'bronze', 'silver', 'gold', 'diamond'];

// Thánh thú bạch kim cho từng hạng (ảnh ở public/images/beasts)
const BEAST_IMG = {
  potential: '/images/beasts/potential.webp',
  bronze: '/images/beasts/bronze.webp',
  silver: '/images/beasts/silver.webp',
  gold: '/images/beasts/gold.webp',
  diamond: '/images/beasts/diamond.webp',
};

// Mốc lên hạng (khớp mốc backend): Đồng từ 2 đơn, Bạc 5tr, Vàng 10tr, Kim cương 20tr
const THRESHOLDS = {
  potential: (t) => t('tier.thresholdPotential'),
  bronze: (t) => t('tier.thresholdBronze', { count: 2 }),
  silver: (t) => t('tier.thresholdSilver', { amount: fmtVND(5000000) }),
  gold: (t) => t('tier.thresholdGold', { amount: fmtVND(10000000) }),
  diamond: (t) => t('tier.thresholdDiamond', { amount: fmtVND(20000000) }),
};

function ProgressBar({ pct, text, remain }) {
  return (
    <div className="mytier-progress">
      <div className="mytier-progress-track">
        <div className="mytier-progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div className="mytier-progress-meta">
        <span>{text}</span>
        <span className="mytier-remain">{remain}</span>
      </div>
    </div>
  );
}

function DiscountCard({ card, t }) {
  return (
    <div className={`mytier-card status-${card.status}`}>
      <div className="mytier-card-off">−{card.percent}%</div>
      <div className="mytier-card-main">
        <code className="mytier-card-code">{card.code}</code>
        <div className="mytier-card-note">{t('tier.cardForOne')}</div>
        <div className="mytier-card-expiry">{t('tier.cardExpiry', { date: fmtDay(card.expires_at) })}</div>
      </div>
      <span className={`mytier-status st-${card.status}`}>{t(`tier.${STATUS_KEY[card.status]}`)}</span>
    </div>
  );
}

export default function MyTier() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMyTier().then(setData).catch((e) => setError(e.message));
    api.getLeaderboard().then(setBoard).catch(() => {});
  }, []);

  const tierName = (key) => t(`tier.name.${key}`);

  if (error) {
    return (
      <div className="container page">
        <PageTitle title={t('tier.title')} />
        <h1 className="page-title">{t('tier.title')}</h1>
        <div className="form-error">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container page">
        <PageTitle title={t('tier.title')} />
        <h1 className="page-title">{t('tier.title')}</h1>
        <p className="muted">{t('tier.loading')}</p>
      </div>
    );
  }

  const { tier, stats, next, period } = data;
  const sortedTiers = [...(data.tiers || [])]
    .sort((a, b) => TIER_ORDER.indexOf(a.key) - TIER_ORDER.indexOf(b.key));
  const [year, month] = String(period || '').split('-');
  const thisMonthCards = (data.cards || []).filter((c) => c.period === period);
  const pastCards = (data.cards || []).filter((c) => c.period !== period);
  const myRank = board?.me?.rank;
  const inTop = (board?.top || []).some((r) => r.is_me);

  return (
    <div className="container page">
      <PageTitle title={t('tier.title')} />
      <h1 className="page-title">🏆 {t('tier.title')}</h1>

      {/* --- Thẻ hero: hạng hiện tại + số liệu --- */}
      <div className="mytier-hero">
        <div className="mytier-hero-top">
          <Link to="/phan-hang" className={`tier-badge mytier-hero-badge tier-${tier.key}`}>
            {tier.key === 'diamond' ? '💎 ' : ''}{tierName(tier.key)}
          </Link>
          <span className="mytier-hero-benefit">
            {t('tier.cardsPerMonth', { count: tier.cards, percent: tier.percent })}
          </span>
        </div>
        <div className="mytier-stats">
          <div className="mytier-stat">
            <span className="mytier-stat-value">{stats.order_count}</span>
            <span className="mytier-stat-label">{t('tier.ordersLabel')}</span>
          </div>
          <div className="mytier-stat">
            <span className="mytier-stat-value">{fmtVND(stats.total_spent)}</span>
            <span className="mytier-stat-label">{t('tier.spentLabel')}</span>
          </div>
          <div className="mytier-stat">
            <span className="mytier-stat-value">{myRank ? `#${myRank}` : '—'}</span>
            <span className="mytier-stat-label">{t('tier.rankLabel')}</span>
          </div>
        </div>

        {/* --- Tiến trình thăng hạng --- */}
        <div className="mytier-progress-wrap">
          <div className="mytier-progress-title">
            {t('tier.progressTitle')}
            {next && <span className="mytier-next"> → {t('tier.nextTier')}: <strong>{tierName(next.key)}</strong></span>}
          </div>
          {!next && <div className="mytier-max">{t('tier.maxTier')}</div>}
          {next && next.need?.either && <p className="muted" style={{ marginBottom: 8 }}>{t('tier.needEither')}</p>}
          {next && next.need?.orders != null && (
            <ProgressBar
              pct={(stats.order_count / (stats.order_count + next.need.orders)) * 100}
              text={t('tier.ordersProgress', { done: stats.order_count, target: stats.order_count + next.need.orders })}
              remain={t('tier.remainingOrders', { count: next.need.orders })}
            />
          )}
          {next && next.need?.spent != null && (
            <ProgressBar
              pct={(stats.total_spent / (stats.total_spent + next.need.spent)) * 100}
              text={t('tier.spentProgress', { done: fmtVND(stats.total_spent), target: fmtVND(stats.total_spent + next.need.spent) })}
              remain={t('tier.remainingSpent', { amount: fmtVND(next.need.spent) })}
            />
          )}
      <div className="mytier-ladder">
        {sortedTiers.map((tr) => (
          <Link
            key={tr.key}
            to={`/phan-hang?tier=${tr.key}`}
            className={`beast-card beast-${tr.key}${tr.key === tier.key ? ' current' : ''}`}
          >
            <img className="beast-card-art" src={BEAST_IMG[tr.key]} alt={t(`tier.beast.${tr.key}`)} loading="lazy" />
            <span className="beast-card-brand">BI99</span>
            <span className="beast-card-info">
              <span className="beast-card-tier">{tierName(tr.key)}</span>
              <span className="beast-card-beast">{t(`tier.beast.${tr.key}`)}</span>
              <span className="beast-card-threshold">{THRESHOLDS[tr.key] ? THRESHOLDS[tr.key](t) : ''}</span>
              {tr.key === tier.key
                ? <span className="beast-card-you">{t('tier.statusCurrent')}</span>
                : <span className="beast-card-you ghost" aria-hidden="true">·</span>}
            </span>
          </Link>
        ))}
      </div>
        </div>
      </div>

      <div style={{ margin: '14px 0 4px' }}>
        <Link to="/phan-hang" className="btn btn-outline">🏆 {t('tier.viewPerks')} →</Link>
      </div>

      {/* --- Thẻ giảm giá tháng này --- */}
      <h2 className="mytier-section-title">{t('tier.cardsTitle', { month, year })}</h2>
      {thisMonthCards.length === 0 ? (
        <p className="muted">{t('tier.cardsEmpty')}</p>
      ) : (
        <div className="mytier-cards-grid">
          {thisMonthCards.map((c) => <DiscountCard key={c.id} card={c} t={t} />)}
        </div>
      )}

      {pastCards.length > 0 && (
        <>
          <h3 className="mytier-sub-title">{t('tier.pastCardsTitle')}</h3>
          <div className="mytier-past-list">
            {pastCards.map((c) => (
              <div key={c.id} className="mytier-past-row">
                <code>{c.code}</code>
                <span>−{c.percent}%</span>
                <span className="muted">{c.period}</span>
                <span className={`mytier-status st-${c.status}`}>{t(`tier.${STATUS_KEY[c.status]}`)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- Bảng xếp hạng --- */}
      <h2 className="mytier-section-title">{t('tier.leaderboardTitle')}</h2>
      {board && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table mytier-board">
              <thead>
                <tr><th>#</th><th>{t('tier.colCustomer')}</th><th>{t('tier.colTier')}</th><th>{t('tier.spentLabel')}</th></tr>
              </thead>
              <tbody>
                {board.top.map((r) => (
                  <tr key={r.rank} className={r.is_me ? 'mytier-board-me' : ''}>
                    <td>{MEDALS[r.rank] || `#${r.rank}`}</td>
                    <td>
                      {r.name}
                      {r.is_me && <span className="mytier-you">{t('tier.you')}</span>}
                    </td>
                    <td><span className={`tier-badge tier-${r.tier}`}>{r.tier === 'diamond' ? '💎 ' : ''}{tierName(r.tier)}</span></td>
                    <td>{fmtVND(r.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!inTop && (
            <p className="mytier-mypos">
              {board.me?.rank
                ? t('tier.yourPosition', { rank: board.me.rank, total: board.total_customers })
                : t('tier.yourPositionNone')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
