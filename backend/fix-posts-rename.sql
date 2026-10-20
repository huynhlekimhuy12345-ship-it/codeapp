-- Đổi tên thương hiệu cũ còn sót trong bài blog (DB thật của shop).
-- Chạy bằng: node run-sql.js fix-posts-rename.sql   (trong thư mục backend)
-- Chạy lại nhiều lần cũng không sao (REPLACE chỉ đổi chỗ còn chữ cũ).
-- Bao cả các kiểu viết hoa/thường khác nhau.
UPDATE posts SET
  title   = REPLACE(title,   'Leather House', 'BI99'),
  excerpt = REPLACE(excerpt, 'Leather House', 'BI99'),
  content = REPLACE(content, 'Leather House', 'BI99');
UPDATE posts SET
  title   = REPLACE(title,   'leather house', 'BI99'),
  excerpt = REPLACE(excerpt, 'leather house', 'BI99'),
  content = REPLACE(content, 'leather house', 'BI99');
UPDATE posts SET
  title   = REPLACE(title,   'LEATHER HOUSE', 'BI99'),
  excerpt = REPLACE(excerpt, 'LEATHER HOUSE', 'BI99'),
  content = REPLACE(content, 'LEATHER HOUSE', 'BI99');
