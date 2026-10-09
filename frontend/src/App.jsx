import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './context/StoreContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Shop from './pages/Shop';
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
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cua-hang" element={<Shop />} />
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
