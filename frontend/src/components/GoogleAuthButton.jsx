import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';

// Client ID lấy từ biến môi trường lúc build (frontend/.env: VITE_GOOGLE_CLIENT_ID).
// Chưa cấu hình -> bấm nút sẽ báo "đang hoàn tất cấu hình" thay vì lỗi kỹ thuật.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gsiPromise = null;
function loadGsi() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được Google'));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/** Logo Google 4 màu (SVG chính thức thu gọn). */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/**
 * Nút Google dùng chung cho Đăng ký / Đăng nhập.
 * - label: chữ trên nút.
 * - onUnavailable(msg): khi chưa cấu hình Client ID hoặc chưa tải được nút Google thật.
 * - onError(msg): lỗi từ server (vd: chặn trùng tài khoản).
 * Cách hoạt động: Google Identity Services vẽ nút chính thức vào 1 div ẩn;
 * nút hiển thị của shop khi bấm sẽ "bấm hộ" vào nút ẩn đó để mở cửa sổ chọn tài khoản.
 */
export default function GoogleAuthButton({ label, onUnavailable, onError }) {
  const { googleLogin } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();
  const hiddenRef = useRef(null);
  const cbRef = useRef(null);
  cbRef.current = { googleLogin, navigate, onError };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !hiddenRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (resp) => {
            const cb = cbRef.current;
            try {
              const user = await cb.googleLogin(resp.credential);
              cb.navigate(user && user.role === 'admin' ? '/admin' : '/');
            } catch (e) {
              if (cb.onError) cb.onError(e.message);
            }
          },
        });
        window.google.accounts.id.renderButton(hiddenRef.current, {
          type: 'standard',
          size: 'large',
          width: 400,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = () => {
    if (!CLIENT_ID) {
      if (onUnavailable) onUnavailable(t('auth.googleDemo'));
      return;
    }
    const realBtn = hiddenRef.current && hiddenRef.current.querySelector('div[role="button"]');
    if (realBtn) realBtn.click();
    else if (onUnavailable) onUnavailable(t('auth.googleDemo'));
  };

  return (
    <>
      <button type="button" className="google-btn" onClick={handleClick}>
        <GoogleIcon /> {label}
      </button>
      <div ref={hiddenRef} style={{ display: 'none' }} aria-hidden="true" />
    </>
  );
}
