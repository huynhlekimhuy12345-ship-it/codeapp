// Khung hiển thị tin nhắn dùng chung cho 2 tab chat trong quản trị.
import { useEffect, useRef, useState } from 'react';
import { detectLang, translateToVietnamese } from '../../i18n/autoTranslate';

// Tin cần dịch: không phải tiếng Việt (bỏ qua câu tiếng Anh quá ngắn kiểu "hi", "ok")
function needsTranslation(text) {
  const lang = detectLang(text);
  if (lang === 'vi') return false;
  if (lang === 'en' && String(text || '').trim().length <= 3) return false;
  return true;
}

// Chữ "Dịch" dưới tin nhắn nước ngoài — chỉ phía nhân viên (admin/sale).
// Bấm vào mới dịch và hiện bản dịch tiếng Việt bên dưới; bấm lần nữa thì ẩn đi.
// Bản dịch được lưu đệm trong trình duyệt nên mở lại cùng một tin là có ngay.
function TranslatedLine({ text }) {
  const [vi, setVi] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    if (vi) { setOpen(true); return; }
    setLoading(true);
    try {
      const out = await translateToVietnamese(text);
      if (out && out !== text) { setVi(out); setOpen(true); }
    } catch { /* dịch lỗi thì giữ nguyên, không hiện gì */ }
    setLoading(false);
  };

  return (
    <>
      <button type="button" className="chat-translate-btn" onClick={toggle}>
        🌐 {loading ? 'Đang dịch…' : open ? 'Ẩn bản dịch' : 'Dịch'}
      </button>
      {open && vi && <div className="chat-translated">{vi}</div>}
    </>
  );
}

export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T') + (ts.includes('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('vi-VN');
}

export function MessageList({ messages, meId }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);
  return (
    <div className="chat-msgs" ref={ref}>
      {messages.length === 0 && <p className="chat-empty">Chưa có tin nhắn nào.</p>}
      {messages.map((m) => (
        <div key={m.id} className={`chat-msg ${m.sender_id === meId ? 'mine' : 'theirs'}`}>
          {m.sender_id !== meId && (
            <div className="chat-sender">
              {m.sender_role === 'admin' ? 'Admin ' : m.sender_role === 'sale' ? 'Sale ' : ''}{m.sender_name || '—'}
            </div>
          )}
          <div className="chat-bubble">{m.content}</div>
          {m.sender_id !== meId && needsTranslation(m.content) && <TranslatedLine text={m.content} />}
          <div className="chat-time">{fmtTime(m.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

export function Composer({ onSend, disabled, placeholder }) {
  const [text, setText] = useState('');
  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    await onSend(v);
  };
  return (
    <div className="chat-composer">
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || 'Nhập tin nhắn...'}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
      />
      <button className="btn btn-primary" disabled={disabled || !text.trim()} onClick={send}>Gửi</button>
    </div>
  );
}
