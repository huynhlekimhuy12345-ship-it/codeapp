// Hiển thị đánh giá của sản phẩm: điểm trung bình, danh sách review,
// form gửi review (chỉ khi đã đăng nhập). Các hàm api do coordinator bổ sung vào api.js.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';

// Vẽ số sao theo điểm (hỗ trợ sao nửa điểm)
function Stars({ value = 0, size = '1rem' }) {
  const { t } = useLang();
  const full = Math.round(value * 2) / 2;
  return (
    <span style={{ color: '#c98a2b', fontSize: size, letterSpacing: '2px' }} aria-label={t('reviews.starsLabel', { value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{i <= Math.floor(full) ? '★' : i - 0.5 === full ? '⯪' : '☆'}</span>
      ))}
    </span>
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
      const payload = { product_id: productId, rating, comment };
      if (myReviewId) {
        await api.updateReview(myReviewId, { rating, comment });
        setFormOk(t('reviews.updated'));
      } else {
        await api.createReview(payload);
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

  return (
    <section className="reviews" style={{ marginTop: '3rem' }}>
      <h2>{t('reviews.title')}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
        {loading ? (
          <span>{t('reviews.loading')}</span>
        ) : summary.count > 0 ? (
          <>
            <span style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.avg_rating}</span>
            <div>
              <Stars value={summary.avg_rating} />
              <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>
                {t('reviews.count', { count: summary.count })}
              </div>
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>{t('reviews.empty')}</span>
        )}
      </div>

      {!user ? (
        <p className="card" style={{ padding: '1rem' }}>
          <Link to="/dang-nhap" className="btn">{t('nav.login')}</Link>{' '}
          {t('reviews.loginToReview')}
        </p>
      ) : (
        <form onSubmit={submit} className="card" style={{ padding: '1.25rem', maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>
            {myReviewId ? t('reviews.updateTitle') : t('reviews.writeTitle')}
          </h3>
          <label>
            {t('reviews.yourRating')}{' '}
            <select value={rating} onChange={(e) => setRating(parseInt(e.target.value))}>
              {[5, 4, 3, 2, 1].map((v) => (
                <option key={v} value={v}>{t('reviews.stars', { v })}</option>
              ))}
            </select>
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('reviews.placeholder')}
            style={{ width: '100%', marginTop: '.75rem' }}
          />
          {formError && <p className="error">{formError}</p>}
          {formOk && <p className="success">{formOk}</p>}
          <button className="btn" type="submit" disabled={submitting} style={{ marginTop: '.75rem' }}>
            {submitting ? t('reviews.sending') : myReviewId ? t('reviews.update') : t('reviews.submit')}
          </button>
        </form>
      )}

      <div className="review-list" style={{ marginTop: '1.5rem' }}>
        {reviews.map((r) => (
          <article key={r.id} className="card" style={{ padding: '1rem', marginBottom: '1rem', maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{r.user_name || t('reviews.customer')}</strong>
              <small style={{ color: 'var(--muted)' }}>
                {new Date(r.created_at + 'Z').toLocaleDateString(lang === 'vi' ? 'vi-VN' : lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko-KR' : 'en-US')}
              </small>
            </div>
            <Stars value={r.rating} />
            {r.comment && <p style={{ margin: '.5rem 0 0' }}>{r.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export { Stars };
