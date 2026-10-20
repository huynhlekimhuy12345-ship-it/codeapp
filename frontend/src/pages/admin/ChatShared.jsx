// Khung hiển thị tin nhắn dùng chung cho 2 tab chat trong quản trị.
import { useEffect, useRef, useState } from 'react';

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
