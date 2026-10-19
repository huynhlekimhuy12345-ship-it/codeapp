// Trang Giới thiệu — port từ web artifact Leather House (AboutView)
import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { useLang } from '../i18n/LanguageContext';

const VALUES = [
  ['🐄', 'v1t', 'v1d'],
  ['✋', 'v2t', 'v2d'],
  ['🛡️', 'v3t', 'v3d'],
];

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'];

export default function About() {
  const { t } = useLang();
  const values = VALUES.map(([icon, tk, dk]) => [icon, t('about.' + tk), t('about.' + dk)]);
  const steps = STEPS.map((k) => [t('about.' + k + 't'), t('about.' + k + 'd')]);
  return (
    <div className="container page">
      <PageTitle title={t('nav.about')} />
      <div className="about-story">
        <div>
          <span className="kicker">{t('nav.about')}</span>
          <h2>{t('about.storyTitle')}</h2>
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>{t('about.p3')}</p>
          <div className="about-cta">
            <Link to="/cua-hang" className="btn btn-primary">{t('about.viewProducts')}</Link>
            <Link to="/lien-he" className="btn btn-outline">{t('about.contactWorkshop')}</Link>
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80"
          alt={t('about.imgAlt')}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="section">
        <div className="section-head"><h2>{t('about.coreValues')}</h2></div>
        <div className="value-grid">
          {values.map(([icon, t, s]) => (
            <div key={t} className="glass value-card">
              <span className="vicon" aria-hidden>{icon}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>{t('about.process')}</h2></div>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>{t('about.processDesc')}</p>
        <div className="value-grid">
          {steps.map(([t, s], i) => (
            <div key={t} className="glass value-card">
              <span className="step-num">{i + 1}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
