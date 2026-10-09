import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtVND } from '../api';
import { useStore } from '../context/StoreContext';

export default function Checkout() {
  const { cart, cartTotal, clearCart, user } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: user?.name || '',
    phone: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (cart.length === 0) return setError('Giỏ hàng trống');
    setLoading(true);
    try {
      const { order } = await api.createOrder({
        ...form,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      clearCart();
      navigate('/don-hang', { state: { newOrderId: order.id } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page">
      <h2 style={{ marginBottom: 20, color: 'var(--brown-800)' }}>Thanh toán</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }} className="checkout-grid">
        <form className="form-card" style={{ maxWidth: 'none', margin: 0 }} onSubmit={submit}>
          <h2>Thông tin giao hàng</h2>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>Họ tên *</label>
            <input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Số điện thoại *</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} required pattern="[0-9+ ]{9,15}" title="Số điện thoại không hợp lệ" />
          </div>
          <div className="field">
            <label>Địa chỉ giao hàng *</label>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} required placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
          </div>
          <div className="field">
            <label>Phương thức thanh toán</label>
            <input value="💵 Thanh toán khi nhận hàng (COD)" disabled />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Đang đặt hàng...' : `Đặt hàng • ${fmtVND(cartTotal)}`}
          </button>
        </form>
        <div className="cart-summary" style={{ margin: 0, maxWidth: 'none' }}>
          <h3 style={{ marginBottom: 12 }}>Đơn hàng của bạn</h3>
          {cart.map((i) => (
            <div className="row" key={i.product_id}>
              <span>{i.name} × {i.quantity}</span>
              <span>{fmtVND(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="row total"><span>Tổng cộng</span><span>{fmtVND(cartTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
