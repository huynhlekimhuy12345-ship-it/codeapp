import { useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, fmtVND } from '../api';
import ProductCard from '../components/ProductCard';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText } from '../i18n/TranslatedProduct';

const LIMIT = 12;

/** Option danh mục trong bộ lọc: tên từ DB dịch theo ngôn ngữ. */
function CategoryOption({ c }) {
  const name = useTranslatedText(c.name);
  return <option value={c.id}>{name}</option>;
}

export default function Shop() {
  const { t } = useLang();
  const shopTrackRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  // Đổi trang / đổi bộ lọc → dải sản phẩm quay về vị trí đầu
  useEffect(() => {
    if (shopTrackRef.current) shopTrackRef.current.scrollTo({ left: 0 });
  }, [products]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  // Thanh kéo giá: trục 0 → 20 triệu, hai núm trượt đồng bộ với 2 ô nhập giá
  const PRICE_CAP = 20000000;
  const sMin = Math.max(0, Math.min(PRICE_CAP, Number(minPrice) || 0));
  const sMax = maxPrice === '' ? PRICE_CAP : Math.max(0, Math.min(PRICE_CAP, Number(maxPrice) || 0));

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    const c = searchParams.get('category') || '';
    setCategory(c);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const tm = setTimeout(() => {
      setLoading(true);
      api.getProducts({ category, search, sort, page, limit: LIMIT, min_price: minPrice || undefined, max_price: maxPrice || undefined })
        .then((d) => { setProducts(d.products); setTotalPages(d.totalPages); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250); // debounce tìm kiếm
    return () => clearTimeout(tm);
  }, [category, search, sort, page, minPrice, maxPrice]);

  const pickCategory = (id) => {
    setSearchParams(id ? { category: id } : {});
  };

  return (
    <div className="container page">
      <PageTitle title={t('shop.title')} />
      {category && (
        <button
          className="btn btn-outline btn-small"
          style={{ marginBottom: 12 }}
          onClick={() => (window.history.length > 1 ? navigate(-1) : pickCategory(''))}
        >
          {t('shop.back')}
        </button>
      )}
      <h1 className="page-title">{t('shop.title')}</h1>
      <div className="filters">
        <input
          className="search" placeholder={t('shop.searchPlaceholder')} aria-label={t('shop.searchLabel')}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={category} onChange={(e) => pickCategory(e.target.value)} aria-label={t('shop.allCategories')}>
          <option value="">{t('shop.allCategories')}</option>
          {categories.map((c) => <CategoryOption key={c.id} c={c} />)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label={t('shop.sortLabel')}>
          <option value="">{t('shop.sort')}</option>
          <option value="newest">{t('shop.newest')}</option>
          <option value="price-asc">{t('shop.priceAsc')}</option>
          <option value="price-desc">{t('shop.priceDesc')}</option>
          <option value="name">{t('shop.nameAZ')}</option>
        </select>
        <div className="price-group">
          <div className="price-mid">
            <div className="price-slider">
              <div className="price-track" />
              <div
                className="price-fill"
                style={{ left: `${(sMin / PRICE_CAP) * 100}%`, right: `${100 - (sMax / PRICE_CAP) * 100}%` }}
              />
              <input
                type="range" min="0" max={PRICE_CAP} step="100000" value={sMin} aria-label={t('shop.minPriceLabel')}
                onChange={(e) => { const v = Math.min(Number(e.target.value), sMax); setMinPrice(v === 0 ? '' : String(v)); setPage(1); }}
              />
              <input
                type="range" min="0" max={PRICE_CAP} step="100000" value={sMax} aria-label={t('shop.maxPriceLabel')}
                onChange={(e) => { const v = Math.max(Number(e.target.value), sMin); setMaxPrice(v === PRICE_CAP ? '' : String(v)); setPage(1); }}
              />
            </div>
            <div className="price-scale"><span>{fmtVND(0)}</span><span>{fmtVND(PRICE_CAP)}</span></div>
          </div>
          <div className="price-nums">
            <input
              className="price-filter" type="number" min="0" placeholder={t('shop.priceFrom')} aria-label={t('shop.minPriceLabel')}
              value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
            />
            <input
              className="price-filter" type="number" min="0" placeholder={t('shop.priceTo')} aria-label={t('shop.maxPriceLabel')}
              value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty">{t('shop.loading')}</div>
      ) : products.length === 0 ? (
        <div className="empty">{t('shop.empty')}</div>
      ) : (
        <div className="rel-wrap">
          {products.length > 1 && (
            <button
              type="button" className="rel-arrow rel-prev" aria-label="Trước"
              onClick={() => shopTrackRef.current && shopTrackRef.current.scrollBy({ left: -shopTrackRef.current.clientWidth, behavior: 'smooth' })}
            >‹</button>
          )}
          <div className="shop-strip" ref={shopTrackRef}>
            {products.map((p) => (
              <div key={p.id} className="shop-slide"><ProductCard product={p} /></div>
            ))}
          </div>
          {products.length > 1 && (
            <button
              type="button" className="rel-arrow rel-next" aria-label="Tiếp"
              onClick={() => shopTrackRef.current && shopTrackRef.current.scrollBy({ left: shopTrackRef.current.clientWidth, behavior: 'smooth' })}
            >›</button>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} className={n === page ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
          ))}
        </div>
      )}
    </div>
  );
}
