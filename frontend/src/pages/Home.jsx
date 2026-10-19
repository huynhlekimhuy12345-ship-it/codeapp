import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

/** Banner hero động: lấy tin mới nhất có show_on_banner từ admin. */
function HeroBanner() {
  const { t } = useLang();
  const [ann, setAnn] = useState(null);
  useEffect(() => {
    api.getActiveAnnouncements()
      .then((d) => {
        const list = (d.announcements || []).filter((a) => a.show_on_banner);
        setAnn(list.length ? list[0] : null);
      })
      .catch(() => setAnn(null));
  }, []);
  const badge = useTranslatedText(ann?.badge || '');
  const title = useTranslatedText(ann?.title || '');
  const content = useTranslatedText(ann?.content || '');
  const cta = useTranslatedText(ann?.cta_text || '');

  if (!ann) {
    return (
      <>
        <span className="hero-kicker">{t('home.kicker')}</span>
        <h1 className="hero-title">{t('home.titleA')} <em>{t('home.titleEm')}</em>,<br />{t('home.titleB')}</h1>
        <p className="hero-sub">{t('home.subtitle')}</p>
        <div className="hero-cta">
          <Link to="/cua-hang" className="btn btn-primary">{t('home.shopNow')}</Link>
          <a href="#danh-muc-noi-bat" className="btn btn-outline">{t('home.viewCategories')}</a>
        </div>
      </>
    );
  }
  return (
    <>
      {(badge || t('home.kicker')) && <span className="hero-kicker">{badge || t('home.kicker')}</span>}
      <h1 className="hero-title">{title}</h1>
      <p className="hero-sub">{content}</p>
      <div className="hero-cta">
        {cta && ann.cta_link ? (
          <Link to={ann.cta_link} className="btn btn-primary">{cta}</Link>
        ) : (
          <Link to="/cua-hang" className="btn btn-primary">{t('home.shopNow')}</Link>
        )}
        <a href="#danh-muc-noi-bat" className="btn btn-outline">{t('home.viewCategories')}</a>
      </div>
    </>
  );
}

/** Mục "Tin tức & cập nhật" trên trang chủ — 3 tin mới nhất có hình. */
function HomeNews() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.getActiveAnnouncements()
      .then((d) => setItems((d.announcements || []).slice(0, 3)))
      .catch(() => setItems([]));
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <h2>{t('news.homeTitle')}</h2>
        <Link to="/tin-tuc" className="link-more">{t('news.viewAll')}</Link>
      </div>
      <div className="news-grid">
        {items.map((a) => <HomeNewsCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}

function HomeNewsCard({ a }) {
  const { t } = useLang();
  const title = useTranslatedText(a.title);
  const content = useTranslatedText(a.content);
  const badge = useTranslatedText(a.badge || '');
  return (
    <article className="glass news-card">
      {a.image_url && (
        <Link to={`/tin-tuc/${a.id}`} className="news-thumb" aria-label={title}>
          <img src={a.image_url} alt={title} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Link>
      )}
      <div className="news-info">
        <div className="news-meta">
          {badge && <span className="news-badge">{badge}</span>}
          <span className="date">📅 {new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
        </div>
        <h3><Link to={`/tin-tuc/${a.id}`}>{title}</Link></h3>
        <p className="excerpt">{content.length > 110 ? content.slice(0, 110) + '…' : content}</p>
        <Link to={`/tin-tuc/${a.id}`} className="link-more">{t('news.readMore')}</Link>
      </div>
    </article>
  );
}

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
          <HeroBanner />
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

        <HomeNews />

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
