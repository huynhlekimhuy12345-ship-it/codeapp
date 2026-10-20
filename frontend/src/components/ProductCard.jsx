import { Link, useNavigate } from 'react-router-dom';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import { useProductName, useTranslatedText } from '../i18n/TranslatedProduct';

export default function ProductCard({ product }) {
  const { addToCart, buyNowItem, user } = useStore();
  const navigate = useNavigate();
  const { t } = useLang();
  const name = useProductName(product);
  const catName = useTranslatedText(product.category_name);
  const hasVariants = (product.variant_count || 0) > 0;
  const onSale = product.sale_price && product.sale_price < product.price;
  return (
    <div className="product-card">
      <Link to={`/san-pham/${product.id}`} className="thumb">
        <img src={product.image_url} alt={name} loading="lazy"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=Do+Da+Shop'; }} />
        {onSale && <span className="card-badge">-{product.discount_percent}%</span>}
      </Link>
      <div className="info">
        <span className="cat">{catName || t('productCard.defaultCategory')}</span>
        <Link to={`/san-pham/${product.id}`}><h3>{name}</h3></Link>
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
          <div className="btn-pair">
            <button
              className="btn btn-outline btn-small"
              disabled={product.stock <= 0}
              onClick={() => addToCart(product)}
            >
              {t('common.addToCart')}
            </button>
            <button
              className="btn btn-primary btn-small"
              disabled={product.stock <= 0}
              onClick={() => { buyNowItem(product, 1); navigate(user ? '/thanh-toan' : '/dang-nhap'); }}
            >
              {t('common.buyNow')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
