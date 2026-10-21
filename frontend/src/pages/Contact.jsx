// Trang Liên hệ — port từ web artifact BI99 (ContactView)
import { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { api } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { countWords, detectLang, translateToVietnamese } from '../i18n/autoTranslate';

const INFO = [
  ['📞', 'phone', '0901 234 567'],
  ['✉️', 'email', 'lienhe@leatherhouse.vn'],
  ['📍', 'address', 'contact.addressValue'],
  ['🕗', 'hours', 'contact.hoursValue'],
];

export default function Contact() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', phone: '', email: '', content: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const words = countWords(form.content);
  const overLimit = words > 300;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      setErr(t('contact.needNameContent'));
      return;
    }
    if (overLimit) {
      setErr(t('contact.tooLong'));
      return;
    }
    setErr('');
    setSending(true);
    try {
      // Khách viết ngôn ngữ khác → dịch kèm bản tiếng Việt cho admin
      let contentVi = '';
      if (detectLang(form.content) !== 'vi') {
        contentVi = await translateToVietnamese(form.content.trim());
        if (contentVi === form.content.trim()) contentVi = '';
      }
      await api.sendContactMessage({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        content: form.content.trim(),
        content_vi: contentVi,
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

      <div className="contact-info-grid" style={{ marginBottom: 26 }}>
        {INFO.map(([icon, tk, s]) => (
          <div key={tk} className="cat-card contact-info-card" style={{ textAlign: 'left', padding: 18 }}>
            <span style={{ fontSize: '1.6rem' }} aria-hidden>{icon}</span>
            <strong style={{ display: 'block', marginTop: 8, color: 'var(--cream)' }}>{t('contact.' + tk)}</strong>
            <small style={{ fontSize: '0.9rem' }}>{(tk === 'hours' || tk === 'address') ? t(s) : s}</small>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <small style={{ color: 'var(--muted)' }}>{t('contact.anyLanguage')}</small>
                  <small style={{ color: overLimit ? '#b3261e' : 'var(--muted)', fontWeight: overLimit ? 700 : 400 }}>
                    {words}/300 {t('contact.words')}
                  </small>
                </div>
                {overLimit && <small style={{ color: '#b3261e' }}>{t('contact.tooLong')}</small>}
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
            src="https://maps.google.com/maps?q=BI%2099%20Leather%20Shoes%20and%20Handbags%2C%202B%20Phan%20B%E1%BB%99i%20Ch%C3%A2u%2C%20H%E1%BB%99i%20An&t=&z=16&ie=UTF8&iwloc=&output=embed"
            className="map-frame"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
