import { useEffect, useMemo, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import { useProductName, useProductDesc, useTranslatedText } from '../i18n/TranslatedProduct';
import ProductCard from '../components/ProductCard';
import ProductReviews from '../components/ProductReviews';

export default function ProductDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const PLACEHOLDER = `https://via.placeholder.com/600?text=${encodeURIComponent(t('fix1.placeholderText'))}`;
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [selColor, setSelColor] = useState('');
  const [selSize, setSelSize] = useState('');
  const [mainIdx, setMainIdx] = useState(0);
  const { addToCart, buyNowItem, user } = useStore();
  const navigate = useNavigate();
  const name = useProductName(product);
  const desc = useProductDesc(product);
  const catName = useTranslatedText(product?.category_name);

  useEffect(() => {
    api.getProduct(id).then(({ product }) => {
      setProduct(product);
      setQty(1);
      setMainIdx(0);
      // Chọn mặc định biến thể đầu tiên (nếu SP có variant)
      const vs = product.variants || [];
      if (vs.length > 0) {
        setSelColor(vs[0].color || '');
        setSelSize(vs[0].size || '');
      } else {
        setSelColor('');
        setSelSize('');
      }
      if (product.category_id) {
        api.getProducts({ category: product.category_id, limit: 4 })
          .then((d) => setRelated(d.products.filter((p) => p.id !== product.id).slice(0, 4)))
          .catch(() => {});
      }
    }).catch(() => setProduct(false));
  }, [id]);

  // ===== Biến thể: danh sách màu/size và variant đang chọn =====
  const variants = product && product.variants ? product.variants : [];
  const hasVariants = variants.length > 0;

  const colors = useMemo(
    () => [...new Set(variants.map((v) => v.color || '').filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product]
  );
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size || '').filter(Boolean))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product]
  );

  const findVariant = (color, size) =>
    variants.find((v) => (v.color || '') === (color || '') && (v.size || '') === (size || '')) || null;

  const selectedVariant = hasVariants ? findVariant(selColor, selSize) : null;

  // Giá = giá gốc + price_delta của variant đã chọn; tồn kho theo variant
  const basePrice = product ? (product.sale_price && product.sale_price < product.price ? product.sale_price : product.price) : 0;
  const unitPrice = product ? basePrice + (selectedVariant ? selectedVariant.price_delta : 0) : 0;
  const onSale = product && product.sale_price && product.sale_price < product.price;
  const maxStock = hasVariants ? (selectedVariant ? selectedVariant.stock : 0) : (product ? product.stock : 0);

  // Đổi màu: nếu size hiện tại không còn tồn tại với màu mới thì chọn size đầu tiên của màu đó
  const pickColor = (c) => {
    setSelColor(c);
    if (!findVariant(c, selSize)) {
      const first = variants.find((v) => (v.color || '') === (c || ''));
      setSelSize(first ? first.size || '' : '');
    }
    setMainIdx(0);
  };
  const pickSize = (s) => { setSelSize(s); setMainIdx(0); };

  // ===== Gallery: ảnh chung + ảnh riêng của variant đang chọn =====
  const images = product && product.images ? product.images : [];
  const galleryImages = useMemo(() => {
    const list = images.filter(
      (img) => !img.variant_id || (selectedVariant && img.variant_id === selectedVariant.id)
    );
    const urls = list.map((img) => img.image_url).filter(Boolean);
    // Fallback về image_url cũ nếu thư viện trống
    if (urls.length === 0 && product && product.image_url) return [product.image_url];
    return urls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, selectedVariant]);
  const mainImage = galleryImages[Math.min(mainIdx, galleryImages.length - 1)] || PLACEHOLDER;

  // ===== Thêm vào giỏ =====
  // SP có variant → gửi object mở rộng theo contract W1/W3:
  // { product_id, variant_id, variant_sku, name, price (đã gồm delta), image, quantity }
  // SP không variant → giữ nguyên hành vi cũ addToCart(product, qty).
  // Dựng dòng hàng theo biến thể đã chọn (dùng chung cho Thêm giỏ + Mua ngay)
  const buildItem = () => {
    if (hasVariants) {
      if (!selectedVariant || selectedVariant.stock <= 0) return null;
      const parts = [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / ');
      return {
        id: product.id,
        product_id: product.id,
        variant_id: selectedVariant.id,
        variant_sku: selectedVariant.sku,
        name: parts ? `${product.name} — ${parts}` : product.name,
        price: unitPrice,
        image_url: mainImage,
        image: mainImage,
        quantity: qty,
      };
    }
    return { ...product, quantity: qty };
  };

  const handleAddToCart = () => {
    const item = buildItem();
    if (item) addToCart(item, qty);
  };

  // Mua ngay: đi thẳng tới thanh toán chỉ với món này, giỏ hàng giữ nguyên
  const handleBuyNow = () => {
    const item = buildItem();
    if (!item) return;
    buyNowItem(item, qty);
    navigate(user ? '/thanh-toan' : '/dang-nhap');
  };

  if (product === null) return <div className="container page"><div className="empty">{t('common.loading')}</div></div>;
  if (product === false) return <div className="container page"><div className="empty">{t('productDetail.notFound')} <Link to="/cua-hang" className="btn">{t('productDetail.backToShop')}</Link></div></div>;

  // Loại sản phẩm (đoán từ tên + danh mục) — chọn bộ nội dung mô tả phù hợp ở cột phải
  const specKind = (() => {
    const h = `${product.name || ''} ${product.category_name || ''}`.toLowerCase();
    if (h.includes('đồng hồ')) return 'watch';
    if (h.includes('thắt lưng') || h.includes('dây lưng')) return 'belt';
    if (h.includes('giày') || h.includes('dép')) return 'shoes';
    if (h.includes('ví')) return 'wallet';
    if (h.includes('túi') || h.includes('cặp')) return 'bag';
    if (h.includes('phụ kiện')) return 'accessory';
    return 'generic';
  })();

  return (
    <div className="container page">
      <PageTitle title={t('productDetail.title')} />
      <button
        className="btn btn-outline btn-small"
        style={{ marginBottom: 14 }}
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/cua-hang'))}
      >
        {t('shop.back')}
      </button>
      <div className="detail">
        <div className="detail-media">
          <img src={mainImage} alt={name}
            onError={(e) => { e.target.src = PLACEHOLDER; }} />
          {galleryImages.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {galleryImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${name} ${i + 1}`}
                  onError={(e) => { e.target.src = PLACEHOLDER; }}
                  onClick={() => setMainIdx(i)}
                  style={{
                    width: 64, height: 64, objectFit: 'cover', borderRadius: 8,
                    cursor: 'pointer', border: i === mainIdx ? '2px solid #f5c97b' : '2px solid transparent',
                    opacity: i === mainIdx ? 1 : 0.75,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <span className="cat" style={{ fontSize: '.85rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
            {catName}
          </span>
          <h1>{name}</h1>
          {onSale ? (
            <div className="price"><s className="old-price">{fmtVND(product.price)}</s> <span className="sale-price">{fmtVND(basePrice)}</span> <span className="card-badge" style={{ position: 'static' }}>-{product.discount_percent}%</span></div>
          ) : (
            <div className="price">{fmtVND(unitPrice)}</div>
          )}
          {hasVariants && selectedVariant && selectedVariant.price_delta !== 0 && (
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
              {t('productDetail.basePrice')} {fmtVND(product.price)}
              {selectedVariant.price_delta > 0 ? ` + ${fmtVND(selectedVariant.price_delta)}` : ` − ${fmtVND(-selectedVariant.price_delta)}`}
              {' '}({selectedVariant.sku})
            </div>
          )}
          {hasVariants && (
            <>
              {colors.length > 0 && (
                <div style={{ margin: '10px 0' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('productDetail.color')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => pickColor(c)}
                        className={c === selColor ? 'btn btn-primary btn-small' : 'btn btn-small'}
                        style={c === selColor ? {} : { background: 'transparent', border: '1px solid var(--border, #ccc)' }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sizes.length > 0 && (
                <div style={{ margin: '10px 0' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('productDetail.size')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sizes.map((s) => {
                      const v = findVariant(selColor, s);
                      const active = s === selSize;
                      return (
                        <button
                          key={s}
                          onClick={() => pickSize(s)}
                          disabled={!v}
                          className={active ? 'btn btn-primary btn-small' : 'btn btn-small'}
                          style={active ? {} : { background: 'transparent', border: '1px solid var(--border, #ccc)' }}
                          title={v ? (v.stock > 0 ? t('productCard.onlyLeft', { count: v.stock }) : t('productCard.outOfStock')) : t('productDetail.noVariant')}
                        >
                          {s}{v && v.stock <= 0 ? t('productDetail.outSuffix') : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ color: maxStock > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {maxStock > 0 ? t('productDetail.stockLeft', { count: maxStock }) : t('productCard.outOfStock')}
          </div>
          <div className="qty-row">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(Math.max(maxStock, 1), q + 1))}>+</button>
          </div>
          <div className="btn-pair">
            <button
              className="btn btn-outline"
              disabled={maxStock <= 0 || (hasVariants && !selectedVariant)}
              onClick={handleAddToCart}
            >
              {t('productDetail.addToCart')}
            </button>
            <button
              className="btn btn-primary"
              disabled={maxStock <= 0 || (hasVariants && !selectedVariant)}
              onClick={handleBuyNow}
            >
              {t('common.buyNow')}
            </button>
          </div>

          {/* Mô tả sản phẩm — nằm ngay trong cột phải dưới nút mua (không còn mục riêng phía dưới) */}
          <div className="desc-block">
            <h2 className="desc-title">📝 {t('productDetail.descTitle')}</h2>
            {desc && <p className="desc-text">{desc}</p>}
            <div className="spec-rows">
              {[
                ['🐄', 'materialT', t('productDetail.spec.material.' + specKind)],
                ['📍', 'madeT', t('productDetail.spec.made')],
                ['🧭', 'useT', t('productDetail.spec.use.' + specKind)],
                ['🛡️', 'careT', t('productDetail.spec.care')],
                ['✨', 'beautyT', t('productDetail.spec.beauty.' + specKind)],
              ].map(([icon, tk, text]) => (
                <div key={tk} className="spec-rowc">
                  <span className="spec-icon" aria-hidden>{icon}</span>
                  <div>
                    <strong>{t('productDetail.spec.' + tk)}</strong>
                    <span>{text}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/gioi-thieu" className="spec-link">{t('productDetail.spec.processLink')} ›</Link>
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {related.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>{t('productDetail.related')}</h2></div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
