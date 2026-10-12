import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';

const LIMIT = 12;

// Gọi endpoint nhẹ /:id/variants để biết SP có bao nhiêu màu/size.
// Không sửa API list cũ, không ảnh hưởng filter/sort/phân trang hiện có.
async function fetchVariantSummary(productId) {
  const res = await fetch(`/api/products/${productId}/variants`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.variants || [];
}

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  // productId -> { colors: [...], sizes: [...] }, chỉ set khi SP có variant
  const [variantInfo, setVariantInfo] = useState({});

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

  // Tải thông tin biến thể cho từng SP đang hiển thị (song song, bỏ qua lỗi)
  useEffect(() => {
    if (products.length === 0) { setVariantInfo({}); return; }
    let alive = true;
    Promise.allSettled(products.map((p) => fetchVariantSummary(p.id)))
      .then((results) => {
        if (!alive) return;
        const info = {};
        results.forEach((r, i) => {
          if (r.status !== 'fulfilled' || !r.value || r.value.length === 0) return;
          const variants = r.value;
          info[products[i].id] = {
            colors: [...new Set(variants.map((v) => v.color).filter(Boolean))],
            sizes: [...new Set(variants.map((v) => v.size).filter(Boolean))],
          };
        });
        setVariantInfo(info);
      });
    return () => { alive = false; };
  }, [products]);

  const pickCategory = (id) => {
    setSearchParams(id ? { category: id } : {});
  };

  return (
    <div className="container page">
      <h2 className="page-title">Cửa hàng</h2>
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
          {products.map((p) => {
            const vi = variantInfo[p.id];
            const badge = vi ? `${vi.colors.length} màu / ${vi.sizes.length} size` : null;
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                <ProductCard product={p} />
                {badge && (
                  <span
                    title="Sản phẩm có nhiều biến thể màu sắc / kích thước"
                    style={{
                      position: 'absolute', top: 10, right: 10, zIndex: 2,
                      background: 'rgba(20,12,6,.88)', color: '#f5c97b',
                      border: '1px solid rgba(245,201,123,.5)', borderRadius: 999,
                      padding: '4px 10px', fontSize: '.75rem', fontWeight: 700,
                      pointerEvents: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    🎨 {badge}
                  </span>
                )}
              </div>
            );
          })}
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
