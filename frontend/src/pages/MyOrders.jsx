import { useEffect, useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { api, fmtVND, fmtDate, fmtDay } from '../api';
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

// Bộ chọn sản phẩm cho dialog đổi/trả: khách tick từng món + gõ số lượng muốn
// đổi/trả (tối đa = đã mua - đã hoàn tất đổi/trả trước đó). Tự nạp chi tiết đơn
// và lịch sử đổi/trả của chính khách khi mở dialog.
function ReturnItemPicker({ orderId, value, onChange, t, onError }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [{ order }, retData] = await Promise.all([
          api.getOrder(orderId),
          authFetch('/api/returns', {}, t).catch(() => ({ returns: [] })),
        ]);
        if (!alive) return;
        const returnedMap = {};
        for (const r of retData.returns || []) {
          if (r.order_id !== orderId || r.status !== 'completed') continue;
          for (const it of r.items || []) {
            if (it.order_item_id) returnedMap[it.order_item_id] = (returnedMap[it.order_item_id] || 0) + it.quantity;
          }
        }
        onChange((order.items || []).map((i) => {
          const max = Math.max(0, i.quantity - (returnedMap[i.id] || 0));
          return {
            order_item_id: i.id, product_name: i.product_name, variant_sku: i.variant_sku || '',
            price: i.price, max, qty: max, checked: max > 0,
          };
        }));
      } catch (e) { if (alive) onError(e.message); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) return <div className="field"><label>{t('myOrders.returnItems')} <span className="tip-star" data-tip={t('myOrders.returnItemsHint')}>*</span></label><p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p></div>;
  return (
    <div className="field">
      <label>{t('myOrders.returnItems')} <span className="tip-star" data-tip={t('myOrders.returnItemsHint')}>*</span></label>
      <div style={{ display: 'grid', gap: 8 }}>
        {value.map((row, idx) => (
          <ReturnPickRow key={row.order_item_id} row={row} t={t}
            onToggle={(c) => onChange(value.map((x, j) => (j === idx ? { ...x, checked: c } : x)))}
            onQty={(q) => onChange(value.map((x, j) => (j === idx ? { ...x, qty: q } : x)))} />
        ))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 6 }}>{t('myOrders.returnItemsHint')}</p>
    </div>
  );
}

function ReturnPickRow({ row, onToggle, onQty, t }) {
  const name = useProductName({ name: row.product_name });
  const disabled = row.max <= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--panel-border)', borderRadius: 10, opacity: disabled ? 0.55 : 1 }}>
      <input type="checkbox" checked={row.checked && !disabled} disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)} style={{ width: 18, height: 18, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '.92rem' }}>
        {name}
        {row.variant_sku && <span style={{ color: 'var(--muted)' }}> · {row.variant_sku}</span>}
        <span style={{ color: 'var(--muted)' }}> — {fmtVND(row.price)}</span>
        {disabled && <span style={{ color: 'var(--muted)' }}> ({t('myOrders.alreadyReturned')})</span>}
      </span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', color: 'var(--muted)', margin: 0 }}>
        {t('myOrders.qtyShort')}
        <input type="number" min="1" max={row.max} value={row.qty} disabled={disabled || !row.checked}
          onChange={(e) => onQty(e.target.value)}
          style={{ width: 64, padding: '6px 8px', borderRadius: 8 }} aria-label={t('myOrders.qtyShort')} />
        <span>/ {row.max}</span>
      </label>
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
  // Xác nhận hài lòng: đơn đang chọn trong dialog (ghi điểm ngay + khóa đổi/trả)
  const [satisfiedTarget, setSatisfiedTarget] = useState(null);
  // Yêu cầu đổi/trả: đơn đang chọn + hình thức (đổi/trả) + lý do + ảnh minh họa
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnType, setReturnType] = useState('return');
  const [returnReason, setReturnReason] = useState('');
  const [returnImages, setReturnImages] = useState([]);
  const [returnPick, setReturnPick] = useState([]);
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
  // Khách xác nhận hài lòng -> đơn ghi điểm ngay (có thể thăng hạng), khóa đổi/trả
  const doConfirmSatisfied = async () => {
    try {
      const r = await api.confirmSatisfied(satisfiedTarget.id);
      setSatisfiedTarget(null);
      if (r && r.upgraded && r.tier) showToast(t('myOrders.tierUpToast', { tier: t(`tier.name.${r.tier.key}`) }));
      else showToast(t('myOrders.satisfiedDone'));
      load();
    } catch (e) { showToast(e.message, true); }
  };

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
    const items = returnPick
      .filter((r) => r.checked && r.max > 0)
      .map((r) => ({ order_item_id: r.order_item_id, quantity: Math.max(1, Math.min(parseInt(r.qty) || 0, r.max)) }))
      .filter((x) => x.quantity >= 1);
    if (items.length === 0) { showToast(t('myOrders.needReturnItems'), true); return; }
    if (!returnReason.trim()) { showToast(t('myOrders.needReturnReason'), true); return; }
    if (returnImages.length === 0) { showToast(t('myOrders.needImages'), true); return; }
    try {
      await authFetch('/api/returns', {
        method: 'POST',
        body: { order_id: returnTarget.id, type: returnType, reason: returnReason.trim(), images: returnImages, items },
      }, t);
      showToast(t('myOrders.returnSent', { type: returnType === 'exchange' ? t('myOrders.exchange') : t('myOrders.return'), id: returnTarget.id }));
      setReturnTarget(null);
      setReturnType('return');
      setReturnReason('');
      setReturnImages([]);
      setReturnPick([]);
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
            {/* Đơn đã giao: xác nhận hài lòng (ghi điểm ngay + khóa đổi/trả) + hậu mãi */}
            {o.status === 'delivered' && (
              <>
                {o.satisfied_at ? (
                  <span style={{ alignSelf: 'center', color: 'var(--green)', fontWeight: 700, fontSize: '.9rem' }}>{t('myOrders.satisfiedBadge')}</span>
                ) : (
                  <>
                    <button className="btn btn-small btn-primary"
                      onClick={() => setSatisfiedTarget(o)}>
                      {t('myOrders.confirmSatisfied')}
                    </button>
                    {o.return_deadline && new Date(String(o.return_deadline).replace(' ', 'T') + 'Z').getTime() > Date.now() ? (
                      <button className="btn btn-small btn-outline"
                        onClick={() => { setReturnTarget(o); setReturnType('return'); setReturnReason(''); setReturnImages([]); setReturnPick([]); }}>
                        {t('myOrders.requestReturn')}
                      </button>
                    ) : (
                      <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>{t('myOrders.returnExpired')}</span>
                    )}
                  </>
                )}
                <button className="btn btn-small btn-outline"
                  onClick={() => { setWarrantyTarget(o); setWarrantyReason(''); setWarrantyImages([]); }}>
                  {t('myOrders.requestWarranty')}
                </button>
              </>
            )}
          </div>
          {/* Trạng thái ghi điểm hạng của đơn đã thanh toán + đã giao */}
          {o.status === 'delivered' && o.payment_status === 'verified' && (
            o.points_settled || o.satisfied_at ? (
              <p style={{ margin: '8px 0 0', color: 'var(--green)', fontSize: '.9rem' }}>{t('myOrders.pointsSettled')}</p>
            ) : o.return_deadline ? (
              <p className="muted" style={{ margin: '8px 0 0', fontSize: '.9rem' }}>
                {t('myOrders.pointsPending', { date: fmtDay(String(o.return_deadline).replace(' ', 'T') + 'Z') })}
              </p>
            ) : null
          )}
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

      {/* Dialog xác nhận hài lòng: ghi điểm ngay, đổi lại khóa đổi/trả */}
      {satisfiedTarget && (
        <div className="modal-backdrop" onClick={() => setSatisfiedTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('myOrders.satisfiedTitle', { id: satisfiedTarget.id })}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              {t('myOrders.satisfiedDesc')}
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSatisfiedTarget(null)}>{t('myOrders.close')}</button>
              <button className="btn btn-primary" onClick={doConfirmSatisfied}>{t('myOrders.satisfiedConfirmBtn')}</button>
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
            <ReturnItemPicker orderId={returnTarget.id} value={returnPick} onChange={setReturnPick} t={t}
              onError={(m) => showToast(m, true)} />
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
