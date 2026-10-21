import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { api, fmtVND, fmtDay } from '../api';
import { useLang } from '../i18n/LanguageContext';
import './MyTier.css';

const STATUS_KEY = { unused: 'statusUnused', used: 'statusUsed', expired: 'statusExpired' };
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Mốc lên hạng hiển thị ở bảng quyền lợi (khớp mốc backend)
const THRESHOLDS = {
  potential: (t) => t('tier.thresholdPotential'),
  new: (t) => t('tier.thresholdNew', { count: 1 }),
  regular: (t) => t('tier.thresholdRegular', { min: 2, max: 4 }),
  loyal: (t) => t('tier.thresholdLoyal', { orders: 5, amount: fmtVND(10000000) }),
  vip: (t) => t('tier.thresholdVip', { amount: fmtVND(20000000) }),
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
          <span className={`tier-badge mytier-hero-badge tier-${tier.key}`}>
            {tier.key === 'vip' ? '👑 ' : ''}{tierName(tier.key)}
          </span>
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
        </div>
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

      {/* --- Bảng quyền lợi 5 hạng --- */}
      <h2 className="mytier-section-title">{t('tier.benefitsTitle')}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table mytier-benefits">
          <thead>
            <tr><th>{t('tier.colTier')}</th><th>{t('tier.colCards')}</th><th>{t('tier.colThreshold')}</th></tr>
          </thead>
          <tbody>
            {[...(data.tiers || [])]
              .sort((a, b) => ['potential', 'new', 'regular', 'loyal', 'vip'].indexOf(a.key) - ['potential', 'new', 'regular', 'loyal', 'vip'].indexOf(b.key))
              .map((tr) => (
              <tr key={tr.key} className={tr.key === tier.key ? 'mytier-benefit-current' : ''}>
                <td>
                  <span className={`tier-badge tier-${tr.key}`}>
                    {tr.key === 'vip' ? '👑 ' : ''}{tierName(tr.key)}
                  </span>
                </td>
                <td>{t('tier.cardsPerMonth', { count: tr.cards, percent: tr.percent })}</td>
                <td>{THRESHOLDS[tr.key] ? THRESHOLDS[tr.key](t) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                    <td><span className={`tier-badge tier-${r.tier}`}>{r.tier === 'vip' ? '👑 ' : ''}{tierName(r.tier)}</span></td>
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
