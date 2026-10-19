// Trang Liên hệ — port từ web artifact Leather House (ContactView)
import { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { api } from '../api';
import { useLang } from '../i18n/LanguageContext';

const INFO = [
  ['📞', 'phone', '0901 234 567'],
  ['✉️', 'email', 'lienhe@leatherhouse.vn'],
  ['📍', 'address', '45 Trần Phú, Phường Minh An, TP. Hội An, Quảng Nam'],
  ['🕗', 'hours', 'contact.hoursValue'],
];

export default function Contact() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', phone: '', email: '', content: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      setErr(t('contact.needNameContent'));
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
      setErr(ex.message || t('contact.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container page">
      <PageTitle title={t('nav.contact')} />
      <span className="hero-kicker">{t('nav.contact')}</span>
      <h1 className="page-title">{t('contact.title')}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        {t('contact.subtitle')}
      </p>

      <div className="cat-grid" style={{ marginBottom: 26 }}>
        {INFO.map(([icon, tk, s]) => (
          <div key={t} className="cat-card" style={{ textAlign: 'left', padding: 18 }}>
            <span style={{ fontSize: '1.6rem' }} aria-hidden>{icon}</span>
            <strong style={{ display: 'block', marginTop: 8, color: 'var(--cream)' }}>{t('contact.' + tk)}</strong>
            <small style={{ fontSize: '0.9rem' }}>{tk === 'hours' ? t(s) : s}</small>
          </div>
        ))}
      </div>

      <div className="contact-grid">
        <div className="glass" style={{ padding: 26 }}>
          <h2 style={{ color: 'var(--cream)', marginBottom: 16 }}>{t('contact.sendMessage')}</h2>
          {sent ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '2.5rem' }}>✅</p>
              <h3>{t('contact.sentTitle')}</h3>
              <p>{t('contact.sentDesc')}</p>
              <button className="btn btn-primary" onClick={() => setSent(false)}>{t('contact.sendMore')}</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {err && <div className="form-error">{err}</div>}
              <div className="field">
                <label htmlFor="contact-ho-ten">{t('checkout.fullName')}</label>
                <input id="contact-ho-ten" value={form.name} onChange={set('name')} placeholder={t('fix2.nameExample')} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label htmlFor="contact-so-ien-thoai">{t('contact.phoneLabel')}</label>
                  <input id="contact-so-ien-thoai" value={form.phone} onChange={set('phone')} placeholder="0901234567" inputMode="tel" />
                </div>
                <div className="field">
                  <label htmlFor="contact-email">Email</label>
                  <input id="contact-email" value={form.email} onChange={set('email')} placeholder="email@example.com" type="email" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="contact-noi-dung">{t('contact.content')}</label>
                <textarea id="contact-noi-dung" value={form.content} onChange={set('content')} rows={5} required
                  placeholder={t('contact.contentPlaceholder')} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
                {sending ? t('reviews.sending') : t('contact.send')}
              </button>
            </form>
          )}
        </div>

        <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            title={t('contact.mapTitle')}
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
