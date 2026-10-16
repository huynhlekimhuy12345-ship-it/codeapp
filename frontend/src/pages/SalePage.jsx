import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
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

function voucherText(v) {
  return v.type === 'percent' ? `Giảm ${v.value}%` : `Giảm ${fmtVND(v.value)}`;
}

export default function SalePage() {
  const { addToCart } = useStore();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [status, setStatus] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [products, setProducts] = useState([]);
  const [copied, setCopied] = useState('');

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
  }, []);

  const target = event ? (status === 'live' ? event.end_at : event.start_at) : null;
  const cd = useCountdown(target);
  const pad = (n) => String(n).padStart(2, '0');

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
        <p style={{ textAlign: 'center', padding: 60 }}>Đang tải chương trình khuyến mãi...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container page sale-page">
        <div className="sale-empty">
          <h2>Chưa có chương trình khuyến mãi nào</h2>
          <p>Hãy quay lại sau — Leather House sẽ sớm có ưu đãi hấp dẫn dành cho bạn.</p>
          <Link className="btn btn-primary" to="/cua-hang">Xem sản phẩm</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sale-page">
      <header className="sale-hero">
        <div className="container">
          <span className="sale-kicker">
            {status === 'live' ? '🔥 Đang diễn ra' : '⏳ Sắp diễn ra'} · Leather House
          </span>
          <h1>{event.title || event.name}</h1>
          {event.subtitle && <p className="sale-sub">{event.subtitle}</p>}
          {target && (
            <div className="sale-countdown">
              {[
                [pad(cd.d), 'Ngày'],
                [pad(cd.h), 'Giờ'],
                [pad(cd.m), 'Phút'],
                [pad(cd.s), 'Giây'],
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
              ? 'Ưu đãi kết thúc khi hết giờ — số lượng voucher có hạn.'
              : 'Lưu mã trước, áp dụng lúc thanh toán khi chương trình bắt đầu.'}
          </p>
        </div>
      </header>

      <main className="container">
        {!!vouchers.length && (
          <section className="sale-section">
            <h2>Voucher {event.name}</h2>
            <p className="sale-desc">Áp dụng lúc thanh toán. Mỗi mã 1 lượt/khách.</p>
            <div className="sale-vouchers">
              {vouchers.map((v) => (
                <div className="sale-voucher" key={v.code}>
                  <div className="sv-off">{voucherText(v)}</div>
                  <button
                    className={`sv-code ${copied === v.code ? 'copied' : ''}`}
                    onClick={() => copyCode(v.code)}
                    title="Bấm để lưu mã"
                  >
                    {copied === v.code ? 'Đã lưu ✓' : v.code}
                  </button>
                  <ul>
                    {!!v.min_order && <li>Đơn tối thiểu: <b>{fmtVND(v.min_order)}</b></li>}
                    {!!v.usage_limit && (
                      <li>Còn <b>{Math.max(0, v.usage_limit - v.used_count)}</b> lượt</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!products.length && (
          <section className="sale-section">
            <h2>Sản phẩm sale</h2>
            <p className="sale-desc">Giá ưu đãi chỉ áp dụng trong thời gian diễn ra chương trình.</p>
            <div className="sale-products">
              {products.map((p) => (
                <div className="sale-product" key={p.id}>
                  <Link to={`/san-pham/${p.id}`} className="sp-img">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=Leather+House'; }}
                    />
                    <span className="sp-badge">-{p.discount_percent}%</span>
                  </Link>
                  <div className="sp-body">
                    <Link to={`/san-pham/${p.id}`}><h3>{p.name}</h3></Link>
                    <div className="sp-prices">
                      <span className="sp-old">{fmtVND(p.price)}</span>
                      <span className="sp-sale">{fmtVND(p.sale_price)}</span>
                    </div>
                    <button
                      className="btn btn-primary btn-small"
                      disabled={p.stock <= 0}
                      onClick={() => addToCart({ ...p, price: p.sale_price })}
                    >
                      🛒 Thêm vào giỏ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
