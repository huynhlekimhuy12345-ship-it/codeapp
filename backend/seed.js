// Seed dữ liệu mẫu: admin, danh mục, sản phẩm đồ da
const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('Đang seed dữ liệu...');

// 1. Tài khoản admin mặc định
const adminEmail = 'admin@dodashop.vn';
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!adminExists) {
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Quản trị viên', adminEmail, bcrypt.hashSync('admin123', 10), 'admin');
  console.log('  - Đã tạo admin: admin@dodashop.vn / admin123');
}

// 2. Danh mục
const categories = [
  ['Ví da', 'Ví nam, ví nữ làm từ da bò thật, da cá sấu'],
  ['Túi xách da', 'Túi xách, cặp công sở, balo da cao cấp'],
  ['Thắt lưng da', 'Thắt lưng da bò, da cá sấu cho nam'],
  ['Giày da', 'Giày tây, giày lười, boots da thật'],
  ['Áo khoác da', 'Áo khoác da bò, da cừu thời trang'],
  ['Phụ kiện da', 'Móc khóa, bao điện thoại, dây đồng hồ da'],
];
const catIds = {};
for (const [name, desc] of categories) {
  let row = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (!row) {
    const info = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, desc);
    row = { id: info.lastInsertRowid };
  }
  catIds[name] = row.id;
}

// 3. Sản phẩm (giá VND, ảnh Unsplash)
const U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const products = [
  // Ví da
  ['Ví da bò nam cao cấp', 'Ví da', 'Ví nam da bò thật 100%, khâu tay tỉ mỉ, nhiều ngăn đựng thẻ và tiền mặt.', 890000, 50, U('photo-1627123424574-724758594e93')],
  ['Ví da nữ dáng dài', 'Ví da', 'Ví nữ dáng dài da mềm, khóa kéo YKK, nhiều màu sang trọng.', 750000, 40, U('photo-1589756823695-278bc923f962')],
  ['Ví da cá sấu nam', 'Ví da', 'Ví nam vân da cá sấu thật, đẳng cấp doanh nhân.', 2490000, 20, U('photo-1620109176813-e91290f6c5d2')],
  // Túi xách da
  ['Túi xách da công sở', 'Túi xách da', 'Cặp da công sở đựng vừa laptop 15.6 inch, da bò sáp cao cấp.', 1890000, 25, U('photo-1548036328-c9fa89d128fa')],
  ['Balo da du lịch', 'Túi xách da', 'Balo da bò mềm, phong cách vintage, sức chứa lớn.', 1590000, 30, U('photo-1553062407-98eeb64c6a62')],
  ['Túi đeo chéo da nam', 'Túi xách da', 'Túi đeo chéo da bò nhỏ gọn, tiện lợi dạo phố.', 990000, 45, U('photo-1590874103328-eac38a683ce7')],
  // Thắt lưng da
  ['Thắt lưng da bò mặt khóa tự động', 'Thắt lưng da', 'Thắt lưng da bò nguyên tấm, khóa tự động cao cấp.', 490000, 80, U('photo-1624222247344-550fb60583dc')],
  ['Thắt lưng da cá sấu', 'Thắt lưng da', 'Thắt lưng vân cá sấu sang trọng, quà tặng ý nghĩa.', 1290000, 35, U('photo-1553704571-c32d20e6c74f1')],
  ['Thắt lưng da lộn casual', 'Thắt lưng da', 'Thắt lưng da lộn phong cách trẻ trung, dễ phối đồ.', 390000, 60, U('photo-1584865288642-42078afe6942')],
  // Giày da
  ['Giày tây da bò Oxford', 'Giày da', 'Giày tây Oxford da bò thật, đế da khâu Goodyear.', 2190000, 30, U('photo-1614252235316-8c857d38b5f4')],
  ['Giày lười da nam', 'Giày da', 'Giày lười da mềm êm chân, phong cách công sở trẻ trung.', 1490000, 40, U('photo-1533867617858-e7b97e060509')],
  ['Boots da cổ cao', 'Giày da', 'Boots da bò cổ cao, phong cách bụi bặm cá tính.', 1990000, 25, U('photo-1520639888713-7851133b1ed0')],
  // Áo khoác da
  ['Áo khoác da bò biker', 'Áo khoác da', 'Áo khoác da bò phong cách biker, lót nỉ ấm áp.', 3490000, 15, U('photo-1551028719-00167b16eac5')],
  ['Áo khoác da cừu bomber', 'Áo khoác da', 'Áo bomber da cừu mềm nhẹ, form dáng hiện đại.', 2990000, 18, U('photo-1520975954732-35dd22299614')],
  ['Áo vest da nam', 'Áo khoác da', 'Áo vest da sang trọng cho quý ông lịch lãm.', 2790000, 12, U('photo-1591047139829-d91aecb6caea')],
  // Phụ kiện da
  ['Móc khóa da khắc tên', 'Phụ kiện da', 'Móc khóa da bò khắc tên theo yêu cầu, quà tặng độc đáo.', 149000, 100, U('photo-1611085583191-a3b181a88401')],
  ['Bao da điện thoại', 'Phụ kiện da', 'Bao da điện thoại handmade, vừa nhiều dòng máy.', 299000, 70, U('photo-1601593346740-925612772716')],
  ['Dây đồng hồ da', 'Phụ kiện da', 'Dây đồng hồ da bò, da cá sấu nhiều size.', 349000, 90, U('photo-1524805444758-089113d48a6d')],
];

const countBefore = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (countBefore === 0) {
  const ins = db.prepare(
    'INSERT INTO products (category_id, name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const [name, cat, desc, price, stock, img] of products) {
    ins.run(catIds[cat], name, desc, price, stock, img);
  }
  console.log(`  - Đã thêm ${products.length} sản phẩm mẫu`);
} else {
  console.log(`  - Đã có ${countBefore} sản phẩm, bỏ qua seed sản phẩm`);
}

console.log('Seed hoàn tất!');
