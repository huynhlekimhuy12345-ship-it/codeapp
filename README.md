# Đồ Da Shop 👜

Website bán đồ da thật cao cấp — viết lại sạch sẽ, đầy đủ nghiệp vụ CRUD, **không chatbot, không đặt lịch sửa chữa, không cổng thanh toán** (chỉ COD - thanh toán khi nhận hàng).

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js + Express + SQLite (better-sqlite3) + JWT |
| Frontend | React 18 + Vite + React Router, CSS thuần |
| Auth | bcryptjs (mã hóa mật khẩu) + jsonwebtoken |

## Cấu trúc thư mục

```
leather-shop/
├── backend/
│   ├── server.js            # Express app, API routes, phục vụ frontend build
│   ├── db.js                # Khởi tạo SQLite + tạo bảng
│   ├── seed.js              # Dữ liệu mẫu (npm run seed)
│   ├── middleware/auth.js   # auth (JWT) + adminOnly
│   └── routes/
│       ├── auth.js          # đăng ký / đăng nhập / me
│       ├── categories.js    # CRUD danh mục
│       ├── products.js      # CRUD sản phẩm + lọc/tìm kiếm/phân trang
│       ├── orders.js        # đặt hàng, xem đơn, cập nhật trạng thái
│       └── users.js         # quản lý người dùng (admin)
└── frontend/
    └── src/
        ├── api.js           # client gọi API + fmtVND
        ├── context/StoreContext.jsx  # auth + giỏ hàng (localStorage)
        ├── components/      # Navbar, Footer, ProductCard
        └── pages/           # Home, Shop, ProductDetail, Cart, Checkout,
                             # Login, Register, MyOrders, Admin
```

## Cài đặt & chạy

```bash
# 1. Backend
cd backend
npm install
npm run seed     # tạo admin + 6 danh mục + 18 sản phẩm mẫu
npm start        # chạy tại http://localhost:5000

# 2. Frontend (terminal khác)
cd frontend
npm install
npm run dev      # chạy tại http://localhost:5173 (proxy /api về backend)

# Hoặc build frontend để backend phục vụ trực tiếp:
cd frontend && npm run build
cd ../backend && npm start   # mở http://localhost:5000
```

## Tài khoản mặc định

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@dodashop.vn` | `admin123` |

## API tóm tắt

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/auth/register` | công khai | Đăng ký |
| POST | `/api/auth/login` | công khai | Đăng nhập, trả về JWT |
| GET | `/api/auth/me` | đã đăng nhập | Thông tin user hiện tại |
| GET | `/api/products?category=&search=&sort=&page=&limit=` | công khai | Danh sách sản phẩm |
| GET | `/api/products/:id` | công khai | Chi tiết sản phẩm |
| POST/PUT/DELETE | `/api/products[/:id]` | admin | Thêm/sửa/xóa sản phẩm |
| GET/POST | `/api/categories` | GET công khai, write admin | Danh mục |
| PUT/DELETE | `/api/categories/:id` | admin | Sửa/xóa danh mục |
| POST | `/api/orders` | đã đăng nhập | Đặt hàng (tự trừ tồn kho) |
| GET | `/api/orders` | đã đăng nhập | Đơn của mình (admin: tất cả, lọc `?status=`) |
| GET | `/api/orders/:id` | chủ đơn/admin | Chi tiết đơn hàng |
| PUT | `/api/orders/:id/status` | admin | Đổi trạng thái đơn |
| GET | `/api/users` | admin | Danh sách người dùng |
| PUT | `/api/users/:id/role` | admin | Đổi vai trò admin/customer |

Trạng thái đơn hàng: `pending` → `confirmed` → `shipping` → `delivered`, hoặc `cancelled`.

## Quy trình mua hàng (COD)

1. Khách xem sản phẩm → thêm vào giỏ (lưu localStorage)
2. Đăng nhập/đăng ký → nhập thông tin giao hàng tại trang Thanh toán
3. Đặt hàng → tồn kho tự động trừ → đơn ở trạng thái "Chờ xác nhận"
4. Admin vào trang Quản trị → Đơn hàng → duyệt / chuyển trạng thái
5. Khách theo dõi đơn tại trang "Đơn hàng"
