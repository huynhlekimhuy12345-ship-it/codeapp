import { useEffect } from 'react';

// Đặt <title> riêng cho từng route (SEO + tab trình duyệt)
export default function PageTitle({ title }) {
  useEffect(() => {
    document.title = title ? `${title} — Leather House` : 'Leather House - Đồ da thật cao cấp';
  }, [title]);
  return null;
}
