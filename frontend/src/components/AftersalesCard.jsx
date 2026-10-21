// Thẻ yêu cầu hậu mãi hiển thị trong khung chat (dùng chung cho khách và nhân viên).
// Dữ liệu lấy trực tiếp từ đơn gốc qua API chat (trạng thái luôn mới nhất).
// labels do nơi gọi truyền vào (khách: qua t(); nhân viên: tiếng Việt cứng như toàn trang quản trị).
import { useState } from 'react';
import './AftersalesCard.css';

const TONE = {
  requested: 'warn', approved: 'info', rejected: 'bad', completed: 'good',
  accepted: 'info', received: 'info',
  active: 'good', expired: 'muted', void: 'bad',
};

export default function AftersalesCard({ data, labels, onOpen }) {
  const [zoom, setZoom] = useState(null);
  if (!data) return null;
  const isWarranty = data.ref_type === 'warranty';
  const title = isWarranty
    ? labels.warranty
    : data.type === 'exchange' ? labels.exchange : labels.return;
  const icon = isWarranty ? '🛡️' : data.type === 'exchange' ? '🔄' : '↩️';
  const tone = TONE[data.status] || 'warn';
  const statusLabel = labels.statuses[data.status] || data.status;

  return (
    <div className="as-card">
      <div className="as-card-head">
        <span className="as-card-title">{icon} {title}</span>
        <span className={`as-pill as-pill-${tone}`}>{statusLabel}</span>
      </div>
      <div className="as-card-meta">
        {labels.order.replace('{id}', data.order_id)}
        {isWarranty && data.months ? ` · ${labels.months.replace('{count}', data.months)}` : ''}
        {isWarranty && data.end_date ? ` · HSD ${data.end_date}` : ''}
      </div>
      {data.reason && (
        <p className="as-card-reason"><span>{labels.reason}:</span> {data.reason}</p>
      )}
      {data.received_at && (
        <p className="as-card-reason">
          <span>📥 {labels.receivedNote || 'Đã nhận lại hàng'}:</span>
          {data.received_note ? ` ${data.received_note}` : ''}
        </p>
      )}
      {Array.isArray(data.images) && data.images.length > 0 && (
        <div className="as-card-imgs">
          {data.images.map((src, i) => (
            <button key={i} type="button" className="as-thumb" onClick={() => setZoom(src)}
              aria-label={labels.viewImage || 'Xem ảnh'}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      {onOpen && (
        <button type="button" className="as-open" onClick={() => onOpen(data)}>
          {labels.open} →
        </button>
      )}
      {zoom && (
        <div className="as-lightbox" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  );
}
