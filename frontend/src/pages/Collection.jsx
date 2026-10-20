// Trang Bộ sưu tập — phiên bản ẢNH THẬT (không còn 3D).
// Cấu trúc cuộn 3 giai đoạn: MỞ ĐẦU (hero cặp da tách nền) → KHÁM PHÁ (panel ảnh trôi
// ngang, trình chiếu ghim bằng GSAP ScrollTrigger) → BỘ SƯU TẬP (lưới gallery).
import { useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { api, fmtVND } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useProductName, useTranslatedText } from '../i18n/TranslatedProduct';
import './Collection.css';

gsap.registerPlugin(ScrollTrigger);

/** Hạt bụi vàng bay nhẹ — canvas 2D, không chứa chữ. */
function DustCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const parts = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      s: 0.0004 + Math.random() * 0.0012,
      sway: Math.random() * Math.PI * 2,
      a: 0.15 + Math.random() * 0.4,
    }));
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const tick = (now) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.s; p.sway += 0.008;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const x = (p.x + Math.sin(p.sway) * 0.012) * w;
        const y = p.y * h;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232, 181, 106, ${p.a * (0.7 + 0.3 * Math.sin(now / 900 + p.sway))})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="cl-dust" aria-hidden />;
}

/** Thanh chỉ báo 3 giai đoạn (sticky dưới navbar). */
function PhaseBar({ phase, onGo }) {
  const { t } = useLang();
  const items = [
    { key: 0, label: t('collection.phaseStart'), target: 'cl-start' },
    { key: 1, label: t('collection.phaseExplore'), target: 'cl-explore' },
    { key: 2, label: t('collection.phaseGallery'), target: 'cl-gallery' },
  ];
  return (
    <nav className="cl-phasebar" aria-label="Giai đoạn bộ sưu tập">
      <ul>
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              className={phase === it.key ? 'active' : ''}
              onClick={() => onGo(it.target)}
              aria-current={phase === it.key ? 'true' : undefined}
            >
              <span className="cl-dot" />
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Thẻ thông tin sản phẩm đang ở trung tâm (kính mờ, kích thước cố định). */
function ExploreInfo({ p, index, total }) {
  const { t } = useLang();
  const name = useProductName(p);
  const cat = useTranslatedText(p.category_name || t('collection.defaultCategory'));
  if (!p) return null;
  return (
    <div className="cl-info glass">
      <div className="cl-counter">{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
      <h3>{name}</h3>
      <p className="cl-info-cat">{cat}</p>
      <p className="cl-price">{fmtVND(p.price)}</p>
      <Link to={`/san-pham/${p.id}`} className="btn btn-primary">{t('collection.viewDetail')}</Link>
    </div>
  );
}

/** Một panel ảnh trong mục Khám phá. */
function ExplorePanel({ p }) {
  const name = useProductName(p);
  return (
    <div className="cl-panel">
      <figure className="cl-panel-frame">
        <img src={p.image_url} alt={name} loading="lazy" draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <img src={p.image_url} alt="" aria-hidden className="cl-reflect"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </figure>
    </div>
  );
}

/** Thẻ sản phẩm trong lưới gallery. */
function GalleryCard({ p }) {
  const { t } = useLang();
  const name = useProductName(p);
  const cat = useTranslatedText(p.category_name || t('collection.defaultCategory'));
  return (
    <article className="cl-card glass">
      <Link to={`/san-pham/${p.id}`} className="cl-card-thumb" aria-label={name}>
        <img src={p.image_url} alt={name} loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </Link>
      <div className="cl-card-body">
        <h3><Link to={`/san-pham/${p.id}`}>{name}</Link></h3>
        <p className="cl-info-cat">{cat}</p>
        <div className="cl-card-row">
          <span className="cl-price">{fmtVND(p.price)}</span>
          <Link to={`/san-pham/${p.id}`} className="btn btn-small btn-outline">{t('collection.viewDetail')}</Link>
        </div>
      </div>
    </article>
  );
}

export default function Collection() {
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState(0);
  const [mode, setMode] = useState('gsap'); // 'gsap' | 'fallback'

  const heroRef = useRef(null);
  const exploreRef = useRef(null);
  const galleryRef = useRef(null);
  const pinRef = useRef(null);
  const trackRef = useRef(null);

  // 1. Nạp sản phẩm trưng bày: ưu tiên danh sách admin chọn trong trang quản trị;
  //    chưa chọn thì lấy 6 sản phẩm đầu tiên.
  useEffect(() => {
    api.getProducts({ showcase: 1, limit: 6 })
      .then((d) => {
        if (d.products && d.products.length > 0) { setProducts(d.products); return null; }
        return api.getProducts({ limit: 6, sort: 'oldest' })
          .then((d2) => setProducts(d2.products || []));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  // 2. Theo dõi giai đoạn đang xem cho thanh chỉ báo
  useEffect(() => {
    const secs = [heroRef.current, exploreRef.current, galleryRef.current];
    if (secs.some((s) => !s)) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            if (en.target === heroRef.current) setPhase(0);
            else if (en.target === exploreRef.current) setPhase(1);
            else setPhase(2);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px' }
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [loading]);

  // 3. GSAP: ghim mục Khám phá, scrub panel trôi ngang. Lỗi → chế độ fallback cuộn ngang tay.
  useEffect(() => {
    if (products.length < 2) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode('fallback');
      return undefined;
    }
    let ctx = null;
    try {
      ctx = gsap.context(() => {
        const track = trackRef.current;
        const pin = pinRef.current;
        const getDist = () => Math.max(0, track.scrollWidth - pin.clientWidth);
        // Panel nào gần trung tâm màn hình nhất → to/rõ nhất VÀ thẻ thông tin hiện đúng panel đó
        const updateActive = () => {
          const panels = track.querySelectorAll('.cl-panel');
          let best = 0;
          let bestD = Infinity;
          panels.forEach((el, i) => {
            const r = el.getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - window.innerWidth / 2);
            const f = Math.max(0, 1 - (d / window.innerWidth) * 2.4);
            gsap.set(el, { scale: 0.9 + f * 0.14, opacity: 0.55 + f * 0.45 });
            if (d < bestD) { bestD = d; best = i; }
          });
          setActive((prev) => (prev === best ? prev : best));
        };
        gsap.to(track, {
          x: () => -getDist(),
          ease: 'none',
          scrollTrigger: {
            trigger: exploreRef.current,
            start: 'top top',
            end: () => `+=${getDist() * 1.8}`,
            pin: true,
            scrub: 1,
            snap: {
              snapTo: 1 / Math.max(1, products.length - 1),
              duration: { min: 0.3, max: 0.7 },
              delay: 0.05,
              ease: 'power2.inOut',
            },
            invalidateOnRefresh: true,
            onUpdate: updateActive,
            onRefresh: () => requestAnimationFrame(updateActive),
          },
        });
        requestAnimationFrame(updateActive);
      });
      setMode('gsap');
    } catch {
      setMode('fallback');
    }
    return () => { if (ctx) ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  // 4. Fallback: cuộn ngang tay, panel gần trung tâm nhất → thẻ thông tin
  useEffect(() => {
    if (mode !== 'fallback' || !trackRef.current) return undefined;
    const track = trackRef.current;
    const onScroll = () => {
      const panels = track.querySelectorAll('.cl-panel');
      let best = 0;
      let bestD = Infinity;
      panels.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - window.innerWidth / 2);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive((prev) => (prev === best ? prev : best));
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => track.removeEventListener('scroll', onScroll);
  }, [mode, products.length]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="cl-page">
      <PageTitle title={t('collection.heroTitle')} />
      <DustCanvas />
      <PhaseBar phase={phase} onGo={scrollTo} />

      {/* GĐ1 — MỞ ĐẦU */}
      <section ref={heroRef} id="cl-start" className="cl-hero">
        <div className="cl-hero-copy">
          <span className="hero-kicker">{t('collection.heroKicker')}</span>
          <h1 className="hero-title">{t('collection.heroTitleA')} <em>{t('collection.heroTitleEm')}</em></h1>
          <p className="hero-sub">{t('collection.heroSub')}</p>
          <p className="hero-sub cl-hero-sub2">{t('collection.heroSub2')}</p>
        </div>
        <div className="cl-bag-stage">
          <div className="cl-bag-glow" aria-hidden />
          <div className="cl-bag-static">
            <img src="/images/bag-hero-cut.png" alt={t('collection.heroTitle')} draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <img src="/images/bag-hero-cut.png" alt="" aria-hidden className="cl-reflect cl-bag-reflect"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
        </div>
      </section>

      {/* GĐ2 — KHÁM PHÁ */}
      <section ref={exploreRef} id="cl-explore" className={`cl-explore${mode === 'fallback' ? ' cl-fallback' : ''}`}>
        <div ref={pinRef} className="cl-explore-pin">
          <div className="container" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 }}>
            <span className="hero-kicker">{t('collection.phaseExplore')}</span>
          </div>
          {loading ? (
            <p className="cl-loading">{t('common.loading')}</p>
          ) : (
            <div ref={trackRef} className="cl-track">
              {products.map((p) => <ExplorePanel key={p.id} p={p} />)}
            </div>
          )}
          {!loading && products.length > 0 && <ExploreInfo p={products[active]} index={active} total={products.length} />}
        </div>
      </section>

      {/* GĐ3 — BỘ SƯU TẬP */}
      <section ref={galleryRef} id="cl-gallery" className="cl-gallery">
        <div className="container">
          <span className="hero-kicker">{t('collection.kicker')}</span>
          <h2 className="cl-gallery-title">{t('collection.phaseGallery')}</h2>
          {loading ? (
            <p className="cl-loading">{t('common.loading')}</p>
          ) : (
            <div className="cl-grid">
              {products.map((p) => <GalleryCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
