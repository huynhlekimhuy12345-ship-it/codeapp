// Tab quản lý voucher khuyến mãi (admin). Component độc lập, dùng chung style
// với các tab trong Admin.jsx (data-table, btn, modal, field, toolbar).
// Lưu ý: khi api.js có voucher endpoints thì đổi các hàm call() bên dưới sang api.*.
import { useEffect, useState } from 'react';

function request(path, { method = 'GET', body } = {}) {
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

const EMPTY = { code: '', type: 'percent', value: '', min_order: '', expiry: '', usage_limit: '', is_active: true };

function fmtVND(n) {
  return (parseInt(n) || 0).toLocaleString('vi-VN') + '₫';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('vi-VN');
}

// Input datetime-local → chuỗi ISO gửi API
function toInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VouchersTab() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(''); // '' | '1' | '0'
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = filter === '' ? '' : `?is_active=${filter}`;
      const data = await request(`/api/vouchers${q}`);
      setVouchers(data.vouchers || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({
      code: v.code,
      type: v.type,
      value: v.value,
      min_order: v.min_order || '',
      expiry: toInputValue(v.expiry),
      usage_limit: v.usage_limit || '',
      is_active: !!v.is_active,
    });
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    try {
      const payload = {
        value: parseInt(form.value) || 0,
        min_order: parseInt(form.min_order) || 0,
        usage_limit: parseInt(form.usage_limit) || 0,
        expiry: form.expiry ? new Date(form.expiry).toISOString() : '',
        is_active: form.is_active,
      };
      if (!editing) {
        payload.code = form.code.toUpperCase().trim();
        payload.type = form.type;
      }
      if (editing) await request(`/api/vouchers/${editing.id}`, { method: 'PUT', body: payload });
      else await request('/api/vouchers', { method: 'POST', body: payload });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleActive = async (v) => {
    setError('');
    try {
      await request(`/api/vouchers/${v.id}`, {
        method: 'PUT',
        body: { is_active: !v.is_active },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (v) => {
    if (!window.confirm(`Xóa voucher "${v.code}"?`)) return;
    setError('');
    try {
      await request(`/api/vouchers/${v.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>Quản lý voucher khuyến mãi</h3>
      <div className="toolbar">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8 }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="1">Đang bật</option>
          <option value="0">Đã tắt</option>
        </select>
        <button className="btn btn-primary" onClick={openNew}>+ Thêm voucher</button>
      </div>

      {error && <p style={{ color: 'var(--danger, #c0392b)', marginBottom: 10 }}>{error}</p>}
      {loading && <p>Đang tải...</p>}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Giá trị</th>
                <th>Đơn tối thiểu</th>
                <th>Hạn dùng</th>
                <th>Đã dùng / Giới hạn</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.code}</strong></td>
                  <td>{v.type === 'percent' ? 'Phần trăm' : 'Số tiền'}</td>
                  <td>{v.type === 'percent' ? `${v.value}%` : fmtVND(v.value)}</td>
                  <td>{v.min_order ? fmtVND(v.min_order) : '—'}</td>
                  <td>{fmtDate(v.expiry)}</td>
                  <td>{v.used_count}{v.usage_limit ? ` / ${v.usage_limit}` : ' / ∞'}</td>
                  <td>
                    <span style={{ color: v.is_active ? 'green' : '#888' }}>
                      {v.is_active ? 'Đang bật' : 'Đã tắt'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-small btn-outline" onClick={() => openEdit(v)}>Sửa</button>
                      <button className="btn btn-small btn-outline" onClick={() => toggleActive(v)}>
                        {v.is_active ? 'Tắt' : 'Bật'}
                      </button>
                      <button className="btn btn-small btn-danger" onClick={() => remove(v)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!vouchers.length && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>Chưa có voucher nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14 }}>{editing ? `Sửa voucher ${editing.code}` : 'Thêm voucher mới'}</h3>
            {!editing && (
              <>
                <div className="field"><label htmlFor="voucherstab-ma-voucher">Mã voucher *</label>
                  <input id="voucherstab-ma-voucher" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="VD: GIAM20" />
                </div>
                <div className="field"><label htmlFor="voucherstab-loai">Loại *</label>
                  <select id="voucherstab-loai" value={form.type} onChange={(e) => set('type', e.target.value)}>
                    <option value="percent">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định (VND)</option>
                  </select>
                </div>
              </>
            )}
            <div className="field"><label htmlFor="voucherstab-gia-tri-form-type-percent-1100-vnd">Giá trị * {form.type === 'percent' ? '(1–100)' : '(VND)'}</label>
              <input id="voucherstab-gia-tri-form-type-percent-1100-vnd" type="number" min="1" value={form.value} onChange={(e) => set('value', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label htmlFor="voucherstab-on-toi-thieu-vnd">Đơn tối thiểu (VND)</label>
                <input id="voucherstab-on-toi-thieu-vnd" type="number" min="0" value={form.min_order} onChange={(e) => set('min_order', e.target.value)} placeholder="0 = không giới hạn" />
              </div>
              <div className="field"><label htmlFor="voucherstab-gioi-han-luot-dung">Giới hạn lượt dùng</label>
                <input id="voucherstab-gioi-han-luot-dung" type="number" min="0" value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} placeholder="0 = không giới hạn" />
              </div>
            </div>
            <div className="field"><label htmlFor="voucherstab-han-dung">Hạn dùng</label>
              <input id="voucherstab-han-dung" type="datetime-local" value={form.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </div>
            <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input aria-label="Ô nhập" type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Đang kích hoạt
            </label></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
