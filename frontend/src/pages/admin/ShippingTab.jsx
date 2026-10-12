// Tab Vận chuyển (admin): quản lý phương thức vận chuyển + vận đơn của đơn hàng.
// GHI CHÚ TÍCH HỢP (dành cho parent/orchestrator):
// - Backend cần mount route trong server.js:
//     app.use('/api/shipping', require('./routes/shipping'));
// - api.js không được phép sửa ở task này nên component dùng helper cục bộ
//   shipApi() gọi thẳng /api/shipping (tạm thời, worker khác có thể chuyển vào api.js).
// - Admin.jsx cần thêm tab: {tab === 'shipping' && <ShippingTab />} và nút chọn tab.
import { useEffect, useState } from 'react';
import { fmtVND, fmtDate } from '../../api';

// Helper gọi API vận chuyển — sao chép convention của api.js (token từ localStorage)
function getToken() {
  return localStorage.getItem('token');
}
async function shipApi(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/shipping' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}

// Nhãn trạng thái vận đơn (khớp backend; ĐỘC LẬP với orders.status)
const SHIP_STATUS = {
  preparing: 'Đang chuẩn bị',
  shipped: 'Đã gửi hàng',
  delivered: 'Đã giao hàng',
  failed: 'Giao thất bại',
};
// Luồng chuyển trạng thái hợp lệ của vận đơn (khớp backend)
const SHIP_FLOW = {
  preparing: ['shipped', 'failed'],
  shipped: ['delivered', 'failed'],
  delivered: [],
  failed: [],
};

const emptyMethodForm = { name: '', fee: '', eta_days: '3', is_active: true };

export default function ShippingTab() {
  const [methods, setMethods] = useState([]);
  const [shippings, setShippings] = useState([]);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [methodForm, setMethodForm] = useState(emptyMethodForm);

  // Form gán vận chuyển cho đơn hàng
  const [assignForm, setAssignForm] = useState({ order_id: '', method_id: '', tracking_code: '' });
  // Tracking code sửa inline theo từng vận đơn: { [shippingId]: value }
  const [trackingEdits, setTrackingEdits] = useState({});

  const loadMethods = () =>
    shipApi('/methods?all=1').then((d) => setMethods(d.methods)).catch((e) => alert(e.message));
  const loadShippings = () =>
    shipApi('').then((d) => setShippings(d.shippings)).catch((e) => alert(e.message));

  useEffect(() => {
    loadMethods();
    loadShippings();
  }, []);

  /* ---------- Phương thức vận chuyển ---------- */

  const openAddMethod = () => {
    setEditingMethod(null);
    setMethodForm(emptyMethodForm);
    setShowMethodModal(true);
  };
  const openEditMethod = (m) => {
    setEditingMethod(m);
    setMethodForm({ name: m.name, fee: String(m.fee), eta_days: String(m.eta_days), is_active: !!m.is_active });
    setShowMethodModal(true);
  };
  const saveMethod = async () => {
    if (!methodForm.name.trim()) { alert('Vui lòng nhập tên phương thức'); return; }
    const payload = {
      name: methodForm.name.trim(),
      fee: parseInt(methodForm.fee) || 0,
      eta_days: parseInt(methodForm.eta_days) || 0,
      is_active: methodForm.is_active,
    };
    try {
      if (editingMethod) await shipApi(`/methods/${editingMethod.id}`, { method: 'PUT', body: payload });
      else await shipApi('/methods', { method: 'POST', body: payload });
      setShowMethodModal(false);
      loadMethods();
    } catch (e) { alert(e.message); }
  };
  const deleteMethod = async (m) => {
    if (!window.confirm(`Xóa phương thức "${m.name}"?`)) return;
    try {
      await shipApi(`/methods/${m.id}`, { method: 'DELETE' });
      loadMethods();
    } catch (e) { alert(e.message); }
  };

  /* ---------- Vận đơn ---------- */

  const assignShipping = async () => {
    const order_id = parseInt(assignForm.order_id);
    if (!order_id) { alert('Vui lòng nhập mã đơn hàng'); return; }
    if (!assignForm.method_id) { alert('Vui lòng chọn phương thức vận chuyển'); return; }
    try {
      await shipApi('', {
        method: 'POST',
        body: {
          order_id,
          method_id: parseInt(assignForm.method_id),
          tracking_code: assignForm.tracking_code.trim(),
        },
      });
      setAssignForm({ order_id: '', method_id: '', tracking_code: '' });
      loadShippings();
    } catch (e) { alert(e.message); }
  };

  const saveTracking = async (s) => {
    try {
      await shipApi(`/${s.id}`, {
        method: 'PUT',
        body: { tracking_code: (trackingEdits[s.id] ?? s.tracking_code ?? '').trim() },
      });
      setTrackingEdits((prev) => ({ ...prev, [s.id]: undefined }));
      loadShippings();
    } catch (e) { alert(e.message); }
  };

  const changeShipStatus = async (s, status) => {
    if (!status || status === s.status) return;
    try {
      await shipApi(`/${s.id}`, { method: 'PUT', body: { status } });
      loadShippings();
    } catch (e) { alert(e.message); }
  };

  const activeMethods = methods.filter((m) => m.is_active);

  return (
    <div>
      {/* ===== Quản lý phương thức vận chuyển ===== */}
      <div className="toolbar">
        <h3>Phương thức vận chuyển ({methods.length})</h3>
        <button className="btn btn-small" onClick={openAddMethod}>+ Thêm phương thức</button>
      </div>
      {methods.length === 0 ? (
        <div className="empty">Chưa có phương thức vận chuyển nào.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Phí</th>
              <th>ETA (ngày)</th>
              <th>Trạng thái</th>
              <th style={{ width: 140 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong></td>
                <td>{fmtVND(m.fee)}</td>
                <td>{m.eta_days}</td>
                <td>{m.is_active ? '🟢 Đang bật' : '⚪ Đã tắt'}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-small btn-outline" onClick={() => openEditMethod(m)}>Sửa</button>
                    <button className="btn btn-small btn-danger" onClick={() => deleteMethod(m)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===== Vận đơn ===== */}
      <div className="toolbar" style={{ marginTop: 32 }}>
        <h3>Vận đơn ({shippings.length})</h3>
      </div>

      <div className="order-card">
        <strong>Gán vận chuyển cho đơn hàng</strong>
        <p style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
          Phí vận chuyển lấy theo phương thức đã chọn (server tính, đồng thời cập nhật
          phí vận chuyển của đơn hàng). Mỗi đơn chỉ có 1 vận đơn.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0, minWidth: 120 }}>
            <label>Mã đơn hàng *</label>
            <input
              type="number" min="1"
              value={assignForm.order_id}
              onChange={(e) => setAssignForm({ ...assignForm, order_id: e.target.value })}
              placeholder="VD: 12"
            />
          </div>
          <div className="field" style={{ margin: 0, minWidth: 180 }}>
            <label>Phương thức *</label>
            <select
              value={assignForm.method_id}
              onChange={(e) => setAssignForm({ ...assignForm, method_id: e.target.value })}
            >
              <option value="">— Chọn phương thức —</option>
              {activeMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {fmtVND(m.fee)} (~{m.eta_days} ngày)
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 180 }}>
            <label>Mã tracking</label>
            <input
              value={assignForm.tracking_code}
              onChange={(e) => setAssignForm({ ...assignForm, tracking_code: e.target.value })}
              placeholder="VD: GHN123456"
            />
          </div>
          <button className="btn" onClick={assignShipping}>Gán vận chuyển</button>
        </div>
      </div>

      {shippings.length === 0 ? (
        <div className="empty">Chưa có vận đơn nào.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Phương thức</th>
              <th>Phí</th>
              <th>Mã tracking</th>
              <th>Trạng thái</th>
              <th>Gửi / Giao</th>
              <th style={{ width: 170 }}>Cập nhật trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {shippings.map((s) => {
              const next = SHIP_FLOW[s.status] || [];
              const trackingVal = trackingEdits[s.id] ?? s.tracking_code ?? '';
              const trackingChanged = trackingVal.trim() !== (s.tracking_code || '').trim();
              return (
                <tr key={s.id}>
                  <td><strong>#{s.order_id}</strong><br /><span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{s.customer_name} • {s.phone}</span></td>
                  <td>{s.method_name || '—'}</td>
                  <td>{fmtVND(s.fee)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        value={trackingVal}
                        onChange={(e) => setTrackingEdits((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="Mã tracking"
                        style={{ width: 120 }}
                      />
                      <button
                        className="btn btn-small btn-outline"
                        disabled={!trackingChanged}
                        onClick={() => saveTracking(s)}
                      >
                        Lưu
                      </button>
                    </div>
                  </td>
                  <td><span className="status-chip">{SHIP_STATUS[s.status] || s.status}</span></td>
                  <td style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
                    {s.shipped_at ? `Gửi: ${fmtDate(s.shipped_at)}` : '—'}<br />
                    {s.delivered_at ? `Giao: ${fmtDate(s.delivered_at)}` : ''}
                  </td>
                  <td>
                    {next.length > 0 ? (
                      <select
                        value=""
                        onChange={(e) => { const st = e.target.value; e.target.value = ''; changeShipStatus(s, st); }}
                        style={{ padding: '6px 10px', borderRadius: 8 }}
                      >
                        <option value="">Chuyển trạng thái…</option>
                        {next.map((st) => (
                          <option key={st} value={st}>→ {SHIP_STATUS[st]}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Kết thúc</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ===== Modal thêm/sửa phương thức ===== */}
      {showMethodModal && (
        <div className="modal-backdrop" onClick={() => setShowMethodModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingMethod ? `Sửa phương thức #${editingMethod.id}` : 'Thêm phương thức vận chuyển'}</h3>
            <div className="field">
              <label>Tên phương thức *</label>
              <input
                value={methodForm.name}
                onChange={(e) => setMethodForm({ ...methodForm, name: e.target.value })}
                placeholder="VD: Tiêu chuẩn, Nhanh, Hỏa tốc"
              />
            </div>
            <div className="field">
              <label>Phí (VNĐ)</label>
              <input
                type="number" min="0"
                value={methodForm.fee}
                onChange={(e) => setMethodForm({ ...methodForm, fee: e.target.value })}
                placeholder="VD: 30000"
              />
            </div>
            <div className="field">
              <label>Thời gian giao dự kiến (ngày)</label>
              <input
                type="number" min="0"
                value={methodForm.eta_days}
                onChange={(e) => setMethodForm({ ...methodForm, eta_days: e.target.value })}
              />
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={methodForm.is_active}
                  onChange={(e) => setMethodForm({ ...methodForm, is_active: e.target.checked })}
                />
                Đang bật (hiển thị ở checkout)
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowMethodModal(false)}>Đóng</button>
              <button className="btn" onClick={saveMethod}>{editingMethod ? 'Lưu thay đổi' : 'Thêm mới'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
