import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useNavigate } from 'react-router-dom';
import { api, fmtVND } from '../api';
import { useStore } from '../context/StoreContext';

const PAYMENT_METHODS = [
  { id: 'cod', label: '💵 Thanh toán khi nhận hàng (COD)', hint: 'Thanh toán tiền mặt khi nhận hàng.' },
  { id: 'bank', label: '🏦 Chuyển khoản ngân hàng', hint: 'Chuyển khoản trước, shop xác nhận sau.' },
  { id: 'momo', label: '📱 Ví MoMo', hint: 'Thanh toán qua ví điện tử MoMo.' },
];

export default function Checkout() {
  const { cart, cartTotal, clearCart, user } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: user?.name || '',
    phone: '',
    address: '',
    note: '',
  });
  // Phương thức vận chuyển (lấy từ server, fee cũng lấy server-side khi đặt đơn)
  const [shipMethods, setShipMethods] = useState([]);
  const [shippingId, setShippingId] = useState(null);
  // Voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [voucher, setVoucher] = useState(null); // { valid, discount }
  const [voucherMsg, setVoucherMsg] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState('cod');
  // Đặt đơn xong (chế độ xem sau khi đặt — hiển thị hướng dẫn chuyển khoản nếu bank)
  const [placedOrder, setPlacedOrder] = useState(null);
  const [proofUrl, setProofUrl] = useState('');
  const [proofSaved, setProofSaved] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getShippingMethods()
      .then(({ methods }) => {
        setShipMethods(methods || []);
        if (methods && methods.length > 0) setShippingId(methods[0].id);
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Tóm tắt đơn: tạm tính + ship - voucher = tổng (fee lấy theo method đã chọn, server tính lại)
  const shipFee = shipMethods.find((m) => m.id === shippingId)?.fee || 0;
  const discount = voucher?.valid ? voucher.discount : 0;
  const grandTotal = Math.max(0, cartTotal + shipFee - discount);

  const applyVoucher = async () => {
    const code = voucherCode.trim();
    if (!code) return;
    setVoucherLoading(true);
    setVoucherMsg('');
    try {
      const r = await api.validateVoucher(code, cartTotal);
      if (r.valid) {
        setVoucher({ valid: true, discount: r.discount });
        setVoucherMsg(`Áp dụng thành công, giảm ${fmtVND(r.discount)}`);
      } else {
        setVoucher(null);
        setVoucherMsg(r.message || 'Mã không hợp lệ');
      }
    } catch (err) {
      setVoucher(null);
      setVoucherMsg(err.message);
    } finally {
      setVoucherLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (cart.length === 0) return setError('Giỏ hàng trống');
    if (!shippingId) return setError('Vui lòng chọn phương thức vận chuyển');
    setLoading(true);
    try {
      const { order } = await api.createOrder({
        customer_name: form.customer_name,
        phone: form.phone,
        address: form.address,
        note: form.note,
        items: cart.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          quantity: i.quantity,
        })),
        shipping_method_id: shippingId,
        voucher_code: voucher?.valid ? voucherCode.trim() : undefined,
        payment_method: paymentMethod,
      });
      if (paymentMethod === 'bank') {
        // Chuyển khoản: giữ màn hình hướng dẫn + ô nhập bằng chứng sau khi đặt đơn
        setPlacedOrder(order);
      } else {
        clearCart();
        navigate('/don-hang', { state: { newOrderId: order.id } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gửi link ảnh bằng chứng chuyển khoản
  const saveProof = async () => {
    if (!proofUrl.trim() || !placedOrder?.payment?.id) return;
    try {
      await api.submitPaymentProof(placedOrder.payment.id, proofUrl.trim());
      setProofSaved(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const cartKey = (i) => `${i.product_id}|${i.variant_id || 0}`;

  // === Màn hình sau khi đặt đơn chuyển khoản ===
  if (placedOrder) {
    return (
      <div className="container page">
        <PageTitle title="Thanh toán" />
        <div className="form-card" style={{ maxWidth: 560 }}>
          <h2>✅ Đặt hàng thành công!</h2>
          <p>Mã đơn hàng: <strong>#{placedOrder.id}</strong> — Tổng: <strong>{fmtVND(placedOrder.total)}</strong></p>
          <h3 style={{ marginTop: 16 }}>Hướng dẫn chuyển khoản</h3>
          <p>Vui lòng chuyển khoản đúng số tiền trên, nội dung: <strong>DH{placedOrder.id}</strong></p>
          <p style={{ color: '#888' }}>Shop sẽ xác nhận thanh toán và gửi hàng sau khi nhận được tiền.</p>
          <div className="field">
            <label htmlFor="checkout-link-anh-bang-chung-chuyen-khoan">Link ảnh bằng chứng chuyển khoản</label>
            <input id="checkout-link-anh-bang-chung-chuyen-khoan"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://... (link ảnh chụp màn hình giao dịch)"
              disabled={proofSaved}
            />
          </div>
          {proofSaved ? (
            <div className="form-success">Đã ghi nhận bằng chứng của bạn. Shop sẽ kiểm tra sớm.</div>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={saveProof}>
              Gửi bằng chứng
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => { clearCart(); navigate('/don-hang', { state: { newOrderId: placedOrder.id } }); }}
          >
            Về đơn hàng của tôi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">Thanh toán</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }} className="checkout-grid">
        <form className="form-card" style={{ maxWidth: 'none', margin: 0 }} onSubmit={submit}>
          <h2>Thông tin giao hàng</h2>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="checkout-ho-ten">Họ tên *</label>
            <input id="checkout-ho-ten" value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="checkout-so-ien-thoai">Số điện thoại *</label>
            <input id="checkout-so-ien-thoai" value={form.phone} onChange={(e) => set('phone', e.target.value)} required pattern="[0-9+ ]{9,15}" title="Số điện thoại không hợp lệ" />
          </div>
          <div className="field">
            <label htmlFor="checkout-ia-chi-giao-hang">Địa chỉ giao hàng *</label>
            <textarea id="checkout-ia-chi-giao-hang" value={form.address} onChange={(e) => set('address', e.target.value)} required placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" />
          </div>
          <div className="field">
            <label htmlFor="checkout-ghi-chu">Ghi chú</label>
            <textarea id="checkout-ghi-chu" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Ghi chú cho shop (tùy chọn)" rows={2} />
          </div>

          <h2 style={{ marginTop: 24 }}>Phương thức vận chuyển</h2>
          {shipMethods.length === 0 && <p className="muted">Đang tải phương thức vận chuyển...</p>}
          {shipMethods.map((m) => (
            <label key={m.id} className="radio-row">
              <input aria-label="Ô nhập"
                type="radio"
                name="shipping"
                checked={shippingId === m.id}
                onChange={() => setShippingId(m.id)}
              />
              <span style={{ flex: 1 }}>
                {m.name}
                {m.eta_days ? <span className="muted"> (dự kiến {m.eta_days} ngày)</span> : null}
              </span>
              <strong>{fmtVND(m.fee)}</strong>
            </label>
          ))}

          <h2 style={{ marginTop: 24 }}>Mã khuyến mãi</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Ô nhập"
              value={voucherCode}
              onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucher(null); setVoucherMsg(''); }}
              placeholder="Nhập mã, ví dụ WELCOME10"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={applyVoucher} disabled={voucherLoading || !voucherCode.trim()}>
              {voucherLoading ? '...' : 'Áp dụng'}
            </button>
          </div>
          {voucherMsg && (
            <div className={voucher?.valid ? 'form-success' : 'form-error'} style={{ marginTop: 8 }}>{voucherMsg}</div>
          )}

          <h2 style={{ marginTop: 24 }}>Phương thức thanh toán</h2>
          {PAYMENT_METHODS.map((m) => (
            <label key={m.id} className="radio-row">
              <input aria-label="Ô nhập"
                type="radio"
                name="payment"
                checked={paymentMethod === m.id}
                onChange={() => setPaymentMethod(m.id)}
              />
              <span style={{ flex: 1 }}>
                {m.label}
                <div className="muted" style={{ fontSize: 13 }}>{m.hint}</div>
              </span>
            </label>
          ))}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
            {loading ? 'Đang đặt hàng...' : `Đặt hàng • ${fmtVND(grandTotal)}`}
          </button>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            Giá ưu đãi khuyến mãi chỉ áp dụng trong thời gian diễn ra chương trình — tổng tiền cuối cùng được tính lại khi đặt hàng.
          </p>
        </form>

        <div className="cart-summary" style={{ margin: 0, maxWidth: 'none' }}>
          <h3 style={{ marginBottom: 12 }}>Đơn hàng của bạn</h3>
          {cart.map((i) => (
            <div className="row" key={cartKey(i)}>
              <span>{i.name} × {i.quantity}</span>
              <span>{fmtVND(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="row"><span>Tạm tính</span><span>{fmtVND(cartTotal)}</span></div>
          <div className="row"><span>Vận chuyển</span><span>{fmtVND(shipFee)}</span></div>
          {discount > 0 && <div className="row"><span>Voucher giảm</span><span>-{fmtVND(discount)}</span></div>}
          <div className="row total"><span>Tổng cộng</span><span>{fmtVND(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
