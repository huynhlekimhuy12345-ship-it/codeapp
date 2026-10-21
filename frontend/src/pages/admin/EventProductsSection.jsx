// Khu vực CRUD sản phẩm trong sự kiện khuyến mãi — nhúng trong tab Sản phẩm (Admin.jsx).
// Chọn sự kiện → xem/sửa giá sale từng SP, thêm SP mới vào sự kiện, gỡ SP khỏi sự kiện.
import { useEffect, useState } from 'react';
import { api, fmtVND } from '../../api';

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

// Làm tròn về nghìn đồng gần nhất cho giá sale "đẹp"
function roundVND(n) {
  return Math.round(n / 1000) * 1000;
}
function saleFromPercent(price, pct) {
  const p = parseFloat(pct);
  if (isNaN(p) || p <= 0 || p >= 100) return '';
  return String(roundVND(price * (1 - p / 100)));
}

export default function EventProductsSection() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [items, setItems] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newDiscountPct, setNewDiscountPct] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [editing, setEditing] = useState(null); // { product_id, name, price, sale_price }
  const [editDiscountPct, setEditDiscountPct] = useState('');
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    request('/api/promo-events')
      .then((d) => {
        setEvents(d.events || []);
        if (d.events && d.events.length) setEventId(String(d.events[0].id));
      })
      .catch((e) => setError(e.message));
    api.getProducts({ limit: 100 }).then((d) => setAllProducts(d.products || [])).catch(() => {});
  }, []);

  const loadItems = async (id) => {
    if (!id) { setItems([]); return; }
    setLoading(true);
    setError('');
    try {
      const d = await request(`/api/promo-events/${id}/products`);
      setItems(d.products || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(eventId); }, [eventId]);

  const selectedNewProduct = allProducts.find((p) => String(p.id) === String(newProductId));

  const onNewPctChange = (v) => {
    setNewDiscountPct(v);
    if (selectedNewProduct) {
      const auto = saleFromPercent(selectedNewProduct.price, v);
      if (auto !== '') setNewSalePrice(auto);
    }
  };

  const addProduct = async () => {
    if (!newProductId) return setError('Hãy chọn sản phẩm cần thêm');
    const sp = parseInt(newSalePrice) || 0;
    if (sp <= 0) return setError('Hãy nhập giá sale hợp lệ');
    try {
      await request(`/api/promo-events/${eventId}/products`, {
        method: 'POST',
        body: { product_id: parseInt(newProductId), sale_price: sp },
      });
      setNewProductId('');
      setNewDiscountPct('');
      setNewSalePrice('');
      loadItems(eventId);
    } catch (e) {
      setError(e.message);
    }
  };

  const openEdit = (it) => {
    setEditing(it);
    setEditPrice(String(it.sale_price));
    setEditDiscountPct(String(it.discount_percent || ''));
  };

  const onEditPctChange = (v) => {
    setEditDiscountPct(v);
    if (editing) {
      const auto = saleFromPercent(editing.price, v);
      if (auto !== '') setEditPrice(auto);
    }
  };

  const saveEdit = async () => {
    const sp = parseInt(editPrice) || 0;
    try {
      await request(`/api/promo-events/${eventId}/products/${editing.product_id}`, {
        method: 'PUT',
        body: { sale_price: sp },
      });
      setEditing(null);
      loadItems(eventId);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeProduct = async (it) => {
    if (!window.confirm(`Gỡ "${it.name}" khỏi sự kiện? (Giá gốc của sản phẩm không đổi)`)) return;
    try {
      await request(`/api/promo-events/${eventId}/products/${it.product_id}`, { method: 'DELETE' });
      loadItems(eventId);
    } catch (e) {
      setError(e.message);
    }
  };

  const available = allProducts.filter((p) => !items.some((it) => it.product_id === p.id));
  const selectedEvent = events.find((e) => String(e.id) === String(eventId));

  return (
    <div style={{ marginTop: 28, borderTop: '2px solid #eee', paddingTop: 18 }}>
      <div className="toolbar">
        <h3>🎉 Sản phẩm trong sự kiện khuyến mãi</h3>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.is_active ? ' (đang bật)' : ''}</option>
          ))}
          {!events.length && <option value="">— Chưa có sự kiện —</option>}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {eventId && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ minWidth: 260, margin: 0 }}>
              <label htmlFor="eventproductssection-them-san-pham-vao-selectedevent-name">Thêm sản phẩm vào "{selectedEvent?.name}"</label>
              <select id="eventproductssection-them-san-pham-vao-selectedevent-name" value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                <option value="">— Chọn sản phẩm —</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {fmtVND(p.price)}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 130, margin: 0 }}>
              <label htmlFor="eventproductssection-giam">Giảm (%)</label>
              <input id="eventproductssection-giam" type="number" min="1" max="99" value={newDiscountPct} onChange={(e) => onNewPctChange(e.target.value)} placeholder="VD: 10" />
            </div>
            <div className="field" style={{ width: 180, margin: 0 }}>
              <label htmlFor="eventproductssection-gia-sale">Giá sale (₫)</label>
              <input id="eventproductssection-gia-sale" type="number" min="1" value={newSalePrice} onChange={(e) => setNewSalePrice(e.target.value)} placeholder="Tự tính theo %" />
            </div>
            <button className="btn btn-primary" onClick={addProduct}>+ Thêm vào sự kiện</button>
          </div>

          {loading ? <p>Đang tải...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Sản phẩm</th><th>Giá gốc</th><th>Giá sale</th><th>Giảm</th><th style={{ width: 170 }}>Thao tác</th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.product_id}>
                      <td>{it.name}</td>
                      <td style={{ textDecoration: 'line-through', color: '#888' }}>{fmtVND(it.price)}</td>
                      <td style={{ fontWeight: 700, color: '#b33' }}>{fmtVND(it.sale_price)}</td>
                      <td><span className="badge">-{it.discount_percent}%</span></td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-small btn-outline" onClick={() => openEdit(it)}>Đổi giá</button>
                          <button className="btn btn-small btn-danger-outline" onClick={() => removeProduct(it)}>Gỡ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>Chưa có sản phẩm nào trong sự kiện này</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Đổi giá sale</h3>
            <p style={{ marginBottom: 12 }}><strong>{editing.name}</strong><br />
              <span style={{ color: '#888', fontSize: '.9rem' }}>Giá gốc: {fmtVND(editing.price)}</span></p>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="eventproductssection-giam-1">Giảm (%)</label>
                <input id="eventproductssection-giam-1" type="number" min="1" max="99" value={editDiscountPct} onChange={(e) => onEditPctChange(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="eventproductssection-gia-sale-moi">Giá sale mới (₫)</label>
                <input id="eventproductssection-gia-sale-moi" type="number" min="1" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
            </div>
            <small style={{ color: '#888' }}>Nhập % giảm, giá sale tự tính và làm tròn về nghìn đồng. Vẫn sửa tay được nếu muốn.</small>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveEdit}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
