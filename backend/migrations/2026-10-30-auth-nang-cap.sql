-- Nâng cấp tài khoản — BI99, 2026-10-30
-- Chạy 1 lần trong SSMS (trên database LeatherShop) khi cập nhật bản
-- "đăng ký bằng email hoặc số điện thoại + đăng nhập Google + quên mật khẩu".
--
-- 1) users.auth_provider: cách tạo tài khoản — 'local' (email/sđt + mật khẩu)
--    hoặc 'google'. Dùng để chặn trùng tài khoản: email đã có tài khoản thường
--    thì không cho đăng nhập Google tạo tài khoản thứ hai (và ngược lại).
--    Code chạy được cả khi CHƯA có cột này (mọi tài khoản coi là 'local'),
--    nhưng muốn dùng đăng nhập Google thì phải chạy file này.
--
-- 2) password_resets: mã xác nhận 6 số đặt lại mật khẩu (hạn 10 phút,
--    lưu dạng băm SHA-256, sai quá 5 lần tự hủy).

ALTER TABLE users ADD auth_provider NVARCHAR(20) NOT NULL
  CONSTRAINT DF_users_auth_provider DEFAULT 'local';
GO

CREATE TABLE password_resets (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  code_hash NVARCHAR(200) NOT NULL,
  expires_at DATETIME2 NOT NULL,
  used INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
