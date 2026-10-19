import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

/** Thẻ danh mục nổi bật: tên + mô tả danh mục từ DB dịch theo ngôn ngữ. */
function CategoryCard({ c }) {
  const name = useTranslatedText(c.name);
  const desc = useTranslatedText(c.description || '');
  return (
    <Link to={`/cua-hang?category=${c.id}`} className="cat-card">
      👜 {name}
      <small>{desc.slice(0, 40)}</small>
    </Link>
  );
}

export default function Home() {
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getProducts({ limit: 8 }).then((d) => setProducts(d.products)).catch(() => {});
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const reasons = [
    { icon: '🐄', title: t('home.reason1t'), desc: t('home.reason1d') },
    { icon: '🧵', title: t('home.reason2t'), desc: t('home.reason2d') },
    { icon: '🛡️', title: t('home.reason3t'), desc: t('home.reason3d') },
    { icon: '🚚', title: t('home.reason4t'), desc: t('home.reason4d') },
  ];

  return (
    <>
      <PageTitle title={t('nav.home')} />
      <div className="hero-3d">
        <div className="container">
          <span className="hero-kicker">{t('home.kicker')}</span>
          <h1 className="hero-title">{t('home.titleA')} <em>{t('home.titleEm')}</em>,<br />{t('home.titleB')}</h1>
          <p className="hero-sub">{t('home.subtitle')}</p>
          <div className="hero-cta">
            <Link to="/cua-hang" className="btn btn-primary">{t('home.shopNow')}</Link>
            <a href="#danh-muc-noi-bat" className="btn btn-outline">{t('home.viewCategories')}</a>
          </div>
        </div>
        <div className="hero-scroll">{t('home.scrollDown')}</div>
      </div>

      <div className="container">
        <div className="section" id="danh-muc-noi-bat">
          <div className="section-head">
            <h2>{t('home.featuredCategories')}</h2>
          </div>
          <div className="cat-grid">
            {categories.map((c) => (
              <CategoryCard key={c.id} c={c} />
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <h2>{t('home.featuredProducts')}</h2>
            <Link to="/cua-hang" className="link-more">{t('home.viewAll')}</Link>
          </div>
          <div className="product-grid">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>

        <div className="section">
          <div className="section-head"><h2>{t('home.whyUs')}</h2></div>
          <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {reasons.map((r, i) => (
              <div className="cat-card" key={i}>{r.icon} {r.title}<small>{r.desc}</small></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
