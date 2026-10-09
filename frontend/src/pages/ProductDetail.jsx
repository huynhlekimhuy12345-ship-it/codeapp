import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const { addToCart } = useStore();

  useEffect(() => {
    api.getProduct(id).then(({ product }) => {
      setProduct(product);
      setQty(1);
      if (product.category_id) {
        api.getProducts({ category: product.category_id, limit: 4 })
          .then((d) => setRelated(d.products.filter((p) => p.id !== product.id).slice(0, 4)))
          .catch(() => {});
      }
    }).catch(() => setProduct(false));
  }, [id]);

  if (product === null) return <div className="container page"><div className="empty">Đang tải...</div></div>;
  if (product === false) return <div className="container page"><div className="empty">Không tìm thấy sản phẩm. <Link to="/cua-hang" className="btn">Về cửa hàng</Link></div></div>;

  return (
    <div className="container page">
      <div className="detail">
        <img src={product.image_url} alt={product.name}
          onError={(e) => { e.target.src = 'https://via.placeholder.com/600?text=Do+Da+Shop'; }} />
        <div>
          <span className="cat" style={{ fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
            {product.category_name}
          </span>
          <h1>{product.name}</h1>
          <div className="price">{fmtVND(product.price)}</div>
          <p className="desc">{product.description}</p>
          <div style={{ color: product.stock > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}
          </div>
          <div className="qty-row">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
          </div>
          <button
            className="btn btn-primary"
            disabled={product.stock <= 0}
            onClick={() => addToCart(product, qty)}
          >
            🛒 Thêm vào giỏ hàng
          </button>
        </div>
      </div>

      {related.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Sản phẩm liên quan</h2></div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
