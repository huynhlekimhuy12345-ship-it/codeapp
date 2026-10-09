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
  updateOrderStatus: (id, status, reason) =>
    request(`/api/orders/${id}/status`, { method: 'PUT', body: { status, reason }, auth: true }),
  deleteOrder: (id) => request(`/api/orders/${id}`, { method: 'DELETE', auth: true }),

  // Người dùng (admin)
  getUsers: () => request('/api/users', { auth: true }),
  updateUserRole: (id, role) =>
    request(`/api/users/${id}/role`, { method: 'PUT', body: { role }, auth: true }),

  // Bài viết Blog
  getPosts: (all = false) => request(`/api/posts${all ? '?all=1' : ''}`, { auth: all }),
  getPost: (slug) => request(`/api/posts/${encodeURIComponent(slug)}`),
  createPost: (p) => request('/api/posts', { method: 'POST', body: p, auth: true }),
  updatePost: (id, p) => request(`/api/posts/${id}`, { method: 'PUT', body: p, auth: true }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE', auth: true }),

  // Tin nhắn liên hệ
  sendContactMessage: (m) => request('/api/contact', { method: 'POST', body: m }),
  getContactMessages: () => request('/api/contact', { auth: true }),
  markMessageRead: (id, isRead = true) =>
    request(`/api/contact/${id}/read`, { method: 'PUT', body: { is_read: isRead }, auth: true }),
  deleteContactMessage: (id) => request(`/api/contact/${id}`, { method: 'DELETE', auth: true }),
};

// Định dạng tiền VND
export const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

// Định dạng ngày giờ
export const fmtDate = (s) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('vi-VN');

// Định dạng ngày (dùng cho Blog): "Đăng ngày 07/10/2026"
export const fmtDay = (s) => {
  try {
    return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
};

export const ORDER_STATUS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

// Luồng trạng thái hợp lệ của đơn hàng (khớp backend)
export const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const nextStatuses = (from) => STATUS_FLOW[from] || [];
