import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import { useLang } from '../i18n/LanguageContext';

const LIMIT = 12;

export default function Shop() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

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
      <h1 className="page-title">{t('shop.title')}</h1>
      <div className="filters">
        <input
          className="search" placeholder={t('shop.searchPlaceholder')} aria-label={t('shop.searchLabel')}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={category} onChange={(e) => pickCategory(e.target.value)} aria-label={t('shop.allCategories')}>
          <option value="">{t('shop.allCategories')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label={t('shop.sortLabel')}>
          <option value="">{t('shop.sort')}</option>
          <option value="newest">{t('shop.newest')}</option>
          <option value="price-asc">{t('shop.priceAsc')}</option>
          <option value="price-desc">{t('shop.priceDesc')}</option>
          <option value="name">{t('shop.nameAZ')}</option>
        </select>
        <input
          className="price-filter" type="number" min="0" placeholder={t('shop.priceFrom')} aria-label={t('shop.minPriceLabel')}
          value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
        />
        <input
          className="price-filter" type="number" min="0" placeholder={t('shop.priceTo')} aria-label={t('shop.maxPriceLabel')}
          value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="empty">{t('shop.loading')}</div>
      ) : products.length === 0 ? (
        <div className="empty">{t('shop.empty')}</div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
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
