// Báo cho NHÂN VIÊN (trang quản trị) khi có khách chờ chat / tin nhắn mới:
// - Thông báo desktop (Notification API): trình duyệt chỉ xin quyền 1 lần,
//   tại lần bấm chuột/gõ phím đầu tiên của nhân viên trong trang quản trị.
// - Nhấp nháy tiêu đề tab trình duyệt trong lúc tab đang bị ẩn (đang ở tab khác).
// Chỉ dùng phía quản trị — không ảnh hưởng phía khách hàng.

let permissionArmed = false;
export function armStaffNotifications() {
  if (!('Notification' in window) || permissionArmed) return;
  if (Notification.permission !== 'default') return;
  permissionArmed = true;
  const ask = () => {
    try {
      const p = Notification.requestPermission();
      if (p && p.catch) p.catch(() => {});
    } catch { /* trình duyệt không hỗ trợ */ }
    window.removeEventListener('pointerdown', ask);
    window.removeEventListener('keydown', ask);
  };
  window.addEventListener('pointerdown', ask);
  window.addEventListener('keydown', ask);
}

export function staffNotify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* bỏ qua nếu trình duyệt chặn */ }
}

/* ---------- Nhấp nháy tiêu đề tab ---------- */
const titleAlerts = new Map(); // key -> text; ưu tiên: 'waiting' trước 'msg'
let blinkTimer = null;
let baseTitle = null;
let showingAlt = false;

function currentTitleAlert() {
  if (titleAlerts.has('waiting')) return titleAlerts.get('waiting');
  if (titleAlerts.has('msg')) return titleAlerts.get('msg');
  return null;
}

function stopBlink() {
  if (blinkTimer) clearInterval(blinkTimer);
  blinkTimer = null;
  if (baseTitle !== null && document.title !== baseTitle) document.title = baseTitle;
  baseTitle = null;
  showingAlt = false;
}

function ensureBlink() {
  if (blinkTimer) return;
  baseTitle = document.title;
  blinkTimer = setInterval(() => {
    const text = currentTitleAlert();
    if (!text) { stopBlink(); return; }
    if (!document.hidden) {
      // Đang nhìn tab này thì giữ tiêu đề gốc, không nhấp nháy gây rối mắt
      if (document.title !== baseTitle) document.title = baseTitle;
      showingAlt = false;
      return;
    }
    showingAlt = !showingAlt;
    document.title = showingAlt ? `🔴 ${text}` : baseTitle;
  }, 1200);
}

export function setTitleAlert(key, text) {
  titleAlerts.set(key, text);
  ensureBlink();
}

export function clearTitleAlert(key) {
  titleAlerts.delete(key);
  if (!currentTitleAlert()) stopBlink();
  else ensureBlink();
}
