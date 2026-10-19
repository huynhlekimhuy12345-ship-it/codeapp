// Trang chi tiết tin tức / thông báo
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

function DetailBody({ a }) {
  const title = useTranslatedText(a.title);
  const content = useTranslatedText(a.content);
  const badge = useTranslatedText(a.badge || '');
  const caption = useTranslatedText(a.image_caption || '');
  const cta = useTranslatedText(a.cta_text || '');
  const { t } = useLang();
  return (
    <article className="glass blog-article">
      <Link to="/tin-tuc" className="back-link">{t('news.backToList')}</Link>
      <div className="news-meta" style={{ marginTop: 12 }}>
        {badge && <span className="news-badge">{badge}</span>}
        <span className="date">📅 {new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
      </div>
      <h1>{title}</h1>
      {a.image_url && (
        <figure style={{ margin: '18px 0' }}>
          <img className="cover" src={a.image_url} alt={title}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          {caption && <figcaption style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.88rem', marginTop: 8, fontStyle: 'italic' }}>{caption}</figcaption>}
        </figure>
      )}
      <div className="body">
        {content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      {cta && a.cta_link && (
        <div style={{ marginTop: 24 }}>
          <Link to={a.cta_link} className="btn btn-primary">{cta} →</Link>
        </div>
      )}
    </article>
  );
}

export default function NewsDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.getActiveAnnouncements()
      .then((d) => {
        const found = (d.announcements || []).find((a) => String(a.id) === String(id));
        if (found) setItem(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="container page">
        <PageTitle title={t('news.title')} />
        <div className="empty"><h3>{t('common.loading')}</h3></div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="container page">
        <div className="empty">
          <h3>{t('news.notFound')}</h3>
          <p>{t('news.notFoundDesc')}</p>
          <Link to="/tin-tuc" className="btn btn-primary">{t('news.backToList')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <PageTitle title={t('news.title')} />
      <DetailBody a={item} />
    </div>
  );
}
