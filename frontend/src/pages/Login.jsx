import { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { login } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(identifier, password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container page">
      <PageTitle title={t('auth.login')} />
      <form className="form-card" onSubmit={submit}>
        <h2>{t('auth.login')}</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="login-email">{t('auth.loginId')}</label>
          <input id="login-email" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="login-mat-khau">{t('auth.password')}</label>
          <div className="pw-wrap">
            <input id="login-mat-khau" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="pw-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPw ? '🙈' : '👁'}</button>
          </div>
        </div>
        <div className="forgot-row"><Link to="/quen-mat-khau">{t('auth.forgot')}</Link></div>
        <div className="auth-divider"><span>{t('auth.or')}</span></div>
        <GoogleAuthButton
          label={t('auth.googleLogin')}
          onUnavailable={(m) => setError(m)}
          onError={(m) => setError(m)}
        />
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>{t('auth.login')}</button>
        <div className="form-link">{t('auth.noAccount')} <Link to="/dang-ky">{t('auth.registerNow')}</Link></div>
      </form>
    </div>
  );
}
