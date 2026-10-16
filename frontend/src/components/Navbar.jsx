import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Navbar() {
  const { user, logout, cartCount } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="logo">ĐỒ DA <span>SHOP</span></Link>
        <div className={`nav-links${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} onKeyDown={() => {}} role="presentation">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/gioi-thieu">Giới thiệu</NavLink>
          <NavLink to="/cua-hang">Sản phẩm</NavLink>
          <NavLink to="/khuyen-mai">Khuyến mãi</NavLink>
          <NavLink to="/bo-suu-tap">Bộ sưu tập</NavLink>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/lien-he">Liên hệ</NavLink>
          {user && <NavLink to="/don-hang">Đơn hàng</NavLink>}
          {['admin', 'sale'].includes(user?.role) && <NavLink to="/admin">Quản trị</NavLink>}
        </div>
        <div className="nav-right">
          <button
            className="hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
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
