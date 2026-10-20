// Hiển thị đánh giá của sản phẩm: tổng kết điểm + thanh phân bố, danh sách review,
// form gửi review với sao bấm chọn (chỉ khi đã đăng nhập).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import './ProductReviews.css';

// Vẽ số sao theo điểm (hỗ trợ sao nửa điểm)
function Stars({ value = 0, size = '1rem' }) {
  const { t } = useLang();
  const full = Math.round(value * 2) / 2;
  return (
    <span className="rv-stars" style={{ fontSize: size }} aria-label={t('reviews.starsLabel', { value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{i <= Math.floor(full) ? '★' : i - 0.5 === full ? '⯪' : '☆'}</span>
      ))}
    </span>
  );
}

// Bộ chọn sao bấm trực tiếp (thay ô select cũ)
function StarPicker({ value, onChange }) {
  const { t } = useLang();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="rv-picker">
      <div className="rv-picker-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={`rv-star-btn${i <= shown ? ' on' : ''}`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            aria-label={t('reviews.stars', { v: i })}
          >★</button>
        ))}
      </div>
      <span className="rv-picker-label">{shown ? t(`reviews.rate${shown}`) : ''}</span>
    </div>
  );
}

export default function ProductReviews({ productId }) {
  const { user } = useStore();
  const { t, lang } = useLang();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avg_rating: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');
  const [myReviewId, setMyReviewId] = useState(null);

  const load = () => {
    api.getReviews(productId)
      .then((d) => {
        setReviews(d.reviews || []);
        setSummary(d.summary || { avg_rating: 0, count: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [productId]);

  // Nếu user đã có review cho SP này, cho phép sửa thay vì gửi mới
  useEffect(() => {
    if (!user) { setMyReviewId(null); return; }
    api.getReviews({ mine: 1 })
      .then((d) => {
        const mine = (d.reviews || []).find((r) => String(r.product_id) === String(productId));
        if (mine) {
          setMyReviewId(mine.id);
          setRating(mine.rating);
          setComment(mine.comment || '');
        } else {
          setMyReviewId(null);
        }
      })
      .catch(() => {});
  }, [user, productId]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError(''); setFormOk('');
    setSubmitting(true);
    try {
      if (myReviewId) {
        await api.updateReview(myReviewId, { rating, comment });
        setFormOk(t('reviews.updated'));
      } else {
        await api.createReview({ product_id: productId, rating, comment });
        setFormOk(t('reviews.thanks'));
      }
      setComment('');
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso) => new Date(iso + 'Z').toLocaleDateString(
    lang === 'vi' ? 'vi-VN' : lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko-KR' : 'en-US',
    { day: '2-digit', month: '2-digit', year: 'numeric' }
  );

  // Phân bố điểm từ danh sách đã tải (5★ → 1★)
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => r.rating === star).length,
  }));
  const distTotal = dist.reduce((a, b) => a + b.n, 0) || 1;

  const form = !user ? (
    <div className="rv-login">
      <Link to="/dang-nhap" className="btn btn-primary">{t('nav.login')}</Link>
      <span>{t('reviews.loginToReview')}</span>
    </div>
  ) : (
    <form onSubmit={submit} className="rv-form">
      <h3>{myReviewId ? t('reviews.updateTitle') : t('reviews.writeTitle')}</h3>
      <div className="rv-your-rating">{t('reviews.yourRating')}</div>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        className="rv-textarea"
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('reviews.placeholder')}
      />
      {formError && <p className="rv-error">{formError}</p>}
      {formOk && <p className="rv-ok">{formOk}</p>}
      <button className="btn btn-primary rv-submit" type="submit" disabled={submitting}>
        {submitting ? t('reviews.sending') : myReviewId ? t('reviews.update') : t('reviews.submit')}
      </button>
    </form>
  );

  return (
    <section className="rv-wrap">
      <h2 className="rv-title">{t('reviews.title')}</h2>

      {loading ? (
        <p className="rv-muted">{t('reviews.loading')}</p>
      ) : summary.count === 0 && reviews.length === 0 ? (
        <div className="rv-grid">
          <div className="rv-empty">
            <div className="rv-empty-star">★</div>
            <p>{t('reviews.empty')}</p>
          </div>
          <div>{form}</div>
        </div>
      ) : (
        <div className="rv-grid">
          <aside className="rv-summary">
            <div className="rv-avg">{summary.avg_rating}</div>
            <Stars value={summary.avg_rating} size="1.25rem" />
            <div className="rv-count">{t('reviews.count', { count: summary.count })}</div>
            <div className="rv-bars">
              {dist.map(({ star, n }) => (
                <div key={star} className="rv-bar-row">
                  <span className="rv-bar-star">{star}★</span>
                  <div className="rv-bar"><i style={{ width: `${(n / distTotal) * 100}%` }} /></div>
                  <span className="rv-bar-n">{n}</span>
                </div>
              ))}
            </div>
          </aside>
          <div>
            {form}
            <div className="rv-list">
              {reviews.map((r) => (
                <article key={r.id} className="rv-card">
                  <div className="rv-card-head">
                    <span className="rv-avatar">{(r.user_name || 'K').trim().charAt(0).toUpperCase()}</span>
                    <div className="rv-card-meta">
                      <strong>{r.user_name || t('reviews.customer')}</strong>
                      <small>{fmtDate(r.created_at)}</small>
                    </div>
                    <Stars value={r.rating} size="0.95rem" />
                  </div>
                  {r.comment && <p className="rv-comment">{r.comment}</p>}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { Stars };
