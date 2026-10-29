import { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { register } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container page">
      <PageTitle title={t('auth.register')} />
      <form className="form-card" onSubmit={submit}>
        <h2>{t('auth.registerTitle')}</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="register-ho-ten">{t('auth.fullName')}</label>
          <input id="register-ho-ten" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="register-mat-khau">{t('auth.passwordMin')}</label>
          <div className="pw-wrap">
            <input id="register-mat-khau" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="button" className="pw-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPw ? '🙈' : '👁'}</button>
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>{t('auth.register')}</button>
        <div className="form-link">{t('auth.hasAccount')} <Link to="/dang-nhap">{t('nav.login')}</Link></div>
      </form>
    </div>
  );
}
