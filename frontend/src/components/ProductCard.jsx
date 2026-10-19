import { Link } from 'react-router-dom';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';

export default function ProductCard({ product }) {
  const { addToCart } = useStore();
  const { t } = useLang();
  const hasVariants = (product.variant_count || 0) > 0;
  const onSale = product.sale_price && product.sale_price < product.price;
  return (
    <div className="product-card">
      <Link to={`/san-pham/${product.id}`} className="thumb">
        <img src={product.image_url} alt={product.name} loading="lazy"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=Do+Da+Shop'; }} />
        {onSale && <span className="card-badge">-{product.discount_percent}%</span>}
      </Link>
      <div className="info">
        <span className="cat">{product.category_name || t('productCard.defaultCategory')}</span>
        <Link to={`/san-pham/${product.id}`}><h3>{product.name}</h3></Link>
        {onSale ? (
          <div className="price"><s className="old-price">{fmtVND(product.price)}</s> <span className="sale-price">{fmtVND(product.sale_price)}</span></div>
        ) : (
          <div className="price">{fmtVND(product.price)}</div>
        )}
        <div className={`stock ${product.stock <= 5 ? 'low' : ''}`}>
          {product.stock > 0 ? (product.stock <= 5 ? t('productCard.onlyLeft', { count: product.stock }) : t('productCard.inStock')) : t('productCard.outOfStock')}
        </div>
        {hasVariants ? (
          <Link to={`/san-pham/${product.id}`} className="btn btn-primary btn-small">
            {t('productCard.chooseVariant')}
          </Link>
        ) : (
          <button
            className="btn btn-primary btn-small"
            disabled={product.stock <= 0}
            onClick={() => addToCart(product)}
          >
            {t('common.addToCart')}
          </button>
        )}
      </div>
    </div>
  );
}
