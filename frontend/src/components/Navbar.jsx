import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Navbar() {
  const { user, logout, cartCount } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="logo">ĐỒ DA <span>SHOP</span></Link>
        <div className="nav-links">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/cua-hang">Cửa hàng</NavLink>
          {user && <NavLink to="/don-hang">Đơn hàng</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}
        </div>
        <div className="nav-right">
          <Link to="/gio-hang" className="cart-link" title="Giỏ hàng">
            🛒
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          {user ? (
            <>
              <span className="user-chip">👋 {user.name}</span>
              <button className="btn btn-small btn-outline" onClick={handleLogout}>Đăng xuất</button>
            </>
          ) : (
            <Link to="/dang-nhap" className="btn btn-small btn-primary">Đăng nhập</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
