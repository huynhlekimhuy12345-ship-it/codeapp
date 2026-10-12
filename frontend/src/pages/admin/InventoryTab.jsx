/*
 * Tab Tồn kho & Nhà cung cấp (Admin).
 *
 * GỌI API qua các hàm trong `api` (coordinator thêm vào frontend/src/api.js):
 *   getSuppliers() → { suppliers }
 *   createSupplier({ name, phone, address, note }) → { supplier }
 *   updateSupplier(id, payload) → { supplier }
 *   deleteSupplier(id) → { message }
 *   getPurchaseOrders() → { purchase_orders }            // mỗi phiếu có supplier_name, total, status_label
 *   getPurchaseOrder(id) → { purchase_order, items }     // items có variant_sku/product_name
 *   createPurchaseOrder({ supplier_id, note, items })    // items: [{ variant_id?, product_id?, quantity, unit_price }]
 *   receivePurchaseOrder(id) → { purchase_order, total } // nhập kho
 *   cancelPurchaseOrder(id) → { purchase_order }
 *   getMovements({ product_id, variant_id, limit }) → { movements } // mỗi dòng có product_name, variant_sku
 *   adjustStock({ variant_id?, product_id?, qty, note }) → { message, stock }
 *   getLowStock(threshold) → { threshold, low_stock }
 *   getInventoryItems(q) → { items }                     // SP kèm variants (cho picker phiếu nhập)
 */
import { useEffect, useState } from 'react';
import { api, fmtVND, fmtDate } from '../../api';

const PO_STATUS_COLOR = {
  draft: '#b7791f',
  confirmed: '#1d6fd1',
  received: '#1f8a4c',
  cancelled: '#999',
};

/* ---------- Form Nhà cung cấp (thêm / sửa) ---------- */
function SupplierForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    phone: initial?.phone || '',
    address: initial?.address || '',
    note: initial?.note || '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name.trim()) return alert('Vui lòng nhập tên nhà cung cấp');
    try {
      if (initial) await api.updateSupplier(initial.id, form);
      else await api.createSupplier(form);
      onSave();
    } catch (e) { alert(e.message); }
  };
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h3>
        <div className="field"><label>Tên *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label>Điện thoại</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label>Địa chỉ</label><input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label>Ghi chú</label><textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} /></div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Đóng</button>
          <button className="btn btn-primary" onClick={save}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Section 1: Nhà cung cấp ---------- */
function SuppliersSection() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.getSuppliers().then((d) => setSuppliers(d.suppliers)).catch((e) => alert(e.message));
  useEffect(load, []);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setShowForm(true); };
  const doDelete = async (s) => {
    if (!window.confirm(`Xóa nhà cung cấp "${s.name}"?`)) return;
    try { await api.deleteSupplier(s.id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="toolbar">
        <h3>Nhà cung cấp ({suppliers.length})</h3>
        <button className="btn btn-primary" onClick={openNew}>+ Thêm nhà cung cấp</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Tên</th><th>Điện thoại</th><th>Địa chỉ</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.address || '—'}</td>
                <td>{s.note || '—'}</td>
                <td><div className="row-actions">
                  <button className="btn btn-small btn-outline" onClick={() => openEdit(s)}>Sửa</button>
                  <button className="btn btn-small btn-danger" onClick={() => doDelete(s)}>Xóa</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {suppliers.length === 0 && <p className="empty">Chưa có nhà cung cấp nào</p>}
      </div>
      {showForm && <SupplierForm initial={editing} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------- Form tạo phiếu nhập ---------- */
function PurchaseOrderForm({ suppliers, onSave, onCancel }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  useEffect(() => {
    api.getInventoryItems(search).then((d) => setResults(d.items)).catch(() => {});
  }, [search]);

  // Thêm 1 dòng hàng: target = { kind: 'variant'|'product', id, label }
  const addItem = (target, label) => {
    const q = parseInt(qty);
    const up = parseInt(unitPrice) || 0;
    if (!Number.isInteger(q) || q <= 0) return alert('Số lượng phải là số nguyên dương');
    const dup = items.find((i) => i.target.id === target.id && i.target.kind === target.kind);
    if (dup) return alert('Mặt hàng này đã có trong phiếu');
    setItems((list) => [...list, {
      target,
      label,
      quantity: q,
      unit_price: up,
      ...(target.kind === 'variant' ? { variant_id: target.id } : { product_id: target.id }),
    }]);
  };

  const save = async () => {
    if (!supplierId) return alert('Vui lòng chọn nhà cung cấp');
    if (items.length === 0) return alert('Phiếu nhập phải có ít nhất 1 dòng hàng');
    try {
      await api.createPurchaseOrder({
        supplier_id: parseInt(supplierId),
        note,
        items: items.map(({ variant_id, product_id, quantity, unit_price }) => ({ variant_id, product_id, quantity, unit_price })),
      });
      onSave();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <h3>Tạo phiếu nhập hàng</h3>
        <div className="field"><label>Nhà cung cấp *</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Ghi chú</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>

        <h4>Thêm dòng hàng</h4>
        <div className="filters">
          <input placeholder="Tìm sản phẩm…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 2 }} />
          <input placeholder="SL" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 80 }} />
          <input placeholder="Giá nhập" type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} style={{ width: 140 }} />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border, #eee)', borderRadius: 8, marginBottom: 12 }}>
          {results.flatMap((p) => {
            const rows = p.variants.length === 0
              ? [{ kind: 'product', id: p.id, label: `${p.name} (tồn: ${p.stock})` }]
              : p.variants.map((v) => ({
                  kind: 'variant', id: v.id,
                  label: `${p.name} — ${v.sku}${v.color ? ' / ' + v.color : ''}${v.size ? ' / ' + v.size : ''} (tồn: ${v.stock})`,
                }));
            return rows.map((t) => (
              <div key={`${t.kind}-${t.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: '.9rem' }}>{t.label}</span>
                <button className="btn btn-small btn-outline" onClick={() => addItem({ kind: t.kind, id: t.id }, t.label)}>+ Thêm</button>
              </div>
            ));
          })}
        </div>

        <h4>Dòng hàng ({items.length})</h4>
        {items.length === 0
          ? <p className="empty">Chưa có dòng hàng nào</p>
          : <table className="data-table">
              <thead><tr><th>Mặt hàng</th><th>SL</th><th>Giá nhập</th><th>Thành tiền</th><th></th></tr></thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={idx}>
                    <td>{i.label}</td>
                    <td>{i.quantity}</td>
                    <td>{fmtVND(i.unit_price)}</td>
                    <td>{fmtVND(i.quantity * i.unit_price)}</td>
                    <td><button className="btn btn-small btn-danger" onClick={() => setItems((l) => l.filter((_, j) => j !== idx))}>Xóa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        <p style={{ textAlign: 'right', fontWeight: 600, marginTop: 8 }}>
          Tổng dự kiến: {fmtVND(items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}
        </p>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Đóng</button>
          <button className="btn btn-primary" onClick={save}>Tạo phiếu</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Section 2: Phiếu nhập ---------- */
function PurchaseOrdersSection() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null); // { purchase_order, items }

  const load = () => {
    api.getPurchaseOrders().then((d) => setOrders(d.purchase_orders)).catch((e) => alert(e.message));
    api.getSuppliers().then((d) => setSuppliers(d.suppliers)).catch(() => {});
  };
  useEffect(load, []);

  const openDetail = async (id) => {
    try { setDetail(await api.getPurchaseOrder(id)); } catch (e) { alert(e.message); }
  };

  const doReceive = async (id) => {
    if (!window.confirm('Nhập kho theo phiếu này? Tồn kho sẽ tăng lên.')) return;
    try {
      const d = await api.receivePurchaseOrder(id);
      alert(`Đã nhập kho, tổng ${fmtVND(d.total)}`);
      setDetail(null);
      load();
    } catch (e) { alert(e.message); }
  };
  const doCancel = async (id) => {
    if (!window.confirm('Hủy phiếu nhập này?')) return;
    try { await api.cancelPurchaseOrder(id); setDetail(null); load(); } catch (e) { alert(e.message); }
  };

  const canAct = (po) => po.status === 'draft' || po.status === 'confirmed';

  return (
    <div>
      <div className="toolbar">
        <h3>Phiếu nhập hàng ({orders.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} disabled={suppliers.length === 0}>+ Tạo phiếu nhập</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Nhà cung cấp</th><th>Trạng thái</th><th>Tổng tiền</th><th>Ghi chú</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id}>
                <td>#{po.id}</td>
                <td>{po.supplier_name || '—'}</td>
                <td><span className="status-chip" style={{ background: PO_STATUS_COLOR[po.status] || '#999' }}>{po.status_label}</span></td>
                <td>{fmtVND(po.total)}</td>
                <td>{po.note || '—'}</td>
                <td>{fmtDate(po.created_at)}</td>
                <td><div className="row-actions">
                  <button className="btn btn-small btn-outline" onClick={() => openDetail(po.id)}>Chi tiết</button>
                  {canAct(po) && <>
                    <button className="btn btn-small btn-primary" onClick={() => doReceive(po.id)}>Nhập kho</button>
                    <button className="btn btn-small btn-danger" onClick={() => doCancel(po.id)}>Hủy</button>
                  </>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="empty">Chưa có phiếu nhập nào</p>}
      </div>

      {showForm && <PurchaseOrderForm suppliers={suppliers} onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3>Phiếu nhập #{detail.purchase_order.id} — {detail.purchase_order.status_label}</h3>
            <p style={{ color: 'var(--muted)' }}>NCC: {detail.purchase_order.supplier_name || '—'} · Tổng: {fmtVND(detail.purchase_order.total)}</p>
            <table className="data-table">
              <thead><tr><th>Mặt hàng</th><th>SL</th><th>Giá nhập</th><th>Thành tiền</th></tr></thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.variant_sku ? `${it.product_name} — ${it.variant_sku}` : it.product_name}</td>
                    <td>{it.quantity}</td>
                    <td>{fmtVND(it.unit_price)}</td>
                    <td>{fmtVND(it.quantity * it.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Đóng</button>
              {canAct(detail.purchase_order) && <>
                <button className="btn btn-primary" onClick={() => doReceive(detail.purchase_order.id)}>Nhập kho</button>
                <button className="btn btn-danger" onClick={() => doCancel(detail.purchase_order.id)}>Hủy phiếu</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Form điều chỉnh kho ---------- */
function AdjustForm({ onSave, onCancel }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [target, setTarget] = useState(null); // { kind, id, label }
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    api.getInventoryItems(search).then((d) => setResults(d.items)).catch(() => {});
  }, [search]);

  const save = async () => {
    const d = parseInt(qty);
    if (!target) return alert('Vui lòng chọn mặt hàng');
    if (isNaN(d) || d === 0) return alert('Số lượng điều chỉnh phải là số nguyên khác 0');
    if (!note.trim()) return alert('Ghi chú là bắt buộc khi điều chỉnh kho');
    try {
      const r = await api.adjustStock({
        ...(target.kind === 'variant' ? { variant_id: target.id } : { product_id: target.id }),
        qty: d,
        note: note.trim(),
      });
      alert(`Đã điều chỉnh. Tồn kho hiện tại: ${r.stock}`);
      onSave();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Điều chỉnh tồn kho thủ công</h3>
        <div className="field"><label>Tìm mặt hàng</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập tên sản phẩm…" /></div>
        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border, #eee)', borderRadius: 8, marginBottom: 12 }}>
          {results.flatMap((p) => {
            const rows = p.variants.length === 0
              ? [{ kind: 'product', id: p.id, label: `${p.name} (tồn: ${p.stock})` }]
              : p.variants.map((v) => ({ kind: 'variant', id: v.id, label: `${p.name} — ${v.sku} (tồn: ${v.stock})` }));
            return rows.map((t) => (
              <div
                key={`${t.kind}-${t.id}`}
                onClick={() => setTarget(t)}
                style={{ padding: '6px 10px', fontSize: '.9rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                         background: target?.kind === t.kind && target?.id === t.id ? '#f5efe4' : 'transparent' }}
              >{t.label}</div>
            ));
          })}
        </div>
        <div className="field"><label>Đã chọn</label><input value={target ? target.label : '—'} readOnly /></div>
        <div className="field"><label>Số lượng (+ nhập thêm / − xuất bớt) *</label>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="VD: 10 hoặc -5" />
        </div>
        <div className="field"><label>Lý do điều chỉnh *</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Đóng</button>
          <button className="btn btn-primary" onClick={save}>Điều chỉnh</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Section 3: Lịch sử xuất-nhập kho ---------- */
function MovementsSection() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterProduct, setFilterProduct] = useState('');
  const [lowStock, setLowStock] = useState([]);
  const [threshold, setThreshold] = useState(5);
  const [showAdjust, setShowAdjust] = useState(false);

  const loadMovements = () => {
    const params = filterProduct ? { product_id: filterProduct } : {};
    api.getMovements(params).then((d) => setMovements(d.movements)).catch((e) => alert(e.message));
  };
  const loadLowStock = () => {
    api.getLowStock(parseInt(threshold) || 5).then((d) => setLowStock(d.low_stock)).catch(() => {});
  };
  useEffect(() => { loadMovements(); loadLowStock(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.getProducts({ limit: 100 }).then((d) => setProducts(d.products)).catch(() => {}); }, []);

  const label = (m) => m.variant_sku
    ? `${m.product_name || ''} — ${m.variant_sku}${m.variant_color ? ' / ' + m.variant_color : ''}${m.variant_size ? ' / ' + m.variant_size : ''}`
    : (m.product_name || '—');
  const typeColor = { IN: '#1f8a4c', OUT: '#c0392b', ADJUST: '#b7791f' };

  return (
    <div>
      <div className="toolbar">
        <h3>Lịch sử xuất-nhập kho</h3>
        <div className="row-actions">
          <div className="filters" style={{ margin: 0 }}>
            <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
              <option value="">Tất cả sản phẩm</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-small btn-outline" onClick={loadMovements}>Lọc</button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdjust(true)}>Điều chỉnh kho</button>
        </div>
      </div>

      <h4 style={{ marginTop: 4 }}>Cảnh báo sắp hết hàng (≤ {threshold})</h4>
      <div className="filters" style={{ marginBottom: 12 }}>
        <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ width: 100 }} />
        <button className="btn btn-small btn-outline" onClick={loadLowStock}>Kiểm tra</button>
      </div>
      {lowStock.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="data-table">
            <thead><tr><th>Mặt hàng</th><th>Tồn kho</th></tr></thead>
            <tbody>
              {lowStock.map((r, i) => (
                <tr key={i}>
                  <td>{r.variant_sku ? `${r.product_name} — ${r.variant_sku}` : r.product_name}</td>
                  <td style={{ color: '#c0392b', fontWeight: 700 }}>{r.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Thời gian</th><th>Mặt hàng</th><th>Loại</th><th>Số lượng</th><th>Tham chiếu</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.created_at)}</td>
                <td>{label(m)}</td>
                <td><span className="status-chip" style={{ background: typeColor[m.type] || '#999' }}>
                  {m.type === 'IN' ? 'Nhập' : m.type === 'OUT' ? 'Xuất' : 'Điều chỉnh'}
                </span></td>
                <td>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                <td>{m.ref_type ? `${m.ref_type}${m.ref_id != null ? ' #' + m.ref_id : ''}` : '—'}</td>
                <td>{m.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {movements.length === 0 && <p className="empty">Chưa có biến động kho nào</p>}
      </div>

      {showAdjust && <AdjustForm onSave={() => { setShowAdjust(false); loadMovements(); loadLowStock(); }} onCancel={() => setShowAdjust(false)} />}
    </div>
  );
}

/* ---------- Component chính: 3 section ---------- */
export default function InventoryTab() {
  return (
    <div>
      <h2 className="page-title">Tồn kho & Nhà cung cấp</h2>
      <section style={{ marginBottom: 32 }}>
        <SuppliersSection />
      </section>
      <section style={{ marginBottom: 32 }}>
        <PurchaseOrdersSection />
      </section>
      <section>
        <MovementsSection />
      </section>
    </div>
  );
}
