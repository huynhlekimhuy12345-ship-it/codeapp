// Trang "Tất cả thông báo": trang con nằm trong trang web chính, hiển thị MỌI
// thông báo của tài khoản (thông báo riêng + tin tức shop) dạng thẻ lớn, dễ đọc,
// nội dung đầy đủ — thay cho panel chuông nhỏ chỉ xem nhanh được vài tin.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { api, fmtDate } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

const SEEN_KEY = 'bi99_ann_seen';

// Icon theo loại thông báo
function iconFor(type) {
  const s = String(type || '');
  if (s.includes('hunt')) return '🎯';
  if (s === 'tier_up') return '🎉';
  if (s.includes('tier')) return '🎟️';
  if (s.includes('order')) return '📦';
  if (s.includes('return')) return '↩️';
  if (s.includes('warranty')) return '🛠️';
  if (s === 'announcement') return '📣';
  return '🔔';
}

function NotifCard({ item, openLabel }) {
  const title = useTranslatedText(item.title);
  const content = useTranslatedText(item.content);
  const cta = useTranslatedText(item.cta || '');
  // Nhiều tiêu đề đã chứa sẵn emoji ở đầu (do nội dung thông báo) — chỉ thêm
  // icon phân loại khi tiêu đề chưa có, tránh hiện 2 icon cạnh nhau.
  const hasEmoji = /^[^a-zA-Z0-9À-ỹ]/.test(String(title).trim());
  return (
    <div className={`notif-card${item.unread ? ' unread' : ''}`}>
      <div className="notif-card-body">
        <strong>{hasEmoji ? title : `${item.icon} ${title}`}</strong>
        <p>{content}</p>
        <div className="notif-card-foot">
          <small>{fmtDate(item.at)}</small>
          {item.link && (
            <Link to={item.link} className="link-more">{cta || openLabel} →</Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const merged = [];
      try {
        const d = await api.getNotifications(true);
        for (const n of d.notifications || []) {
          merged.push({
            key: 'n' + n.id, icon: iconFor(n.type), title: n.title, content: n.content,
            at: n.created_at, link: n.link || '', cta: '', unread: !n.is_read,
          });
        }
      } catch { /* bỏ qua */ }
      try {
        const d = await api.getActiveAnnouncements();
        const anns = (d.announcements || []).filter((a) => a.send_notification);
        let seen = 0;
        try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { /* bỏ qua */ }
        for (const a of anns) {
          merged.push({
            key: 'a' + a.id, icon: '📣', title: a.title, content: a.content,
            at: a.created_at, link: a.cta_link || '', cta: a.cta_text || '', unread: a.id > seen,
          });
        }
        if (anns.length) {
          const maxId = Math.max(...anns.map((a) => a.id));
          try { localStorage.setItem(SEEN_KEY, String(maxId)); } catch { /* bỏ qua */ }
        }
      } catch { /* bỏ qua */ }
      merged.sort((x, y) => String(y.at).localeCompare(String(x.at)));
      if (alive) { setItems(merged); setLoading(false); }
      // Mở trang này = đã đọc hết thông báo riêng
      api.markNotificationsRead().catch(() => {});
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="container" style={{ maxWidth: 780, paddingTop: 28, paddingBottom: 40 }}>
      <PageTitle title={t('notifPage.title')} />
      <h1 style={{ marginBottom: 20 }}>🔔 {t('notifPage.title')}</h1>
      {loading ? (
        <p className="muted">…</p>
      ) : items.length === 0 ? (
        <p className="muted">{t('bell.empty')}</p>
      ) : (
        items.map((it) => (
          <NotifCard key={it.key} item={it} openLabel={t('notifPage.openLink')} />
        ))
      )}
    </div>
  );
}
