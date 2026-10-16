import { Link, useNavigate } from 'react-router-dom';
import PageTitle from '../components/PageTitle';
import { fmtVND } from '../api';
import { useStore } from '../context/StoreContext';

export default function Cart() {
  const { cart, updateQty, removeFromCart, clearCart, cartTotal, user } = useStore();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="container page">
        <PageTitle title="Giỏ hàng" />
        <div className="empty">
          <h3>🛒 Giỏ hàng trống</h3>
          <p>Hãy chọn vài món đồ da ưng ý nhé!</p>
          <Link to="/cua-hang" className="btn btn-primary">Mua sắm ngay</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">Giỏ hàng</h1>
      <div className="cart-table">
        {cart.map((i) => (
          <div className="cart-row" key={`${i.product_id}|${i.variant_id || 0}`}>
            <img src={i.image_url} alt={i.name}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=Da'; }} />
            <div>
              <div className="pname">{i.name}</div>
              <div className="pprice">{fmtVND(i.price)}</div>
            </div>
            <div className="qty-row" style={{ margin: 0 }}>
              <button onClick={() => updateQty(i.product_id, i.quantity - 1, i.variant_id)}>−</button>
              <span>{i.quantity}</span>
              <button onClick={() => updateQty(i.product_id, i.quantity + 1, i.variant_id)}>+</button>
            </div>
            <div className="line-total" style={{ fontWeight: 700 }}>{fmtVND(i.price * i.quantity)}</div>
            <button className="btn btn-small btn-danger" onClick={() => removeFromCart(i.product_id, i.variant_id)}>✕</button>
          </div>
        ))}
      </div>
      <div className="cart-summary">
        <div className="row"><span>Tạm tính</span><span>{fmtVND(cartTotal)}</span></div>
        <div className="row"><span>Phí giao hàng</span><span>Tính lúc thanh toán</span></div>
        <div className="row total"><span>Tổng cộng</span><span>{fmtVND(cartTotal)}</span></div>
        <div className="cart-actions">
          <button className="btn btn-outline" onClick={clearCart}>Xóa giỏ</button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(user ? '/thanh-toan' : '/dang-nhap')}
          >
            Thanh toán →
          </button>
        </div>
      </div>
    </div>
  );
}
