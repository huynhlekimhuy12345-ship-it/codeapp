import { useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
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
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="login-mat-khau">{t('auth.password')}</label>
          <input id="login-mat-khau" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>{t('auth.login')}</button>
        <div className="form-link">{t('auth.noAccount')} <Link to="/dang-ky">{t('auth.registerNow')}</Link></div>
      </form>
    </div>
  );
}
