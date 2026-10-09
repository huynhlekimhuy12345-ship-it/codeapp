import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div>
          <h4>ĐỒ DA SHOP</h4>
          <p>Chuyên đồ da thật cao cấp: ví, túi xách, thắt lưng, giày da và phụ kiện. Cam kết da thật 100%, bảo hành 12 tháng.</p>
        </div>
        <div>
          <h4>Liên kết</h4>
          <ul>
            <li><Link to="/">Trang chủ</Link></li>
            <li><Link to="/gioi-thieu">Giới thiệu</Link></li>
            <li><Link to="/cua-hang">Cửa hàng</Link></li>
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/lien-he">Liên hệ</Link></li>
            <li><Link to="/gio-hang">Giỏ hàng</Link></li>
            <li><Link to="/don-hang">Theo dõi đơn hàng</Link></li>
          </ul>
        </div>
        <div>
          <h4>Liên hệ</h4>
          <p>📍 123 Nguyễn Trãi, Q.1, TP.HCM</p>
          <p>📞 0901 234 567</p>
          <p>✉️ hotro@dodashop.vn</p>
        </div>
      </div>
      <div className="footer-bottom">© 2026 Đồ Da Shop. Thanh toán khi nhận hàng (COD).</div>
    </footer>
  );
}
