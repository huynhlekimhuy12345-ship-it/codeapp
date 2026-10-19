import { useEffect } from 'react';
import { useLang } from '../i18n/LanguageContext';

// Đặt <title> riêng cho từng route (SEO + tab trình duyệt)
export default function PageTitle({ title }) {
  const { t } = useLang();
  useEffect(() => {
    document.title = title ? `${title} — BI99` : t('common.defaultTitle');
  }, [title, t]);
  return null;
}
