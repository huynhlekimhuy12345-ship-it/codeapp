import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtVND, fmtDate, ORDER_STATUS } from '../api';

// Nhãn tiếng Việt cho phương thức thanh toán (khớp backend routes/orders.js)
const PAYMENT_LABELS = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
};

// Gọi API có auth — bản rút gọn dùng riêng trong trang này cho các route mới
// (không sửa api.js dùng chung để tránh xung đột với các trang khác)
async function authFetch(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
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

function OrderDetail({ id }) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    api.getOrder(id).then(({ order }) => setOrder(order)).catch(() => {});
  }, [id]);
  if (!order) return <div>Đang tải...</div>;
  // Tạm tính từ các dòng hàng (chỉ để hiển thị chi tiết — server mới là nguồn tính toán)
  const subtotal = order.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
  return (
    <div>
      <p><strong>Người nhận:</strong> {order.customer_name} • {order.phone}</p>
      <p><strong>Địa chỉ:</strong> {order.address}</p>
      <p><strong>Ngày đặt:</strong> {fmtDate(order.created_at)}</p>
      <p><strong>Thanh toán:</strong> {PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
      <div className="order-items">
        {order.items.map((i) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>{i.product_name} × {i.quantity}</span>
            <span>{fmtVND(i.price * i.quantity)}</span>
          </div>
        ))}
      </div>
      {/* Chi tiết tiền: tạm tính + phí ship - giảm giá voucher = tổng */}
      <div style={{ fontSize: '.9rem', color: 'var(--muted)', marginTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Tạm tính</span><span>{fmtVND(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Phí vận chuyển</span><span>{fmtVND(order.shipping_fee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Giảm giá voucher</span><span>-{fmtVND(order.discount_total)}</span>
        </div>
      </div>
      <div className="order-total">Tổng: {fmtVND(order.total)}</div>
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [openId, setOpenId] = useState(null);

  // Hủy đơn: đơn đang chọn + lý do nhập trong dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  // Yêu cầu đổi/trả: đơn đang chọn + hình thức (đổi/trả) + lý do
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnType, setReturnType] = useState('return');
  const [returnReason, setReturnReason] = useState('');
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
    if (!cancelReason.trim()) { showToast('Vui lòng nhập lý do hủy đơn hàng', true); return; }
    try {
      await authFetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: 'PUT',
        body: { reason: cancelReason.trim() },
      });
      showToast(`Đã hủy đơn #${cancelTarget.id}, tồn kho được hoàn lại`);
      const cancelledId = cancelTarget.id;
      setCancelTarget(null);
      setCancelReason('');
      if (openId === cancelledId) setOpenId(null);
      load();
    } catch (e) { showToast(e.message, true); }
  };

  // Tạo yêu cầu đổi/trả cho đơn đã giao → POST /api/returns
  const doRequestReturn = async () => {
    if (!returnReason.trim()) { showToast('Vui lòng ghi rõ lý do đổi/trả', true); return; }
    try {
      await authFetch('/api/returns', {
        method: 'POST',
        body: { order_id: returnTarget.id, type: returnType, reason: returnReason.trim() },
      });
      showToast(`Đã gửi yêu cầu ${returnType === 'exchange' ? 'đổi hàng' : 'trả hàng'} cho đơn #${returnTarget.id}`);
      setReturnTarget(null);
      setReturnType('return');
      setReturnReason('');
    } catch (e) { showToast(e.message, true); }
  };

  // Tạo bảo hành 12 tháng cho đơn đã giao → POST /api/warranties
  const doRequestWarranty = async (id) => {
    try {
      await authFetch('/api/warranties', {
        method: 'POST',
        body: { order_id: id, months: 12 },
      });
      showToast(`Đã tạo bảo hành 12 tháng cho đơn #${id}`);
    } catch (e) { showToast(e.message, true); }
  };

  return (
    <div className="container page">
      <h2 className="page-title">Đơn hàng của tôi</h2>
      {orders.length === 0 ? (
        <div className="empty">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link to="/cua-hang" className="btn btn-primary">Mua sắm ngay</Link>
        </div>
      ) : orders.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="order-head">
            <strong>Đơn #{o.id}</strong>
            <span className={`status ${o.status}`}>{ORDER_STATUS[o.status]}</span>
          </div>
          <div style={{ fontSize: '.9rem', color: 'var(--muted)' }}>
            {fmtDate(o.created_at)} • {o.item_count} sản phẩm • <span className="order-total">{fmtVND(o.total)}</span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-small btn-outline"
              onClick={() => setOpenId(openId === o.id ? null : o.id)}>
              {openId === o.id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </button>
            {/* Chỉ đơn đang chờ xác nhận mới được khách tự hủy */}
            {o.status === 'pending' && (
              <button className="btn btn-small btn-outline"
                style={{ color: '#b3261e', borderColor: '#b3261e' }}
                onClick={() => { setCancelTarget(o); setCancelReason(''); }}>
                Hủy đơn
              </button>
            )}
            {/* Đơn đã giao: các nút hậu mãi đổi/trả + bảo hành */}
            {o.status === 'delivered' && (
              <>
                <button className="btn btn-small btn-outline"
                  onClick={() => { setReturnTarget(o); setReturnType('return'); setReturnReason(''); }}>
                  Yêu cầu đổi trả
                </button>
                <button className="btn btn-small btn-outline" onClick={() => doRequestWarranty(o.id)}>
                  Yêu cầu bảo hành
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
            <h3>Hủy đơn #{cancelTarget.id}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại tự động.
              Vui lòng ghi rõ lý do hủy (bắt buộc):
            </p>
            <div className="field">
              <label>Lý do hủy *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Đặt nhầm sản phẩm, đổi ý không mua nữa…"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setCancelTarget(null)}>Đóng</button>
              <button className="btn btn-danger" onClick={doCancel}>Xác nhận hủy đơn</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog yêu cầu đổi/trả: chọn hình thức + nhập lý do */}
      {returnTarget && (
        <div className="modal-backdrop" onClick={() => setReturnTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Yêu cầu đổi/trả — đơn #{returnTarget.id}</h3>
            <p style={{ color: 'var(--muted)', fontSize: '.95rem' }}>
              Cửa hàng sẽ xem xét yêu cầu của bạn. Vui lòng ghi rõ lý do (bắt buộc):
            </p>
            <div className="field">
              <label>Hình thức</label>
              <select value={returnType} onChange={(e) => setReturnType(e.target.value)}>
                <option value="return">Trả hàng (hoàn tiền)</option>
                <option value="exchange">Đổi hàng (đổi sản phẩm khác)</option>
              </select>
            </div>
            <div className="field">
              <label>Lý do *</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Ví dụ: Sản phẩm bị lỗi khóa kéo, sai màu so với mô tả…"
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setReturnTarget(null)}>Đóng</button>
              <button className="btn btn-primary" onClick={doRequestReturn}>Gửi yêu cầu</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
