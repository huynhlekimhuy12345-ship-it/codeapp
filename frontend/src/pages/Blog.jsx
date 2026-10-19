// Trang Blog (danh sách) — port từ web artifact BI99 (BlogListView)
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api, fmtDay } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

/** Thẻ bài viết — tiêu đề + trích đoạn tự dịch theo ngôn ngữ. */
export function BlogCard({ p }) {
  const { t } = useLang();
  const title = useTranslatedText(p.title);
  const excerpt = useTranslatedText(p.excerpt || '');
  return (
    <article className="product-card blog-card">
      <Link to={`/blog/${p.slug}`} className="thumb" aria-label={t('blog.readPost', { title })}>
        {p.cover_image_url ? (
          <img src={p.cover_image_url} alt={title} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <span style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--cream)', fontWeight: 700, padding: 16, textAlign: 'center' }}>
            BI99 Blog
          </span>
        )}
      </Link>
      <div className="info">
        <span className="date">📅 {fmtDay(p.created_at)}</span>
        <h3><Link to={`/blog/${p.slug}`}>{title}</Link></h3>
        {excerpt && <p className="excerpt">{excerpt}</p>}
        <Link to={`/blog/${p.slug}`} className="link-more">{t('blog.readMore')}</Link>
      </div>
    </article>
  );
}

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
          {posts.map((p) => <BlogCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
