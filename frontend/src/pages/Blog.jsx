// Trang Blog (danh sách) — port từ web artifact Leather House (BlogListView)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDay } from '../api';

export default function Blog() {
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
      <span className="hero-kicker">Blog</span>
      <h1 className="page-title">Góc chia sẻ về đồ da</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Kinh nghiệm chọn, dùng và bảo quản đồ da thật từ thợ xưởng Leather House.
      </p>

      {loading ? (
        <div className="empty"><h3>Đang tải bài viết...</h3></div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <h3>Chưa có bài viết nào</h3>
          <p>Bài viết mới sẽ sớm xuất hiện. Mời bạn quay lại sau nhé!</p>
        </div>
      ) : (
        <div className="product-grid">
          {posts.map((p) => (
            <article key={p.id} className="product-card blog-card">
              <Link to={`/blog/${p.slug}`} className="thumb" aria-label={`Đọc bài: ${p.title}`}>
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
                <Link to={`/blog/${p.slug}`} className="link-more">Đọc tiếp →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
