// Tab Quản lý thanh toán (admin) — duyệt / từ chối / hoàn tiền
// Dùng fetch trực tiếp tới /api/payments (gắn JWT từ localStorage) vì không được sửa api.js
import { useEffect, useState } from 'react';
import { fmtVND, fmtDate } from '../../api';

function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  return fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
    return data;
  });
}

const METHOD_LABEL = { cod: 'COD', bank: 'Chuyển khoản', momo: 'MoMo' };
const STATUS_LABEL = { pending: 'Chờ duyệt', verified: 'Đã xác nhận', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
const STATUS_STYLE = {
  pending: { background: '#fff3cd', color: '#856404' },
  verified: { background: '#d4edda', color: '#155724' },
  failed: { background: '#f8d7da', color: '#721c24' },
  refunded: { background: '#e2e3e5', color: '#383d41' },
};

// Hộp thoại xác nhận hành động (duyệt / từ chối / hoàn tiền) kèm ghi chú
function ConfirmBox({ title, message, confirmLabel, danger, needNote, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  const submit = () => {
    if (needNote && !note.trim()) { alert('Vui lòng nhập ghi chú / lý do'); return; }
    onConfirm(note.trim());
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
        <p style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: 10 }}>{message}</p>
        <div className="field">
          <label>{needNote ? 'Lý do / ghi chú *' : 'Ghi chú (không bắt buộc)'}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder={needNote ? 'Nhập lý do...' : 'Ghi chú thêm...'} />
        </div>
        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel}>Hủy</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={submit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('');
  const [proof, setProof] = useState(null); // payment đang xem ảnh proof
  const [confirming, setConfirming] = useState(null); // { payment, action }

  const load = () => {
    const q = filter ? `?status=${filter}` : '';
    request(`/api/payments${q}`).then((d) => setPayments(d.payments)).catch(() => {});
  };
  useEffect(load, [filter]);

  const doVerify = async (note) => {
    try {
      await request(`/api/payments/${confirming.payment.id}/verify`, {
        method: 'PUT', body: { action: confirming.action, note },
      });
    } catch (e) { alert(e.message); }
    setConfirming(null);
    load();
  };

  const doRefund = async (note) => {
    try {
      await request(`/api/payments/${confirming.payment.id}/refund`, { method: 'PUT', body: { note } });
    } catch (e) { alert(e.message); }
    setConfirming(null);
    load();
  };

  const onAction = (payment, action) => setConfirming({ payment, action });

  return (
    <div>
      <div className="toolbar">
        <h3>Quản lý thanh toán ({payments.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tất cả trạng thái</option>
          {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Đơn hàng</th><th>Khách hàng</th><th>Phương thức</th>
              <th>Số tiền</th><th>Trạng thái</th><th>Bằng chứng</th><th>Ghi chú</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>Đơn #{p.order_id} <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>({p.order_status})</span></td>
                <td>{p.customer_name}<br /><span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{p.user_email || p.phone}</span></td>
                <td>{METHOD_LABEL[p.method] || p.method}</td>
                <td style={{ fontWeight: 600 }}>{fmtVND(p.amount)}</td>
                <td>
                  <span className="status-chip" style={STATUS_STYLE[p.status]}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 4 }}>{fmtDate(p.created_at)}</div>
                </td>
                <td>
                  {p.proof_url
                    ? <button className="btn btn-small btn-outline" onClick={() => setProof(p)}>Xem ảnh</button>
                    : <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>—</span>}
                </td>
                <td style={{ maxWidth: 200, fontSize: '.9rem' }}>{p.note || '—'}</td>
                <td>
                  <div className="row-actions">
                    {p.status === 'pending' && (
                      <>
                        <button className="btn btn-small btn-primary" onClick={() => onAction(p, 'verified')}>Duyệt</button>
                        <button className="btn btn-small btn-outline" onClick={() => onAction(p, 'failed')}>Từ chối</button>
                      </>
                    )}
                    {p.status === 'verified' && (
                      <button className="btn btn-small btn-danger" onClick={() => onAction(p, 'refund')}>Hoàn tiền</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Chưa có thanh toán nào</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hộp xác nhận duyệt / từ chối / hoàn tiền */}
      {confirming && confirming.action === 'verified' && (
        <ConfirmBox title="Duyệt thanh toán" confirmLabel="Xác nhận duyệt"
          message={`Xác nhận đã nhận ${fmtVND(confirming.payment.amount)} cho đơn #${confirming.payment.order_id}?`}
          onCancel={() => setConfirming(null)} onConfirm={doVerify} />
      )}
      {confirming && confirming.action === 'failed' && (
        <ConfirmBox title="Từ chối thanh toán" confirmLabel="Từ chối" danger needNote
          message={`Từ chối thanh toán cho đơn #${confirming.payment.order_id}? Vui lòng ghi rõ lý do.`}
          onCancel={() => setConfirming(null)} onConfirm={doVerify} />
      )}
      {confirming && confirming.action === 'refund' && (
        <ConfirmBox title="Đánh dấu hoàn tiền" confirmLabel="Hoàn tiền" danger needNote
          message={`Đánh dấu đã hoàn ${fmtVND(confirming.payment.amount)} cho đơn #${confirming.payment.order_id}?`}
          onCancel={() => setConfirming(null)} onConfirm={doRefund} />
      )}

      {/* Xem ảnh bằng chứng chuyển khoản */}
      {proof && (
        <div className="modal-backdrop" onClick={() => setProof(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h4>Bằng chứng thanh toán — Đơn #{proof.order_id}</h4>
            <img src={proof.proof_url} alt="Bằng chứng thanh toán"
              style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, marginTop: 8 }}
              onError={(e) => { e.target.style.display = 'none'; }} />
            {!proof.proof_url && <p style={{ color: 'var(--muted)' }}>Không tải được ảnh</p>}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline" onClick={() => setProof(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
