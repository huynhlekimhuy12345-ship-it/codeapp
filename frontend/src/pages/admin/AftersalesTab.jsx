// Tab Hậu mãi (admin): Đổi trả / Bảo hành / Sửa chữa
// Thiết kế: section header có icon + thẻ card với viền accent theo trạng thái
import { useEffect, useState } from 'react';

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
  active: { label: 'Đang hiệu lực', bg: 'rgba(74,222,128,.12)', fg: '#6ee7a0', dot: '#4ade80' },
  expired: { label: 'Hết hạn', bg: 'rgba(148,163,184,.14)', fg: '#a8b3c4', dot: '#94a3b8' },
  void: { label: 'Đã hủy', bg: 'rgba(248,113,113,.12)', fg: '#f58a8a', dot: '#f87171' },
};

/* ---------- Section Đổi trả ---------- */
function ReturnsSection() {
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
          return (
            <div key={r.id} style={{ ...card, borderLeft: `3px solid ${s.dot}` }}>
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
function WarrantiesSection() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [orderId, setOrderId] = useState('');
  const [months, setMonths] = useState('12');
  const [extendId, setExtendId] = useState(null);
  const [extendMonths, setExtendMonths] = useState('12');

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

  const act = async (id, action, m) => {
    try {
      await req(`/api/warranties/${id}`, { method: 'PUT', body: { action, months: m } });
      setExtendId(null);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHead icon="🛡️" title="Bảo hành" count={list.length}
        filter={filter} setFilter={setFilter}
        options={[['active', 'Đang hiệu lực'], ['expired', 'Hết hạn'], ['void', 'Đã hủy']]}
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
          const s = WARRANTY_STATUS[w.status] || WARRANTY_STATUS.active;
          return (
            <div key={w.id} style={{ ...card, borderLeft: `3px solid ${s.dot}` }}>
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
                  <div style={{ marginTop: 6, fontSize: '.92rem' }}>
                    ⏳ <strong>{w.months} tháng</strong>
                    <span style={{ color: 'var(--muted)' }}> · {w.start_date} → {w.end_date}</span>
                  </div>
                </div>
                {w.status !== 'void' && (
                  <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
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
                          onClick={() => act(w.id, 'extend', parseInt(extendMonths))}>Xác nhận</button>
                        <button className="btn btn-small btn-outline" onClick={() => setExtendId(null)}>Hủy</button>
                      </span>
                    )}
                    <button className="btn btn-small btn-danger" onClick={() => act(w.id, 'void')}>Hủy BH</button>
                  </div>
                )}
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
  return (
    <div>
      <ReturnsSection />
      <WarrantiesSection />
      <RepairsSection />
    </div>
  );
}
