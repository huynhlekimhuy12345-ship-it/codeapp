// Trang Giới thiệu — gộp: Câu chuyện -> Blog -> Giá trị cốt lõi -> Quy trình
// (Blog từng là trang riêng /blog; đường dẫn cũ tự chuyển về mục #blog của trang này)
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../api';
import { BlogCard } from './Blog';

const VALUES = [
  ['🐄', 'v1t', 'v1d'],
  ['✋', 'v2t', 'v2d'],
  ['🛡️', 'v3t', 'v3d'],
];

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'];

export default function About() {
  const { t } = useLang();
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const values = VALUES.map(([icon, tk, dk]) => [icon, t('about.' + tk), t('about.' + dk)]);
  const steps = STEPS.map((k) => [t('about.' + k + 't'), t('about.' + k + 'd')]);

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
        <div className="value-grid">
          {values.map(([icon, t, s]) => (
            <div key={t} className="glass value-card">
              <span className="vicon" aria-hidden>{icon}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>{t('about.process')}</h2></div>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>{t('about.processDesc')}</p>
        <div className="value-grid">
          {steps.map(([t, s], i) => (
            <div key={t} className="glass value-card">
              <span className="step-num">{i + 1}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
