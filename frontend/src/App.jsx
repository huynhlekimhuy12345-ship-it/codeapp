import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './context/StoreContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
// Tải lười Three.js: tách thành chunk riêng, trang hiện ngay với nền gradient,
// nền 3D mờ dần vào sau — không chặn lần vẽ đầu tiên.
const Scene3D = lazy(() => import('./components/Scene3D'));
import Home from './pages/Home';
import Shop from './pages/Shop';
import About from './pages/About';
import Blog from './pages/Blog';
import BlogDetail from './pages/BlogDetail';
import Contact from './pages/Contact';
import ProductDetail from './pages/ProductDetail';
import Collection from './pages/Collection';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import MyOrders from './pages/MyOrders';
import ProfilePage from './pages/ProfilePage';
import Admin from './pages/Admin';
import SalePage from './pages/SalePage';

// Chặn route cần đăng nhập
function RequireAuth({ children }) {
  const { user } = useStore();
  if (user === null) return null; // đang khôi phục phiên
  return user ? children : <Navigate to="/dang-nhap" replace />;
}

// Chặn route chỉ dành cho nhân sự (admin + sale); quản lý tài khoản do tab UsersTab tự ẩn với sale
function RequireStaff({ children }) {
  const { user } = useStore();
  if (user === null) return null;
  if (!user) return <Navigate to="/dang-nhap" replace />;
  return ['admin', 'sale'].includes(user.role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const location = useLocation();
  // Trang quản trị dùng nền 3D tối giản để tập trung thao tác
  const variant = location.pathname.startsWith('/admin') ? 'subtle' : 'hero';
  // Trang Bộ sưu tập có canvas 3D riêng che kín màn hình → tắt Scene3D
  // nền chung để đỡ tốn GPU (nhất là shader compile lần đầu)
  const hideGlobalScene = location.pathname.startsWith('/bo-suu-tap');

  return (
    <>
      {/* Nền 3D toàn màn hình — chỉ vẽ nền, mọi chữ/nút là HTML/CSS bên trên */}
      {!hideGlobalScene && (
        <Suspense fallback={null}>
          <Scene3D key={variant} variant={variant} />
        </Suspense>
      )}
      <div className="page-veil" aria-hidden="true" />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/khuyen-mai" element={<SalePage />} />
          <Route path="/cua-hang" element={<Shop />} />
          <Route path="/gioi-thieu" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/lien-he" element={<Contact />} />
          <Route path="/san-pham/:id" element={<ProductDetail />} />
          <Route path="/bo-suu-tap" element={<Collection />} />
          <Route path="/gio-hang" element={<Cart />} />
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dang-ky" element={<Register />} />
          <Route path="/thanh-toan" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/don-hang" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/ho-so" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/admin" element={<RequireStaff><Admin /></RequireStaff>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
