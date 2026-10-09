// Trang Liên hệ — port từ web artifact Leather House (ContactView)
import { useState } from 'react';
import { api } from '../api';

const INFO = [
  ['📞', 'Điện thoại / Zalo', '0901 234 567'],
  ['✉️', 'Email', 'lienhe@leatherhouse.vn'],
  ['📍', 'Địa chỉ cửa hàng', '45 Trần Phú, Phường Minh An, TP. Hội An, Quảng Nam'],
  ['🕗', 'Giờ mở cửa', 'Thứ 2 – Thứ 7: 8:00 – 21:00 • Chủ nhật: 9:00 – 20:00'],
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', content: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      setErr('Vui lòng điền Họ tên và Nội dung tin nhắn.');
      return;
    }
    setErr('');
    setSending(true);
    try {
      await api.sendContactMessage({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        content: form.content.trim(),
      });
      setSent(true);
      setForm({ name: '', phone: '', email: '', content: '' });
    } catch (ex) {
      setErr(ex.message || 'Gửi tin nhắn thất bại, vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container page">
      <span className="hero-kicker">Liên hệ</span>
      <h1 className="page-title">Ghé xưởng hoặc nhắn cho chúng tôi</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Đội ngũ Leather House phản hồi trong vòng 24 giờ làm việc.
      </p>

      <div className="cat-grid" style={{ marginBottom: 26 }}>
        {INFO.map(([icon, t, s]) => (
          <div key={t} className="cat-card" style={{ textAlign: 'left', padding: 18 }}>
            <span style={{ fontSize: '1.6rem' }} aria-hidden>{icon}</span>
            <strong style={{ display: 'block', marginTop: 8, color: 'var(--cream)' }}>{t}</strong>
            <small style={{ fontSize: '0.9rem' }}>{s}</small>
          </div>
        ))}
      </div>

      <div className="contact-grid">
        <div className="glass" style={{ padding: 26 }}>
          <h2 style={{ color: 'var(--cream)', marginBottom: 16 }}>Gửi tin nhắn</h2>
          {sent ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '2.5rem' }}>✅</p>
              <h3>Đã gửi tin nhắn thành công!</h3>
              <p>Cảm ơn bạn đã liên hệ. Shop sẽ phản hồi sớm nhất có thể.</p>
              <button className="btn btn-primary" onClick={() => setSent(false)}>Gửi thêm tin nhắn</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {err && <div className="form-error">{err}</div>}
              <div className="field">
                <label>Họ tên *</label>
                <input value={form.name} onChange={set('name')} placeholder="Nguyễn Văn A" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Số điện thoại</label>
                  <input value={form.phone} onChange={set('phone')} placeholder="0901234567" inputMode="tel" />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input value={form.email} onChange={set('email')} placeholder="email@example.com" type="email" />
                </div>
              </div>
              <div className="field">
                <label>Nội dung *</label>
                <textarea value={form.content} onChange={set('content')} rows={5} required
                  placeholder="Bạn cần tư vấn sản phẩm, đặt may theo yêu cầu hay bảo hành? Hãy nhắn cho shop..." />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
                {sending ? 'Đang gửi...' : 'Gửi tin nhắn'}
              </button>
            </form>
          )}
        </div>

        <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            title="Bản đồ khu vực Hội An — vị trí cửa hàng Leather House"
            src="https://maps.google.com/maps?q=H%E1%BB%99i%20An%2C%20Qu%E1%BA%A3ng%20Nam&t=&z=14&ie=UTF8&iwloc=&output=embed"
            className="map-frame"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
