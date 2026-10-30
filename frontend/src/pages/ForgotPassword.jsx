import { useMemo, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../api';

/** Điểm mạnh mật khẩu 0–4 (giống trang Đăng ký). */
function pwScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

/** Quên mật khẩu: bước 1 nhập email/sđt → backend sinh mã 6 số (hạn 10 phút)
 *  gửi về email/sđt → bước 2 nhập mã + mật khẩu mới → backend kiểm tra mã rồi đổi mật khẩu. */
export default function ForgotPassword() {
  const { t } = useLang();
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const score = useMemo(() => pwScore(password), [password]);
  const strengthLabel = [t('auth.strengthWeak'), t('auth.strengthWeak'), t('auth.strengthMedium'), t('auth.strengthGood'), t('auth.strengthStrong')][score];

  const sendCode = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.forgotPassword({ identifier: identifier.trim() });
      setNotice(t('auth.codeSent'));
      setStep(2);
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) { setError(t('auth.codeInvalid')); return; }
    if (password !== confirm) { setError(t('auth.pwMismatch')); return; }
    try {
      await api.resetPassword({ identifier: identifier.trim(), code: code.trim(), password });
      setStep(3);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container page">
      <PageTitle title={t('auth.forgotTitle')} />
      <form className="form-card register-card" onSubmit={step === 1 ? sendCode : reset}>
        <h2>{t('auth.forgotTitle')}</h2>

        {step === 1 && (
          <>
            <p className="register-gift">{t('auth.forgotNote')}</p>
            <div className="field">
              <label htmlFor="forgot-dinh-danh">{t('auth.loginId')} *</label>
              <input id="forgot-dinh-danh" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" placeholder={t('auth.idPlaceholder')} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>{t('auth.sendCode')}</button>
          </>
        )}

        {step === 2 && (
          <>
            {notice && <div className="form-notice">{notice}</div>}
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label htmlFor="forgot-ma">{t('auth.codeLabel')} *</label>
              <input id="forgot-ma" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required placeholder="123456" />
            </div>
            <div className="field">
              <label htmlFor="forgot-mk-moi">{t('auth.newPassword')} *</label>
              <div className="pw-wrap">
                <input id="forgot-mk-moi" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
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
              <label htmlFor="forgot-nhap-lai">{t('auth.confirmPassword')} *</label>
              <input id="forgot-nhap-lai" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              {confirm && password !== confirm && <small className="field-warn">{t('auth.pwMismatch')}</small>}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>{t('auth.resetSubmit')}</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="form-notice">✅ {t('auth.resetDone')}</div>
            <Link className="btn btn-primary" style={{ width: '100%', display: 'block', textAlign: 'center' }} to="/dang-nhap">{t('auth.backToLogin')}</Link>
          </>
        )}

        {step !== 3 && (
          <div className="form-link"><Link to="/dang-nhap">← {t('auth.backToLogin')}</Link></div>
        )}
      </form>
    </div>
  );
}
