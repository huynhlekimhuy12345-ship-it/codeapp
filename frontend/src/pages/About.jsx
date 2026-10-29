// Trang Giới thiệu — gộp: Câu chuyện -> Blog -> Giá trị cốt lõi -> Quy trình
// (Blog từng là trang riêng /blog; đường dẫn cũ tự chuyển về mục #blog của trang này)
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../api';
import { BlogCard } from './Blog';

const VALUES = [
  ['🐄', 'v1t', 'v1d', '/images/process/da-that.jpg', '/cua-hang', 'v1link'],
  ['✋', 'v2t', 'v2d', '/images/process/khau-tay.jpg', '/bo-suu-tap', 'v2link'],
  ['🛡️', 'v3t', 'v3d', '/images/bag-hero-cut.png', '/don-hang', 'v3link'],
];

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'];

/** Ảnh từng công đoạn chế tác (đã kiểm chứng nội dung, lưu local trong web). */
const STEP_IMAGES = [
  '/images/process/da-that.jpg',
  '/images/process/step2.jpg',
  '/images/process/step3.jpg',
  '/images/process/step4.jpg',
  '/images/process/step5.jpg',
  '/images/process/khau-tay.jpg',
];

export default function About() {
  const { t } = useLang();
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const values = VALUES.map(([icon, tk, dk, img, to, lk]) => [icon, t('about.' + tk), t('about.' + dk), img, to, t('about.' + lk)]);
  const steps = STEPS.map((k) => [t('about.' + k + 't'), t('about.' + k + 'd')]);
  // Dải ảnh quy trình chế tác: lướt ngang (snap) + nút mũi tên + chấm chỉ bước
  const stripRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const goStep = (i) => {
    const el = stripRef.current;
    if (!el) return;
    const panel = el.children[i];
    if (panel) el.scrollTo({ left: panel.offsetLeft - el.offsetLeft - 2, behavior: 'smooth' });
  };
  const onStripScroll = () => {
    const el = stripRef.current;
    if (!el || !el.children.length) return;
    const w = el.children[0].offsetWidth + 16;
    const i = Math.max(0, Math.min(steps.length - 1, Math.round(el.scrollLeft / w)));
    setActiveStep(i);
  };

  useEffect(() => {
    api.getPosts()
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }, []);

  // Vào từ đường dẫn /blog cũ (chuyển hướng kèm #blog) thì cuộn xuống mục Blog
  useEffect(() => {
    if (location.hash === '#blog' && !postsLoading) {
      const el = document.getElementById('blog');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [location.hash, postsLoading]);
  return (
    <div className="container page">
      <PageTitle title={t('nav.about')} />
      <div className="about-story">
        <div>
          <span className="kicker">{t('nav.about')}</span>
          <h2>{t('about.storyTitle')}</h2>
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>{t('about.p3')}</p>
          <div className="about-cta">
            <Link to="/cua-hang" className="btn btn-primary">{t('about.viewProducts')}</Link>
            <Link to="/lien-he" className="btn btn-outline">{t('about.contactWorkshop')}</Link>
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80"
          alt={t('about.imgAlt')}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="section" id="blog">
        <div className="section-head"><h2>{t('blog.title')}</h2></div>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>{t('blog.subtitle')}</p>
        {postsLoading ? (
          <div className="empty"><h3>{t('blog.loading')}</h3></div>
        ) : posts.length === 0 ? (
          <div className="empty">
            <h3>{t('blog.empty')}</h3>
            <p>{t('blog.emptyDesc')}</p>
          </div>
        ) : (
          <div className="product-grid">
            {posts.map((p) => <BlogCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-head"><h2>{t('about.coreValues')}</h2></div>
        <div className="value-grid values-even">
          {values.map(([icon, title, s, img, to, linkText]) => (
            <Link key={title} to={to} className="glass value-card value-link-card">
              <span className="value-thumb"><img src={img} alt={title} loading="lazy" /></span>
              <span className="value-body">
                <span className="vicon" aria-hidden>{icon}</span>
                <h3>{title}</h3>
                <p>{s}</p>
                <span className="value-more">{linkText} ›</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>{t('about.process')}</h2></div>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>{t('about.processDesc')}</p>
        <div className="craft-strip" ref={stripRef} onScroll={onStripScroll}>
          {steps.map(([title, s], i) => (
            <article key={title} className="glass craft-panel">
              <div className="craft-photo">
                <img src={STEP_IMAGES[i]} alt={title} loading="lazy" />
                <span className="craft-badge">{i + 1}</span>
              </div>
              <div className="craft-body">
                <div className="craft-count">{String(i + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</div>
                <h3>{title}</h3>
                <p>{s}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="craft-nav">
          <button type="button" className="craft-arrow" onClick={() => goStep(activeStep - 1)} disabled={activeStep === 0} aria-label="Công đoạn trước">‹</button>
          <div className="craft-dots">
            {steps.map((_, i) => (
              <button type="button" key={i} className={i === activeStep ? 'on' : ''} onClick={() => goStep(i)} aria-label={`Công đoạn ${i + 1}`} />
            ))}
          </div>
          <button type="button" className="craft-arrow" onClick={() => goStep(activeStep + 1)} disabled={activeStep === steps.length - 1} aria-label="Công đoạn tiếp">›</button>
        </div>
      </div>
    </div>
  );
}
