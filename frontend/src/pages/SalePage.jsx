import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import { useProductName, useTranslatedText } from '../i18n/TranslatedProduct';
import './SalePage.css';

function useCountdown(targetIso) {
  const [left, setLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      setLeft({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return left;
}

function voucherText(v, t) {
  return v.type === 'percent' ? t('sale.percentOff', { value: v.value }) : t('sale.amountOff', { amount: fmtVND(v.value) });
}

/** Thẻ SP khuyến mãi: tên SP từ DB dịch theo ngôn ngữ. */
function SaleProductItem({ p }) {
  const { addToCart } = useStore();
  const { t } = useLang();
  const name = useProductName(p);
  return (
    <div className="sale-product">
      <Link to={`/san-pham/${p.id}`} className="sp-img">
        <img
          src={p.image_url}
          alt={name}
          loading="lazy"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=BI99'; }}
        />
        <span className="sp-badge">-{p.discount_percent}%</span>
      </Link>
      <div className="sp-body">
        <Link to={`/san-pham/${p.id}`}><h3>{name}</h3></Link>
        <div className="sp-prices">
          <span className="sp-old">{fmtVND(p.price)}</span>
          <span className="sp-sale">{fmtVND(p.sale_price)}</span>
        </div>
        <button
          className="btn btn-primary btn-small"
          disabled={p.stock <= 0}
          onClick={() => addToCart({ ...p, price: p.sale_price })}
        >
          {t('common.addToCart')}
        </button>
      </div>
    </div>
  );
}

/* Ngày hết hạn của thẻ săn: cuối ngày (giờ mở săn + số ngày hạn) — khớp cách tính ở máy chủ */
function huntExpiryText(startStr, days) {
  const d = new Date(String(startStr || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ---------- Săn thẻ: từng sự kiện có đồng hồ đếm ngược riêng ---------- */
function HuntEventBlock({ ev, user, onClaimed }) {
  const { t } = useLang();
  const name = useTranslatedText(ev.name || '');
  const target = ev.phase === 'live' ? ev.ends_at : ev.starts_at;
  const cd = useCountdown(String(target || '').replace(' ', 'T'));
  const pad = (n) => String(n).padStart(2, '0');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState({}); // { [typeId]: {ok, text} }

  const claim = async (type) => {
    setBusyId(type.id);
    setNotice((n) => ({ ...n, [type.id]: null }));
    try {
      const r = await fetch(`/api/hunt-events/${ev.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ type_id: type.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setNotice((n) => ({ ...n, [type.id]: { ok: true, text: t('sale.huntReceived', { percent: type.percent }) } }));
      if (onClaimed) onClaimed();
    } catch (e) {
      setNotice((n) => ({ ...n, [type.id]: { ok: false, text: e.message } }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="hunt-event">
      <div className="hunt-head">
        <h3>{name}</h3>
        <span className={`hunt-phase ${ev.phase}`}>
          {ev.phase === 'live' ? t('sale.huntLive') : t('sale.huntUpcoming')}
        </span>
      </div>
      <div className="hunt-count">
        {[
          [pad(cd.d), t('sale.days')],
          [pad(cd.h), t('sale.hours')],
          [pad(cd.m), t('sale.minutes')],
          [pad(cd.s), t('sale.seconds')],
        ].map(([n, l]) => (
          <div className="cd-cell small" key={l}>
            <div className="cd-num">{n}</div>
            <div className="cd-lbl">{l}</div>
          </div>
        ))}
      </div>
      <div className="hunt-types">
        {ev.types.map((type) => {
          const soldOut = type.remaining <= 0;
          const mine = type.claimed_by_me;
          return (
            <div className={`hunt-type ${soldOut ? 'soldout' : ''} ${mine ? 'mine' : ''}`} key={type.id}>
              <div className="ht-off">-{type.percent}%</div>
              <div className="ht-label">{type.label}</div>
              <ul>
                <li>{t('sale.huntValid', { days: type.valid_days, date: huntExpiryText(ev.starts_at, type.valid_days) })}</li>
                <li><b>{t('sale.huntLeft', { left: type.remaining, total: type.quantity })}</b></li>
              </ul>
              <div className="ht-bar"><span style={{ width: `${type.quantity ? (type.remaining / type.quantity) * 100 : 0}%` }} /></div>
              {!user ? (
                <Link className="btn btn-primary btn-small" to="/dang-nhap">{t('sale.huntLogin')}</Link>
              ) : (
                <button
                  className="btn btn-primary btn-small"
                  disabled={ev.phase !== 'live' || soldOut || mine || busyId === type.id}
                  onClick={() => claim(type)}
                >
                  {mine ? t('sale.huntSaved') : soldOut ? t('sale.huntSoldOut') : ev.phase !== 'live' ? t('sale.huntUpcoming') : busyId === type.id ? '...' : t('sale.huntSave')}
                </button>
              )}
              {notice[type.id] && (
                <p className={`ht-note ${notice[type.id].ok ? 'ok' : 'err'}`}>{notice[type.id].text}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SalePage() {
  const { addToCart, user } = useStore();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [products, setProducts] = useState([]);
  const [copied, setCopied] = useState('');
  const [huntEvents, setHuntEvents] = useState([]);

  const loadHunts = () => {
    const token = localStorage.getItem('token');
    return fetch('/api/hunt-events/active', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => setHuntEvents(d.events || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/promo-events/active')
      .then((r) => r.json())
      .then((d) => {
        setEvent(d.event);
        setStatus(d.status);
        setVouchers(d.vouchers || []);
        setProducts(d.products || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadHunts();
    const id = setInterval(loadHunts, 30000); // cập nhật số thẻ còn lại mỗi 30 giây
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const target = event ? (status === 'live' ? event.end_at : event.start_at) : null;
  const cd = useCountdown(target);
  const pad = (n) => String(n).padStart(2, '0');
  // Tiêu đề / phụ đề / tên sự kiện từ DB (tiếng Việt) dịch theo ngôn ngữ
  const eventTitle = useTranslatedText(event ? (event.title || event.name) : '');
  const eventName = useTranslatedText(event?.name || '');
  const eventSub = useTranslatedText(event?.subtitle || '');

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) {
    return (
      <div className="container page sale-page">
        <PageTitle title={t('nav.sale')} />
        <p style={{ textAlign: 'center', padding: 60 }}>{t('sale.loading')}</p>
      </div>
    );
  }

  if (!event && huntEvents.length === 0) {
    return (
      <div className="container page sale-page">
        <div className="sale-empty">
          <h2>{t('sale.empty')}</h2>
          <p>{t('sale.emptyDesc')}</p>
          <Link className="btn btn-primary" to="/cua-hang">{t('about.viewProducts')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sale-page">
      {event && (
      <header className="sale-hero">
        <div className="container">
          <span className="sale-kicker">
            {status === 'live' ? t('sale.live') : t('sale.upcoming')} · BI99
          </span>
          <h1>{eventTitle}</h1>
          {event.subtitle && <p className="sale-sub">{eventSub}</p>}
          {target && (
            <div className="sale-countdown">
              {[
                [pad(cd.d), t('sale.days')],
                [pad(cd.h), t('sale.hours')],
                [pad(cd.m), t('sale.minutes')],
                [pad(cd.s), t('sale.seconds')],
              ].map(([n, l]) => (
                <div className="cd-cell" key={l}>
                  <div className="cd-num">{n}</div>
                  <div className="cd-lbl">{l}</div>
                </div>
              ))}
            </div>
          )}
          <p className="sale-note">
            {status === 'live'
              ? t('sale.liveNote')
              : t('sale.upcomingNote')}
          </p>
        </div>
      </header>
      )}

      <main className="container">
        {!!huntEvents.length && (
          <section className="sale-section">
            <h2>{t('sale.huntTitle')}</h2>
            <p className="sale-desc">{t('sale.huntDesc')}</p>
            {huntEvents.map((ev) => (
              <HuntEventBlock key={ev.id} ev={ev} user={user} onClaimed={loadHunts} />
            ))}
          </section>
        )}
        {!!vouchers.length && (
          <section className="sale-section">
            <h2>{t('sale.voucherTitle', { name: eventName })}</h2>
            <p className="sale-desc">{t('sale.voucherDesc')}</p>
            <div className="sale-vouchers">
              {vouchers.map((v) => (
                <div className="sale-voucher" key={v.code}>
                  <div className="sv-off">{voucherText(v, t)}</div>
                  <button
                    className={`sv-code ${copied === v.code ? 'copied' : ''}`}
                    onClick={() => copyCode(v.code)}
                    title={t('sale.copyHint')}
                  >
                    {copied === v.code ? t('sale.copied') : v.code}
                  </button>
                  <ul>
                    {!!v.min_order && <li>{t('sale.minOrder')}: <b>{fmtVND(v.min_order)}</b></li>}
                    {!!v.usage_limit && (
                      <li>{t('sale.remaining', { count: Math.max(0, v.usage_limit - v.used_count) })}</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!products.length && (
          <section className="sale-section">
            <h2>{t('sale.productsTitle')}</h2>
            <p className="sale-desc">{t('sale.productsDesc')}</p>
            <div className="sale-products">
              {products.map((p) => (
                <SaleProductItem key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
