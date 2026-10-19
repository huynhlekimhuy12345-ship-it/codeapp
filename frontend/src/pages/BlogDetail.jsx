// Trang chi tiết bài viết Blog — port từ web artifact BI99 (BlogDetailView)
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDay } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';
import { BlogCard } from './Blog';

/** Nội dung bài viết — tiêu đề, trích đoạn, toàn văn tự dịch theo ngôn ngữ. */
function TranslatedArticle({ post }) {
  const { t } = useLang();
  const title = useTranslatedText(post.title);
  const excerpt = useTranslatedText(post.excerpt || '');
  const content = useTranslatedText(post.content || '');
  return (
    <article className="glass blog-article">
      <Link to="/blog" className="back-link">{t('blogDetail.allPosts')}</Link>
      <h1>{title}</h1>
      <p className="meta">📅 {t('blogDetail.publishedOn')} {fmtDay(post.created_at)} • BI99</p>
      {post.cover_image_url && (
        <img className="cover" src={post.cover_image_url} alt={title}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      )}
      {excerpt && <p className="lede">{excerpt}</p>}
      <div className="body">
        {content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
    </article>
  );
}

export default function BlogDetail() {
  const { t } = useLang();
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    Promise.all([api.getPost(slug), api.getPosts()])
      .then(([d, list]) => {
        setPost(d.post);
        setRelated((list.posts || []).filter((p) => p.slug !== slug).slice(0, 3));
        if (!d.post) setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <div className="container page">
        <PageTitle title={t('blogDetail.title')} />
        <div className="empty"><h3>{t('blog.loading')}</h3></div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="container page">
        <div className="empty">
          <h3>{t('blogDetail.notFound')}</h3>
          <p>{t('blogDetail.notFoundDesc')}</p>
          <Link to="/blog" className="btn btn-primary">{t('blogDetail.backToBlog')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      {post && <TranslatedArticle post={post} />}

      {related.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('blogDetail.related')}</h2></div>
          <div className="product-grid">
            {related.map((r) => <BlogCard key={r.id} p={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
