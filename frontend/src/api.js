// Client gọi API backend, tự gắn JWT token
import vi from './i18n/translations/vi';
import en from './i18n/translations/en';
import zh from './i18n/translations/zh';
import ko from './i18n/translations/ko';

const API_BASE = '';

function getToken() {
  return localStorage.getItem('token');
}

// Dịch ở cấp module (không dùng hook được ở đây): đọc ngôn ngữ đã lưu,
// cùng key localStorage mà LanguageContext dùng.
const dicts = { vi, en, zh, ko };
function apiT(key) {
  let lang = 'vi';
  try { lang = localStorage.getItem('bi99_lang') || 'vi'; } catch {}
  const d = dicts[lang] || vi;
  const s = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), d);
  return s !== undefined ? s : vi.store.unknownError;
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
  if (!res.ok) throw new Error(data.error || apiT('store.unknownError'));
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me', { auth: true }),

  // Sản phẩm
  getProducts: (params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const q = new URLSearchParams(clean).toString();
    return request(`/api/products${q ? '?' + q : ''}`);
  },
  getProduct: (id) => request(`/api/products/${id}`),
  setShowcase: (ids) => request('/api/products/showcase', { method: 'PUT', body: { ids }, auth: true }),
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

  // Voucher (checkout preview, không trừ lượt)
  validateVoucher: (code, order_total) =>
    request('/api/vouchers/validate', { method: 'POST', body: { code, order_total }, auth: true }),

  // Phương thức vận chuyển (public)
  getShippingMethods: () => request('/api/shipping/methods'),

  // Bài viết Blog
  getPosts: (all = false) => request(`/api/posts${all ? '?all=1' : ''}`, { auth: all }),
  getActiveAnnouncements: () => request('/api/announcements/active'),
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

  // Biến thể & ảnh sản phẩm
  getVariants: (productId) => request(`/api/products/${productId}/variants`),
  createVariant: (productId, v) => request(`/api/products/${productId}/variants`, { method: 'POST', body: v, auth: true }),
  updateVariant: (variantId, v) => request(`/api/products/variants/${variantId}`, { method: 'PUT', body: v, auth: true }),
  deleteVariant: (variantId) => request(`/api/products/variants/${variantId}`, { method: 'DELETE', auth: true }),
  getProductImages: (productId) => request(`/api/products/${productId}/images`),
  addProductImage: (productId, img) => request(`/api/products/${productId}/images`, { method: 'POST', body: img, auth: true }),
  deleteProductImage: (imageId) => request(`/api/products/images/${imageId}`, { method: 'DELETE', auth: true }),

  // Đơn hàng (mở rộng)
  cancelOrder: (id, reason) => request(`/api/orders/${id}/cancel`, { method: 'PUT', body: { reason }, auth: true }),
  updateShippingInfo: (id, info) => request(`/api/orders/${id}/shipping-info`, { method: 'PUT', body: info, auth: true }),

  // Tồn kho & NCC (admin)
  getSuppliers: () => request('/api/inventory/suppliers', { auth: true }),
  createSupplier: (s) => request('/api/inventory/suppliers', { method: 'POST', body: s, auth: true }),
  updateSupplier: (id, s) => request(`/api/inventory/suppliers/${id}`, { method: 'PUT', body: s, auth: true }),
  deleteSupplier: (id) => request(`/api/inventory/suppliers/${id}`, { method: 'DELETE', auth: true }),
  getPurchaseOrders: () => request('/api/inventory/purchase-orders', { auth: true }),
  getPurchaseOrder: (id) => request(`/api/inventory/purchase-orders/${id}`, { auth: true }),
  createPurchaseOrder: (po) => request('/api/inventory/purchase-orders', { method: 'POST', body: po, auth: true }),
  receivePurchaseOrder: (id) => request(`/api/inventory/purchase-orders/${id}/receive`, { method: 'PUT', auth: true }),
  cancelPurchaseOrder: (id) => request(`/api/inventory/purchase-orders/${id}/cancel`, { method: 'PUT', auth: true }),
  getMovements: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/inventory/movements${q ? '?' + q : ''}`, { auth: true });
  },
  adjustStock: (payload) => request('/api/inventory/adjust', { method: 'POST', body: payload, auth: true }),
  getLowStock: (threshold = 5) => request(`/api/inventory/low-stock?threshold=${threshold}`, { auth: true }),
  getInventoryItems: (q = '') => request(`/api/inventory/items${q ? '?q=' + encodeURIComponent(q) : ''}`, { auth: true }),

  // Thanh toán
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/payments${q ? '?' + q : ''}`, { auth: true });
  },
  createPayment: (p) => request('/api/payments', { method: 'POST', body: p, auth: true }),
  verifyPayment: (id, action, note) => request(`/api/payments/${id}/verify`, { method: 'PUT', body: { action, note }, auth: true }),
  refundPayment: (id, note) => request(`/api/payments/${id}/refund`, { method: 'PUT', body: { note }, auth: true }),
  submitPaymentProof: (id, proof_url) => request(`/api/payments/${id}/proof`, { method: 'PUT', body: { proof_url }, auth: true }),

  // Vận chuyển
  getShippingMethodsAdmin: () => request('/api/shipping/methods?all=1', { auth: true }),
  createShippingMethod: (m) => request('/api/shipping/methods', { method: 'POST', body: m, auth: true }),
  updateShippingMethod: (id, m) => request(`/api/shipping/methods/${id}`, { method: 'PUT', body: m, auth: true }),
  deleteShippingMethod: (id) => request(`/api/shipping/methods/${id}`, { method: 'DELETE', auth: true }),
  getShippings: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/shipping${q ? '?' + q : ''}`, { auth: true });
  },
  createShipping: (s) => request('/api/shipping', { method: 'POST', body: s, auth: true }),
  updateShipping: (id, s) => request(`/api/shipping/${id}`, { method: 'PUT', body: s, auth: true }),

  // Voucher (admin)
  getVouchers: (activeOnly = false) => request(`/api/vouchers${activeOnly ? '?is_active=1' : ''}`, { auth: true }),
  createVoucher: (v) => request('/api/vouchers', { method: 'POST', body: v, auth: true }),
  updateVoucher: (id, v) => request(`/api/vouchers/${id}`, { method: 'PUT', body: v, auth: true }),
  deleteVoucher: (id) => request(`/api/vouchers/${id}`, { method: 'DELETE', auth: true }),

  // Đánh giá
  getReviews: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/reviews${q ? '?' + q : ''}`);
  },
  createReview: (r) => request('/api/reviews', { method: 'POST', body: r, auth: true }),
  updateReview: (id, r) => request(`/api/reviews/${id}`, { method: 'PUT', body: r, auth: true }),
  approveReview: (id, is_approved) => request(`/api/reviews/${id}/approve`, { method: 'PUT', body: { is_approved }, auth: true }),
  deleteReview: (id) => request(`/api/reviews/${id}`, { method: 'DELETE', auth: true }),
  getPendingReviews: () => request('/api/reviews/pending', { auth: true }),

  // Hồ sơ khách hàng
  getMe: () => request('/api/users/me', { auth: true }),
  updateMe: (payload) => request('/api/users/me', { method: 'PUT', body: payload, auth: true }),

  // Đổi trả / bảo hành / sửa chữa
  getReturns: (status) => request(`/api/returns${status ? '?status=' + status : ''}`, { auth: true }),
  createReturn: (r) => request('/api/returns', { method: 'POST', body: r, auth: true }),
  updateReturn: (id, payload) => request(`/api/returns/${id}`, { method: 'PUT', body: payload, auth: true }),
  getWarranties: (status) => request(`/api/warranties${status ? '?status=' + status : ''}`, { auth: true }),
  createWarranty: (w) => request('/api/warranties', { method: 'POST', body: w, auth: true }),
  updateWarranty: (id, payload) => request(`/api/warranties/${id}`, { method: 'PUT', body: payload, auth: true }),
  getRepairs: (status) => request(`/api/repairs${status ? '?status=' + status : ''}`, { auth: true }),
  createRepair: (r) => request('/api/repairs', { method: 'POST', body: r, auth: true }),
  updateRepair: (id, payload) => request(`/api/repairs/${id}`, { method: 'PUT', body: payload, auth: true }),

  // Báo cáo (admin)
  getReportSummary: () => request('/api/reports/summary', { auth: true }),
  getRevenueReport: ({ from, to, group = 'day' } = {}) =>
    request(`/api/reports/revenue?from=${from}&to=${to}&group=${group}`, { auth: true }),
  getTopProducts: (limit = 10) => request(`/api/reports/top-products?limit=${limit}`, { auth: true }),
  getReportLowStock: (threshold = 5) => request(`/api/reports/low-stock?threshold=${threshold}`, { auth: true }),
  getOrdersByStatus: () => request('/api/reports/orders-by-status', { auth: true }),
  getPaymentsByMethod: () => request('/api/reports/payments-by-method', { auth: true }),
};

// Định dạng tiền VND
export const fmtVND = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

// Định dạng ngày giờ
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
};

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
