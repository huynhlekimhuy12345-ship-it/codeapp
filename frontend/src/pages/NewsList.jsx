// Trang danh sách tin tức / thông báo của shop
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

function NewsCard({ a }) {
  const { t } = useLang();
  const title = useTranslatedText(a.title);
  const content = useTranslatedText(a.content);
  const badge = useTranslatedText(a.badge || '');
  return (
    <article className="glass news-card">
      {a.image_url && (
        <Link to={`/tin-tuc/${a.id}`} className="news-thumb" aria-label={title}>
          <img src={a.image_url} alt={title} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Link>
      )}
      <div className="news-info">
        <div className="news-meta">
          {badge && <span className="news-badge">{badge}</span>}
          <span className="date">📅 {new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
        </div>
        <h3><Link to={`/tin-tuc/${a.id}`}>{title}</Link></h3>
        <p className="excerpt">{content.length > 120 ? content.slice(0, 120) + '…' : content}</p>
        <Link to={`/tin-tuc/${a.id}`} className="link-more">{t('news.readMore')}</Link>
      </div>
    </article>
  );
}

export default function NewsList() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActiveAnnouncements()
      .then((d) => setItems(d.announcements || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container page">
      <PageTitle title={t('news.title')} />
      <span className="hero-kicker">{t('news.title')}</span>
      <h1 className="page-title">{t('news.title')}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{t('news.subtitle')}</p>

      {loading ? (
        <div className="empty"><h3>{t('common.loading')}</h3></div>
      ) : items.length === 0 ? (
        <div className="empty">
          <h3>{t('news.empty')}</h3>
          <p>{t('news.emptyDesc')}</p>
        </div>
      ) : (
        <div className="news-grid">
          {items.map((a) => <NewsCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}
