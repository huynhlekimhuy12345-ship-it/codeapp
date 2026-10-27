import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="footer">
      <div className="container">
        <div>
          <h4>{t('footer.brand')}</h4>
          <p>{t('footer.tagline')}</p>
        </div>
        <div>
          <h4>{t('footer.links')}</h4>
          <ul>
            <li><Link to="/">{t('nav.home')}</Link></li>
            <li><Link to="/gioi-thieu">{t('nav.about')}</Link></li>
            <li><Link to="/cua-hang">{t('footer.shop')}</Link></li>
            <li><Link to="/gioi-thieu#blog">{t('nav.blog')}</Link></li>
            <li><Link to="/lien-he">{t('nav.contact')}</Link></li>
            <li><Link to="/gio-hang">{t('nav.cart')}</Link></li>
            <li><Link to="/don-hang">{t('footer.trackOrder')}</Link></li>
          </ul>
        </div>
        <div>
          <h4>{t('nav.contact')}</h4>
          <p>📍 2B Phan Bội Châu, Hội An</p>
          <p>📞 0935 468 662</p>
          <p>✉️ hotro@dodashop.vn</p>
        </div>
      </div>
      <div className="footer-bottom">{t('footer.bottom')}</div>
    </footer>
  );
}
