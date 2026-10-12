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
      return JSON.parse(localStorage.getItem('cart') || '[]');
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

  const login = async (email, password) => {
    const { user, token } = await api.login({ email, password });
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password) => {
    const { user, token } = await api.register({ name, email, password });
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

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <StoreContext.Provider
      value={{ user, setUser, login, register, logout, cart, addToCart, updateQty, removeFromCart, clearCart, cartCount, cartTotal }}
    >
      {children}
    </StoreContext.Provider>
  );
}
