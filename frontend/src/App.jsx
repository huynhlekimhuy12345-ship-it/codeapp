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
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import MyOrders from './pages/MyOrders';
import Admin from './pages/Admin';

// Chặn route cần đăng nhập
function RequireAuth({ children }) {
  const { user } = useStore();
  if (user === null) return null; // đang khôi phục phiên
  return user ? children : <Navigate to="/dang-nhap" replace />;
}

// Chặn route chỉ dành cho admin
function RequireAdmin({ children }) {
  const { user } = useStore();
  if (user === null) return null;
  if (!user) return <Navigate to="/dang-nhap" replace />;
  return user.role === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  const location = useLocation();
  // Trang quản trị dùng nền 3D tối giản để tập trung thao tác
  const variant = location.pathname.startsWith('/admin') ? 'subtle' : 'hero';

  return (
    <>
      {/* Nền 3D toàn màn hình — chỉ vẽ nền, mọi chữ/nút là HTML/CSS bên trên */}
      <Suspense fallback={null}>
        <Scene3D key={variant} variant={variant} />
      </Suspense>
      <div className="page-veil" aria-hidden="true" />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cua-hang" element={<Shop />} />
          <Route path="/gioi-thieu" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/lien-he" element={<Contact />} />
          <Route path="/san-pham/:id" element={<ProductDetail />} />
          <Route path="/gio-hang" element={<Cart />} />
          <Route path="/dang-nhap" element={<Login />} />
          <Route path="/dang-ky" element={<Register />} />
          <Route path="/thanh-toan" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/don-hang" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
