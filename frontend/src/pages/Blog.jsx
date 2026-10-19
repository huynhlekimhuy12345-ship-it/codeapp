// Trang Blog (danh sách) — port từ web artifact Leather House (BlogListView)
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api, fmtDay } from '../api';
import { useLang } from '../i18n/LanguageContext';

export default function Blog() {
  const { t } = useLang();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPosts()
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container page">
      <PageTitle title={t('nav.blog')} />
      <span className="hero-kicker">{t('nav.blog')}</span>
      <h1 className="page-title">{t('blog.title')}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        {t('blog.subtitle')}
      </p>

      {loading ? (
        <div className="empty"><h3>{t('blog.loading')}</h3></div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <h3>{t('blog.empty')}</h3>
          <p>{t('blog.emptyDesc')}</p>
        </div>
      ) : (
        <div className="product-grid">
          {posts.map((p) => (
            <article key={p.id} className="product-card blog-card">
              <Link to={`/blog/${p.slug}`} className="thumb" aria-label={t('blog.readPost', { title: p.title })}>
                {p.cover_image_url ? (
                  <img src={p.cover_image_url} alt={p.title} loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--cream)', fontWeight: 700, padding: 16, textAlign: 'center' }}>
                    Leather House Blog
                  </span>
                )}
              </Link>
              <div className="info">
                <span className="date">📅 {fmtDay(p.created_at)}</span>
                <h3><Link to={`/blog/${p.slug}`}>{p.title}</Link></h3>
                {p.excerpt && <p className="excerpt">{p.excerpt}</p>}
                <Link to={`/blog/${p.slug}`} className="link-more">{t('blog.readMore')}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
