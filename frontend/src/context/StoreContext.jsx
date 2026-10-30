// Context dùng chung: đăng nhập + giỏ hàng (lưu localStorage)
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

// Key phân biệt dòng giỏ theo biến thể: cùng SP nhưng khác variant phải là 2 dòng
const cartKey = (product_id, variant_id) => `${product_id}|${variant_id || 0}`;

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('cart') || '[]');
      // Món cũ chưa có cờ selected → mặc định được chọn để thanh toán
      return raw.map((i) => ({ ...i, selected: i.selected !== false }));
    } catch {
      return [];
    }
  });

  // Khôi phục phiên đăng nhập khi tải lại trang
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me().then(({ user }) => setUser(user)).catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const login = async (identifier, password) => {
    const { user, token } = await api.login({ identifier, password });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const register = async (name, identifier, password) => {
    const { user, token } = await api.register({ name, identifier, password });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const googleLogin = async (credential) => {
    const { user, token } = await api.googleAuth({ credential });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Giỏ hàng: [{ product_id, variant_id?, variant_sku?, name, price, image_url, image, quantity }]
  // Contract W1/W3: gộp theo key = product_id + variant_id (không gộp 2 variant cùng SP)
  const addToCart = (product, qty = 1) => {
    const variant_id = product.variant_id || null;
    setCart((prev) => {
      const key = cartKey(product.id ?? product.product_id, variant_id);
      const found = prev.find(
        (i) => cartKey(i.product_id, i.variant_id) === key
      );
      if (found) {
        return prev.map((i) =>
          cartKey(i.product_id, i.variant_id) === key
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, {
        product_id: product.product_id ?? product.id,
        variant_id,
        variant_sku: product.variant_sku || '',
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        image: product.image,
        quantity: qty,
        selected: true,
      }];
    });
  };

  // updateQty/removeFromCart cũng phân biệt theo variant để không chạm nhầm dòng khác
  const updateQty = (product_id, quantity, variant_id = null) => {
    const key = cartKey(product_id, variant_id);
    if (quantity <= 0) return removeFromCart(product_id, variant_id);
    setCart((prev) =>
      prev.map((i) =>
        cartKey(i.product_id, i.variant_id) === key ? { ...i, quantity } : i
      )
    );
  };

  const removeFromCart = (product_id, variant_id = null) =>
    setCart((prev) =>
      prev.filter((i) => cartKey(i.product_id, i.variant_id) !== cartKey(product_id, variant_id))
    );

  const clearCart = () => setCart([]);

  // Bật/tắt chọn 1 dòng để thanh toán (món không chọn được giữ lại trong giỏ)
  const toggleSelect = (product_id, variant_id = null, value) => {
    const key = cartKey(product_id, variant_id);
    setCart((prev) =>
      prev.map((i) => (cartKey(i.product_id, i.variant_id) === key ? { ...i, selected: !!value } : i))
    );
  };
  const setAllSelected = (value) =>
    setCart((prev) => prev.map((i) => ({ ...i, selected: !!value })));

  // Chỉ xóa đúng các món vừa đặt đơn (giữ lại món chưa chọn)
  const removePurchased = (items) => {
    const keys = new Set((items || []).map((i) => cartKey(i.product_id, i.variant_id)));
    setCart((prev) => prev.filter((i) => !keys.has(cartKey(i.product_id, i.variant_id))));
  };

  // Mua ngay: lưu 1 món riêng (sessionStorage) để thanh toán ngay, không động vào giỏ
  const buyNowItem = (product, qty = 1) => {
    const item = {
      product_id: product.product_id ?? product.id,
      variant_id: product.variant_id || null,
      variant_sku: product.variant_sku || '',
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      image: product.image,
      quantity: qty,
    };
    try { sessionStorage.setItem('buyNowItem', JSON.stringify(item)); } catch { /* bỏ qua */ }
    return item;
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.price, 0);
  const selectedItems = cart.filter((i) => i.selected !== false);
  const selectedTotal = selectedItems.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <StoreContext.Provider
      value={{ user, setUser, login, register, googleLogin, logout, cart, addToCart, updateQty, removeFromCart, clearCart, cartCount, cartTotal, toggleSelect, setAllSelected, selectedItems, selectedTotal, removePurchased, buyNowItem }}
    >
      {children}
    </StoreContext.Provider>
  );
}
