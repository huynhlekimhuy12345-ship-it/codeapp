import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { useLang } from '../i18n/LanguageContext';

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="container page">
      <PageTitle title={t('notFound.title')} />
      <div className="sale-empty">
        <h1>404 — {t('notFound.title')}</h1>
        <p>{t('notFound.desc')}</p>
        <Link className="btn btn-primary" to="/">{t('notFound.backHome')}</Link>
      </div>
    </div>
  );
}
