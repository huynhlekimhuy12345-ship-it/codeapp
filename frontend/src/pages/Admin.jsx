import { useEffect, useState } from 'react';
import { api, fmtVND, fmtDate, ORDER_STATUS } from '../api';

const STATUS_LIST = Object.keys(ORDER_STATUS);

/* ---------- Tab Sản phẩm ---------- */
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category_id: '', name: '', description: '', price: '', stock: '', image_url: '' });

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
  const remove = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return;
    try { await api.deleteProduct(id); load(); } catch (e) { alert(e.message); }
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
                  <button className="btn btn-small btn-danger" onClick={() => remove(p.id)}>Xóa</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
  const remove = async (id) => {
    if (!confirm('Xóa danh mục này? Sản phẩm thuộc danh mục sẽ mất liên kết.')) return;
    try { await api.deleteCategory(id); load(); } catch (e) { alert(e.message); }
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
                <button className="btn btn-small btn-danger" onClick={() => remove(c.id)}>Xóa</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tab Đơn hàng ---------- */
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => api.getOrders(filter || undefined).then((d) => setOrders(d.orders)).catch(() => {});
  useEffect(load, [filter]);

  const changeStatus = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status);
      load();
      if (openId === id) {
        const { order } = await api.getOrder(id);
        setDetail(order);
      }
    } catch (e) { alert(e.message); }
  };

  const toggle = async (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    try { const { order } = await api.getOrder(id); setDetail(order); } catch { setDetail(null); }
  };

  return (
    <div>
      <div className="toolbar">
        <h3>Quản lý đơn hàng ({orders.length})</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tất cả trạng thái</option>
          {STATUS_LIST.map((s) => <option key={s} value={s}>{ORDER_STATUS[s]}</option>)}
        </select>
      </div>
      {orders.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="order-head">
            <strong>Đơn #{o.id} — {o.customer_name} ({o.phone})</strong>
            <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{ORDER_STATUS[s]}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
            {o.user_email || 'Khách vãng lai'} • {fmtDate(o.created_at)} • {o.item_count} sản phẩm • <span className="order-total">{fmtVND(o.total)}</span>
          </div>
          <div style={{ fontSize: '.9rem' }}>📍 {o.address}</div>
          <button className="btn btn-small btn-outline" style={{ marginTop: 8 }} onClick={() => toggle(o.id)}>
            {openId === o.id ? 'Ẩn' : 'Chi tiết'}
          </button>
          {openId === o.id && detail && (
            <div className="order-items">
              {detail.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{i.product_name} × {i.quantity}</span>
                  <span>{fmtVND(i.price * i.quantity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {orders.length === 0 && <div className="empty">Chưa có đơn hàng nào.</div>}
    </div>
  );
}

/* ---------- Tab Người dùng ---------- */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const load = () => api.getUsers().then((d) => setUsers(d.users)).catch(() => {});
  useEffect(load, []);

  const toggleRole = async (u) => {
    const next = u.role === 'admin' ? 'customer' : 'admin';
    if (!confirm(`Đổi ${u.email} thành ${next === 'admin' ? 'quản trị viên' : 'khách hàng'}?`)) return;
    try { await api.updateUserRole(u.id, next); load(); } catch (e) { alert(e.message); }
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
              <td><button className="btn btn-small btn-outline" onClick={() => toggleRole(u)}>Đổi vai trò</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('products');
  return (
    <div className="container page">
      <h2 className="page-title">Bảng quản trị</h2>
      <div className="admin-tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>🛍️ Sản phẩm</button>
        <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>📂 Danh mục</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>📦 Đơn hàng</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>👥 Người dùng</button>
      </div>
      {tab === 'products' && <ProductsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
