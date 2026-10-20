// Tab quản lý Tin tức / Thông báo (admin + sale được viết).
// Đăng tin → hiện banner trang chủ + chuông thông báo của mọi tài khoản.
import { useEffect, useState } from 'react';

function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Có lỗi xảy ra');
      return d;
    });
}

// Trang đích gợi ý cho nút CTA / banner: chọn nhanh hoặc tự nhập link
const CTA_PAGES = [
  { value: '', label: '— Tự nhập link bên dưới —' },
  { value: '/khuyen-mai', label: 'Khuyến mãi (/khuyen-mai)' },
  { value: '/cua-hang', label: 'Cửa hàng (/cua-hang)' },
  { value: '/bo-suu-tap', label: 'Bộ sưu tập (/bo-suu-tap)' },
  { value: '/tin-tuc', label: 'Tin tức (/tin-tuc)' },
  { value: '/blog', label: 'Blog (/blog)' },
  { value: '/lien-he', label: 'Liên hệ (/lien-he)' },
];

const EMPTY = {
  title: '', content: '', badge: '', cta_text: '', cta_link: '',
  image_url: '', image_caption: '',
  show_on_banner: true, send_notification: true, is_active: true,
};

export default function NewsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    request('/api/announcements')
      .then((d) => setItems(d.announcements || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setErr(''); setShowForm(true);
  };
  const openEdit = (a) => {
    setEditing(a); setErr('');
    setForm({
      title: a.title, content: a.content, badge: a.badge,
      cta_text: a.cta_text, cta_link: a.cta_link,
      image_url: a.image_url || '', image_caption: a.image_caption || '',
      show_on_banner: a.show_on_banner, send_notification: a.send_notification,
      is_active: a.is_active,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setErr('Vui lòng nhập tiêu đề và nội dung.');
      return;
    }
    setSaving(true); setErr('');
    try {
      if (editing) await request(`/api/announcements/${editing.id}`, { method: 'PUT', body: form });
      else await request('/api/announcements', { method: 'POST', body: form });
      setShowForm(false);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (a) => {
    try { await request(`/api/announcements/${a.id}/toggle`, { method: 'PUT' }); load(); }
    catch (e) { alert(e.message); }
  };

  const doDelete = async () => {
    try {
      await request(`/api/announcements/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Tin tức / Thông báo</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Thêm thông báo</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '.92rem', marginTop: -8, marginBottom: 16 }}>
        Tin đang hiển thị sẽ lên banner trang chủ và chuông thông báo của mọi tài khoản (khách hàng, sale, admin).
      </p>

      {loading ? <p>Đang tải...</p> : items.length === 0 ? (
        <div className="empty"><p>Chưa có thông báo nào. Bấm "Thêm thông báo" để đăng tin đầu tiên.</p></div>
      ) : (
        <div className="news-admin-list">
          {items.map((a) => (
            <div key={a.id} className="glass news-admin-card">
              {a.image_url && (
                <img src={a.image_url} alt="" className="news-admin-thumb"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <div className="news-admin-body">
                <div className="news-admin-top">
                  <span className={`status-chip${a.is_active ? '' : ' off'}`}>
                    {a.is_active ? 'Đang hiển thị' : 'Đang ẩn'}
                  </span>
                  <div className="news-admin-actions">
                    <button
                      className={`toggle-switch${a.is_active ? ' on' : ''}`}
                      onClick={() => toggle(a)}
                      title={a.is_active ? 'Tắt hiển thị' : 'Bật hiển thị'}
                      aria-label={a.is_active ? 'Tắt hiển thị' : 'Bật hiển thị'}
                    >
                      <span className="toggle-knob" />
                    </button>
                    <span className="toggle-label">{a.is_active ? 'Đang bật' : 'Đang tắt'}</span>
                    <button className="btn btn-small btn-outline" onClick={() => openEdit(a)}>Sửa</button>
                    <button className="btn btn-small btn-outline" style={{ color: '#b3261e', borderColor: '#b3261e' }} onClick={() => setDeleting(a)}>Xóa</button>
                  </div>
                </div>
                <h3>{a.title}</h3>
                <p className="news-admin-excerpt">
                  {a.content.length > 140 ? a.content.slice(0, 140) + '…' : a.content}
                </p>
                <div className="news-admin-chips">
                  <span className="chip">{a.show_on_banner ? 'Đang lên banner' : 'Không lên banner'}</span>
                  <span className="chip">{a.send_notification ? 'Có gửi thông báo' : 'Không gửi thông báo'}</span>
                  <span className="chip">Ngày đăng: {new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
                  {a.cta_link && <span className="chip">→ {a.cta_link}</span>}
                </div>
                <div className="news-admin-author">
                  · Người đăng: {a.author_name || '—'}{a.author_role === 'sale' ? ' (Nhân viên Sale)' : a.author_role === 'admin' ? ' (Quản trị viên)' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>{editing ? 'Sửa thông báo' : 'Thêm thông báo mới'}</h3>
            {err && <div className="form-error">{err}</div>}
            <div className="field"><label>Tiêu đề *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="VD: SALE 11.11 — Giảm đến 20%" />
            </div>
            <div className="field"><label>Nội dung *</label>
              <textarea value={form.content} onChange={(e) => set('content', e.target.value)} rows={3}
                placeholder="VD: Duy nhất ngày 11.11, toàn bộ ví da giảm 20%. Áp dụng kèm voucher SALE1111." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>Nhãn badge (tùy chọn)</label>
                <input value={form.badge} onChange={(e) => set('badge', e.target.value)} placeholder="VD: HOT, MỚI" />
              </div>
              <div className="field"><label>Nút CTA (tùy chọn)</label>
                <input value={form.cta_text} onChange={(e) => set('cta_text', e.target.value)} placeholder="VD: Săn sale ngay" />
              </div>
            </div>
            <div className="field"><label>Trang đích của nút (chọn để dẫn đến trang cần)</label>
              <select value={CTA_PAGES.some((o) => o.value === form.cta_link) ? form.cta_link : ''}
                onChange={(e) => set('cta_link', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: 'var(--cream)', border: '1px solid rgba(255,255,255,.12)' }}>
                {CTA_PAGES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={form.cta_link} onChange={(e) => set('cta_link', e.target.value)}
                placeholder="Hoặc nhập link tùy ý, VD: /khuyen-mai, /san-pham/5, https://..."
                style={{ marginTop: 8 }} />
              {form.cta_link && <small style={{ color: 'var(--muted)' }}>Banner & trang chi tiết sẽ dẫn đến: <code>{form.cta_link}</code></small>}
            </div>
            <div className="field"><label>Hình ảnh (link URL, tùy chọn)</label>
              <input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://... (link ảnh minh họa)" />
              {form.image_url && (
                <img src={form.image_url} alt="Xem trước" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 160, borderRadius: 10, objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
            </div>
            <div className="field"><label>Chú thích hình ảnh (tùy chọn)</label>
              <input value={form.image_caption} onChange={(e) => set('image_caption', e.target.value)} placeholder="VD: Xưởng da BI99 tại Hội An" />
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.show_on_banner} onChange={(e) => set('show_on_banner', e.target.checked)} />
                Lên banner trang chủ
              </label>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.send_notification} onChange={(e) => set('send_notification', e.target.checked)} />
                Gửi chuông thông báo (mọi tài khoản)
              </label>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                Đang hiển thị
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Đăng thông báo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Xóa thông báo?</h3>
            <p style={{ color: 'var(--muted)' }}>"{deleting.title}" sẽ bị gỡ khỏi banner và chuông thông báo.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDeleting(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={doDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
