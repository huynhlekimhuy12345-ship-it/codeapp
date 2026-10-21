import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useLang, LANGS } from '../i18n/LanguageContext';
import NotificationBell from './NotificationBell';

function LangSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div className="lang-switcher">
      <button
        className="lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('nav.language')}
        aria-expanded={open}
        title={t('nav.language')}
      >
        <span>{current.flag}</span>
        <span className="lang-code">{current.short}</span>
        <span className="lang-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="lang-backdrop" onClick={() => setOpen(false)} />
          <div className="lang-menu" role="menu">
            {LANGS.map((l) => (
              <button
                key={l.code}
                role="menuitem"
                className={`lang-item${l.code === lang ? ' active' : ''}`}
                onClick={() => { setLang(l.code); setOpen(false); }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.code === lang && <span className="lang-check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout, cartCount } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="logo">BI<span>99</span></Link>
        <div className={`nav-links${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} onKeyDown={() => {}} role="presentation">
          <NavLink to="/" end>{t('nav.home')}</NavLink>
          <NavLink to="/gioi-thieu">{t('nav.about')}</NavLink>
          <NavLink to="/cua-hang">{t('nav.products')}</NavLink>
          <NavLink to="/khuyen-mai">{t('nav.sale')}</NavLink>
          <NavLink to="/bo-suu-tap">{t('nav.collection')}</NavLink>
          <NavLink to="/lien-he">{t('nav.contact')}</NavLink>
          {user && <NavLink to="/don-hang">{t('nav.orders')}</NavLink>}
          {user?.role === 'customer' && <NavLink to="/hang-cua-toi">🏆 {t('nav.myTier')}</NavLink>}
          {['admin', 'sale'].includes(user?.role) && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
        </div>
        <div className="nav-right">
          <button
            className="hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <LangSwitcher />
          <NotificationBell />
          <Link to="/gio-hang" className="cart-link" title={t('nav.cart')}>
            🛒
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          {user ? (
            <>
              <span className="user-chip">👋 {user.name}</span>
              <button className="btn btn-small btn-outline" onClick={handleLogout}>{t('nav.logout')}</button>
            </>
          ) : (
            <Link to="/dang-nhap" className="btn btn-small btn-primary">{t('nav.login')}</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
