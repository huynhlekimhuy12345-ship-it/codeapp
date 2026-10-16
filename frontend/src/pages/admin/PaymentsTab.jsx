// Tab Quản lý thanh toán (admin) — duyệt / từ chối / hoàn tiền
// Thiết kế: thẻ thống kê + danh sách thẻ thanh toán
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

const METHOD = {
  cod: { label: 'COD', icon: '💵', bg: 'rgba(166,124,82,.14)', fg: '#d9a86c' },
  bank: { label: 'Chuyển khoản', icon: '🏦', bg: 'rgba(96,165,250,.12)', fg: '#7fb3f5' },
  momo: { label: 'MoMo', icon: '📱', bg: 'rgba(236,72,153,.12)', fg: '#f07bb5' },
};
const STATUS = {
  pending: { label: 'Chờ duyệt', bg: 'rgba(232,181,106,.14)', fg: '#e8b56a', dot: '#e8b56a' },
  verified: { label: 'Đã xác nhận', bg: 'rgba(74,222,128,.12)', fg: '#6ee7a0', dot: '#4ade80' },
  failed: { label: 'Thất bại', bg: 'rgba(248,113,113,.12)', fg: '#f58a8a', dot: '#f87171' },
  refunded: { label: 'Đã hoàn tiền', bg: 'rgba(148,163,184,.14)', fg: '#a8b3c4', dot: '#94a3b8' },
};

const card = {
  background: 'linear-gradient(160deg, rgba(58,38,24,.55), rgba(32,20,12,.65))',
  border: '1px solid rgba(232,181,106,.16)',
  borderRadius: 14,
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
          <label htmlFor="pay-confirm-note">{needNote ? 'Lý do / ghi chú *' : 'Ghi chú (không bắt buộc)'}</label>
          <textarea id="pay-confirm-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
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

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...card, padding: '14px 18px', flex: '1 1 160px', minWidth: 150 }}>
      <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.45rem', fontWeight: 700, color: accent || '#ffe9c4' }}>{value}</div>
    </div>
  );
}

export default function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('');
  const [proof, setProof] = useState(null);
  const [confirming, setConfirming] = useState(null); // { payment, action }

  const load = () => {
    const q = filter ? `?status=${filter}` : '';
    request(`/api/payments${q}`).then((d) => setPayments(d.payments || [])).catch(() => {});
  };
  useEffect(() => { load(); }, [filter]);

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

  const total = payments.length;
  const pending = payments.filter((p) => p.status === 'pending').length;
  const verified = payments.filter((p) => p.status === 'verified').length;
  const collected = payments.filter((p) => p.status === 'verified').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div>
      {/* Thống kê nhanh */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatCard label="Tổng giao dịch" value={total} />
        <StatCard label="Chờ duyệt" value={pending} accent="#e8b56a" />
        <StatCard label="Đã xác nhận" value={verified} accent="#6ee7a0" />
        <StatCard label="Tổng đã thu" value={fmtVND(collected)} accent="#ffe9c4" />
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>💳 Quản lý thanh toán</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 10 }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Danh sách thẻ thanh toán */}
      <div style={{ display: 'grid', gap: 12 }}>
        {payments.map((p) => {
          const m = METHOD[p.method] || { label: p.method, icon: '💰', bg: 'rgba(148,163,184,.12)', fg: '#a8b3c4' };
          const s = STATUS[p.status] || { label: p.status, bg: 'rgba(148,163,184,.12)', fg: '#a8b3c4', dot: '#94a3b8' };
          return (
            <div key={p.id} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>#{p.id}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: m.bg, color: m.fg, padding: '4px 12px', borderRadius: 20,
                      fontSize: '.82rem', fontWeight: 600,
                    }}>{m.icon} {m.label}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: s.bg, color: s.fg, padding: '4px 12px', borderRadius: 20,
                      fontSize: '.82rem', fontWeight: 600,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                      {s.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: '.9rem' }}>
                    Đơn <strong style={{ color: '#ffe9c4' }}>#{p.order_id}</strong>
                    {p.order_status && <span> · {p.order_status}</span>}
                    {' · '}{p.customer_name}
                    {(p.user_email || p.phone) && <span> · {p.user_email || p.phone}</span>}
                  </div>
                  <div style={{ marginTop: 4, fontSize: '.82rem', color: 'var(--muted)' }}>{fmtDate(p.created_at)}</div>
                  {p.note && (
                    <div style={{ marginTop: 8, fontSize: '.88rem', color: '#d9c9a8', fontStyle: 'italic' }}>
                      “{p.note}”
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffe9c4' }}>{fmtVND(p.amount)}</div>
                  <div className="row-actions" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                    {p.proof_url && (
                      <button className="btn btn-small btn-outline" onClick={() => setProof(p)}>🖼 Xem ảnh</button>
                    )}
                    {p.status === 'pending' && (
                      <>
                        <button className="btn btn-small btn-primary" onClick={() => onAction(p, 'verified')}>✓ Duyệt</button>
                        <button className="btn btn-small btn-outline" onClick={() => onAction(p, 'failed')}>Từ chối</button>
                      </>
                    )}
                    {p.status === 'verified' && (
                      <button className="btn btn-small btn-danger" onClick={() => onAction(p, 'refund')}>Hoàn tiền</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {payments.length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💳</div>
            Chưa có thanh toán nào
          </div>
        )}
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
