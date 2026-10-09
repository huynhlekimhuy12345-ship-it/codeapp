import { useEffect, useState } from 'react';
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
      api.getProducts({ category, search, sort, page, limit: LIMIT })
        .then((d) => { setProducts(d.products); setTotalPages(d.totalPages); })
        .catch(() => {});
    }, 250); // debounce tìm kiếm
    return () => clearTimeout(t);
  }, [category, search, sort, page]);

  const pickCategory = (id) => {
    setSearchParams(id ? { category: id } : {});
  };

  return (
    <div className="container page">
      <h2 style={{ marginBottom: 20, color: 'var(--brown-800)' }}>Cửa hàng</h2>
      <div className="filters">
        <input
          className="search" placeholder="🔍 Tìm ví da, túi xách..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={category} onChange={(e) => pickCategory(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="">Sắp xếp</option>
          <option value="newest">Mới nhất</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
          <option value="name">Tên A–Z</option>
        </select>
      </div>

      {products.length === 0 ? (
        <div className="empty">Không tìm thấy sản phẩm nào phù hợp.</div>
      ) : (
        <div className="product-grid">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
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
