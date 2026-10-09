// Trang chi tiết bài viết Blog — port từ web artifact Leather House (BlogDetailView)
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDay } from '../api';

export default function BlogDetail() {
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
        <div className="empty"><h3>Đang tải bài viết...</h3></div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="container page">
        <div className="empty">
          <h3>Không tìm thấy bài viết</h3>
          <p>Bài viết có thể đã bị gỡ hoặc đang ở trạng thái nháp.</p>
          <Link to="/blog" className="btn btn-primary">← Quay lại Blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <article className="glass blog-article">
        <Link to="/blog" className="back-link">← Tất cả bài viết</Link>
        <h1>{post.title}</h1>
        <p className="meta">📅 Đăng ngày {fmtDay(post.created_at)} • Leather House</p>
        {post.cover_image_url && (
          <img className="cover" src={post.cover_image_url} alt={post.title}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        )}
        {post.excerpt && <p className="lede">{post.excerpt}</p>}
        <div className="body">
          {post.content.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
      </article>

      {related.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Bài viết khác</h2></div>
          <div className="product-grid">
            {related.map((r) => (
              <article key={r.id} className="product-card blog-card">
                <Link to={`/blog/${r.slug}`} className="thumb" aria-label={`Đọc bài: ${r.title}`}>
                  {r.cover_image_url ? (
                    <img src={r.cover_image_url} alt="" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : null}
                </Link>
                <div className="info">
                  <span className="date">{fmtDay(r.created_at)}</span>
                  <h3><Link to={`/blog/${r.slug}`}>{r.title}</Link></h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
