import { useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useStore } from '../context/StoreContext';
import { api, fmtVND, fmtDate, ORDER_STATUS, nextStatuses } from '../api';
import { detectLang, translateToVietnamese } from '../i18n/autoTranslate';
import InventoryTab from './admin/InventoryTab';
import PaymentsTab from './admin/PaymentsTab';
import ShippingTab from './admin/ShippingTab';
import AftersalesTab from './admin/AftersalesTab';
import VouchersTab from './admin/VouchersTab';
import PromoEventsTab from './admin/PromoEventsTab';
import NewsTab from './admin/NewsTab';
import CustomerChatTab from './admin/CustomerChatTab';
import InternalChatTab from './admin/InternalChatTab';
import EventProductsSection from './admin/EventProductsSection';
import ReviewsTab from './admin/ReviewsTab';
import ReportsTab from './admin/ReportsTab';

/* ---------- Hộp xác nhận trong trang (thay confirm() trình duyệt — bị chặn trong iframe nhúng) ---------- */
function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = false, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <PageTitle title="Quản trị" />
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.95rem', marginBottom: 6 }}>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Đóng</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tab Sản phẩm ---------- */
/** Chọn tối đa 10 sản phẩm trưng bày ở trang Bộ sưu tập (thứ tự = thứ tự hiển thị). */
/** Chọn tối đa 6 sản phẩm trưng bày ở trang Bộ sưu tập: tích chọn nhiều sản phẩm rồi Lưu 1 lần. */
function ShowcaseSection({ products }) {
  const [saved, setSaved] = useState([]);   // danh sách đã lưu trên server (theo thứ tự)
  const [draft, setDraft] = useState([]);   // id đang chọn (chưa lưu)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadShowcase = () => {
    api.getProducts({ showcase: 1, limit: 10 })
      .then((d) => {
        const items = d.products || [];
        setSaved(items);
        setDraft(items.map((x) => x.id));
      })
      .catch(() => { setSaved([]); setDraft([]); });
  };
  useEffect(() => { loadShowcase(); }, []);

  const byId = (id) => products.find((x) => x.id === id) || saved.find((x) => x.id === id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.map((x) => x.id));

  const toggle = (id) => {
    setMsg('');
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };
  const move = (i, dir) => {
    setDraft((prev) => {
      const ids = [...prev];
      const j = i + dir;
      if (j < 0 || j >= ids.length) return prev;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return ids;
    });
  };
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const d = await api.setShowcase(draft);
      setSaved(d.products || []);
      setDraft((d.products || []).map((x) => x.id));
      setMsg('Đã lưu danh sách trưng bày.');
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 6px' }}>Sản phẩm trưng bày ở trang Bộ sưu tập ({draft.length}/10)</h3>
      <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: '0.9rem' }}>
        Tích chọn các sản phẩm muốn trưng bày (tối đa 10), sắp xếp thứ tự bên dưới rồi bấm Lưu. Để trống = trang tự lấy 10 sản phẩm đầu tiên.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8, maxHeight: 264, overflowY: 'auto', paddingRight: 4 }}>
        {products.map((p) => {
          const checked = draft.includes(p.id);
          const full = !checked && draft.length >= 10;
          return (
            <label key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10, cursor: full ? 'not-allowed' : 'pointer',
                background: checked ? 'rgba(232,181,106,.13)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${checked ? 'rgba(232,181,106,.55)' : 'rgba(255,255,255,.09)'}`,
                opacity: full ? 0.45 : 1 }}>
              <input type="checkbox" className="cart-check" checked={checked} disabled={full} onChange={() => toggle(p.id)} />
              <img src={p.image_url} alt="" style={{ width: 42, height: 32, objectFit: 'cover', borderRadius: 6 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <span style={{ fontSize: '0.92rem', lineHeight: 1.3 }}>{p.name}</span>
            </label>
          );
        })}
      </div>

      {draft.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: 8 }}>Thứ tự hiển thị (dùng ↑ ↓ để xếp):</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.map((id, i) => {
              const p = byId(id);
              if (!p) return null;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(232,181,106,.18)', borderRadius: 10, padding: '6px 10px' }}>
                  <b style={{ color: 'var(--amber-light)', minWidth: 22 }}>{i + 1}.</b>
                  <img src={p.image_url} alt="" style={{ width: 44, height: 34, objectFit: 'cover', borderRadius: 6 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <button className="btn btn-small btn-outline" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn btn-small btn-outline" disabled={i === draft.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn btn-small btn-danger" onClick={() => toggle(id)}>Bỏ</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Đang lưu...' : 'Lưu danh sách trưng bày'}
        </button>
        {dirty && <span style={{ color: 'var(--amber-light)', fontSize: '0.88rem' }}>Có thay đổi chưa lưu</span>}
        {msg && !dirty && <span style={{ color: 'var(--amber-light)', fontSize: '0.88rem' }}>{msg}</span>}
      </div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '', stock: '', image_url: '' });
  const [deleting, setDeleting] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [loadError, setLoadError] = useState('');
  const load = () => {
    api.getProducts({ limit: 50 }).then((d) => { setProducts(d.products); setLoadError(''); }).catch(() => setLoadError('Không tải được danh sách sản phẩm'));
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ category_id: '', name: '', description: '', price: '', stock: '', image_url: '' });
    setNewCategoryName('');
    setShowModal(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ category_id: p.category_id || '', name: p.name, description: p.description || '', price: p.price, stock: p.stock, image_url: p.image_url || '' });
    setNewCategoryName('');
    setShowModal(true);
  };
  const save = async () => {
    if (!form.name || form.price === '') return alert('Vui lòng nhập tên và giá');
    try {
      let category_id = form.category_id || null;
      if (form.category_id === '__new__') {
        const name = newCategoryName.trim();
        if (!name) return alert('Vui lòng nhập tên danh mục mới');
        const created = await api.createCategory({ name });
        category_id = created.category.id;
      }
      const payload = { ...form, category_id };
      if (editing) await api.updateProduct(editing.id, payload);
      else await api.createProduct(payload);
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
  };
  const doDelete = async () => {
    try { await api.deleteProduct(deleting.id); } catch (e) { alert(e.message); return; }
    setDeleting(null);
    load();
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <ShowcaseSection products={products} />
      <div className="toolbar">
        <h3>Quản lý sản phẩm ({products.length})</h3>
        <button className="btn btn-primary" onClick={openNew}>+ Thêm sản phẩm</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Thao tác</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={p.image_url} alt="" onError={(e) => { e.target.style.display = 'none'; }} /></td>
                <td>{p.name}</td>
                <td>{p.category_name || '—'}</td>
                <td>{fmtVND(p.price)}</td>
                <td>{p.stock}</td>
                <td><div className="row-actions">
                  <button className="btn btn-small btn-outline" onClick={() => openEdit(p)}>Sửa</button>
                  <button className="btn btn-small btn-danger" onClick={() => setDeleting(p)}>Xóa</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Xóa sản phẩm"
          message={`Bạn có chắc muốn xóa "${deleting.name}"? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa sản phẩm"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h3>
            <div className="field"><label>Tên *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="field"><label>Danh mục</label>
              <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">— Không có —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">+ Thêm danh mục mới...</option>
              </select>
            </div>
            {form.category_id === '__new__' && (
              <div className="field"><label>Tên danh mục mới *</label>
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="VD: Thắt lưng da" />
              </div>
            )}
            <div className="field"><label>Mô tả</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>Giá (VND) *</label><input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
              <div className="field"><label>Tồn kho</label><input type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></div>
            </div>
            <div className="field"><label>URL ảnh</label><input value={form.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://..." /></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      <EventProductsSection />
    </div>
  );
}

/* ---------- Tab Danh mục ---------- */
function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const catFormRef = useRef(null);
  // Bấm Sửa ở một hàng phía dưới → tự cuộn lên form ở đầu tab
  useEffect(() => {
    if (editingId) catFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [editingId]);
  const [deleting, setDeleting] = useState(null);

  const [loadError, setLoadError] = useState('');
  const load = () => api.getCategories().then((d) => { setCategories(d.categories); setLoadError(''); }).catch(() => setLoadError('Không tải được danh mục'));
  useEffect(() => { load(); }, []);

  const reset = () => { setName(''); setDescription(''); setEditingId(null); };

  const save = async () => {
    if (!name.trim()) return alert('Nhập tên danh mục');
    try {
      if (editingId) await api.updateCategory(editingId, { name, description });
      else await api.createCategory({ name, description });
      reset(); load();
    } catch (e) { alert(e.message); }
  };
  const edit = (c) => { setEditingId(c.id); setName(c.name); setDescription(c.description || ''); };
  const doDelete = async () => {
    try { await api.deleteCategory(deleting.id); } catch (e) { alert(e.message); return; }
    setDeleting(null);
    load();
  };

  return (
    <div>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <h3 style={{ marginBottom: 14 }}>Quản lý danh mục</h3>
      <div className="filters" style={{ alignItems: 'end' }} ref={catFormRef}>
        <div className="field" style={{ margin: 0, flex: 1 }}><label>Tên *</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ margin: 0, flex: 2 }}><label>Mô tả</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button className="btn btn-primary" onClick={save}>{editingId ? 'Cập nhật' : 'Thêm'}</button>
        {editingId && <button className="btn btn-outline" onClick={reset}>Hủy</button>}
      </div>
      <table className="data-table">
        <thead><tr><th>ID</th><th>Tên</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td><td>{c.name}</td><td>{c.description}</td>
              <td><div className="row-actions">
                <button className="btn btn-small btn-outline" onClick={() => edit(c)}>Sửa</button>
                <button className="btn btn-small btn-danger" onClick={() => setDeleting(c)}>Xóa</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleting && (
        <ConfirmDialog
          title="Xóa danh mục"
          message={`Xóa danh mục "${deleting.name}"? Sản phẩm thuộc danh mục này sẽ mất liên kết.`}
          confirmLabel="Xóa danh mục"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

/* ---------- Tab Đơn hàng ---------- */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const [loadError, setLoadError] = useState('');
  const load = () => api.getOrders(filter || undefined).then((d) => { setOrders(d.orders); setLoadError(''); }).catch(() => setLoadError('Không tải được danh sách đơn hàng'));
  useEffect(() => { load(); }, [filter]);

  const refreshDetail = async (id) => {
    try { const { order } = await api.getOrder(id); setDetail(order); } catch { setDetail(null); }
  };

  const changeStatus = async (id, status, reason) => {
    try {
      await api.updateOrderStatus(id, status, reason);
      load();
      if (openId === id) refreshDetail(id);
    } catch (e) { alert(e.message); }
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) { alert('Vui lòng nhập lý do hủy đơn hàng'); return; }
    await changeStatus(cancelTarget.id, 'cancelled', cancelReason.trim());
    setCancelTarget(null);
    setCancelReason('');
  };

  const doDeleteOrder = async () => {
    try { await api.deleteOrder(deletingOrder.id); } catch (e) { alert(e.message); return; }
    setDeletingOrder(null);
    load();
  };

  const toggle = async (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    refreshDetail(id);
  };

  return (
    <div>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <div className="toolbar">
        <h3>Quản lý đơn hàng ({orders.length})</h3>
        <select className="select-dark" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.keys(ORDER_STATUS).map((s) => <option key={s} value={s}>{ORDER_STATUS[s]}</option>)}
        </select>
      </div>
      {orders.map((o) => {
        const next = nextStatuses(o.status);
        return (
          <div className="order-card" key={o.id}>
            <div className="order-head">
              <strong>Đơn #{o.id} — {o.customer_name} ({o.phone})</strong>
              <div className="row-actions">
                <span className={`status-chip st-${o.status}`}>{ORDER_STATUS[o.status]}</span>
                {next.length > 0 && (
                  <div className="status-menu-wrap">
                    <button type="button" className="btn btn-small btn-primary"
                      onClick={() => setMenuFor(menuFor === o.id ? null : o.id)}>
                      Chuyển trạng thái ▾
                    </button>
                    {menuFor === o.id && (
                      <>
                        <div className="status-menu-catcher" onClick={() => setMenuFor(null)} />
                        <div className="status-menu">
                          {next.map((s) => (
                            <button key={s} type="button"
                              className={s === 'cancelled' ? 'danger' : ''}
                              onClick={() => {
                                setMenuFor(null);
                                if (s === 'cancelled') { setCancelTarget(o); setCancelReason(''); }
                                else changeStatus(o.id, s);
                              }}>
                              → {ORDER_STATUS[s]}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button className="btn btn-small btn-danger" onClick={() => setDeletingOrder(o)}>Xóa</button>
              </div>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
              {o.user_email || 'Khách vãng lai'} • {fmtDate(o.created_at)} • {o.item_count} sản phẩm • <span className="order-total">{fmtVND(o.total)}</span>
            </div>
            <div style={{ fontSize: '.9rem' }}>📍 {o.address}</div>
            <button className="btn btn-small btn-outline" style={{ marginTop: 8 }} onClick={() => toggle(o.id)}>
              {openId === o.id ? 'Ẩn' : 'Chi tiết & lịch sử'}
            </button>
            {openId === o.id && (
              <div className="order-items">
                {detail ? (
                  <>
                    {detail.items.map((i) => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>{i.product_name} × {i.quantity}</span>
                        <span>{fmtVND(i.price * i.quantity)}</span>
                      </div>
                    ))}
                    {detail.history && detail.history.length > 0 && (
                      <div className="order-history">
                        <div className="order-history-title">📜 Lịch sử trạng thái</div>
                        {detail.history.map((h) => (
                          <div key={h.id} className="order-history-row">
                            <span className="history-flow">
                              {h.from_status ? ORDER_STATUS[h.from_status] : '—'} → <strong>{ORDER_STATUS[h.to_status]}</strong>
                            </span>
                            <span className="history-meta">
                              {h.actor_name} • {fmtDate(h.created_at)}
                              {h.reason ? ` • Lý do: ${h.reason}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '8px 0', color: 'var(--muted)' }}>Đang tải…</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {orders.length === 0 && <div className="empty">Chưa có đơn hàng nào.</div>}

      {cancelTarget && (
        <div className="modal-backdrop" onClick={() => setCancelTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Hủy đơn #{cancelTarget.id}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại tự động.
              Vui lòng ghi rõ lý do hủy (bắt buộc):
            </p>
            <div className="field">
              <label>Lý do hủy *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Khách đổi ý, hết hàng, sai thông tin…"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setCancelTarget(null)}>Đóng</button>
              <button className="btn btn-danger" onClick={confirmCancel}>Xác nhận hủy đơn</button>
            </div>
          </div>
        </div>
      )}

      {deletingOrder && (
        <ConfirmDialog
          title="Xóa đơn hàng"
          message={`Xóa vĩnh viễn đơn #${deletingOrder.id}? Tồn kho sẽ được hoàn lại nếu đơn chưa bị hủy. Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa đơn hàng"
          danger
          onCancel={() => setDeletingOrder(null)}
          onConfirm={doDeleteOrder}
        />
      )}
    </div>
  );
}

/* ---------- Tab Người dùng ---------- */
function UsersTab() {
  const { user } = useStore();
  const [users, setUsers] = useState([]);
  const [roleTarget, setRoleTarget] = useState(null);
  const [newRole, setNewRole] = useState('customer');
  const [loadError, setLoadError] = useState('');
  const [topCustomers, setTopCustomers] = useState([]);
  const [detailFor, setDetailFor] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const load = () => api.getUsers().then((d) => { setUsers(d.users); setLoadError(''); }).catch(() => setLoadError('Không tải được danh sách người dùng'));
  useEffect(() => { load(); }, []);
  useEffect(() => { api.getTopCustomers().then((d) => setTopCustomers(d.customers)).catch(() => {}); }, []);

  const openPurchases = async (u) => {
    setDetailFor(u);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const d = await api.getUserPurchases(u.id);
      setDetailData(d);
    } catch (e) { /* detailData giữ null → modal hiện thông báo không tải được */ }
    setDetailLoading(false);
  };

  const openRoleChange = (u) => { setRoleTarget(u); setNewRole(u.role); };
  const doChangeRole = async () => {
    try { await api.updateUserRole(roleTarget.id, newRole); } catch (e) { alert(e.message); }
    setRoleTarget(null);
    load();
  };
  const roleLabel = (r) => r === 'admin' ? 'Quản trị' : r === 'sale' ? 'Nhân viên sale' : 'Khách hàng';

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>Quản lý người dùng ({users.length})</h3>
      {loadError && <div className="alert alert-error">{loadError}</div>}

      {topCustomers.length > 0 && (
        <div className="top-customers">
          <h4 className="top-customers-title">🏆 Top khách hàng tiềm năng</h4>
          <p className="top-customers-note">Xếp theo tổng tiền đã mua (chỉ tính đơn đã thanh toán). Bấm vào một khách để xem họ đã mua những gì.</p>
          <div className="top-customers-list">
            {topCustomers.map((c, i) => (
              <button key={c.id} type="button" className="top-customer-card" onClick={() => openPurchases(c)}>
                <span className={`top-rank rank-${i + 1}`}>{i + 1}</span>
                <span className="top-customer-main">
                  <span className="top-customer-name">{c.name}</span>
                  <span className="top-customer-email">{c.email}</span>
                </span>
                <span className="top-customer-stats">
                  <strong>{fmtVND(c.total_spent)}</strong>
                  <span>{c.order_count} đơn • mua gần nhất {fmtDate(c.last_order_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <table className="data-table">
        <thead><tr><th>ID</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td><td>{u.name}</td><td>{u.email}</td>
              <td><span className={`status ${u.role === 'customer' ? 'pending' : 'confirmed'}`}>
                {roleLabel(u.role)}
              </span></td>
              <td>{fmtDate(u.created_at)}</td>
              <td>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {u.role === 'customer' && (
                    <button className="btn btn-small btn-outline" onClick={() => openPurchases(u)}>📦 Đã mua</button>
                  )}
                  <button className="btn btn-small btn-outline" onClick={() => openRoleChange(u)} disabled={user && u.id === user.id} title={user && u.id === user.id ? 'Không thể đổi vai trò của chính mình' : ''}>Đổi vai trò</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detailFor && (
        <div className="modal-overlay" onClick={() => setDetailFor(null)}>
          <div className="modal purchase-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h3>🛍️ Lịch sử mua hàng</h3>
            {detailLoading ? (
              <p style={{ color: 'var(--muted)' }}>Đang tải…</p>
            ) : detailData ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  <strong>{detailData.customer.name}</strong> • {detailData.customer.email}
                  {detailData.customer.phone ? ` • ${detailData.customer.phone}` : ''}
                </p>
                <div className="purchase-summary">
                  <span>🧾 {detailData.summary.order_count} đơn đã thanh toán</span>
                  <span>💰 Tổng chi: <strong>{fmtVND(detailData.summary.total_spent)}</strong></span>
                  {detailData.summary.last_order_at && <span>🕐 Mua gần nhất: {fmtDate(detailData.summary.last_order_at)}</span>}
                </div>

                {detailData.top_products.length > 0 && (
                  <>
                    <div className="purchase-subtitle">Sản phẩm hay mua</div>
                    {detailData.top_products.map((p) => (
                      <div key={p.product_name} className="purchase-row">
                        <span>{p.product_name} × {p.total_qty}</span>
                        <span>{fmtVND(p.total_amount)}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="purchase-subtitle">Tất cả đơn hàng ({detailData.orders.length})</div>
                <div className="purchase-orders">
                  {detailData.orders.length === 0 && <p style={{ color: 'var(--muted)' }}>Khách chưa có đơn hàng nào.</p>}
                  {detailData.orders.map((o) => (
                    <div key={o.id} className="purchase-order">
                      <div className="purchase-order-head">
                        <span>Đơn #{o.id} • {fmtDate(o.created_at)}</span>
                        <span className="status-chip">{ORDER_STATUS[o.status] || o.status}</span>
                        <strong>{fmtVND(o.total)}</strong>
                      </div>
                      {o.items.map((i) => (
                        <div key={i.id} className="purchase-row">
                          <span>{i.product_name} × {i.quantity}</span>
                          <span>{fmtVND(i.price * i.quantity)}</span>
                        </div>
                      ))}
                      <div className="purchase-pay">
                        {o.payment_status === 'verified' ? '✅ Đã thanh toán' : o.payment_status === 'refunded' ? '↩️ Đã hoàn tiền' : '⏳ Chưa xác nhận thanh toán'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--muted)' }}>Không tải được dữ liệu của khách này.</p>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDetailFor(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {roleTarget && (
        <div className="modal-overlay" onClick={() => setRoleTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Đổi vai trò</h3>
            <p style={{ marginBottom: 12 }}>{roleTarget.email}</p>
            <div className="field">
              <label>Vai trò mới</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="customer">Khách hàng</option>
                <option value="sale">Nhân viên sale</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setRoleTarget(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={doChangeRole}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { key: 'products', icon: '🛍️', label: 'Sản phẩm' },
  { key: 'categories', icon: '📂', label: 'Danh mục' },
  { key: 'orders', icon: '📦', label: 'Đơn hàng' },
  { key: 'inventory', icon: '🏭', label: 'Kho & NCC' },
  { key: 'payments', icon: '💳', label: 'Thanh toán' },
  { key: 'shipping', icon: '🚚', label: 'Vận chuyển' },
  { key: 'aftersales', icon: '🛠️', label: 'Hậu mãi' },
  { key: 'vouchers', icon: '🎟️', label: 'Voucher' },
  { key: 'promos', icon: '🎉', label: 'Sự kiện' },
  { key: 'news', icon: '📰', label: 'Tin tức', badge: 'MỚI' },
  { key: 'reviews', icon: '⭐', label: 'Đánh giá' },
  { key: 'reports', icon: '📊', label: 'Thống kê' },
  { key: 'users', icon: '👥', label: 'Người dùng' },
  { key: 'posts', icon: '📝', label: 'Bài viết' },
  { key: 'customerChat', icon: '💬', label: 'Chat khách hàng' },
  { key: 'internalChat', icon: '🏢', label: 'Tin nhắn nội bộ' },
  { key: 'messages', icon: '✉️', label: 'Tin nhắn' },
];

/* ---------- Tab Bài viết (Blog) — port từ web artifact ---------- */
function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const empty = { title: '', cover_image_url: '', excerpt: '', content: '', status: 'draft' };
  const [form, setForm] = useState(empty);

  const [loadError, setLoadError] = useState('');
  const load = () => api.getPosts(true).then((d) => { setPosts(d.posts); setLoadError(''); }).catch(() => setLoadError('Không tải được danh sách bài viết'));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ title: p.title, cover_image_url: p.cover_image_url || '', excerpt: p.excerpt || '', content: p.content || '', status: p.status });
    setShowModal(true);
  };
  const save = async () => {
    if (!form.title.trim()) return alert('Vui lòng nhập tiêu đề bài viết');
    try {
      if (editing) await api.updatePost(editing.id, form);
      else await api.createPost(form);
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
  };
  const doDelete = async () => {
    try { await api.deletePost(deleting.id); } catch (e) { alert(e.message); }
    setDeleting(null);
    load();
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <div className="toolbar">
        <h3>Quản lý bài viết ({posts.length})</h3>
        <button className="btn btn-primary" onClick={openNew}>+ Viết bài mới</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td style={{ maxWidth: 320 }}>{p.title}<br /><small style={{ color: 'var(--muted)' }}>/{p.slug}</small></td>
                <td><span className={`status ${p.status === 'published' ? 'delivered' : 'pending'}`}>
                  {p.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
                </span></td>
                <td>{fmtDate(p.created_at)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-small btn-outline" onClick={() => openEdit(p)}>Sửa</button>{' '}
                  <button className="btn btn-small btn-danger" onClick={() => setDeleting(p)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h3>{editing ? 'Sửa bài viết' : 'Viết bài mới'}</h3>
            <div className="field"><label>Tiêu đề *</label>
              <input value={form.title} onChange={set('title')} placeholder="Tiêu đề bài viết" /></div>
            <div className="field"><label>Ảnh bìa (URL)</label>
              <input value={form.cover_image_url} onChange={set('cover_image_url')} placeholder="https://..." /></div>
            <div className="field"><label>Tóm tắt</label>
              <textarea value={form.excerpt} onChange={set('excerpt')} rows={2} placeholder="Đoạn tóm tắt hiển thị ở danh sách" /></div>
            <div className="field"><label>Nội dung (mỗi đoạn cách nhau bằng một dòng trống)</label>
              <textarea value={form.content} onChange={set('content')} rows={8} placeholder="Nội dung bài viết..." /></div>
            <div className="field"><label>Trạng thái</label>
              <select value={form.status} onChange={set('status')}>
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
              </select></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Đóng</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Lưu thay đổi' : 'Tạo bài viết'}</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa bài viết"
          message={`Xóa vĩnh viễn bài "${deleting.title}"? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa bài viết"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

/* ---------- Tab Tin nhắn liên hệ ---------- */
/** Nội dung tin nhắn cho admin: luôn hiện bản gốc, kèm bản dịch tiếng Việt nếu khách viết ngoại ngữ. */
function MessageBody({ message }) {
  const [liveVi, setLiveVi] = useState('');
  const [translating, setTranslating] = useState(false);
  const stored = (message.content_vi || '').trim();
  const needLive = !stored && detectLang(message.content) !== 'vi';

  useEffect(() => {
    if (!needLive) { setLiveVi(''); setTranslating(false); return; }
    let alive = true;
    setTranslating(true);
    translateToVietnamese(message.content).then((t) => {
      if (!alive) return;
      setTranslating(false);
      if (t && t !== message.content) setLiveVi(t);
    });
    return () => { alive = false; };
  }, [message.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vi = stored || liveVi;
  return (
    <div>
      <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 6, fontWeight: 700 }}>
        {vi ? 'Nội dung gốc' : 'Nội dung'}
      </div>
      <div className="msg-content">{message.content}</div>
      {vi && (
        <>
          <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginBottom: 6, fontWeight: 700 }}>
            Bản dịch tiếng Việt
          </div>
          <div className="msg-content">{vi}</div>
        </>
      )}
      {translating && !vi && (
        <small style={{ color: 'var(--muted)' }}>Đang dịch sang tiếng Việt…</small>
      )}
    </div>
  );
}

function MessagesTab({ onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [loadError, setLoadError] = useState('');
  const load = () => api.getContactMessages().then((d) => {
    setMessages(d.messages); setLoadError('');
    onUnreadChange?.(d.messages.filter((m) => !m.is_read).length);
  }).catch(() => setLoadError('Không tải được tin nhắn liên hệ'));
  useEffect(() => { load(); }, []);

  // Mở tin để đọc: tự đánh dấu đã đọc
  const openMessage = async (m) => {
    setViewing({ ...m, is_read: true });
    if (!m.is_read) {
      try { await api.markMessageRead(m.id, true); } catch (e) { /* bỏ qua, giữ UI */ }
      load();
    }
  };
  const markUnread = async () => {
    if (!viewing) return;
    try { await api.markMessageRead(viewing.id, false); } catch (e) { alert(e.message); }
    setViewing(null);
    load();
  };
  const doDelete = async () => {
    try { await api.deleteContactMessage(deleting.id); } catch (e) { alert(e.message); }
    if (viewing && viewing.id === deleting.id) setViewing(null);
    setDeleting(null);
    load();
  };

  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <div>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <div className="toolbar">
        <h3>Tin nhắn liên hệ ({messages.length}{unread > 0 ? ` — ${unread} chưa đọc` : ''})</h3>
      </div>
      {messages.length === 0 ? (
        <div className="empty"><h3>Chưa có tin nhắn nào</h3><p>Tin nhắn khách gửi từ trang Liên hệ sẽ hiện ở đây.</p></div>
      ) : (
        <div className="news-admin-list">
          {messages.map((m) => (
            <div key={m.id} className="glass news-admin-card msg-row" onClick={() => openMessage(m)}>
              <div className={`msg-avatar${m.is_read ? '' : ' unread'}`}>{(m.name || '?').trim().charAt(0).toUpperCase()}</div>
              <div className="news-admin-body">
                <div className="news-admin-top">
                  <span className={m.is_read ? 'msg-name' : 'msg-name unread'}>{m.name}</span>
                  <span className={`status-chip${m.is_read ? ' off' : ''}`}>{m.is_read ? 'Đã đọc' : 'Chưa đọc'}</span>
                </div>
                <div className="news-admin-author">{[m.phone, m.email].filter(Boolean).join(' • ') || '—'}</div>
                <div className="news-admin-author">📅 {fmtDate(m.created_at)}</div>
              </div>
              <div className="news-admin-actions">
                <button className="btn btn-small btn-outline" onClick={(e) => { e.stopPropagation(); openMessage(m); }}>Đọc tin</button>
                <button className="btn btn-small btn-outline" style={{ color: '#b3261e', borderColor: '#b3261e' }} onClick={(e) => { e.stopPropagation(); setDeleting(m); }}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop" onClick={() => setViewing(null)}>
          <div className="modal msg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="msg-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="msg-avatar unread">{(viewing.name || '?').trim().charAt(0).toUpperCase()}</div>
                <div>
                  <h3 style={{ margin: 0 }}>{viewing.name}</h3>
                  <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>
                    {[viewing.phone, viewing.email].filter(Boolean).join(' • ') || '—'}
                  </div>
                </div>
              </div>
              <button className="btn btn-small btn-outline" onClick={() => setViewing(null)}>✕</button>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '.86rem', marginBottom: 10 }}>📅 Gửi ngày {fmtDate(viewing.created_at)}</div>
            <MessageBody message={viewing} />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={markUnread}>Đánh dấu chưa đọc</button>
              <button className="btn btn-outline" style={{ color: '#b3261e', borderColor: '#b3261e' }} onClick={() => setDeleting(viewing)}>Xóa</button>
              <button className="btn btn-primary" onClick={() => setViewing(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Xóa tin nhắn"
          message={`Xóa vĩnh viễn tin nhắn của "${deleting.name}"? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa tin nhắn"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('products');
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [chatSummary, setChatSummary] = useState({ waiting: 0, internal_unread: 0, customer_unread: 0 });
  const [newOrders, setNewOrders] = useState(0);
  const [pendingPays, setPendingPays] = useState(0);
  const refreshBadges = () => {
    api.getNewOrderCount().then((d) => setNewOrders(d.count || 0)).catch(() => {});
    api.getPayments().then((d) => setPendingPays((d.payments || []).filter((p) => p.status === 'pending').length)).catch(() => {});
  };
  useEffect(() => {
    const loadSummary = () => api.chatStaffSummary().then(setChatSummary).catch(() => {});
    loadSummary();
    refreshBadges();
    const iv = setInterval(() => { loadSummary(); refreshBadges(); }, 20000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Đổi tab: vào tab Đơn hàng thì đánh dấu đã xem (ô đỏ đơn mới về 0);
  // số thanh toán chờ duyệt luôn nạp lại để duyệt xong là giảm ngay khi qua tab khác
  useEffect(() => {
    if (tab === 'orders') {
      api.markOrdersSeen().then(() => setNewOrders(0)).catch(() => {});
    }
    api.getPayments().then((d) => setPendingPays((d.payments || []).filter((p) => p.status === 'pending').length)).catch(() => {});
  }, [tab]);
  // Đổi tab quản trị → về đầu trang (đổi tab không đổi địa chỉ nên App không tự cuộn)
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  // Số tin nhắn liên hệ chưa đọc → hiện ô đỏ ở mục Tin nhắn (nạp lại mỗi lần đổi tab)
  useEffect(() => {
    if (tab === 'messages') return; // tab Tin nhắn tự báo số qua onUnreadChange
    api.getContactMessages()
      .then((d) => setUnreadMsgs((d.messages || []).filter((m) => !m.is_read).length))
      .catch(() => {});
  }, [tab]);
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useStore();
  // Sale thấy toàn bộ tab trừ "Người dùng" (quản lý tài khoản chỉ dành cho Admin)
  const visibleNav = user?.role === 'sale' ? NAV.filter((n) => n.key !== 'users') : NAV;
  return (
    <div className="container page">
      <h1 className="page-title">Bảng quản trị</h1>
      <div className="admin-layout">
        <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
          <button className="sidebar-toggle" onClick={() => setCollapsed((c) => !c)} aria-label="Thu gọn menu">
            {collapsed ? '☰' : '✕'}
          </button>
          <nav>
            {visibleNav.map((n) => (
              <button
                key={n.key}
                className={tab === n.key ? 'active' : ''}
                onClick={() => setTab(n.key)}
                title={n.label}
              >
                <span className="nav-icon">{n.icon}</span>
                {!collapsed && <span className="nav-label">{n.label}</span>}
                {!collapsed && n.badge && <span className="nav-badge">{n.badge}</span>}
                {(() => {
                  const counts = {
                    messages: unreadMsgs,
                    customerChat: chatSummary.waiting + chatSummary.customer_unread,
                    internalChat: chatSummary.internal_unread,
                    orders: newOrders,
                    payments: pendingPays,
                  };
                  const n2 = counts[n.key] || 0;
                  return n2 > 0 ? <span className="nav-count">{n2 > 99 ? '99+' : n2}</span> : null;
                })()}
              </button>
            ))}
          </nav>
        </aside>
        <section className="admin-content">
          {tab === 'products' && <ProductsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'inventory' && <InventoryTab />}
          {tab === 'payments' && <PaymentsTab />}
          {tab === 'shipping' && <ShippingTab />}
          {tab === 'aftersales' && <AftersalesTab />}
          {tab === 'vouchers' && <VouchersTab />}
          {tab === 'promos' && <PromoEventsTab />}
          {tab === 'news' && <NewsTab />}
          {tab === 'reviews' && <ReviewsTab />}
          {tab === 'reports' && <ReportsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'posts' && <PostsTab />}
          {tab === 'customerChat' && <CustomerChatTab />}
          {tab === 'internalChat' && <InternalChatTab />}
          {tab === 'messages' && <MessagesTab onUnreadChange={setUnreadMsgs} />}
        </section>
      </div>
    </div>
  );
}
