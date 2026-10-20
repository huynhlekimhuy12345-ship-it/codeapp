// Tab quản lý sự kiện khuyến mãi (admin): bật/tắt sự kiện, sửa nội dung.
// Bật sự kiện sẽ đồng thời bật các voucher liên kết (qua PUT /:id/toggle).
import { useEffect, useState } from 'react';
import DateTimeField from '../../components/DateTimeField';

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

const EMPTY = { name: '', slug: '', title: '', subtitle: '', start_at: '', end_at: '', voucher_codes: '', is_active: false };

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromoEventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/promo-events');
      setEvents(data.events || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };

  const openEdit = (ev) => {
    setEditing(ev);
    setForm({
      name: ev.name || '',
      slug: ev.slug || '',
      title: ev.title || '',
      subtitle: ev.subtitle || '',
      start_at: toInputValue(ev.start_at),
      end_at: toInputValue(ev.end_at),
      voucher_codes: (ev.voucher_codes || []).join(', '),
      is_active: !!ev.is_active,
    });
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        start_at: form.start_at ? new Date(form.start_at).toISOString() : '',
        end_at: form.end_at ? new Date(form.end_at).toISOString() : '',
        voucher_codes: form.voucher_codes,
        is_active: form.is_active,
      };
      if (editing) await request(`/api/promo-events/${editing.id}`, { method: 'PUT', body: payload });
      else await request('/api/promo-events', { method: 'POST', body: payload });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = async (ev) => {
    const action = ev.is_active ? 'tắt' : 'bật';
    const n = (ev.voucher_codes || []).length;
    if (!window.confirm(`Bạn chắc muốn ${action} sự kiện "${ev.name}"?${n ? `\n${n} voucher liên kết sẽ được ${action} cùng lúc.` : ''}`)) return;
    try {
      await request(`/api/promo-events/${ev.id}/toggle`, { method: 'PUT' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Xóa sự kiện "${ev.name}"? (Voucher liên kết sẽ bị TẮT nếu sự kiện đang bật)`)) return;
    try {
      await request(`/api/promo-events/${ev.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h3>Sự kiện khuyến mãi</h3>
        <button className="btn btn-primary" onClick={openNew}>+ Thêm sự kiện</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? <p>Đang tải...</p> : (
        <div className="table-scroll">
          <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tên sự kiện</th>
                        <th>Thời gian</th>
                        <th>Voucher liên kết</th>
                        <th>Trạng thái</th>
                        <th style={{ width: 190 }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id}>
                          <td>
                            <strong>{ev.name}</strong>
                            <div style={{ fontSize: '.8rem', color: '#888' }}>{ev.slug}</div>
                          </td>
                          <td style={{ fontSize: '.85rem' }}>{fmtDateTime(ev.start_at)}<br />→ {fmtDateTime(ev.end_at)}</td>
                          <td>
                            {(ev.voucher_codes || []).length
                              ? (ev.voucher_codes || []).map((c) => <span key={c} className="badge" style={{ marginRight: 4 }}>{c}</span>)
                              : <span style={{ color: '#888' }}>—</span>}
                          </td>
                          <td>
                            <span style={{ color: ev.is_active ? 'green' : '#888', fontWeight: 600 }}>
                              {ev.is_active ? '● Đang bật' : '○ Đang tắt'}
                            </span>
                          </td>
                          <td>
                            <button className={`btn btn-small ${ev.is_active ? 'btn-outline' : 'btn-primary'}`} onClick={() => toggle(ev)}>
                              {ev.is_active ? 'Tắt' : 'Bật'}
                            </button>{' '}
                            <button className="btn btn-small btn-outline" onClick={() => openEdit(ev)}>Sửa</button>{' '}
                            <button className="btn btn-small btn-danger-outline" onClick={() => remove(ev)}>Xóa</button>
                          </td>
                        </tr>
                      ))}
                      {!events.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>Chưa có sự kiện nào</td></tr>}
                    </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <h3>{editing ? 'Sửa sự kiện' : 'Thêm sự kiện mới'}</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="promoeventstab-ten-su-kien">Tên sự kiện *</label>
                <input id="promoeventstab-ten-su-kien" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="VD: Sale 11.11" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="promoeventstab-slug">Slug</label>
                <input id="promoeventstab-slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="VD: sale-11-11 (để trống = tự tạo từ tên)" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="promoeventstab-tieu-e-banner">Tiêu đề banner</label>
              <input id="promoeventstab-tieu-e-banner" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: SALE 11.11" />
            </div>
            <div className="field">
              <label htmlFor="promoeventstab-mo-ta-banner">Mô tả banner</label>
              <textarea id="promoeventstab-mo-ta-banner" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Dòng giới thiệu hiển thị trên trang khuyến mãi" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="promoeventstab-bat-au">Bắt đầu</label>
                <DateTimeField id="promoeventstab-bat-au" value={form.start_at} onChange={(v) => set('start_at', v)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="promoeventstab-ket-thuc">Kết thúc</label>
                <DateTimeField id="promoeventstab-ket-thuc" value={form.end_at} onChange={(v) => set('end_at', v)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="promoeventstab-voucher-lien-ket-cach-nhau-bang-dau-phay">Voucher liên kết (cách nhau bằng dấu phẩy)</label>
              <input id="promoeventstab-voucher-lien-ket-cach-nhau-bang-dau-phay" value={form.voucher_codes} onChange={(e) => set('voucher_codes', e.target.value)} placeholder="VD: SALE1111, GIAM111K" />
              <small style={{ color: '#888' }}>Khi bật/tắt sự kiện, các voucher này sẽ được bật/tắt cùng lúc.</small>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                Bật ngay sau khi lưu
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Lưu thay đổi' : 'Tạo sự kiện'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
