// Trang hồ sơ cá nhân: thông tin user, cập nhật tên/SĐT, danh sách review đã viết,
// liên kết tới "Đơn hàng của tôi".
// Cần coordinator bổ sung trong api.js: api.getMe() -> GET /api/users/me,
// api.updateMe({name, phone}) -> PUT /api/users/me, api.getReviews (hỗ trợ ?mine=1).
import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../context/StoreContext';

export default function ProfilePage() {
  const store = useStore();
  const user = store.user;
  // setUser sẽ được coordinator expose từ StoreContext (chưa có thì dùng hàm rỗng)
  const setUser = store.setUser || (() => {});
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getMe().catch(() => ({ user })), // dự phòng dùng user từ context nếu API chưa có
      api.getReviews({ mine: 1 }).catch(() => ({ reviews: [] })),
    ])
      .then(([meRes, revRes]) => {
        const u = meRes.user || user;
        setProfile(u);
        setName(u.name || '');
        setPhone(u.phone || '');
        setReviews(revRes.reviews || []);
      })
      .finally(() => setLoading(false));
  }, [user]); // eslint-disable-line

  if (!user) return <Navigate to="/dang-nhap" replace />;

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setSaving(true);
    try {
      const { user: u } = await api.updateMe({ name: name.trim(), phone: phone.trim() });
      setProfile(u);
      setUser(u);
      setMsg('Đã cập nhật thông tin.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container page">
      <PageTitle title="Hồ sơ" />
      <h1>Hồ sơ của tôi</h1>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <>
          <form onSubmit={save} className="card" style={{ padding: '1.25rem', maxWidth: 560 }}>
            <h3 style={{ marginTop: 0 }}>Thông tin cá nhân</h3>
            <p><strong>Email:</strong> {profile?.email}</p>
            <label>
              Họ tên:
              <input aria-label="Ô nhập" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label style={{ marginTop: '.75rem' }}>
              Số điện thoại:
              <input aria-label="Ô nhập" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
            </label>
            {msg && <p className="success">{msg}</p>}
            <button className="btn" type="submit" disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>

          <p style={{ marginTop: '1rem' }}>
            <Link to="/don-hang" className="btn">Xem đơn hàng của tôi</Link>
          </p>

          <h2 style={{ marginTop: '2rem' }}>Đánh giá đã viết ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Bạn chưa viết đánh giá nào.</p>
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="card" style={{ padding: '1rem', marginBottom: '1rem', maxWidth: 720 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong>
                  <small style={{ color: 'var(--muted)' }}>
                    {r.is_approved ? 'Đã duyệt' : 'Đang chờ duyệt'}
                  </small>
                </div>
                {r.comment && <p style={{ margin: '.5rem 0 0' }}>{r.comment}</p>}
                <Link to={`/san-pham/${r.product_id}`}>Xem sản phẩm</Link>
              </article>
            ))
          )}
        </>
      )}
    </div>
  );
}
