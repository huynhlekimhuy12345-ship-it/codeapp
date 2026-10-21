import { useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api, fmtVND, fmtDate } from '../api';
import { useLang } from '../i18n/LanguageContext';
import { useProductName } from '../i18n/TranslatedProduct';
import { fileToCompressedDataUrl } from '../utils/image';

// Ô chọn ảnh minh họa cho yêu cầu hậu mãi: bắt buộc 1–3 ảnh chụp tình trạng sản phẩm,
// ảnh được nén nhỏ ngay trên trình duyệt trước khi gửi kèm đơn.
function ImagePicker({ images, setImages, t, onError }) {
  const pick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const room = 3 - images.length;
    if (room <= 0) { onError(t('myOrders.imagesMax')); return; }
    const out = [...images];
    for (const f of files.slice(0, room)) {
      try { out.push(await fileToCompressedDataUrl(f)); }
      catch { onError(t('myOrders.imageBad')); }
    }
    setImages(out);
  };
  return (
    <div className="field">
      <label>{t('myOrders.imagesLabel')}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {images.map((src, i) => (
          <span key={i} style={{ position: 'relative', width: 64, height: 64, display: 'inline-block' }}>
            <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--panel-border)' }} />
            <button type="button" aria-label="✕"
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#b3261e', color: '#fff', cursor: 'pointer', lineHeight: 1, fontSize: '.72rem', padding: 0 }}>✕</button>
          </span>
        ))}
        {images.length < 3 && (
          <label style={{ width: 64, height: 64, borderRadius: 8, border: '1.5px dashed rgba(232,181,106,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--amber-light)', margin: 0 }}>
            +
            <input type="file" accept="image/*" multiple hidden onChange={pick} />
          </label>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 6 }}>{t('myOrders.imagesHint')}</p>
    </div>
  );
}

// Nhãn phương thức thanh toán (khớp backend routes/orders.js) — qua i18n

// Gọi API có auth — bản rút gọn dùng riêng trong trang này cho các route mới
// (không sửa api.js dùng chung để tránh xung đột với các trang khác)
async function authFetch(path, { method = 'GET', body } = {}, t) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t('fix1.errorGeneric'));
  return data;
}

// Thông báo nổi trong trang (thay alert/toast ngoài — codebase không có toast dùng chung)
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
        background: toast.isErr ? '#b3261e' : '#2e7d32', color: '#fff',
        padding: '12px 20px', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.25)',
        zIndex: 9999, cursor: 'pointer', maxWidth: '90vw', fontSize: '.95rem',
      }}
    >
      {toast.msg}
    </div>
  );
}

/** Một dòng hàng trong chi tiết đơn: tên SP dịch theo ngôn ngữ. */
function OrderItemRow({ i }) {
  const name = useProductName({ name: i.product_name });
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span>{name} × {i.quantity}</span>
      <span>{fmtVND(i.price * i.quantity)}</span>
    </div>
  );
}

function OrderDetail({ id }) {
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  useEffect(() => {
    api.getOrder(id).then(({ order }) => setOrder(order)).catch(() => {});
  }, [id]);
  if (!order) return <div>{t('common.loading')}</div>;
  // Tạm tính từ các dòng hàng (chỉ để hiển thị chi tiết — server mới là nguồn tính toán)
  const subtotal = order.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
  return (
    <div>
      <p><strong>{t('myOrders.recipient')}</strong> {order.customer_name} • {order.phone}</p>
      <p><strong>{t('myOrders.address')}</strong> {order.address}</p>
      <p><strong>{t('myOrders.orderDate')}</strong> {fmtDate(order.created_at)}</p>
      <p><strong>{t('myOrders.payment')}</strong> {t('checkout.pay' + order.payment_method[0].toUpperCase() + order.payment_method.slice(1)) || order.payment_method}</p>
      <div className="order-items">
        {order.items.map((i) => (
          <OrderItemRow key={i.id} i={i} />
        ))}
      </div>
      {/* Chi tiết tiền: tạm tính + phí ship - giảm giá voucher = tổng */}
      <div style={{ fontSize: '.9rem', color: 'var(--muted)', marginTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>{t('cart.subtotal')}</span><span>{fmtVND(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>{t('checkout.shipping')}</span><span>{fmtVND(order.shipping_fee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>{t('checkout.voucherDiscount')}</span><span>-{fmtVND(order.discount_total)}</span>
        </div>
      </div>
      <div className="order-total">{t('myOrders.total')} {fmtVND(order.total)}</div>
    </div>
  );
}

export default function MyOrders() {
  const { t } = useLang();
  const [orders, setOrders] = useState([]);
  const [openId, setOpenId] = useState(null);

  // Hủy đơn: đơn đang chọn + lý do nhập trong dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  // Yêu cầu đổi/trả: đơn đang chọn + hình thức (đổi/trả) + lý do + ảnh minh họa
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnType, setReturnType] = useState('return');
  const [returnReason, setReturnReason] = useState('');
  const [returnImages, setReturnImages] = useState([]);
  // Yêu cầu bảo hành: đơn đang chọn + lý do + ảnh minh họa
  // (thời hạn bảo hành do shop quyết định khi duyệt, khách không chọn)
  const [warrantyTarget, setWarrantyTarget] = useState(null);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [warrantyImages, setWarrantyImages] = useState([]);
  // Toast thông báo trong trang
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, isErr = false) => {
    setToast({ msg, isErr });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const load = () => api.getOrders().then((d) => setOrders(d.orders)).catch(() => {});

  useEffect(() => {
    load();
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  // Khách tự hủy đơn đang chờ xác nhận → PUT /api/orders/:id/cancel
  const doCancel = async () => {
    if (!cancelReason.trim()) { showToast(t('myOrders.needCancelReason'), true); return; }
    try {
      await authFetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: 'PUT',
        body: { reason: cancelReason.trim() },
      }, t);
      showToast(t('myOrders.cancelled', { id: cancelTarget.id }));
      const cancelledId = cancelTarget.id;
      setCancelTarget(null);
      setCancelReason('');
      if (openId === cancelledId) setOpenId(null);
      load();
    } catch (e) { showToast(e.message, true); }
  };

  // Tạo yêu cầu đổi/trả cho đơn đã giao → POST /api/returns
  // Bắt buộc lý do + ít nhất 1 ảnh minh họa; tạo xong đơn tự vào chat tư vấn với shop.
  const doRequestReturn = async () => {
    if (!returnReason.trim()) { showToast(t('myOrders.needReturnReason'), true); return; }
    if (returnImages.length === 0) { showToast(t('myOrders.needImages'), true); return; }
    try {
      await authFetch('/api/returns', {
        method: 'POST',
        body: { order_id: returnTarget.id, type: returnType, reason: returnReason.trim(), images: returnImages },
      }, t);
      showToast(t('myOrders.returnSent', { type: returnType === 'exchange' ? t('myOrders.exchange') : t('myOrders.return'), id: returnTarget.id }));
      setReturnTarget(null);
      setReturnType('return');
      setReturnReason('');
      setReturnImages([]);
    } catch (e) { showToast(e.message, true); }
  };

  // Tạo yêu cầu bảo hành cho đơn đã giao → POST /api/warranties
  // Bắt buộc lý do + ít nhất 1 ảnh minh họa; tạo xong đơn tự vào chat tư vấn với shop.
  const doRequestWarranty = async () => {
    if (!warrantyReason.trim()) { showToast(t('myOrders.needWarrantyReason'), true); return; }
    if (warrantyImages.length === 0) { showToast(t('myOrders.needImages'), true); return; }
    try {
      await authFetch('/api/warranties', {
        method: 'POST',
        body: { order_id: warrantyTarget.id, reason: warrantyReason.trim(), images: warrantyImages },
      }, t);
      showToast(t('myOrders.warrantyCreated', { id: warrantyTarget.id }));
      setWarrantyTarget(null);
      setWarrantyReason('');
      setWarrantyImages([]);
    } catch (e) { showToast(e.message, true); }
  };

  return (
    <div className="container page">
      <PageTitle title={t('myOrders.title')} />
      <h1 className="page-title">{t('myOrders.title')}</h1>
      {orders.length === 0 ? (
        <div className="empty">
          <p>{t('myOrders.empty')}</p>
          <Link to="/cua-hang" className="btn btn-primary">{t('home.shopNow')}</Link>
        </div>
      ) : orders.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="order-head">
            <strong>{t('myOrders.orderId', { id: o.id })}</strong>
            <span className={`status ${o.status}`}>{t('orderStatus.' + o.status)}</span>
          </div>
          <div style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
            {fmtDate(o.created_at)} • {t('myOrders.itemCount', { count: o.item_count })} • <span className="order-total">{fmtVND(o.total)}</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-small btn-outline"
              onClick={() => setOpenId(openId === o.id ? null : o.id)}>
              {openId === o.id ? t('myOrders.hideDetail') : t('myOrders.viewDetail')}
            </button>
            {/* Chỉ đơn đang chờ xác nhận mới được khách tự hủy */}
            {o.status === 'pending' && (
              <button className="btn btn-small btn-outline"
                style={{ color: '#b3261e', borderColor: '#b3261e' }}
                onClick={() => { setCancelTarget(o); setCancelReason(''); }}>
                {t('myOrders.cancelOrder')}
              </button>
            )}
            {/* Đơn đã giao: các nút hậu mãi đổi/trả + bảo hành */}
            {o.status === 'delivered' && (
              <>
                <button className="btn btn-small btn-outline"
                  onClick={() => { setReturnTarget(o); setReturnType('return'); setReturnReason(''); setReturnImages([]); }}>
                  {t('myOrders.requestReturn')}
                </button>
                <button className="btn btn-small btn-outline"
                  onClick={() => { setWarrantyTarget(o); setWarrantyReason(''); setWarrantyImages([]); }}>
                  {t('myOrders.requestWarranty')}
                </button>
              </>
            )}
          </div>
          {openId === o.id && <div style={{ marginTop: 14 }}><OrderDetail id={o.id} /></div>}
        </div>
      ))}

      {/* Dialog nhập lý do hủy đơn (theo pattern dialog trong trang của codebase) */}
      {cancelTarget && (
        <div className="modal-backdrop" onClick={() => setCancelTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('myOrders.cancelTitle', { id: cancelTarget.id })}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              {t('myOrders.cancelDesc')}
            </p>
            <div className="field">
              <label>{t('myOrders.cancelReason')}</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('myOrders.cancelPlaceholder')}
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setCancelTarget(null)}>{t('myOrders.close')}</button>
              <button className="btn btn-danger" onClick={doCancel}>{t('myOrders.confirmCancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog yêu cầu đổi/trả: chọn hình thức + nhập lý do */}
      {returnTarget && (
        <div className="modal-backdrop" onClick={() => setReturnTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('myOrders.returnTitle', { id: returnTarget.id })}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              {t('myOrders.returnDesc')}
            </p>
            <div className="field">
              <label>{t('myOrders.returnType')}</label>
              <select value={returnType} onChange={(e) => setReturnType(e.target.value)}>
                <option value="return">{t('myOrders.returnRefund')}</option>
                <option value="exchange">{t('myOrders.returnExchange')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('myOrders.reason')}</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder={t('myOrders.returnPlaceholder')}
                rows={3}
              />
            </div>
            <ImagePicker images={returnImages} setImages={setReturnImages} t={t}
              onError={(m) => showToast(m, true)} />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setReturnTarget(null)}>{t('myOrders.close')}</button>
              <button className="btn btn-primary" onClick={doRequestReturn}>{t('myOrders.sendRequest')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog yêu cầu bảo hành: nhập lý do + ảnh minh họa (thời hạn do shop quyết khi duyệt) */}
      {warrantyTarget && (
        <div className="modal-backdrop" onClick={() => setWarrantyTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('myOrders.warrantyTitle', { id: warrantyTarget.id })}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              {t('myOrders.warrantyDesc')}
            </p>
            <div className="field">
              <label>{t('myOrders.reason')}</label>
              <textarea
                value={warrantyReason}
                onChange={(e) => setWarrantyReason(e.target.value)}
                placeholder={t('myOrders.warrantyPlaceholder')}
                rows={3}
              />
            </div>
            <ImagePicker images={warrantyImages} setImages={setWarrantyImages} t={t}
              onError={(m) => showToast(m, true)} />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setWarrantyTarget(null)}>{t('myOrders.close')}</button>
              <button className="btn btn-primary" onClick={doRequestWarranty}>{t('myOrders.sendRequest')}</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
