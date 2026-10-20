// Ô chat của khách hàng (chỉ khách đã đăng nhập): gửi yêu cầu -> chờ nhân viên tiếp nhận
// (ô chat khóa) -> Sale/Admin chấp nhận thì mở chat 2 chiều + khách được báo qua chuông.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import './CustomerChat.css';

const staffLabel = (p) => `${p.role === 'admin' ? 'Admin' : 'Sale'} ${p.name}`;

export default function CustomerChat() {
  const { user } = useStore();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState(undefined); // undefined = đang tải, null = chưa có
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const isCustomer = user && user.role === 'customer';

  const load = useCallback(() => {
    if (!isCustomer) return;
    api.chatMy().then((d) => setConv(d.conversation)).catch(() => {});
  }, [isCustomer]);

  useEffect(() => { load(); }, [load]);
  // Tự làm mới mỗi 4 giây để bắt kịp lúc nhân viên chấp nhận / nhắn lại
  useEffect(() => {
    if (!isCustomer) return undefined;
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [isCustomer, load]);

  // Chuông thông báo bấm vào -> mở ô chat
  useEffect(() => {
    const fn = () => setOpen(true);
    window.addEventListener('bi99:open-chat', fn);
    return () => window.removeEventListener('bi99:open-chat', fn);
  }, []);

  // Mở panel khi đang active -> đánh dấu đã đọc
  useEffect(() => {
    if (open && conv && conv.status === 'active') {
      api.chatMessages(conv.id).catch(() => {});
    }
  }, [open, conv?.id, conv?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuộn xuống tin mới nhất
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [open, conv?.messages?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isCustomer) return null;

  const status = conv === undefined ? 'loading' : conv === null ? 'none' : conv.status;
  const staff = conv?.staff_participants || [];
  const unread = conv && !open ? conv.unread : 0;

  const sendStart = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const d = await api.chatStart(content);
      setConv(d.conversation);
      setText('');
    } catch (e) { alert(e.message); }
    setSending(false);
  };

  const sendMsg = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await api.chatSendMy(content);
      setText('');
      load();
    } catch (e) { alert(e.message); }
    setSending(false);
  };

  return (
    <>
      <button type="button" className="cchat-fab" onClick={() => setOpen((o) => !o)} aria-label={t('chat.title')}>
        💬
        {unread > 0 && <span className="cchat-fab-badge">{unread}</span>}
      </button>

      {open && (
        <div className="cchat-panel glass">
          <div className="cchat-head">
            <div>
              <strong>{t('chat.title')}</strong>
              {status === 'active' && staff.length > 0 && (
                <div className="cchat-with">{t('chat.chattingWith', { name: staff.map(staffLabel).join(', ') })}</div>
              )}
              {status === 'waiting' && <div className="cchat-with">{t('chat.waiting')}</div>}
            </div>
            <button type="button" className="cchat-x" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
          </div>

          <div className="cchat-body" ref={bodyRef}>
            {status === 'loading' && <p className="cchat-note">{t('common.loading')}</p>}

            {(status === 'none' || status === 'closed') && (
              <div className="cchat-start">
                {status === 'closed' && <p className="cchat-note">{t('chat.ended')}</p>}
                <h4>{t('chat.startTitle')}</h4>
                <p className="cchat-note">{t('chat.startHint')}</p>
                <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={t('chat.startPlaceholder')} />
                <button type="button" className="btn btn-primary" disabled={sending || !text.trim()} onClick={sendStart}>
                  {t('chat.sendRequest')}
                </button>
              </div>
            )}

            {(status === 'waiting' || status === 'active') && (
              <>
                {(conv.messages || []).map((m) => (
                  <div key={m.id} className={`cchat-msg ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
                    {m.sender_id !== user.id && <div className="cchat-sender">{m.sender_name}</div>}
                    <div className="cchat-bubble">{m.content}</div>
                  </div>
                ))}
                {status === 'waiting' && <p className="cchat-note cchat-wait-note">⏳ {t('chat.waitingHint')}</p>}
              </>
            )}
          </div>

          {status === 'active' && (
            <div className="cchat-input">
              <input value={text} onChange={(e) => setText(e.target.value)}
                placeholder={t('chat.placeholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMsg(); }} />
              <button type="button" className="btn btn-primary" disabled={sending || !text.trim()} onClick={sendMsg}>
                {t('chat.send')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
