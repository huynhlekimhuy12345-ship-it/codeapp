-- Bổ sung cột hạng đặt tay cho bảng users — BI99, 2026-10-29
-- Chạy 1 lần trong SSMS (trên database LeatherShop) trước khi dùng tính năng
-- "Đặt hạng" ở trang quản trị > Hạng thành viên.
--
-- Ý nghĩa: tier_override = NULL  -> hạng tự tính theo chi tiêu như cũ.
--          tier_override có giá trị (potential/bronze/silver/gold/diamond)
--                               -> hạng do admin đặt, thắng hạng tự tính ở mọi nơi
--                                  (trang hạng của khách, thẻ giảm giá, danh sách admin).
-- Thêm cột nullable, không đụng dữ liệu hiện có, chạy lại lần 2 sẽ báo lỗi đã tồn tại (bỏ qua được).

ALTER TABLE users ADD tier_override NVARCHAR(20) NULL;
