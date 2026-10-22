// Tab Bảo hành (admin): Đổi trả / Bảo hành / Sửa chữa
// Thiết kế: mỗi thẻ chỉ hiện dòng tóm tắt, bấm "Xem chi tiết" mới mở thông tin
// và các bước xử lý. Mọi ô nhập đều có nhãn rõ ràng; ô bắt buộc có dấu * đỏ —
// rê chuột lên dấu * để xem chú thích cách nhập. Ô số gõ trực tiếp.
import { useEffect, useState } from 'react';
import '../../components/AftersalesCard.css';

// Hàng ảnh minh họa khách đính kèm — bấm vào để xem lớn
function ImagesRow({ images }) {
  const [zoom, setZoom] = useState(null);
  if (!Array.isArray(images) || images.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: 6 }}>Ảnh minh họa khách gửi:</div>
      <div className="as-card-imgs" style={{ marginTop: 0 }}>
        {images.map((src, i) => (
          <button key={i} type="button" className="as-thumb" style={{ width: 64, height: 64 }}
            onClick={() => setZoom(src)} aria-label="Xem ảnh">
            <img src={src} alt="" />
          </button>
        ))}
      </div>
      {zoom && (
        <div className="as-lightbox" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  );
}

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

const card = {
  background: 'linear-gradient(160deg, rgba(58,38,24,.55), rgba(32,20,12,.65))',
  border: '1px solid rgba(232,181,106,.16)',
  borderRadius: 14,
  padding: '16px 18px',
};

const fieldInput = {
  padding: '8px 12px', borderRadius: 8, background: 'rgba(12,8,5,.6)',
  border: '1.5px solid rgba(232,181,106,.35)', color: 'var(--cream)',
  font: 'inherit', fontSize: '.95rem', boxSizing: 'border-box',
};

// Nhãn ô nhập: chữ rõ ràng phía trên ô; ô bắt buộc thêm dấu * đỏ có chú thích
// hiện ra khi rê chuột (class tip-star trong index.css).
function FieldLabel({ children, required, tip }) {
  return (
    <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, color: '#ffe9c4', marginBottom: 6 }}>
      {children}
      {required && <> <span className="tip-star" data-tip={tip || 'Ô bắt buộc phải nhập'}>*</span></>}
    </label>
  );
}

function Pill({ bg, fg, dot, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: bg, color: fg, padding: '4px 12px', borderRadius: 20,
      fontSize: '.82rem', fontWeight: 600,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block' }} />}
      {children}
    </span>
  );
}

function SectionHead({ icon, title, count, filter, setFilter, options, right }) {
  return (
    <div className="toolbar" style={{ marginBottom: 12 }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.3rem' }}>{icon}</span> {title}
        <span style={{
          fontSize: '.8rem', fontWeight: 600, background: 'rgba(232,181,106,.14)',
          color: '#e8b56a', borderRadius: 20, padding: '2px 10px',
        }}>{count}</span>
      </h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {right}
        <select className="select-dark" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div style={{ ...card, padding: 36, textAlign: 'center', color: 'var(--muted)', marginBottom: 8 }}>
      <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  );
}

// Nút mở/đóng phần chi tiết của một thẻ
function ToggleDetail({ open, onClick }) {
  return (
    <button className="btn btn-small btn-outline" onClick={onClick}>
      {open ? 'Thu gọn ▴' : 'Xem chi tiết ▾'}
    </button>
  );
}

const RETURN_STATUS = {
  requested: { label: 'Chờ duyệt', bg: 'rgba(232,181,106,.14)', fg: '#e8b56a', dot: '#e8b56a' },
  approved: { label: 'Đã duyệt', bg: 'rgba(96,165,250,.12)', fg: '#7fb3f5', dot: '#60a5fa' },
  received: { label: 'Đã nhận hàng', bg: 'rgba(45,212,191,.12)', fg: '#5eead4', dot: '#2dd4bf' },
  rejected: { label: 'Từ chối', bg: 'rgba(248,113,113,.12)', fg: '#f58a8a', dot: '#f87171' },
  completed: { label: 'Hoàn thành', bg: 'rgba(74,222,128,.12)', fg: '#6ee7a0', dot: '#4ade80' },
};
const RETURN_TYPE = { return: '↩️ Trả hàng', exchange: '🔄 Đổi hàng' };
const REPAIR_STATUS = {
  received: { label: 'Đã nhận', bg: 'rgba(232,181,106,.14)', fg: '#e8b56a', dot: '#e8b56a' },
  repairing: { label: 'Đang sửa', bg: 'rgba(96,165,250,.12)', fg: '#7fb3f5', dot: '#60a5fa' },
  done: { label: 'Đã sửa xong', bg: 'rgba(74,222,128,.12)', fg: '#6ee7a0', dot: '#4ade80' },
  returned: { label: 'Đã trả khách', bg: 'rgba(148,163,184,.14)', fg: '#a8b3c4', dot: '#94a3b8' },
};
const WARRANTY_STATUS = {
  requested: { label: 'Chờ duyệt', bg: 'rgba(232,181,106,.14)', fg: '#e8b56a', dot: '#e8b56a' },
  accepted: { label: 'Đã chấp nhận', bg: 'rgba(96,165,250,.12)', fg: '#7fb3f5', dot: '#60a5fa' },
  received: { label: 'Đã nhận hàng', bg: 'rgba(45,212,191,.12)', fg: '#5eead4', dot: '#2dd4bf' },
  active: { label: 'Đang hiệu lực', bg: 'rgba(74,222,128,.12)', fg: '#6ee7a0', dot: '#4ade80' },
  expired: { label: 'Hết hạn', bg: 'rgba(148,163,184,.14)', fg: '#a8b3c4', dot: '#94a3b8' },
  rejected: { label: 'Từ chối', bg: 'rgba(248,113,113,.12)', fg: '#f58a8a', dot: '#f87171' },
  void: { label: 'Đã hủy', bg: 'rgba(248,113,113,.12)', fg: '#f58a8a', dot: '#f87171' },
};

/* ---------- Section Đổi trả ---------- */
function ReturnsSection({ highlight }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  // Form đang mở theo từng yêu cầu: { [id]: 'reject' | 'receive' | 'complete' }
  const [formKind, setFormKind] = useState({});
  const [rejectReason, setRejectReason] = useState({});
  const [recvNote, setRecvNote] = useState({});
  const [restockQty, setRestockQty] = useState({}); // { [returnId]: { [itemId]: 'so luong' } }
  const [refundValue, setRefundValue] = useState({});

  const load = () =>
    req(`/api/returns${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.returns || []))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);
  // Được nhảy tới từ thẻ chat: tự mở chi tiết yêu cầu đích
  useEffect(() => {
    if (highlight && highlight.startsWith('return-')) setOpenId(parseInt(highlight.slice(7)) || null);
  }, [highlight]);

  const suggestedRefund = (r) => (r.items || []).reduce((s, i) => s + i.price * i.quantity, 0);

  const openForm = (r, kind) => {
    setOpenId(r.id);
    setFormKind((s) => ({ ...s, [r.id]: kind }));
    if (kind === 'receive' || kind === 'complete') {
      setRestockQty((s) => ({
        ...s,
        [r.id]: Object.fromEntries((r.items || []).map((i) => [i.id, String(i.quantity - (i.restocked_qty || 0))])),
      }));
    }
    if (kind === 'complete') {
      setRefundValue((s) => ({ ...s, [r.id]: String(r.refund_amount || suggestedRefund(r)) }));
    }
  };
  const closeForm = (id) => setFormKind((s) => { const n = { ...s }; delete n[id]; return n; });

  const buildRestock = (r) =>
    (r.items || []).map((i) => ({ id: i.id, qty: parseInt((restockQty[r.id] || {})[i.id]) || 0 }));

  const act = async (r, action, extra = {}) => {
    try {
      await req(`/api/returns/${r.id}`, { method: 'PUT', body: { action, ...extra } });
      closeForm(r.id);
      load();
    } catch (e) { alert(e.message); }
  };

  const doReject = (r) => {
    const reason = (rejectReason[r.id] || '').trim();
    if (!reason) { alert('Vui lòng ghi rõ lý do từ chối — khách hàng sẽ nhận được lý do này.'); return; }
    act(r, 'rejected', { reason });
  };
  const doReceive = (r) => act(r, 'received', { note: (recvNote[r.id] || '').trim(), restock: buildRestock(r) });
  const doComplete = (r) => {
    const body = { refund_amount: parseInt(refundValue[r.id]) || 0 };
    // Chưa qua bước nhận hàng thì nhập kho luôn trong bước hoàn thành
    if (r.status === 'approved') body.restock = buildRestock(r);
    act(r, 'completed', body);
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHead icon="↩️" title="Đổi / trả hàng" count={list.length}
        filter={filter} setFilter={setFilter}
        options={Object.entries(RETURN_STATUS).map(([k, v]) => [k, v.label])} />
      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((r) => {
          const s = RETURN_STATUS[r.status] || RETURN_STATUS.requested;
          const hl = highlight === `return-${r.id}`;
          const open = openId === r.id;
          const kind = formKind[r.id];
          const itemCount = (r.items || []).reduce((n, i) => n + i.quantity, 0);
          return (
            <div key={r.id} id={`as-return-${r.id}`}
              style={{ ...card, borderLeft: `3px solid ${s.dot}`, ...(hl ? { boxShadow: '0 0 0 2px var(--amber), 0 0 24px rgba(232,181,106,.35)' } : {}) }}>
              {/* Hàng tóm tắt — luôn hiện */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.02rem' }}>Yêu cầu #{r.id}</strong>
                  <Pill {...s}>{s.label}</Pill>
                  <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{RETURN_TYPE[r.type] || r.type}</span>
                  <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
                    Đơn <strong style={{ color: '#ffe9c4' }}>#{r.order_id}</strong>
                    {r.customer_name && <span> · {r.customer_name}</span>}
                    {itemCount > 0 && <span> · {itemCount} sản phẩm</span>}
                    {' · '}{r.created_at}
                  </span>
                  {r.refund_amount > 0 && (
                    <span style={{ fontSize: '.9rem' }}>Hoàn: <strong style={{ color: '#6ee7a0' }}>{fmt(r.refund_amount)}</strong></span>
                  )}
                </div>
                <ToggleDetail open={open} onClick={() => setOpenId(open ? null : r.id)} />
              </div>

              {open && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(232,181,106,.14)', paddingTop: 14 }}>
                  <div style={{ fontSize: '.92rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Lý do khách gửi: </span>{r.reason || '—'}
                  </div>
                  <ImagesRow images={r.images} />

                  {/* Danh sách món đổi/trả */}
                  {(r.items || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <FieldLabel>Sản phẩm đổi/trả</FieldLabel>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {r.items.map((i) => (
                          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '.92rem', padding: '7px 10px', border: '1px solid rgba(232,181,106,.14)', borderRadius: 8, flexWrap: 'wrap' }}>
                            <span>
                              {i.product_name}
                              {i.variant_sku && <span style={{ color: 'var(--muted)' }}> · SKU {i.variant_sku}</span>}
                              <span style={{ color: 'var(--muted)' }}> × {i.quantity}</span>
                              {i.restocked_qty > 0 && <span style={{ color: '#5eead4' }}> · đã nhập kho {i.restocked_qty}</span>}
                            </span>
                            <strong style={{ color: '#ffe9c4' }}>{fmt(i.price * i.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.status === 'rejected' && r.reject_reason && (
                    <div style={{ marginTop: 10, fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>Lý do từ chối: </span>
                      <span style={{ color: '#f58a8a' }}>{r.reject_reason}</span>
                    </div>
                  )}
                  {r.received_at && (
                    <div style={{ marginTop: 10, fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>📥 Đã nhận lại hàng: </span>
                      {r.received_note || '—'}
                      <span style={{ color: 'var(--muted)' }}> · {String(r.received_at).slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  )}

                  {/* Hàng nút xử lý theo trạng thái */}
                  <div className="row-actions" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
                    {r.status === 'requested' && !kind && (
                      <>
                        <button className="btn btn-small btn-primary" onClick={() => act(r, 'approved')}>✓ Duyệt</button>
                        <button className="btn btn-small btn-outline" onClick={() => openForm(r, 'reject')}>Từ chối</button>
                      </>
                    )}
                    {r.status === 'approved' && !kind && (
                      <>
                        <button className="btn btn-small btn-outline" onClick={() => openForm(r, 'receive')}>📥 Đã nhận lại hàng</button>
                        <button className="btn btn-small btn-primary" onClick={() => openForm(r, 'complete')}>Hoàn thành</button>
                      </>
                    )}
                    {r.status === 'received' && !kind && (
                      <button className="btn btn-small btn-primary" onClick={() => openForm(r, 'complete')}>Hoàn thành</button>
                    )}
                  </div>

                  {/* Form từ chối */}
                  {kind === 'reject' && (
                    <div style={{ marginTop: 12, maxWidth: 560 }}>
                      <FieldLabel required tip="Bắt buộc ghi rõ. Khách sẽ nhận được lý do này qua chuông thông báo và trong tin nhắn chat.">Lý do từ chối</FieldLabel>
                      <textarea value={rejectReason[r.id] || ''}
                        onChange={(e) => setRejectReason((st) => ({ ...st, [r.id]: e.target.value }))}
                        placeholder="Ví dụ: Sản phẩm đã qua sử dụng, trầy xước nhiều nên shop không nhận lại được…"
                        rows={3} style={{ ...fieldInput, width: '100%' }} />
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <button className="btn btn-small btn-danger" onClick={() => doReject(r)}>Xác nhận từ chối</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(r.id)}>Hủy</button>
                      </div>
                    </div>
                  )}

                  {/* Form nhận hàng: ghi chú + chọn số lượng nhập kho từng món */}
                  {kind === 'receive' && (
                    <div style={{ marginTop: 12, maxWidth: 640 }}>
                      <FieldLabel tip="Ghi tình trạng hàng khi nhận lại (còn nguyên, trầy xước nhẹ…). Khách sẽ thấy ghi chú này trong thông báo.">Ghi chú tình trạng hàng nhận lại</FieldLabel>
                      <input type="text" value={recvNote[r.id] || ''}
                        onChange={(e) => setRecvNote((st) => ({ ...st, [r.id]: e.target.value }))}
                        placeholder="Ví dụ: Hàng còn nguyên vẹn, đủ phụ kiện"
                        style={{ ...fieldInput, width: '100%' }} />
                      <div style={{ marginTop: 12 }}>
                        <FieldLabel tip="Chỉ nhập lại vào kho số lượng còn tốt, bán lại được. Món hư hỏng thì để 0. Gõ trực tiếp số vào ô.">Số lượng nhập kho từng món</FieldLabel>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {(r.items || []).map((i) => {
                            const remain = i.quantity - (i.restocked_qty || 0);
                            return (
                              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.92rem', flexWrap: 'wrap' }}>
                                <span style={{ flex: 1, minWidth: 180 }}>{i.product_name}{i.variant_sku && <span style={{ color: 'var(--muted)' }}> · SKU {i.variant_sku}</span>}</span>
                                <input type="number" min="0" max={remain}
                                  value={(restockQty[r.id] || {})[i.id] ?? String(remain)}
                                  onChange={(e) => setRestockQty((st) => ({ ...st, [r.id]: { ...(st[r.id] || {}), [i.id]: e.target.value } }))}
                                  style={{ ...fieldInput, width: 80 }} aria-label={`Số lượng nhập kho của ${i.product_name}`} />
                                <span style={{ color: 'var(--muted)' }}>/ {remain} món</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="row-actions" style={{ marginTop: 10 }}>
                        <button className="btn btn-small btn-primary" onClick={() => doReceive(r)}>Xác nhận đã nhận hàng</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(r.id)}>Hủy</button>
                      </div>
                    </div>
                  )}

                  {/* Form hoàn thành: tiền hoàn (tự gợi ý) + nhập kho nếu chưa nhận hàng */}
                  {kind === 'complete' && (
                    <div style={{ marginTop: 12, maxWidth: 640 }}>
                      {r.status === 'approved' && (
                        <div style={{ marginBottom: 12 }}>
                          <FieldLabel tip="Yêu cầu này chưa qua bước nhận hàng — chọn luôn số lượng nhập kho tại đây. Chỉ nhập số còn tốt, món hư hỏng để 0.">Số lượng nhập kho từng món</FieldLabel>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {(r.items || []).map((i) => {
                              const remain = i.quantity - (i.restocked_qty || 0);
                              return (
                                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.92rem', flexWrap: 'wrap' }}>
                                  <span style={{ flex: 1, minWidth: 180 }}>{i.product_name}{i.variant_sku && <span style={{ color: 'var(--muted)' }}> · SKU {i.variant_sku}</span>}</span>
                                  <input type="number" min="0" max={remain}
                                    value={(restockQty[r.id] || {})[i.id] ?? String(remain)}
                                    onChange={(e) => setRestockQty((st) => ({ ...st, [r.id]: { ...(st[r.id] || {}), [i.id]: e.target.value } }))}
                                    style={{ ...fieldInput, width: 80 }} aria-label={`Số lượng nhập kho của ${i.product_name}`} />
                                  <span style={{ color: 'var(--muted)' }}>/ {remain} món</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <FieldLabel required tip="Đã tự gợi ý bằng tổng giá trị các món đổi/trả. Gõ trực tiếp số tiền thực hoàn cho khách — số tiền này sẽ bị trừ vào doanh thu. Để 0 nếu là đổi hàng không hoàn tiền.">Số tiền hoàn cho khách (đ)</FieldLabel>
                      <input type="number" min="0" value={refundValue[r.id] || ''}
                        onChange={(e) => setRefundValue((st) => ({ ...st, [r.id]: e.target.value }))}
                        style={{ ...fieldInput, width: 220 }} />
                      <div className="row-actions" style={{ marginTop: 10 }}>
                        <button className="btn btn-small btn-primary" onClick={() => doComplete(r)}>Xác nhận hoàn thành</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(r.id)}>Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <Empty icon="📦" text="Chưa có yêu cầu đổi/trả nào." />}
      </div>
    </section>
  );
}

/* ---------- Section Bảo hành ---------- */
function WarrantiesSection({ highlight }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [orderId, setOrderId] = useState('');
  const [months, setMonths] = useState('1');
  const [openId, setOpenId] = useState(null);
  // Form đang mở theo từng bảo hành: 'reject' | 'receive' | 'activate' | 'extend'
  const [formKind, setFormKind] = useState({});
  const [rejectNote, setRejectNote] = useState({});
  const [recvNote, setRecvNote] = useState({});
  const [actMonths, setActMonths] = useState({});
  const [extendMonths, setExtendMonths] = useState({});

  // Ô nhập trên hàng công cụ: cao 40px, nền tối + viền vàng hổ phách theo tông web
  const toolInput = {
    height: 40, padding: '0 12px', borderRadius: 10, boxSizing: 'border-box',
    background: 'rgba(12,8,5,.6)', border: '1.5px solid rgba(232,181,106,.35)',
    color: 'var(--cream)', font: 'inherit', fontSize: '.95rem',
  };

  const load = () =>
    req(`/api/warranties${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.warranties || []))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    if (highlight && highlight.startsWith('warranty-')) setOpenId(parseInt(highlight.slice(9)) || null);
  }, [highlight]);

  const create = async () => {
    if (!orderId.trim()) { alert('Nhập mã đơn hàng cần tạo bảo hành'); return; }
    if (!parseInt(months)) { alert('Nhập số tháng bảo hành'); return; }
    try {
      await req('/api/warranties', { method: 'POST', body: { order_id: parseInt(orderId), months: parseInt(months) } });
      setOrderId('');
      load();
    } catch (e) { alert(e.message); }
  };

  const openForm = (w, kind) => {
    setOpenId(w.id);
    setFormKind((s) => ({ ...s, [w.id]: kind }));
    if (kind === 'activate') setActMonths((s) => ({ ...s, [w.id]: s[w.id] || '1' }));
    if (kind === 'extend') setExtendMonths((s) => ({ ...s, [w.id]: s[w.id] || '1' }));
  };
  const closeForm = (id) => setFormKind((s) => { const n = { ...s }; delete n[id]; return n; });

  const act = async (w, body) => {
    try {
      await req(`/api/warranties/${w.id}`, { method: 'PUT', body });
      closeForm(w.id);
      load();
    } catch (e) { alert(e.message); }
  };

  const doReject = (w) => {
    const note = (rejectNote[w.id] || '').trim();
    if (!note) { alert('Vui lòng ghi rõ lý do từ chối — khách hàng sẽ nhận được lý do này.'); return; }
    act(w, { action: 'reject', note });
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHead icon="🛡️" title="Bảo hành" count={list.length}
        filter={filter} setFilter={setFilter}
        options={[['requested', 'Chờ duyệt'], ['accepted', 'Đã chấp nhận'], ['received', 'Đã nhận hàng'], ['active', 'Đang hiệu lực'], ['rejected', 'Từ chối'], ['void', 'Đã hủy']]}
        right={(
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <span>
              <FieldLabel required tip="Nhập mã số của đơn hàng cần tạo bảo hành (xem mã trong tab Đơn hàng).">Mã đơn</FieldLabel>
              <input value={orderId} onChange={(e) => setOrderId(e.target.value)}
                placeholder="Ví dụ: 25" type="number"
                style={{ ...toolInput, width: 130, marginBottom: 0 }} aria-label="Mã đơn hàng" />
            </span>
            <span>
              <FieldLabel required tip="Thời hạn bảo hành tính bằng tháng, hiệu lực ngay khi tạo. Chính sách hiện tại của shop là bảo hành 1 tháng.">Số tháng</FieldLabel>
              <input value={months} onChange={(e) => setMonths(e.target.value)}
                type="number" min="1" max="120"
                style={{ ...toolInput, width: 100, marginBottom: 0 }} aria-label="Số tháng bảo hành" />
            </span>
            <button className="btn btn-small btn-primary" onClick={create}
              style={{ height: 40, display: 'inline-flex', alignItems: 'center' }}>+ Tạo bảo hành</button>
          </span>
        )} />
      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((w) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const disp = w.status === 'active' && w.end_date && w.end_date < todayStr ? 'expired' : w.status;
          const s = WARRANTY_STATUS[disp] || WARRANTY_STATUS.active;
          const hl = highlight === `warranty-${w.id}`;
          const open = openId === w.id;
          const kind = formKind[w.id];
          return (
            <div key={w.id} id={`as-warranty-${w.id}`}
              style={{ ...card, borderLeft: `3px solid ${s.dot}`, ...(hl ? { boxShadow: '0 0 0 2px var(--amber), 0 0 24px rgba(232,181,106,.35)' } : {}) }}>
              {/* Hàng tóm tắt — luôn hiện */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.02rem' }}>Bảo hành #{w.id}</strong>
                  <Pill {...s}>{s.label}</Pill>
                  <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
                    Đơn <strong style={{ color: '#ffe9c4' }}>#{w.order_id}</strong>
                    {w.customer_name && <span> · {w.customer_name}</span>}
                    {w.months > 0 && <span> · ⏳ {w.months} tháng ({w.start_date} → {w.end_date})</span>}
                  </span>
                </div>
                <ToggleDetail open={open} onClick={() => setOpenId(open ? null : w.id)} />
              </div>

              {open && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(232,181,106,.14)', paddingTop: 14 }}>
                  {w.reason && (
                    <div style={{ fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>Lý do khách gửi: </span>{w.reason}
                    </div>
                  )}
                  {w.received_at && (
                    <div style={{ marginTop: 8, fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>📥 Đã nhận lại hàng: </span>
                      {w.received_note || '—'}
                      <span style={{ color: 'var(--muted)' }}> · {String(w.received_at).slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  )}
                  <ImagesRow images={w.images} />

                  <div className="row-actions" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
                    {w.status === 'requested' && !kind && (
                      <>
                        <button className="btn btn-small btn-primary" onClick={() => act(w, { action: 'accept' })}>✓ Chấp nhận</button>
                        <button className="btn btn-small btn-outline" onClick={() => openForm(w, 'reject')}>Từ chối</button>
                      </>
                    )}
                    {w.status === 'accepted' && !kind && (
                      <>
                        <button className="btn btn-small btn-outline" onClick={() => openForm(w, 'receive')}>📥 Đã nhận lại hàng</button>
                        <button className="btn btn-small btn-primary" onClick={() => openForm(w, 'activate')}>🛡️ Cấp bảo hành</button>
                        <button className="btn btn-small btn-danger" onClick={() => { if (window.confirm('Hủy bảo hành này? Khách sẽ được thông báo.')) act(w, { action: 'void' }); }}>Hủy BH</button>
                      </>
                    )}
                    {w.status === 'received' && !kind && (
                      <>
                        <button className="btn btn-small btn-primary" onClick={() => openForm(w, 'activate')}>🛡️ Cấp bảo hành</button>
                        <button className="btn btn-small btn-danger" onClick={() => { if (window.confirm('Hủy bảo hành này? Khách sẽ được thông báo.')) act(w, { action: 'void' }); }}>Hủy BH</button>
                      </>
                    )}
                    {(disp === 'active' || disp === 'expired') && !kind && (
                      <>
                        <button className="btn btn-small btn-outline" onClick={() => openForm(w, 'extend')}>Gia hạn</button>
                        <button className="btn btn-small btn-danger" onClick={() => { if (window.confirm('Hủy bảo hành này? Khách sẽ được thông báo.')) act(w, { action: 'void' }); }}>Hủy BH</button>
                      </>
                    )}
                  </div>

                  {kind === 'reject' && (
                    <div style={{ marginTop: 12, maxWidth: 560 }}>
                      <FieldLabel required tip="Bắt buộc ghi rõ. Khách sẽ nhận được lý do này qua chuông thông báo và trong tin nhắn chat.">Lý do từ chối</FieldLabel>
                      <textarea value={rejectNote[w.id] || ''}
                        onChange={(e) => setRejectNote((st) => ({ ...st, [w.id]: e.target.value }))}
                        placeholder="Ví dụ: Hư hỏng do va đập mạnh, không thuộc diện bảo hành…"
                        rows={3} style={{ ...fieldInput, width: '100%' }} />
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <button className="btn btn-small btn-danger" onClick={() => doReject(w)}>Xác nhận từ chối</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(w.id)}>Hủy</button>
                      </div>
                    </div>
                  )}

                  {kind === 'receive' && (
                    <div style={{ marginTop: 12, maxWidth: 560 }}>
                      <FieldLabel tip="Ghi tình trạng hàng khi nhận lại (còn nguyên, hư hỏng thêm ở đâu…). Khách sẽ thấy ghi chú này trong thông báo.">Ghi chú tình trạng hàng nhận lại</FieldLabel>
                      <input type="text" value={recvNote[w.id] || ''}
                        onChange={(e) => setRecvNote((st) => ({ ...st, [w.id]: e.target.value }))}
                        placeholder="Ví dụ: Đã nhận đủ hàng, đang kiểm tra lỗi"
                        style={{ ...fieldInput, width: '100%' }} />
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <button className="btn btn-small btn-primary"
                          onClick={() => act(w, { action: 'received', note: (recvNote[w.id] || '').trim() })}>Xác nhận đã nhận hàng</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(w.id)}>Hủy</button>
                      </div>
                    </div>
                  )}

                  {kind === 'activate' && (
                    <div style={{ marginTop: 12, maxWidth: 420 }}>
                      <FieldLabel required tip="Thời hạn bảo hành tính bằng tháng, bắt đầu từ hôm nay. Chính sách hiện tại của shop là bảo hành 1 tháng. Cấp xong khách sẽ nhận thông báo qua chuông và chat.">Số tháng bảo hành</FieldLabel>
                      <input type="number" min="1" max="120" value={actMonths[w.id] || ''}
                        onChange={(e) => setActMonths((st) => ({ ...st, [w.id]: e.target.value }))}
                        style={{ ...fieldInput, width: 140 }} />
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <button className="btn btn-small btn-primary"
                          onClick={() => act(w, { action: 'activate', months: parseInt(actMonths[w.id]) })}>Cấp & thông báo khách</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(w.id)}>Hủy</button>
                      </div>
                    </div>
                  )}

                  {kind === 'extend' && (
                    <div style={{ marginTop: 12, maxWidth: 420 }}>
                      <FieldLabel required tip="Số tháng cộng thêm vào hạn bảo hành hiện tại (nếu đã hết hạn thì tính từ hôm nay).">Số tháng gia hạn</FieldLabel>
                      <input type="number" min="1" max="120" value={extendMonths[w.id] || ''}
                        onChange={(e) => setExtendMonths((st) => ({ ...st, [w.id]: e.target.value }))}
                        style={{ ...fieldInput, width: 140 }} />
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <button className="btn btn-small btn-primary"
                          onClick={() => act(w, { action: 'extend', months: parseInt(extendMonths[w.id]) })}>Xác nhận gia hạn</button>
                        <button className="btn btn-small btn-outline" onClick={() => closeForm(w.id)}>Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <Empty icon="🛡️" text="Chưa có bảo hành nào." />}
      </div>
    </section>
  );
}

/* ---------- Section Sửa chữa ---------- */
function RepairsSection() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState({});

  const load = () =>
    req(`/api/repairs${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.repairs || []))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const startEdit = (r) => setEditing((s) => ({ ...s, [r.id]: { status: r.status, fee: String(r.fee || 0) } }));
  const cancelEdit = (id) => setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
  const save = async (id) => {
    const e = editing[id];
    try {
      await req(`/api/repairs/${id}`, { method: 'PUT', body: { status: e.status, fee: parseInt(e.fee) || 0 } });
      cancelEdit(id);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <section style={{ marginBottom: 8 }}>
      <SectionHead icon="🔧" title="Sửa chữa / bảo dưỡng" count={list.length}
        filter={filter} setFilter={setFilter}
        options={Object.entries(REPAIR_STATUS).map(([k, v]) => [k, v.label])} />
      <div style={{ display: 'grid', gap: 12 }}>
        {list.map((r) => {
          const s = REPAIR_STATUS[r.status] || REPAIR_STATUS.received;
          const e = editing[r.id];
          return (
            <div key={r.id} style={{ ...card, borderLeft: `3px solid ${s.dot}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1.02rem' }}>Phiếu #{r.id}</strong>
                    <Pill {...s}>{s.label}</Pill>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.9rem', color: 'var(--muted)' }}>
                    {r.order_id ? <>Đơn <strong style={{ color: '#ffe9c4' }}>#{r.order_id}</strong>{r.customer_name && <span> · {r.customer_name}</span>} · </> : null}
                    {r.created_at}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.92rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Mô tả: </span>{r.description || '—'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: '.92rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Phí: </span>
                    <strong style={{ color: '#ffe9c4' }}>{r.fee > 0 ? fmt(r.fee) : 'Miễn phí'}</strong>
                  </div>
                </div>
                {!e && (
                  <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn btn-small btn-outline" onClick={() => startEdit(r)}>Cập nhật</button>
                  </div>
                )}
              </div>
              {e && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
                  <span>
                    <FieldLabel>Trạng thái sửa chữa</FieldLabel>
                    <select value={e.status}
                      onChange={(ev) => setEditing((s2) => ({ ...s2, [r.id]: { ...s2[r.id], status: ev.target.value } }))}
                      style={{ ...fieldInput, marginBottom: 0 }} aria-label="Trạng thái sửa chữa">
                      {Object.entries(REPAIR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </span>
                  <span>
                    <FieldLabel tip="Phí sửa chữa tính bằng đồng, gõ trực tiếp số tiền. Để 0 nếu sửa miễn phí.">Phí sửa chữa (đ)</FieldLabel>
                    <input type="number" min="0" value={e.fee}
                      onChange={(ev) => setEditing((s2) => ({ ...s2, [r.id]: { ...s2[r.id], fee: ev.target.value } }))}
                      placeholder="Ví dụ: 150000" aria-label="Phí sửa chữa"
                      style={{ ...fieldInput, width: 150, marginBottom: 0 }} />
                  </span>
                  <span className="row-actions">
                    <button className="btn btn-small btn-primary" onClick={() => save(r.id)}>Lưu</button>
                    <button className="btn btn-small btn-outline" onClick={() => cancelEdit(r.id)}>Hủy</button>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <Empty icon="🔧" text="Chưa có phiếu sửa chữa nào." />}
      </div>
    </section>
  );
}

export default function AftersalesTab() {
  // Đơn đích khi nhân viên bấm "Mở đơn hậu mãi" từ thẻ trong chat: cuộn tới + viền sáng
  const [highlight, setHighlight] = useState('');
  useEffect(() => {
    let target = null;
    try {
      target = JSON.parse(sessionStorage.getItem('bi99_open_aftersales') || 'null');
      sessionStorage.removeItem('bi99_open_aftersales');
    } catch (e) { /* bỏ qua */ }
    if (!target || !target.refId) return undefined;
    const key = `${target.refType}-${target.refId}`;
    setHighlight(key);
    let tries = 0;
    const iv = setInterval(() => {
      const el = document.getElementById(`as-${key}`);
      tries += 1;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clearInterval(iv);
      } else if (tries > 12) {
        clearInterval(iv);
      }
    }, 250);
    const to = setTimeout(() => setHighlight(''), 6000);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, []);

  return (
    <div>
      <ReturnsSection highlight={highlight} />
      <WarrantiesSection highlight={highlight} />
      <RepairsSection />
    </div>
  );
}
