import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../../api';

// Tab Đánh giá — admin duyệt (giữ) hoặc XÓA HẲN đánh giá của khách.
// Mỗi dòng có link mở trang chi tiết của đúng sản phẩm được đánh giá (tab mới).
export default function ReviewsTab() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getPendingReviews(), api.getApprovedReviews()])
      .then(([p, a]) => { setPending(p.reviews || []); setApproved(a.reviews || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const decide = async (id) => {
    try {
      await api.approveReview(id, 1);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await api.deleteReview(id);
      setConfirmId(null);
      load();
    } catch (e) {
      alert(e.message);
    }
    setBusy(false);
  };

  const renderTable = (rows, isPending) => (
    <div className="table-scroll">
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
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link to={`/san-pham/${r.product_id}`} target="_blank" rel="noreferrer" className="review-prod-link">
                  {r.product_name || `Sản phẩm #${r.product_id}`} ↗
                </Link>
              </td>
              <td>{r.user_name}</td>
              <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
              <td style={{ maxWidth: 320 }}>{r.comment}</td>
              <td>{fmtDate(r.created_at)}</td>
              <td>
                {confirmId === r.id ? (
                  <div className="row-actions">
                    <span className="muted">Xóa hẳn?</span>
                    <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(r.id)}>Xóa</button>
                    <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => setConfirmId(null)}>Hủy</button>
                  </div>
                ) : (
                  <div className="row-actions">
                    {isPending && (
                      <button className="btn btn-sm btn-primary" onClick={() => decide(r.id)}>✓ Duyệt (giữ)</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmId(r.id)}>Xóa</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) return <p>Đang tải...</p>;

  return (
    <div>
      <h2>⭐ Kiểm duyệt đánh giá</h2>
      <p className="muted">
        Đánh giá chờ duyệt ({pending.length}) — chưa duyệt thì chưa hiện công khai.
        Bấm tên sản phẩm để mở trang chi tiết của sản phẩm được đánh giá.
        Xóa là xóa hẳn, đánh giá biến mất khỏi trang sản phẩm.
      </p>
      {pending.length === 0 ? <p>Không có đánh giá nào chờ duyệt.</p> : renderTable(pending, true)}

      <h3 style={{ marginTop: 30 }}>Đã duyệt — đang hiện công khai ({approved.length})</h3>
      {approved.length === 0 ? <p className="muted">Chưa có đánh giá nào được duyệt.</p> : renderTable(approved, false)}
    </div>
  );
}
