// Tab "Săn thẻ" — CHỈ ADMIN: tạo/phát hành sự kiện săn thẻ ở trang Khuyến mãi.
// - Mỗi sự kiện gồm nhiều LOẠI thẻ (nhãn, % giảm tối đa 20%, hạn dùng tối đa 7 ngày
//   kể từ giờ mở săn, số lượng giới hạn). Khách săn trong khung giờ đã đặt:
//   mỗi khách tối đa 1 thẻ/loại, hết số lượng thì loại đó khóa "Đã hết thẻ".
// - Phát hành xong, MỌI khách hàng nhận thông báo qua chuông kèm link trang Khuyến mãi.
import { useEffect, useState } from 'react';
import DateTimeField from '../../components/DateTimeField';

async function req(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Lỗi ${r.status}`);
  return d;
}

// Nhãn ô nhập kèm dấu * đỏ (rê chuột hiện chú thích) — cùng chuẩn với tab Bảo hành.
function FieldLabel({ children, required, tip }) {
  return (
    <label style={{ display: 'block', fontSize: '.85rem', fontWeight: 600, color: '#ffe9c4', marginBottom: 6 }}>
      {children}
      {required && <> <span className="tip-star" data-tip={tip || 'Ô bắt buộc phải nhập'}>*</span></>}
    </label>
  );
}

const inputStyle = {
  width: '100%', height: 40, padding: '0 10px', borderRadius: 8,
  border: '1px solid rgba(232,181,106,.35)', background: 'rgba(0,0,0,.25)', color: '#f5eedd',
};

const PHASE_LABEL = {
  live: ['🔥 Đang mở săn', '#8fe3a0'],
  upcoming: ['⏳ Sắp mở', '#f2c57c'],
  ended: ['⌛ Đã kết thúc', '#b9b0a0'],
  closed: ['🔒 Đã đóng', '#ff9d8a'],
};

const fmtWhen = (s) => {
  const str = String(s || '');
  return str.length >= 16 ? `${str.slice(11, 16)} ${str.slice(8, 10)}/${str.slice(5, 7)}/${str.slice(0, 4)}` : str;
};

let rowSeq = 0;
const newRow = (label = '', percent = 10, valid_days = 3, quantity = 10) =>
  ({ _k: ++rowSeq, label, percent, valid_days, quantity });

export default function HuntEventsTab() {
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [mode, setMode] = useState('manual');
  const [rows, setRows] = useState([newRow('May mắn', 10, 3, 10)]);
  const [randCount, setRandCount] = useState(10);
  const [preview, setPreview] = useState(null); // bộ thẻ random đã sinh thử -> sẽ phát hành đúng bộ này

  const load = () => req('/api/hunt-events/admin').then((d) => setEvents(d.events || [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const setRow = (k, field, value) =>
    setRows((rs) => rs.map((r) => (r._k === k ? { ...r, [field]: value } : r)));

  const genPreview = async () => {
    setErr(''); setMsg('');
    try {
      const d = await req('/api/hunt-events/admin/random-preview', {
        method: 'POST',
        body: { count: Number(randCount) || 10 },
      });
      setPreview(d.types || []);
    } catch (e) { setErr(e.message); }
  };

  const create = async () => {
    setErr(''); setMsg('');
    if (!name.trim()) return setErr('Nhập tên sự kiện');
    if (!startsAt || !endsAt) return setErr('Chọn giờ mở săn và giờ kết thúc');
    let payload;
    if (mode === 'random') {
      // Đã sinh thử -> phát hành đúng bộ thẻ đã xem; chưa sinh -> để hệ thống tự random
      payload = preview
        ? { name, starts_at: startsAt, ends_at: endsAt, mode: 'manual', types: preview }
        : { name, starts_at: startsAt, ends_at: endsAt, mode: 'random', type_count: Number(randCount) || 10 };
    } else {
      payload = {
        name, starts_at: startsAt, ends_at: endsAt, mode: 'manual',
        types: rows.map((r) => ({
          label: r.label || 'Thẻ săn sale',
          percent: Number(r.percent), valid_days: Number(r.valid_days), quantity: Number(r.quantity),
        })),
      };
    }
    setBusy(true);
    try {
      await req('/api/hunt-events/admin', { method: 'POST', body: payload });
      setMsg(`✅ Đã phát hành sự kiện "${name}" — mọi khách hàng đã nhận thông báo qua chuông kèm link trang Khuyến mãi.`);
      setName(''); setStartsAt(''); setEndsAt(''); setPreview(null);
      setRows([newRow('May mắn', 10, 3, 10)]);
      load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const toggleStatus = async (ev) => {
    setErr('');
    try {
      await req(`/api/hunt-events/admin/${ev.id}`, {
        method: 'PUT',
        body: { status: ev.status === 'active' ? 'closed' : 'active' },
      });
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Xóa sự kiện "${ev.name}"? Chỉ xóa được khi chưa có khách nào lưu thẻ.`)) return;
    setErr('');
    try {
      await req(`/api/hunt-events/admin/${ev.id}`, { method: 'DELETE' });
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <h3 style={{ color: '#ffe9c4', marginTop: 0 }}>🎯 Sự kiện săn thẻ (chỉ Admin)</h3>
      <p className="muted" style={{ maxWidth: 760 }}>
        Khách vào trang Khuyến mãi trong khung giờ bạn đặt để lưu thẻ giảm giá về tài khoản.
        Mỗi khách tối đa 1 thẻ mỗi loại; hết số lượng thì loại đó tự khóa. Phát hành xong,
        mọi khách hàng đều nhận được thông báo qua chuông kèm link tới trang Khuyến mãi.
      </p>

      {msg && <div className="form-success" style={{ marginBottom: 12 }}>{msg}</div>}
      {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ border: '1px solid rgba(232,181,106,.3)', borderRadius: 12, padding: 18, marginBottom: 24 }}>
        <h4 style={{ color: '#ffe9c4', margin: '0 0 14px' }}>Phát hành sự kiện mới</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          <div>
            <FieldLabel required tip="Tên hiện ở trang Khuyến mãi và trong thông báo gửi khách. Ví dụ: Săn thẻ giờ vàng 19h.">Tên sự kiện</FieldLabel>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Săn thẻ giờ vàng" />
          </div>
          <div>
            <FieldLabel required tip="Đúng giờ này sự kiện tự mở cho khách vào săn. Đặt trước trong tương lai để khách đếm ngược chờ.">Giờ mở săn</FieldLabel>
            <DateTimeField id="hunt-start" value={startsAt} onChange={setStartsAt} />
          </div>
          <div>
            <FieldLabel required tip="Qua giờ này khách không lưu thẻ được nữa. Ví dụ mở săn trong 2 tiếng thì đặt kết thúc sau giờ mở 2 tiếng.">Giờ kết thúc</FieldLabel>
            <DateTimeField id="hunt-end" value={endsAt} onChange={setEndsAt} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, margin: '16px 0 6px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="hunt-mode" checked={mode === 'manual'} onChange={() => setMode('manual')} />
            ✍️ Tự set từng loại thẻ
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="hunt-mode" checked={mode === 'random'} onChange={() => setMode('random')} />
            🎲 Random — hệ thống tự sinh thẻ
          </label>
        </div>

        {mode === 'manual' && (
          <div>
            {rows.map((r) => (
              <div key={r._k} className="hunt-type-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr .7fr .9fr .8fr auto', gap: 10, marginTop: 10, alignItems: 'end' }}>
                <div>
                  <FieldLabel tip="Tên gọi của loại thẻ, hiện cho khách thấy. Ví dụ: Cực hiếm, Hiếm, May mắn...">Nhãn loại thẻ</FieldLabel>
                  <input style={inputStyle} value={r.label} onChange={(e) => setRow(r._k, 'label', e.target.value)} placeholder="VD: Cực hiếm" />
                </div>
                <div>
                  <FieldLabel required tip="Phần trăm giảm cho 1 sản phẩm (món đắt nhất trong đơn). Tối đa 20%.">% giảm</FieldLabel>
                  <input style={inputStyle} type="number" min="1" max="20" value={r.percent} onChange={(e) => setRow(r._k, 'percent', e.target.value)} />
                </div>
                <div>
                  <FieldLabel required tip="Thẻ dùng được bao nhiêu ngày kể từ giờ mở săn. Tối đa 7 ngày.">Hạn dùng (ngày)</FieldLabel>
                  <input style={inputStyle} type="number" min="1" max="7" value={r.valid_days} onChange={(e) => setRow(r._k, 'valid_days', e.target.value)} />
                </div>
                <div>
                  <FieldLabel required tip="Tổng số thẻ của loại này được phát ra. Đủ số người lưu thì loại này chuyển 'Đã hết thẻ'.">Số lượng thẻ</FieldLabel>
                  <input style={inputStyle} type="number" min="1" value={r.quantity} onChange={(e) => setRow(r._k, 'quantity', e.target.value)} />
                </div>
                <button className="btn btn-small" disabled={rows.length <= 1} onClick={() => setRows((rs) => rs.filter((x) => x._k !== r._k))}>✕</button>
              </div>
            ))}
            <button className="btn btn-small" style={{ marginTop: 12 }} onClick={() => setRows((rs) => [...rs, newRow()])}>+ Thêm loại thẻ</button>
          </div>
        )}

        {mode === 'random' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, maxWidth: 560 }}>
              <div>
                <FieldLabel required tip="Hệ thống sinh ngần này loại thẻ khác nhau. Loại đầu hiếm nhất (giảm 20%, hạn ngắn), càng về sau càng thường.">Số loại thẻ</FieldLabel>
                <input style={inputStyle} type="number" min="1" max="20" value={randCount} onChange={(e) => { setRandCount(e.target.value); setPreview(null); }} />
              </div>
            </div>
            <p className="muted" style={{ margin: '10px 0 0', fontSize: '.9rem' }}>Số thẻ của mỗi loại cũng được sinh ngẫu nhiên: thẻ càng hiếm càng ít thẻ, tối đa 10 thẻ/loại. Bấm Sinh thử để xem trước cả bộ.</p>
            <button className="btn btn-small" style={{ marginTop: 12 }} onClick={genPreview}>🎲 Sinh thử bộ thẻ</button>
            {preview && (
              <div style={{ marginTop: 10, fontSize: '.92rem' }}>
                <p className="muted" style={{ margin: '0 0 6px' }}>Bộ thẻ sẽ phát hành (bấm Sinh thử lần nữa để đổi bộ khác):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {preview.map((tp, i) => (
                    <span key={i} style={{ border: '1px solid rgba(232,181,106,.4)', borderRadius: 999, padding: '3px 12px' }}>
                      {tp.label}: −{tp.percent}% · {tp.valid_days} ngày · {tp.quantity} thẻ
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy} onClick={create}>
          {busy ? 'Đang phát hành...' : '🚀 Phát hành sự kiện'}
        </button>
      </div>

      <h4 style={{ color: '#ffe9c4' }}>Sự kiện đã phát hành</h4>
      {events.length === 0 && <p className="muted">Chưa có sự kiện săn thẻ nào.</p>}
      {events.map((ev) => {
        const [txt, color] = PHASE_LABEL[ev.phase] || PHASE_LABEL.ended;
        const totalClaimed = ev.types.reduce((n, x) => n + x.claimed, 0);
        const totalQty = ev.types.reduce((n, x) => n + x.quantity, 0);
        return (
          <div key={ev.id} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ color: '#f5eedd' }}>{ev.name}</b>
              <span style={{ color, fontWeight: 700, fontSize: '.85rem' }}>{txt}</span>
              <span className="muted" style={{ fontSize: '.88rem' }}>
                {fmtWhen(ev.starts_at)} → {fmtWhen(ev.ends_at)} · Đã săn {totalClaimed}/{totalQty} thẻ
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-small" onClick={() => toggleStatus(ev)}>
                  {ev.status === 'active' ? '🔒 Đóng' : '🔓 Mở lại'}
                </button>
                <button className="btn btn-small" onClick={() => remove(ev)}>Xóa</button>
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {ev.types.map((tp) => (
                <span key={tp.id} style={{ border: '1px solid rgba(255,255,255,.15)', borderRadius: 999, padding: '3px 12px', fontSize: '.88rem' }}>
                  {tp.label}: −{tp.percent}% · hạn {tp.valid_days} ngày · còn {tp.remaining}/{tp.quantity}
                  {tp.remaining <= 0 ? ' · ĐÃ HẾT' : ''}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
