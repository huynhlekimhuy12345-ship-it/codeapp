// Tab Hậu mãi (admin): Đổi trả / Bảo hành / Sửa chữa
// Component độc lập — coordinator gắn vào Admin.jsx như các tab khác.
// Gọi trực tiếp /api/returns|warranties|repairs (không qua api.js để không sửa file chung).
import { useEffect, useState } from 'react';

function req(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
    return data;
  });
}

const fmt = (n) => `${(parseInt(n) || 0).toLocaleString('vi-VN')} ₫`;

const RETURN_STATUS = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  completed: 'Hoàn thành',
};
const RETURN_TYPE = { return: 'Trả hàng', exchange: 'Đổi hàng' };
const REPAIR_STATUS = {
  received: 'Đã nhận',
  repairing: 'Đang sửa',
  done: 'Đã sửa xong',
  returned: 'Đã trả khách',
};

/* ---------- Section Đổi trả ---------- */
function ReturnsSection() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [refundFor, setRefundFor] = useState(null); // id yêu cầu đang nhập số tiền hoàn
  const [refundValue, setRefundValue] = useState('0');

  const load = () =>
    req(`/api/returns${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.returns))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const act = async (id, action, refund_amount) => {
    try {
      await req(`/api/returns/${id}`, { method: 'PUT', body: { action, refund_amount } });
      setRefundFor(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <section className="aftersales-section">
      <div className="toolbar">
        <h3>Đổi / trả hàng ({list.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(RETURN_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {list.map((r) => (
        <div className="order-card" key={r.id}>
          <div className="order-head">
            <strong>
              Yêu cầu #{r.id} — Đơn #{r.order_id} ({r.customer_name}) — {RETURN_TYPE[r.type]}
            </strong>
            <span className="badge">{RETURN_STATUS[r.status]}</span>
          </div>
          <p><em>Lý do:</em> {r.reason}</p>
          <p><em>Hoàn tiền:</em> {fmt(r.refund_amount)} · <em>Ngày tạo:</em> {r.created_at}</p>
          <div className="row-actions">
            {r.status === 'requested' && (
              <>
                <button className="btn-primary" onClick={() => act(r.id, 'approved')}>Duyệt</button>
                <button className="btn-danger" onClick={() => act(r.id, 'rejected')}>Từ chối</button>
              </>
            )}
            {r.status === 'approved' && refundFor !== r.id && (
              <button className="btn-primary" onClick={() => { setRefundFor(r.id); setRefundValue(String(r.refund_amount || 0)); }}>
                Hoàn thành (nhập tiền hoàn)
              </button>
            )}
            {r.status === 'approved' && refundFor === r.id && (
              <span className="inline-form">
                <input
                  type="number" min="0" value={refundValue}
                  onChange={(e) => setRefundValue(e.target.value)}
                  placeholder="Số tiền hoàn (đ)"
                  style={{ width: 160, padding: '8px 12px', borderRadius: 8 }}
                />
                <button className="btn-primary" onClick={() => act(r.id, 'completed', parseInt(refundValue) || 0)}>
                  Xác nhận hoàn thành
                </button>
                <button onClick={() => setRefundFor(null)}>Hủy</button>
              </span>
            )}
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="empty">Chưa có yêu cầu đổi/trả nào.</p>}
    </section>
  );
}

/* ---------- Section Bảo hành ---------- */
function WarrantiesSection() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [orderId, setOrderId] = useState('');
  const [months, setMonths] = useState('12');
  const [extendId, setExtendId] = useState(null);
  const [extendMonths, setExtendMonths] = useState('12');

  const load = () =>
    req(`/api/warranties${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.warranties))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const create = async () => {
    if (!orderId.trim()) { alert('Nhập mã đơn hàng'); return; }
    try {
      await req('/api/warranties', {
        method: 'POST',
        body: { order_id: parseInt(orderId), months: parseInt(months) },
      });
      setOrderId('');
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const act = async (id, action, m) => {
    try {
      await req(`/api/warranties/${id}`, { method: 'PUT', body: { action, months: m } });
      setExtendId(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <section className="aftersales-section">
      <div className="toolbar">
        <h3>Bảo hành ({list.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hiệu lực</option>
          <option value="expired">Hết hạn</option>
          <option value="void">Đã hủy</option>
        </select>
      </div>
      <div className="inline-form" style={{ marginBottom: 16 }}>
        <input
          value={orderId} onChange={(e) => setOrderId(e.target.value)}
          placeholder="Mã đơn hàng" type="number"
          style={{ width: 140, padding: '8px 12px', borderRadius: 8 }}
        />
        <input
          value={months} onChange={(e) => setMonths(e.target.value)}
          placeholder="Số tháng" type="number" min="1" max="120"
          style={{ width: 110, padding: '8px 12px', borderRadius: 8 }}
        />
        <button className="btn-primary" onClick={create}>Tạo bảo hành</button>
      </div>
      {list.map((w) => (
        <div className="order-card" key={w.id}>
          <div className="order-head">
            <strong>Bảo hành #{w.id} — Đơn #{w.order_id} ({w.customer_name})</strong>
            <span className="badge">{w.status === 'active' ? 'Đang hiệu lực' : w.status === 'expired' ? 'Hết hạn' : 'Đã hủy'}</span>
          </div>
          <p><em>Thời hạn:</em> {w.months} tháng — {w.start_date} → {w.end_date}</p>
          {w.status !== 'void' && (
            <div className="row-actions">
              {extendId !== w.id && (
                <button onClick={() => { setExtendId(w.id); setExtendMonths('12'); }}>Gia hạn</button>
              )}
              {extendId === w.id && (
                <span className="inline-form">
                  <input
                    type="number" min="1" max="120" value={extendMonths}
                    onChange={(e) => setExtendMonths(e.target.value)}
                    style={{ width: 90, padding: '8px 12px', borderRadius: 8 }}
                  />
                  <button className="btn-primary" onClick={() => act(w.id, 'extend', parseInt(extendMonths))}>
                    Xác nhận gia hạn
                  </button>
                  <button onClick={() => setExtendId(null)}>Hủy</button>
                </span>
              )}
              <button className="btn-danger" onClick={() => act(w.id, 'void')}>Hủy bảo hành</button>
            </div>
          )}
        </div>
      ))}
      {list.length === 0 && <p className="empty">Chưa có bảo hành nào.</p>}
    </section>
  );
}

/* ---------- Section Sửa chữa ---------- */
function RepairsSection() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState({}); // id -> { status, fee }

  const load = () =>
    req(`/api/repairs${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.repairs))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const startEdit = (r) => setEditing((s) => ({ ...s, [r.id]: { status: r.status, fee: String(r.fee || 0) } }));
  const save = async (id) => {
    const e = editing[id];
    try {
      await req(`/api/repairs/${id}`, {
        method: 'PUT',
        body: { status: e.status, fee: parseInt(e.fee) || 0 },
      });
      setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <section className="aftersales-section">
      <div className="toolbar">
        <h3>Sửa chữa / bảo dưỡng ({list.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(REPAIR_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {list.map((r) => {
        const e = editing[r.id];
        return (
          <div className="order-card" key={r.id}>
            <div className="order-head">
              <strong>
                Phiếu #{r.id}{r.order_id ? ` — Đơn #${r.order_id} (${r.customer_name || ''})` : ''}{r.warranty_id ? ` — BH #${r.warranty_id}` : ''}
              </strong>
              <span className="badge">{REPAIR_STATUS[r.status]}</span>
            </div>
            <p><em>Mô tả:</em> {r.description}</p>
            <p><em>Phí:</em> {fmt(r.fee)} · <em>Ngày tạo:</em> {r.created_at}</p>
            {!e && (
              <div className="row-actions">
                <button onClick={() => startEdit(r)}>Cập nhật trạng thái / phí</button>
              </div>
            )}
            {e && (
              <div className="row-actions">
                <select
                  value={e.status}
                  onChange={(ev) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], status: ev.target.value } }))}
                  style={{ padding: '8px 12px', borderRadius: 8 }}
                >
                  {Object.entries(REPAIR_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  type="number" min="0" value={e.fee}
                  onChange={(ev) => setEditing((s) => ({ ...s, [r.id]: { ...s[r.id], fee: ev.target.value } }))}
                  placeholder="Phí (đ)"
                  style={{ width: 140, padding: '8px 12px', borderRadius: 8 }}
                />
                <button className="btn-primary" onClick={() => save(r.id)}>Lưu</button>
                <button onClick={() => setEditing((s) => { const n = { ...s }; delete n[r.id]; return n; })}>Hủy</button>
              </div>
            )}
          </div>
        );
      })}
      {list.length === 0 && <p className="empty">Chưa có phiếu sửa chữa nào.</p>}
    </section>
  );
}

export default function AftersalesTab() {
  return (
    <div>
      <ReturnsSection />
      <WarrantiesSection />
      <RepairsSection />
    </div>
  );
}
