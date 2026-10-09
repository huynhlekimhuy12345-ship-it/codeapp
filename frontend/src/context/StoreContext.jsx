// Context dùng chung: đăng nhập + giỏ hàng (lưu localStorage)
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

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

  // Giỏ hàng: [{ product_id, name, price, image_url, quantity }]
  const addToCart = (product, qty = 1) => {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        quantity: qty,
      }];
    });
  };

  const updateQty = (product_id, quantity) => {
    if (quantity <= 0) return removeFromCart(product_id);
    setCart((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity } : i)));
  };

  const removeFromCart = (product_id) =>
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.price, 0);

  return (
    <StoreContext.Provider
      value={{ user, login, register, logout, cart, addToCart, updateQty, removeFromCart, clearCart, cartCount, cartTotal }}
    >
      {children}
    </StoreContext.Provider>
  );
}
