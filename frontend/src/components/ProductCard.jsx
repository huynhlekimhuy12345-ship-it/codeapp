import { Link } from 'react-router-dom';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';

export default function ProductCard({ product }) {
  const { addToCart } = useStore();
  return (
    <div className="product-card">
      <Link to={`/san-pham/${product.id}`} className="thumb">
        <img src={product.image_url} alt={product.name} loading="lazy"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=Do+Da+Shop'; }} />
      </Link>
      <div className="info">
        <span className="cat">{product.category_name || 'Đồ da'}</span>
        <Link to={`/san-pham/${product.id}`}><h3>{product.name}</h3></Link>
        <div className="price">{fmtVND(product.price)}</div>
        <div className={`stock ${product.stock <= 5 ? 'low' : ''}`}>
          {product.stock > 0 ? (product.stock <= 5 ? `Chỉ còn ${product.stock}` : 'Còn hàng') : 'Hết hàng'}
        </div>
        <button
          className="btn btn-primary btn-small"
          disabled={product.stock <= 0}
          onClick={() => addToCart(product)}
        >
          🛒 Thêm vào giỏ
        </button>
      </div>
    </div>
  );
}
