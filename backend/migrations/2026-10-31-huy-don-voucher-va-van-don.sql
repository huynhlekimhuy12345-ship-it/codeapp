-- BI99 2026-10-31 — Hủy đơn hoàn voucher + vận đơn của đơn hủy
-- Chạy 1 lần trong SSMS (database LeatherShop). Cả 2 phần đều có kiểm tra
-- trước nên chạy lại lần 2 không lỗi.
--
-- 1) orders.voucher_code: mã voucher khách đã dùng cho đơn đó. Trước đây
--    checkout chỉ tăng vouchers.used_count mà không lưu mã, nên hủy đơn
--    không biết hoàn lượt cho mã nào. Từ bản này checkout lưu mã vào đơn,
--    mọi đường hủy (staff hủy / khách tự hủy / quét quá hạn / xóa đơn)
--    đều hoàn lại 1 lượt cho đúng mã. Đơn đặt TRƯỚC bản này không có mã
--    nên không hoàn tự động được.
IF COL_LENGTH('dbo.orders', 'voucher_code') IS NULL
  ALTER TABLE dbo.orders ADD voucher_code NVARCHAR(450) NULL;
GO

-- 2) Nới CHECK constraint của bảng shippings thêm trạng thái 'cancelled'
--    (tên CK_shippings_1 đã xác minh trên DB thật ngày 31/10 — trước đây chỉ
--    có failed/delivered/shipped/preparing). Khi đơn bị hủy, dòng vận đơn
--    đi kèm chuyển sang 'cancelled' thay vì treo mãi ở 'preparing'.
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_shippings_1'
             AND parent_object_id = OBJECT_ID('dbo.shippings'))
  ALTER TABLE dbo.shippings DROP CONSTRAINT CK_shippings_1;
GO
ALTER TABLE dbo.shippings ADD CONSTRAINT CK_shippings_1
  CHECK ([status]='failed' OR [status]='delivered' OR [status]='shipped'
      OR [status]='preparing' OR [status]='cancelled');
GO
