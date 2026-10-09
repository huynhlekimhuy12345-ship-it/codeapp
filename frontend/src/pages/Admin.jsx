import { useEffect, useState } from 'react';
import { api, fmtVND, fmtDate, ORDER_STATUS, nextStatuses } from '../api';

/* ---------- Hộp xác nhận trong trang (thay confirm() trình duyệt — bị chặn trong iframe nhúng) ---------- */
function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = false, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
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
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '', stock: '', image_url: '' });
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    api.getProducts({ limit: 50 }).then((d) => setProducts(d.products)).catch(() => {});
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  };
  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setForm({ category_id: '', name: '', description: '', price: '', stock: '', image_url: '' });
    setShowModal(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ category_id: p.category_id || '', name: p.name, description: p.description || '', price: p.price, stock: p.stock, image_url: p.image_url || '' });
    setShowModal(true);
  };
  const save = async () => {
    if (!form.name || form.price === '') return alert('Vui lòng nhập tên và giá');
    try {
      const payload = { ...form, category_id: form.category_id || null };
      if (editing) await api.updateProduct(editing.id, payload);
      else await api.createProduct(payload);
      setShowModal(false);
      load();
    } catch (e) { alert(e.message); }
  };
  const doDelete = async () => {
    try { await api.deleteProduct(deleting.id); } catch (e) { alert(e.message); }
    setDeleting(null);
    load();
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
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
              </select>
            </div>
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
    </div>
  );
}

/* ---------- Tab Danh mục ---------- */
function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = () => api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  useEffect(load, []);

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
    try { await api.deleteCategory(deleting.id); } catch (e) { alert(e.message); }
    setDeleting(null);
    load();
  };

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>Quản lý danh mục</h3>
      <div className="filters" style={{ alignItems: 'end' }}>
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

  const load = () => api.getOrders(filter || undefined).then((d) => setOrders(d.orders)).catch(() => {});
  useEffect(load, [filter]);

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
    try { await api.deleteOrder(deletingOrder.id); } catch (e) { alert(e.message); }
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
      <div className="toolbar">
        <h3>Quản lý đơn hàng ({orders.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
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
                {next.length > 0 ? (
                  <select
                    value=""
                    onChange={(e) => {
                      const s = e.target.value;
                      e.target.value = '';
                      if (!s) return;
                      if (s === 'cancelled') { setCancelTarget(o); setCancelReason(''); }
                      else changeStatus(o.id, s);
                    }}
                  >
                    <option value="">Chuyển trạng thái…</option>
                    {next.map((s) => <option key={s} value={s}>→ {ORDER_STATUS[s]}</option>)}
                  </select>
                ) : (
                  <span className="status-chip">{ORDER_STATUS[o.status]}</span>
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
  const [users, setUsers] = useState([]);
  const [roleTarget, setRoleTarget] = useState(null);
  const load = () => api.getUsers().then((d) => setUsers(d.users)).catch(() => {});
  useEffect(load, []);

  const doToggleRole = async () => {
    const next = roleTarget.role === 'admin' ? 'customer' : 'admin';
    try { await api.updateUserRole(roleTarget.id, next); } catch (e) { alert(e.message); }
    setRoleTarget(null);
    load();
  };

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>Quản lý người dùng ({users.length})</h3>
      <table className="data-table">
        <thead><tr><th>ID</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td><td>{u.name}</td><td>{u.email}</td>
              <td><span className={`status ${u.role === 'admin' ? 'confirmed' : 'pending'}`}>
                {u.role === 'admin' ? 'Quản trị' : 'Khách hàng'}
              </span></td>
              <td>{fmtDate(u.created_at)}</td>
              <td><button className="btn btn-small btn-outline" onClick={() => setRoleTarget(u)}>Đổi vai trò</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {roleTarget && (
        <ConfirmDialog
          title="Đổi vai trò"
          message={`Đổi ${roleTarget.email} thành ${roleTarget.role === 'admin' ? 'khách hàng' : 'quản trị viên'}?`}
          confirmLabel="Đổi vai trò"
          onCancel={() => setRoleTarget(null)}
          onConfirm={doToggleRole}
        />
      )}
    </div>
  );
}

const NAV = [
  { key: 'products', icon: '🛍️', label: 'Sản phẩm' },
  { key: 'categories', icon: '📂', label: 'Danh mục' },
  { key: 'orders', icon: '📦', label: 'Đơn hàng' },
  { key: 'users', icon: '👥', label: 'Người dùng' },
];

export default function Admin() {
  const [tab, setTab] = useState('products');
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="container page">
      <h2 className="page-title">Bảng quản trị</h2>
      <div className="admin-layout">
        <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
          <button className="sidebar-toggle" onClick={() => setCollapsed((c) => !c)} aria-label="Thu gọn menu">
            {collapsed ? '☰' : '✕'}
          </button>
          <nav>
            {NAV.map((n) => (
              <button
                key={n.key}
                className={tab === n.key ? 'active' : ''}
                onClick={() => setTab(n.key)}
                title={n.label}
              >
                <span className="nav-icon">{n.icon}</span>
                {!collapsed && <span className="nav-label">{n.label}</span>}
              </button>
            ))}
          </nav>
        </aside>
        <section className="admin-content">
          {tab === 'products' && <ProductsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'users' && <UsersTab />}
        </section>
      </div>
    </div>
  );
}
