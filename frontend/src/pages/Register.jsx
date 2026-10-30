import { useMemo, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

/** Điểm mạnh mật khẩu 0–4: dài ≥8, hoa+thường, có số, có ký tự đặc biệt. */
function pwScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function Register() {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { register } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();

  const score = useMemo(() => pwScore(password), [password]);
  const strengthLabel = [t('auth.strengthWeak'), t('auth.strengthWeak'), t('auth.strengthMedium'), t('auth.strengthGood'), t('auth.strengthStrong')][score];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const idv = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(idv);
    const isPhone = /^0\d{9}$/.test(idv.replace(/[\s.]/g, ''));
    if (!isEmail && !isPhone) { setError(t('auth.idInvalid')); return; }
    if (password !== confirm) { setError(t('auth.pwMismatch')); return; }
    if (!agree) { setError(t('auth.mustAgree')); return; }
    try {
      // Đăng ký bằng email HOẶC số điện thoại (một ô duy nhất);
      // backend kiểm tra trùng tài khoản (cả với tài khoản Google) và báo lỗi dễ hiểu.
      await register(name, idv, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container page">
      <PageTitle title={t('auth.register')} />
      <form className="form-card register-card" onSubmit={submit}>
        <h2>{t('auth.registerTitle')}</h2>
        <p className="register-gift">{t('auth.giftNote')}</p>

        {error && <div className="form-error">{error}</div>}
        {notice && <div className="form-notice">{notice}</div>}

        <div className="field">
          <label htmlFor="register-ho-ten">{t('auth.fullName')} *</label>
          <input id="register-ho-ten" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="register-dinh-danh">{t('auth.loginId')} *</label>
          <input id="register-dinh-danh" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" placeholder={t('auth.idPlaceholder')} />
        </div>
        <div className="field">
          <label htmlFor="register-mat-khau">{t('auth.passwordMin')} *</label>
          <div className="pw-wrap">
            <input id="register-mat-khau" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            <button type="button" className="pw-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPw ? '🙈' : '👁'}</button>
          </div>
          {password && (
            <div className="pw-meter" aria-hidden="true">
              <div className="pw-meter-bars">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={i < score ? `on s${score}` : ''} />
                ))}
              </div>
              <small>{t('auth.strength')} <b>{strengthLabel}</b></small>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="register-nhap-lai">{t('auth.confirmPassword')} *</label>
          <div className="pw-wrap">
            <input id="register-nhap-lai" type={showCf ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            <button type="button" className="pw-eye" onClick={() => setShowCf((s) => !s)} aria-label={showCf ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} title={showCf ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showCf ? '🙈' : '👁'}</button>
          </div>
          {confirm && password !== confirm && <small className="field-warn">{t('auth.pwMismatch')}</small>}
        </div>

        <label className="terms-row">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            {t('auth.agree')} <a href="#dieu-khoan" onClick={(e) => e.preventDefault()}>{t('auth.terms')}</a> {t('auth.and')} <a href="#bao-mat" onClick={(e) => e.preventDefault()}>{t('auth.privacy')}</a>
          </span>
        </label>

        <div className="auth-divider"><span>{t('auth.or')}</span></div>
        <GoogleAuthButton
          label={t('auth.google')}
          onUnavailable={(m) => setNotice(m)}
          onError={(m) => setError(m)}
        />

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>{t('auth.register')}</button>
        <div className="form-link">{t('auth.hasAccount')} <Link to="/dang-nhap">{t('nav.login')}</Link></div>
      </form>
    </div>
  );
}
