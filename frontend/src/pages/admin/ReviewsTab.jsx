import { useEffect, useState } from 'react';
import { api, fmtDate } from '../../api';

// Tab Đánh giá — admin duyệt/từ chối/xóa đánh giá sản phẩm của khách
export default function ReviewsTab() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getPendingReviews()
      .then((d) => setPending(d.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const decide = async (id, isApproved) => {
    try {
      await api.approveReview(id, isApproved);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Xóa đánh giá này?')) return;
    try {
      await api.deleteReview(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <p>Đang tải...</p>;

  return (
    <div>
      <h2>⭐ Kiểm duyệt đánh giá</h2>
      <p className="muted">Các đánh giá chờ duyệt ({pending.length}) — đánh giá chưa duyệt không hiển thị công khai.</p>
      {pending.length === 0 ? (
        <p>Không có đánh giá nào chờ duyệt.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Khách hàng</th>
              <th>Điểm</th>
              <th>Nội dung</th>
              <th>Ngày gửi</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id}>
                <td>{r.product_name}</td>
                <td>{r.user_name}</td>
                <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                <td style={{ maxWidth: 320 }}>{r.comment}</td>
                <td>{fmtDate(r.created_at)}</td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => decide(r.id, 1)}>Duyệt</button>{' '}
                  <button className="btn btn-sm btn-outline" onClick={() => decide(r.id, 0)}>Từ chối</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
