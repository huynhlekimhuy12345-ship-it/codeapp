import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtVND, fmtDate, ORDER_STATUS } from '../api';

function OrderDetail({ id }) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    api.getOrder(id).then(({ order }) => setOrder(order)).catch(() => {});
  }, [id]);
  if (!order) return <div>Đang tải...</div>;
  return (
    <div>
      <p><strong>Người nhận:</strong> {order.customer_name} • {order.phone}</p>
      <p><strong>Địa chỉ:</strong> {order.address}</p>
      <p><strong>Ngày đặt:</strong> {fmtDate(order.created_at)}</p>
      <div className="order-items">
        {order.items.map((i) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>{i.product_name} × {i.quantity}</span>
            <span>{fmtVND(i.price * i.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="order-total">Tổng: {fmtVND(order.total)}</div>
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.getOrders().then((d) => setOrders(d.orders)).catch(() => {});
  }, []);

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
          <button className="btn btn-small btn-outline" style={{ marginTop: 10 }}
            onClick={() => setOpenId(openId === o.id ? null : o.id)}>
            {openId === o.id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
          </button>
          {openId === o.id && <div style={{ marginTop: 14 }}><OrderDetail id={o.id} /></div>}
        </div>
      ))}
    </div>
  );
}
