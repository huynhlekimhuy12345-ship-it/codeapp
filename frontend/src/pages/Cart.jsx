import { Link, useNavigate } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import { useProductName, PName } from '../i18n/TranslatedProduct';

function CartRow({ i }) {
  const { updateQty, removeFromCart } = useStore();
  const { t } = useLang();
  const name = useProductName(i);
  return (
    <div className="cart-row">
      <img src={i.image_url} alt={name}
        onError={(e) => { e.target.src = `https://via.placeholder.com/100?text=${encodeURIComponent(t('fix1.leatherWord'))}`; }} />
      <div>
        <div className="pname"><PName product={i} /></div>
        <div className="pprice">{fmtVND(i.price)}</div>
      </div>
      <div className="qty-row" style={{ margin: 0 }}>
        <button onClick={() => updateQty(i.product_id, i.quantity - 1, i.variant_id)} aria-label={t('cart.decrease')}>−</button>
        <span>{i.quantity}</span>
        <button onClick={() => updateQty(i.product_id, i.quantity + 1, i.variant_id)} aria-label={t('cart.increase')}>+</button>
      </div>
      <div className="line-total" style={{ fontWeight: 700 }}>{fmtVND(i.price * i.quantity)}</div>
      <button className="btn btn-small btn-danger" onClick={() => removeFromCart(i.product_id, i.variant_id)} aria-label={t('cart.remove')}>✕</button>
    </div>
  );
}

export default function Cart() {
  const { cart, clearCart, cartTotal, user } = useStore();
  const { t } = useLang();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="container page">
        <PageTitle title={t('cart.title')} />
        <div className="empty">
          <h3>🛒 {t('cart.emptyTitle')}</h3>
          <p>{t('cart.emptyDesc')}</p>
          <Link to="/cua-hang" className="btn btn-primary">{t('home.shopNow')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">{t('cart.title')}</h1>
      <div className="cart-table">
        {cart.map((i) => (
          <CartRow key={`${i.product_id}|${i.variant_id || 0}`} i={i} />
        ))}
      </div>
      <div className="cart-summary">
        <div className="row"><span>{t('cart.subtotal')}</span><span>{fmtVND(cartTotal)}</span></div>
        <div className="row"><span>{t('cart.shipping')}</span><span>{t('cart.shippingNote')}</span></div>
        <div className="row total"><span>{t('cart.total')}</span><span>{fmtVND(cartTotal)}</span></div>
        <div className="cart-actions">
          <button className="btn btn-outline" onClick={clearCart}>{t('cart.clear')}</button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(user ? '/thanh-toan' : '/dang-nhap')}
          >
            {t('cart.checkout')}
          </button>
        </div>
      </div>
    </div>
  );
}
