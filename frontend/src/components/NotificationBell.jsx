// Chuông thông báo tin mới của shop — hiện cho mọi tài khoản (khách, sale, admin).
// Tin chưa đọc = tin có send_notification và id lớn hơn id đã xem gần nhất (lưu localStorage).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';
import { api } from '../api';

const SEEN_KEY = 'bi99_ann_seen';

function getSeen() {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}
function setSeen(id) {
  try { localStorage.setItem(SEEN_KEY, String(id)); } catch {}
}

function BellItem({ a, onRead }) {
  const title = useTranslatedText(a.title);
  const content = useTranslatedText(a.content);
  const cta = useTranslatedText(a.cta_text);
  return (
    <div className={`bell-item${a.unread ? ' unread' : ''}`}>
      {a.unread && <span className="bell-dot" aria-hidden="true" />}
      <div className="bell-item-body">
        <strong>{title}</strong>
        <p>{content.length > 90 ? content.slice(0, 90) + '…' : content}</p>
        <div className="bell-item-foot">
          <small>{new Date(a.created_at).toLocaleDateString('vi-VN')}</small>
          {cta && a.cta_link && (
            <Link to={a.cta_link} className="link-more" onClick={onRead}>{cta} →</Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeenState] = useState(getSeen());
  const wrapRef = useRef(null);

  useEffect(() => {
    api.getActiveAnnouncements()
      .then((d) => setItems((d.announcements || []).filter((a) => a.send_notification)))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((a) => a.id > seen);

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      const maxId = Math.max(...items.map((a) => a.id));
      setSeen(maxId);
      setSeenState(maxId);
    }
  };

  const markAll = () => {
    if (items.length > 0) {
      const maxId = Math.max(...items.map((a) => a.id));
      setSeen(maxId);
      setSeenState(maxId);
    }
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="bell-btn" onClick={openPanel} aria-label={t('bell.title')} title={t('bell.title')}>
        🔔
        {unread.length > 0 && <span className="bell-badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-head">
            <strong>{t('bell.title')}</strong>
            {unread.length > 0 && (
              <button className="link-more" onClick={markAll}>{t('bell.markRead')}</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">{t('bell.empty')}</p>
          ) : (
            items.map((a) => (
              <BellItem key={a.id} a={{ ...a, unread: a.id > seen }} onRead={() => setOpen(false)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
