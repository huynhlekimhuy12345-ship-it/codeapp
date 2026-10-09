import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getProducts({ limit: 8 }).then((d) => setProducts(d.products)).catch(() => {});
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  return (
    <>
      <div className="hero">
        <div className="container">
          <h1>Đồ da thật <em>cao cấp</em>,<br />bền đẹp theo năm tháng</h1>
          <p>Ví da, túi xách, thắt lưng, giày da và phụ kiện làm từ da bò thật 100% — khâu tay tỉ mỉ, bảo hành 12 tháng.</p>
          <Link to="/cua-hang" className="btn btn-primary">Mua sắm ngay</Link>
          <Link to="/cua-hang" className="btn btn-outline" style={{ color: '#f5ead8', borderColor: '#f5ead8' }}>Xem danh mục</Link>
        </div>
      </div>

      <div className="container">
        <div className="section">
          <div className="section-head">
            <h2>Danh mục nổi bật</h2>
          </div>
          <div className="cat-grid">
            {categories.map((c) => (
              <Link key={c.id} to={`/cua-hang?category=${c.id}`} className="cat-card">
                👜 {c.name}
                <small>{c.description?.slice(0, 40)}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-head">
            <h2>Sản phẩm nổi bật</h2>
            <Link to="/cua-hang" className="link-more">Xem tất cả →</Link>
          </div>
          <div className="product-grid">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>

        <div className="section">
          <div className="section-head"><h2>Vì sao chọn chúng tôi?</h2></div>
          <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            <div className="cat-card">🐄 Da thật 100%<small>Cam kết hoàn tiền nếu phát hiện da giả</small></div>
            <div className="cat-card">🧵 Khâu tay thủ công<small>Tỉ mỉ từng đường kim mũi chỉ</small></div>
            <div className="cat-card">🛡️ Bảo hành 12 tháng<small>Miễn phí sửa chữa, đánh bóng</small></div>
            <div className="cat-card">🚚 COD toàn quốc<small>Thanh toán khi nhận hàng, kiểm tra trước</small></div>
          </div>
        </div>
      </div>
    </>
  );
}
