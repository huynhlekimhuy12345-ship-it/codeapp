// Client gọi API backend, tự gắn JWT token
const API_BASE = '';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me', { auth: true }),

  // Sản phẩm
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/products${q ? '?' + q : ''}`);
  },
  getProduct: (id) => request(`/api/products/${id}`),
  createProduct: (p) => request('/api/products', { method: 'POST', body: p, auth: true }),
  updateProduct: (id, p) => request(`/api/products/${id}`, { method: 'PUT', body: p, auth: true }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE', auth: true }),

  // Danh mục
  getCategories: () => request('/api/categories'),
  createCategory: (c) => request('/api/categories', { method: 'POST', body: c, auth: true }),
  updateCategory: (id, c) => request(`/api/categories/${id}`, { method: 'PUT', body: c, auth: true }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE', auth: true }),

  // Đơn hàng
  createOrder: (o) => request('/api/orders', { method: 'POST', body: o, auth: true }),
  getOrders: (status) => request(`/api/orders${status ? '?status=' + status : ''}`, { auth: true }),
  getOrder: (id) => request(`/api/orders/${id}`, { auth: true }),
  updateOrderStatus: (id, status) =>
    request(`/api/orders/${id}/status`, { method: 'PUT', body: { status }, auth: true }),

  // Người dùng (admin)
  getUsers: () => request('/api/users', { auth: true }),
  updateUserRole: (id, role) =>
    request(`/api/users/${id}/role`, { method: 'PUT', body: { role }, auth: true }),
};

// Định dạng tiền VND
export const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

// Định dạng ngày giờ
export const fmtDate = (s) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('vi-VN');

export const ORDER_STATUS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};
