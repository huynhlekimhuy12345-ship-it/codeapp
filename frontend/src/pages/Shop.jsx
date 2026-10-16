import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';

const LIMIT = 12;

export default function Shop() {
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
    const t = setTimeout(() => {
      setLoading(true);
      api.getProducts({ category, search, sort, page, limit: LIMIT, min_price: minPrice || undefined, max_price: maxPrice || undefined })
        .then((d) => { setProducts(d.products); setTotalPages(d.totalPages); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250); // debounce tìm kiếm
    return () => clearTimeout(t);
  }, [category, search, sort, page, minPrice, maxPrice]);

  const pickCategory = (id) => {
    setSearchParams(id ? { category: id } : {});
  };

  return (
    <div className="container page">
      <PageTitle title="Cửa hàng" />
      <h1 className="page-title">Cửa hàng</h1>
      <div className="filters">
        <input
          className="search" placeholder="🔍 Tìm ví da, túi xách..." aria-label="Tìm kiếm sản phẩm"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={category} onChange={(e) => pickCategory(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sắp xếp">
          <option value="">Sắp xếp</option>
          <option value="newest">Mới nhất</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
          <option value="name">Tên A–Z</option>
        </select>
        <input
          className="price-filter" type="number" min="0" placeholder="Giá từ" aria-label="Giá thấp nhất"
          value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
        />
        <input
          className="price-filter" type="number" min="0" placeholder="Đến" aria-label="Giá cao nhất"
          value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
        />
      </div>

      {loading ? (
        <div className="empty">Đang tải sản phẩm...</div>
      ) : products.length === 0 ? (
        <div className="empty">Không tìm thấy sản phẩm nào phù hợp.</div>
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
