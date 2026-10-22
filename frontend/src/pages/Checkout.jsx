import { useEffect, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { useNavigate } from 'react-router-dom';
import { api, fmtVND, fmtDay } from '../api';
import { useStore } from '../context/StoreContext';
import { useLang } from '../i18n/LanguageContext';
import { useTranslatedText, PName } from '../i18n/TranslatedProduct';

const PAYMENT_METHODS = [
  { id: 'cod', labelKey: 'checkout.payCod', hintKey: 'checkout.payCodHint' },
  { id: 'bank', labelKey: 'checkout.payBank', hintKey: 'checkout.payBankHint' },
  { id: 'momo', labelKey: 'checkout.payMomo', hintKey: 'checkout.payMomoHint' },
];

/** Tên phương thức vận chuyển từ DB (tiếng Việt) dịch theo ngôn ngữ. */
function ShipMethodName({ name }) {
  const tname = useTranslatedText(name);
  return tname;
}

export default function Checkout() {
  const { user, selectedItems, selectedTotal, removePurchased } = useStore();
  // Mua ngay: 1 món riêng lưu ở sessionStorage — thanh toán chỉ món đó, không động vào giỏ.
  const [buyItem] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('buyNowItem') || 'null'); } catch { return null; }
  });
  const orderItems = buyItem ? [buyItem] : selectedItems;
  const orderTotal = buyItem ? buyItem.price * buyItem.quantity : selectedTotal;
  const finishPurchase = () => {
    if (buyItem) { try { sessionStorage.removeItem('buyNowItem'); } catch { /* bỏ qua */ } }
    else removePurchased(orderItems);
  };
  const { t } = useLang();
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
  // Thẻ discount theo hạng của khách (chọn thay vì nhập mã; loại trừ lẫn nhau với voucher)
  const [myCards, setMyCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState('cod');
  // Đặt đơn xong (chế độ xem sau khi đặt — hiển thị hướng dẫn chuyển khoản nếu bank)
  const [placedOrder, setPlacedOrder] = useState(null);
  const [proofUrl, setProofUrl] = useState('');
  const [proofSaved, setProofSaved] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Nạp thẻ discount dùng được của khách: mọi thẻ CHƯA DÙNG và CÒN HẠN
  // (thẻ tháng + thẻ săn sale), thẻ sắp hết hạn hiện trước.
  useEffect(() => {
    api.getMyTier()
      .then((d) => {
        const now = Date.now();
        setMyCards((d.cards || [])
          .filter((c) => c.status === 'unused' && c.expires_at && new Date(String(c.expires_at).replace(' ', 'T')).getTime() > now)
          .sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at))));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.getShippingMethods()
      .then(({ methods }) => {
        setShipMethods(methods || []);
        if (methods && methods.length > 0) setShippingId(methods[0].id);
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Tóm tắt đơn: tạm tính + ship - giảm giá = tổng (fee lấy theo method đã chọn, server tính lại)
  const shipFee = shipMethods.find((m) => m.id === shippingId)?.fee || 0;
  // Thẻ hạng: giảm % trên 1 đơn vị giá cao nhất trong đơn
  const maxUnitPrice = orderItems.reduce((m, i) => Math.max(m, i.price || 0), 0);
  const cardDiscount = selectedCard ? Math.floor((maxUnitPrice * selectedCard.percent) / 100) : 0;
  const discount = voucher?.valid ? voucher.discount : cardDiscount;
  const grandTotal = Math.max(0, orderTotal + shipFee - discount);

  // Chọn/bỏ chọn thẻ: chọn thẻ thì xóa trạng thái voucher (chỉ dùng 1 loại ưu đãi)
  const pickCard = (c) => {
    if (selectedCard?.id === c.id) { setSelectedCard(null); return; }
    setSelectedCard(c);
    setVoucher(null);
    setVoucherMsg('');
  };

  const applyVoucher = async () => {
    const code = voucherCode.trim();
    if (!code) return;
    setVoucherLoading(true);
    setVoucherMsg('');
    try {
      const r = await api.validateVoucher(code, orderTotal);
      if (r.valid) {
        setVoucher({ valid: true, discount: r.discount });
        setSelectedCard(null); // áp voucher thành công thì bỏ chọn thẻ
        setVoucherMsg(t('checkout.voucherOk', { amount: fmtVND(r.discount) }));
      } else {
        setVoucher(null);
        setVoucherMsg(r.message || t('checkout.voucherInvalid'));
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
    if (orderItems.length === 0) return setError(t('checkout.emptyCart'));
    if (!shippingId) return setError(t('checkout.pickShipping'));
    setLoading(true);
    try {
      const { order } = await api.createOrder({
        customer_name: form.customer_name,
        phone: form.phone,
        address: form.address,
        note: form.note,
        items: orderItems.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          quantity: i.quantity,
        })),
        shipping_method_id: shippingId,
        voucher_code: voucher?.valid ? voucherCode.trim() : undefined,
        discount_card_code: selectedCard ? selectedCard.code : undefined,
        payment_method: paymentMethod,
      });
      if (paymentMethod === 'bank') {
        // Chuyển khoản: giữ màn hình hướng dẫn + ô nhập bằng chứng sau khi đặt đơn
        setPlacedOrder(order);
      } else {
        finishPurchase();
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
        <PageTitle title={t('checkout.title')} />
        <div className="form-card" style={{ maxWidth: 560 }}>
          <h2>{t('checkout.orderSuccess')}</h2>
          <p>{t('checkout.orderCode')} <strong>#{placedOrder.id}</strong> — {t('checkout.total')}: <strong>{fmtVND(placedOrder.total)}</strong></p>
          <h3 style={{ marginTop: 16 }}>{t('checkout.bankGuide')}</h3>
          <p>{t('checkout.bankTransferNote')} <strong>DH{placedOrder.id}</strong></p>
          <p style={{ color: '#888' }}>{t('checkout.bankWait')}</p>
          <div className="field">
            <label htmlFor="checkout-link-anh-bang-chung-chuyen-khoan">{t('checkout.proofLabel')}</label>
            <input id="checkout-link-anh-bang-chung-chuyen-khoan"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder={t('checkout.proofPlaceholder')}
              disabled={proofSaved}
            />
          </div>
          {proofSaved ? (
            <div className="form-success">{t('checkout.proofSaved')}</div>
          ) : (
            <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={saveProof}>
              {t('checkout.sendProof')}
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => { finishPurchase(); navigate('/don-hang', { state: { newOrderId: placedOrder.id } }); }}
          >
            {t('checkout.myOrders')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">{t('checkout.title')}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }} className="checkout-grid">
        <form className="form-card" style={{ maxWidth: 'none', margin: 0 }} onSubmit={submit}>
          <h2>{t('checkout.shippingInfo')}</h2>
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label htmlFor="checkout-ho-ten">{t('checkout.fullName')}</label>
            <input id="checkout-ho-ten" value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="checkout-so-ien-thoai">{t('checkout.phone')}</label>
            <input id="checkout-so-ien-thoai" value={form.phone} onChange={(e) => set('phone', e.target.value)} required pattern="[0-9+ ]{9,15}" title={t('checkout.phoneInvalid')} />
          </div>
          <div className="field">
            <label htmlFor="checkout-ia-chi-giao-hang">{t('checkout.address')}</label>
            <textarea id="checkout-ia-chi-giao-hang" value={form.address} onChange={(e) => set('address', e.target.value)} required placeholder={t('checkout.addressPlaceholder')} />
          </div>
          <div className="field">
            <label htmlFor="checkout-ghi-chu">{t('checkout.note')}</label>
            <textarea id="checkout-ghi-chu" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder={t('checkout.notePlaceholder')} rows={2} />
          </div>

          <h2 style={{ marginTop: 24 }}>{t('checkout.shipMethod')}</h2>
          {shipMethods.length === 0 && <p className="muted">{t('checkout.loadingShip')}</p>}
          {shipMethods.map((m) => (
            <label key={m.id} className="radio-row">
              <input aria-label={t('fix1.radioOption')}
                type="radio"
                name="shipping"
                checked={shippingId === m.id}
                onChange={() => setShippingId(m.id)}
              />
              <span style={{ flex: 1 }}>
                <ShipMethodName name={m.name} />
                {m.eta_days ? <span className="muted"> {t('checkout.etaDays', { days: m.eta_days })}</span> : null}
              </span>
              <strong>{fmtVND(m.fee)}</strong>
            </label>
          ))}

          <h2 style={{ marginTop: 24 }}>{t('checkout.voucher')}</h2>
          <div className="voucher-row">
            <span className="voucher-icon" aria-hidden="true">🎟️</span>
            <input aria-label={t('checkout.voucher')}
              value={voucherCode}
              onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucher(null); setVoucherMsg(''); }}
              placeholder={t('checkout.voucherPlaceholder')}
              disabled={!!selectedCard}
            />
            <button type="button" className="btn btn-primary" onClick={applyVoucher} disabled={voucherLoading || !voucherCode.trim() || !!selectedCard}>
              {voucherLoading ? '...' : t('checkout.apply')}
            </button>
          </div>
          {voucherMsg && (
            <div className={voucher?.valid ? 'form-success' : 'form-error'} style={{ marginTop: 8 }}>{voucherMsg}</div>
          )}

          {myCards.length > 0 && (
            <div className="checkout-cards">
              <div className="checkout-cards-title">🎟️ {t('tier.myCards')}</div>
              <div
                className={`checkout-card-option${!selectedCard ? ' selected' : ''}`}
                role="radio"
                aria-checked={!selectedCard}
                tabIndex={0}
                onClick={() => setSelectedCard(null)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCard(null); } }}
              >
                <span>{t('tier.noCard')}</span>
                {!selectedCard && <span className="checkout-card-check">✓</span>}
              </div>
              {myCards.map((c) => (
                <div
                  key={c.id}
                  className={`checkout-card-option${selectedCard?.id === c.id ? ' selected' : ''}`}
                  role="radio"
                  aria-checked={selectedCard?.id === c.id}
                  tabIndex={0}
                  onClick={() => pickCard(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickCard(c); } }}
                >
                  <span aria-hidden="true">{c.source === 'hunt' ? '🎯' : '🎟️'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="card-code">{c.code}</span>
                    {' • '}{c.source === 'hunt' ? t('tier.huntBadge') : t(`tier.name.${c.tier}`)}
                    {' • '}{t('tier.cardExpiry', { date: fmtDay(c.expires_at) })}
                  </span>
                  <span className="card-off">−{c.percent}%</span>
                  {selectedCard?.id === c.id && <span className="checkout-card-check">✓</span>}
                </div>
              ))}
              {selectedCard && (
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t('tier.oneDiscountOnly')}</p>
              )}
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>{t('checkout.payMethod')}</h2>
          {PAYMENT_METHODS.map((m) => (
            <label key={m.id} className="radio-row">
              <input aria-label={t('fix1.radioOption')}
                type="radio"
                name="payment"
                checked={paymentMethod === m.id}
                onChange={() => setPaymentMethod(m.id)}
              />
              <span style={{ flex: 1 }}>
                {t(m.labelKey)}
                <div className="muted" style={{ fontSize: 13 }}>{t(m.hintKey)}</div>
              </span>
            </label>
          ))}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
            {loading ? t('checkout.placing') : t('checkout.placeOrder', { total: fmtVND(grandTotal) })}
          </button>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            {t('checkout.priceNote')}
          </p>
        </form>

        <div className="cart-summary" style={{ margin: 0, maxWidth: 'none' }}>
          <h3 style={{ marginBottom: 12 }}>{t('checkout.yourOrder')}</h3>
          {orderItems.map((i) => (
            <div className="row" key={cartKey(i)}>
              <span><PName product={i} /> × {i.quantity}</span>
              <span>{fmtVND(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="row"><span>{t('cart.subtotal')}</span><span>{fmtVND(orderTotal)}</span></div>
          <div className="row"><span>{t('checkout.shipping')}</span><span>{fmtVND(shipFee)}</span></div>
          {discount > 0 && (
            <div className="row">
              <span>{voucher?.valid ? t('checkout.voucherDiscount') : t('tier.cardDiscount')}</span>
              <span>-{fmtVND(discount)}</span>
            </div>
          )}
          <div className="row total"><span>{t('cart.total')}</span><span>{fmtVND(grandTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
