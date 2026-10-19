-- Fix ảnh sản phẩm mẫu bị sai — chạy trên DB thật của shop (sqlite3 leather_shop.db < fix-product-images.sql)
-- Mỗi câu UPDATE khớp theo tên sản phẩm. Kiểm tra số dòng ảnh hưởng sau khi chạy.

UPDATE products SET image_url='https://images.pexels.com/photos/20015774/pexels-photo-20015774.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Ví da nữ dáng dài';
UPDATE products SET image_url='https://images.pexels.com/photos/12865963/pexels-photo-12865963.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Ví da cá sấu nam';
UPDATE products SET image_url='https://images.pexels.com/photos/10973347/pexels-photo-10973347.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Túi xách da công sở';
UPDATE products SET image_url='https://images.pexels.com/photos/3155047/pexels-photo-3155047.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Balo da du lịch';
UPDATE products SET image_url='https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Túi đeo chéo da nam';
UPDATE products SET image_url='https://images.pexels.com/photos/30975839/pexels-photo-30975839.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Thắt lưng da cá sấu';
UPDATE products SET image_url='https://images.pexels.com/photos/10340815/pexels-photo-10340815.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Thắt lưng da lộn casual';
UPDATE products SET image_url='https://images.pexels.com/photos/10259873/pexels-photo-10259873.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Giày lười da nam';
UPDATE products SET image_url='https://images.pexels.com/photos/16060730/pexels-photo-16060730.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Áo khoác da cừu bomber';
UPDATE products SET image_url='https://images.pexels.com/photos/10854422/pexels-photo-10854422.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Áo vest da nam';
UPDATE products SET image_url='https://images.pexels.com/photos/15440419/pexels-photo-15440419.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Móc khóa da khắc tên';
UPDATE products SET image_url='https://images.pexels.com/photos/14833708/pexels-photo-14833708.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Bao da điện thoại';
UPDATE products SET image_url='https://images.pexels.com/photos/1265619/pexels-photo-1265619.jpeg?auto=compress&cs=tinysrgb&w=800' WHERE name='Dây đồng hồ da';
