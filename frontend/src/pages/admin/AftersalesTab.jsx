// Tab Hậu mãi (admin): Đổi trả / Bảo hành / Sửa chữa
// Thiết kế: section header có icon + thẻ card với viền accent theo trạng thái
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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

const RETURN_STATUS = {
  requested: { label: 'Chờ duyệt', bg: 'rgba(232,181,106,.14)', fg: '#e8b56a', dot: '#e8b56a' },
  approved: { label: 'Đã duyệt', bg: 'rgba(96,165,250,.12)', fg: '#7fb3f5', dot: '#60a5fa' },
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
  const [refundFor, setRefundFor] = useState(null);
  const [refundValue, setRefundValue] = useState('0');

  const load = () =>
    req(`/api/returns${filter ? '?status=' + filter : ''}`)
      .then((d) => setList(d.returns || []))
      .catch(() => {});
  useEffect(() => { load(); }, [filter]);

  const act = async (id, action, refund_amount) => {
    try {
      await req(`/api/returns/${id}`, { method: 'PUT', body: { action, refund_amount } });
      setRefundFor(null);
      load();
    } catch (e) { alert(e.message); }
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
          return (
            <div key={r.id} id={`as-return-${r.id}`}
              style={{ ...card, borderLeft: `3px solid ${s.dot}`, ...(hl ? { boxShadow: '0 0 0 2px var(--amber), 0 0 24px rgba(232,181,106,.35)' } : {}) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1.02rem' }}>Yêu cầu #{r.id}</strong>
                    <Pill {...s}>{s.label}</Pill>
                    <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>{RETURN_TYPE[r.type] || r.type}</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.9rem', color: 'var(--muted)' }}>
                    Đơn <strong style={{ color: '#ffe9c4' }}>#{r.order_id}</strong>
                    {r.customer_name && <span> · {r.customer_name}</span>}
                    {' · '}{r.created_at}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.92rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Lý do: </span>{r.reason || '—'}
                  </div>
                  <ImagesRow images={r.images} />
                  {r.refund_amount > 0 && (
                    <div style={{ marginTop: 4, fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>Hoàn tiền: </span>
                      <strong style={{ color: '#6ee7a0' }}>{fmt(r.refund_amount)}</strong>
                    </div>
                  )}
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                  {r.status === 'requested' && (
                    <>
                      <button className="btn btn-small btn-primary" onClick={() => act(r.id, 'approved')}>✓ Duyệt</button>
                      <button className="btn btn-small btn-outline" onClick={() => act(r.id, 'rejected')}>Từ chối</button>
                    </>
                  )}
                  {r.status === 'approved' && refundFor !== r.id && (
                    <button className="btn btn-small btn-primary"
                      onClick={() => { setRefundFor(r.id); setRefundValue(String(r.refund_amount || 0)); }}>
                      Hoàn thành
                    </button>
                  )}
                  {r.status === 'approved' && refundFor === r.id && (
                    <span className="inline-form">
                      <input type="number" min="0" value={refundValue}
                        onChange={(e) => setRefundValue(e.target.value)}
                        placeholder="Số tiền hoàn (đ)"
                        style={{ width: 150, padding: '8px 12px', borderRadius: 8 }} />
                      <button className="btn btn-small btn-primary"
                        onClick={() => act(r.id, 'completed', parseInt(refundValue) || 0)}>Xác nhận</button>
                      <button className="btn btn-small btn-outline" onClick={() => setRefundFor(null)}>Hủy</button>
                    </span>
                  )}
                </div>
              </div>
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
  const [months, setMonths] = useState('12');
  const [extendId, setExtendId] = useState(null);
  const [extendMonths, setExtendMonths] = useState('12');
  const [recvId, setRecvId] = useState(null);
  const [recvNote, setRecvNote] = useState('');
  const [actId, setActId] = useState(null);
  const [actMonths, setActMonths] = useState('12');

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

  const create = async () => {
    if (!orderId.trim()) { alert('Nhập mã đơn hàng'); return; }
    try {
      await req('/api/warranties', { method: 'POST', body: { order_id: parseInt(orderId), months: parseInt(months) } });
      setOrderId('');
      load();
    } catch (e) { alert(e.message); }
  };

  const act = async (id, body) => {
    try {
      await req(`/api/warranties/${id}`, { method: 'PUT', body });
      setExtendId(null);
      setRecvId(null);
      setActId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHead icon="🛡️" title="Bảo hành" count={list.length}
        filter={filter} setFilter={setFilter}
        options={[['requested', 'Chờ duyệt'], ['accepted', 'Đã chấp nhận'], ['received', 'Đã nhận hàng'], ['active', 'Đang hiệu lực'], ['rejected', 'Từ chối'], ['void', 'Đã hủy']]}
        right={(
          <span className="inline-form" style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)}
              placeholder="Mã đơn" type="number"
              style={{ ...toolInput, width: 130 }} aria-label="Mã đơn hàng" />
            <input value={months} onChange={(e) => setMonths(e.target.value)}
              placeholder="Số tháng" type="number" min="1" max="120"
              style={{ ...toolInput, width: 100 }} aria-label="Số tháng bảo hành" />
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
          return (
            <div key={w.id} id={`as-warranty-${w.id}`}
              style={{ ...card, borderLeft: `3px solid ${s.dot}`, ...(hl ? { boxShadow: '0 0 0 2px var(--amber), 0 0 24px rgba(232,181,106,.35)' } : {}) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1.02rem' }}>Bảo hành #{w.id}</strong>
                    <Pill {...s}>{s.label}</Pill>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.9rem', color: 'var(--muted)' }}>
                    Đơn <strong style={{ color: '#ffe9c4' }}>#{w.order_id}</strong>
                    {w.customer_name && <span> · {w.customer_name}</span>}
                  </div>
                  {w.months > 0 && (
                    <div style={{ marginTop: 6, fontSize: '.92rem' }}>
                      ⏳ <strong>{w.months} tháng</strong>
                      <span style={{ color: 'var(--muted)' }}> · {w.start_date} → {w.end_date}</span>
                    </div>
                  )}
                  {w.reason && (
                    <div style={{ marginTop: 8, fontSize: '.92rem' }}>
                      <span style={{ color: 'var(--muted)' }}>Lý do: </span>{w.reason}
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
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                  {w.status === 'requested' && (
                    <>
                      <button className="btn btn-small btn-primary" onClick={() => act(w.id, { action: 'accept' })}>✓ Chấp nhận</button>
                      <button className="btn btn-small btn-outline" onClick={() => act(w.id, { action: 'reject' })}>Từ chối</button>
                    </>
                  )}
                  {w.status === 'accepted' && recvId !== w.id && actId !== w.id && (
                    <>
                      <button className="btn btn-small btn-outline"
                        onClick={() => { setRecvId(w.id); setRecvNote(''); }}>📥 Đã nhận lại hàng</button>
                      <button className="btn btn-small btn-primary"
                        onClick={() => { setActId(w.id); setActMonths('12'); }}>🛡️ Cấp bảo hành</button>
                    </>
                  )}
                  {w.status === 'received' && actId !== w.id && (
                    <button className="btn btn-small btn-primary"
                      onClick={() => { setActId(w.id); setActMonths('12'); }}>🛡️ Cấp bảo hành</button>
                  )}
                  {recvId === w.id && (
                    <span className="inline-form">
                      <input type="text" value={recvNote}
                        onChange={(e) => setRecvNote(e.target.value)}
                        placeholder="Ghi chú tình trạng hàng nhận lại"
                        style={{ width: 230, padding: '8px 12px', borderRadius: 8 }} aria-label="Ghi chú hàng nhận lại" />
                      <button className="btn btn-small btn-primary"
                        onClick={() => act(w.id, { action: 'received', note: recvNote })}>Xác nhận</button>
                      <button className="btn btn-small btn-outline" onClick={() => setRecvId(null)}>Hủy</button>
                    </span>
                  )}
                  {actId === w.id && (
                    <span className="inline-form">
                      <input type="number" min="1" max="120" value={actMonths}
                        onChange={(e) => setActMonths(e.target.value)}
                        placeholder="Số tháng"
                        style={{ width: 90, padding: '8px 12px', borderRadius: 8 }} aria-label="Số tháng bảo hành" />
                      <button className="btn btn-small btn-primary"
                        onClick={() => act(w.id, { action: 'activate', months: parseInt(actMonths) })}>Cấp & thông báo khách</button>
                      <button className="btn btn-small btn-outline" onClick={() => setActId(null)}>Hủy</button>
                    </span>
                  )}
                  {(disp === 'active' || disp === 'expired') && (
                    <>
                      {extendId !== w.id && (
                        <button className="btn btn-small btn-outline"
                          onClick={() => { setExtendId(w.id); setExtendMonths('12'); }}>Gia hạn</button>
                      )}
                      {extendId === w.id && (
                        <span className="inline-form">
                          <input type="number" min="1" max="120" value={extendMonths}
                            onChange={(e) => setExtendMonths(e.target.value)}
                            style={{ width: 80, padding: '8px 12px', borderRadius: 8 }} aria-label="Số tháng gia hạn" />
                          <button className="btn btn-small btn-primary"
                            onClick={() => act(w.id, { action: 'extend', months: parseInt(extendMonths) })}>Xác nhận</button>
                          <button className="btn btn-small btn-outline" onClick={() => setExtendId(null)}>Hủy</button>
                        </span>
                      )}
                      <button className="btn btn-small btn-danger" onClick={() => act(w.id, { action: 'void' })}>Hủy BH</button>
                    </>
                  )}
                  {(w.status === 'accepted' || w.status === 'received') && recvId !== w.id && actId !== w.id && (
                    <button className="btn btn-small btn-danger" onClick={() => act(w.id, { action: 'void' })}>Hủy BH</button>
                  )}
                </div>
              </div>
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
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <select value={e.status}
                    onChange={(ev) => setEditing((s2) => ({ ...s2, [r.id]: { ...s2[r.id], status: ev.target.value } }))}
                    style={{ padding: '8px 12px', borderRadius: 8 }} aria-label="Trạng thái sửa chữa">
                    {Object.entries(REPAIR_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input type="number" min="0" value={e.fee}
                    onChange={(ev) => setEditing((s2) => ({ ...s2, [r.id]: { ...s2[r.id], fee: ev.target.value } }))}
                    placeholder="Phí (đ)" aria-label="Phí sửa chữa"
                    style={{ width: 130, padding: '8px 12px', borderRadius: 8 }} />
                  <button className="btn btn-small btn-primary" onClick={() => save(r.id)}>Lưu</button>
                  <button className="btn btn-small btn-outline" onClick={() => cancelEdit(r.id)}>Hủy</button>
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
