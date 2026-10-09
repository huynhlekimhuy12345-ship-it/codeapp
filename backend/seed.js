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


// 4. Bài viết Blog mẫu (port từ web artifact Leather House)
const blogPosts = [
  {
    "title": "Cách bảo quản đồ da bền đẹp theo thời gian",
    "slug": "cach-bao-quan-do-da-ben-dep",
    "coverImageUrl": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Đồ da thật càng dùng càng bóng đẹp nếu được chăm sóc đúng cách. Cùng Leather House tìm hiểu các nguyên tắc vệ sinh, dưỡng ẩm và cất giữ để chiếc túi, ví da của bạn bền đẹp nhiều năm.",
    "content": "Da bò thật là chất liệu \"sống\": càng dùng lâu, bề mặt da càng lên nước, mềm và bóng đẹp — người chơi da gọi đó là patina. Nhưng để da đạt được vẻ đẹp ấy, bạn cần chăm sóc đúng cách.\n\n1. Vệ sinh đúng cách\nDùng khăn mềm khô hoặc hơi ẩm lau nhẹ bề mặt để loại bỏ bụi bẩn. Tuyệt đối không ngâm nước, không dùng hóa chất tẩy rửa mạnh hay xăng, cồn lên bề mặt da. Với vết bẩn cứng đầu, hãy dùng dung dịch vệ sinh chuyên dụng cho đồ da.\n\n2. Dưỡng ẩm cho da\nSau khi vệ sinh, thoa một lớp mỏng kem dưỡng da (leather conditioner) hoặc mỡ chồn, để khoảng 15 phút rồi lau lại bằng khăn sạch. Dưỡng ẩm giúp da không bị khô nứt, giữ độ mềm mại và màu sắc đều đẹp. Chỉ cần thực hiện 1–2 tháng một lần.\n\n3. Cất giữ nơi khô thoáng\nKhi không sử dụng, hãy nhồi giấy mềm vào trong túi/ví để giữ form, cho vào túi vải chống bụi và để nơi khô ráo, tránh ánh nắng trực tiếp. Không bọc đồ da trong túi nilon kín vì da cần \"thở\"; môi trường ẩm kín dễ khiến da mốc.\n\n4. Xử lý khi bị ướt\nNếu đồ da dính mưa, thấm khô bằng khăn mềm và để khô tự nhiên ở nhiệt độ phòng. Không dùng máy sấy hay phơi nắng gắt — nhiệt độ cao làm da co, cứng và nứt.\n\n5. Mang đi bảo dưỡng định kỳ\nVới sản phẩm của Leather House, bạn được bảo hành 12 tháng và hỗ trợ bảo dưỡng, đánh bóng, sửa đường chỉ trọn đời tại xưởng. Đừng ngần ngại mang sản phẩm ghé xưởng để thợ da kiểm tra và chăm sóc giúp bạn.",
    "daysAgo": 2
  },
  {
    "title": "Cách phân biệt da thật và da giả đơn giản, chính xác",
    "slug": "cach-phan-biet-da-that-da-gia",
    "coverImageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Da thật, da PU, da microfiber... thị trường có quá nhiều loại \"da\" khiến người mua bối rối. Bài viết này giúp bạn nhận biết da bò thật chỉ với vài thao tác đơn giản.",
    "content": "Không phải sản phẩm nào gắn mác \"da\" cũng là da thật. Dưới đây là những cách phân biệt đơn giản mà thợ da lâu năm vẫn dùng.\n\n1. Quan sát bề mặt\nDa thật có lỗ chân lông tự nhiên, vân da không đều và không lặp lại theo quy luật. Da giả (PU, simili) có bề mặt quá đồng đều, vân da lặp đi lặp lại như được in khuôn.\n\n2. Ấn tay kiểm tra độ đàn hồi\nDùng ngón tay ấn mạnh lên bề mặt da rồi thả ra. Da thật sẽ xuất hiện các nếp nhăn li ti quanh chỗ ấn và nhanh chóng trở lại trạng thái ban đầu. Da giả bị ấn sẽ không tạo nếp nhăn tự nhiên hoặc để lại vết lõm lâu.\n\n3. Kiểm tra bằng nước\nNhỏ một giọt nước lên bề mặt. Da thật thấm nước từ từ và để lại vệt sẫm màu khi thấm. Da giả có lớp phủ nhựa nên nước đọng thành giọt, trượt đi mà không thấm.\n\n4. Ngửi mùi\nDa thật có mùi ngai ngái đặc trưng của da thuộc. Da giả thường có mùi nhựa, mùi hóa chất hắc.\n\n5. Kiểm tra mặt trái và cạnh cắt\nMặt trái của da thật là lớp da lộn xù xì, sờ vào thấy nhám tay. Da giả mặt trái thường là lớp vải hoặc foam trơn. Ở cạnh cắt, da thật cho thấy các sợi da xốp đan xen, còn da giả lộ rõ lớp nhựa và lớp vải nền.\n\nLưu ý: một số loại da giả cao cấp (microfiber) khá giống da thật. Cách chắc chắn nhất là mua tại xưởng, cửa hàng uy tín có cam kết chất liệu và chính sách bảo hành rõ ràng — như cam kết da bò thật 100% tại Leather House.",
    "daysAgo": 6
  },
  {
    "title": "Gợi ý phối đồ với túi da cho quý ông lịch lãm",
    "slug": "phoi-do-voi-tui-da-quy-ong",
    "coverImageUrl": "https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Một chiếc túi da đúng gu có thể nâng tầm cả bộ trang phục. Khám phá các nguyên tắc phối màu và chọn kiểu túi da phù hợp với phong cách công sở, dạo phố hay du lịch.",
    "content": "Túi da không chỉ là vật đựng đồ — đó là tuyên ngôn phong cách. Dưới đây là những nguyên tắc phối đồ với túi da được nhiều quý ông tin dùng.\n\n1. Đồng điệu màu với giày và thắt lưng\nNguyên tắc kinh điển: màu túi da nên cùng tông với giày da và thắt lưng. Nâu đi với nâu, đen đi với đen. Sự đồng điệu này tạo tổng thể chỉn chu, sang trọng mà không cần cố gắng.\n\n2. Chọn kiểu túi theo hoàn cảnh\nĐi làm công sở: túi xách tay (briefcase) hoặc túi đeo chéo dáng đứng, màu nâu sẫm hoặc đen, phom cứng cáp. Dạo phố cuối tuần: túi đeo chéo nhỏ gọn màu nâu bò sáng, phối cùng áo thun, sơ mi khoác ngoài và giày sneaker da. Du lịch: balo da hoặc túi trống (duffle) rộng rãi, da sáp càng dùng càng đẹp và không ngại va quệt.\n\n3. Cân đối kích thước túi với vóc dáng\nNgười cao lớn hợp với túi khổ lớn; người nhỏ nhắn nên chọn túi vừa và nhỏ để tổng thể cân đối. Túi quá khổ so với người mặc sẽ \"nuốt\" mất trang phục.\n\n4. Để chất da làm điểm nhấn\nKhi đã mang túi da thật với vân da đẹp, hãy giữ trang phục đơn giản: áo trơn, quần tối màu. Chiếc túi sẽ tự lên tiếng. Ngược lại, trang phục nhiều họa tiết đi cùng túi da trơn là lựa chọn an toàn.\n\n5. Chăm sóc để túi luôn \"có hồn\"\nMột chiếc túi da bóng đẹp, lên patina đều màu luôn gây ấn tượng hơn túi mới tinh. Hãy dưỡng da định kỳ và dùng túi thường xuyên — da thật đẹp lên chính nhờ được sử dụng.",
    "daysAgo": 11
  },
  {
    "title": "Quy trình chế tác một chiếc túi da thủ công tại xưởng",
    "slug": "quy-trinh-che-tac-tui-da-thu-cong",
    "coverImageUrl": "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Từ tấm da bò nguyên miếng đến chiếc túi hoàn thiện trên tay bạn là hành trình qua 7 công đoạn thủ công tỉ mỉ. Mời bạn ghé thăm xưởng của Leather House qua bài viết này.",
    "content": "Mỗi chiếc túi da thủ công tại Leather House mất từ 6 đến 10 giờ chế tác liên tục. Khác với hàng sản xuất hàng loạt, mọi công đoạn đều qua tay người thợ.\n\nBước 1: Chọn da\nThợ chọn tấm da bò thuộc thảo mộc (vegetable-tanned), kiểm tra độ dày, vân da, vết sẹo tự nhiên. Chỉ phần da lưng — phần đẹp và bền nhất của tấm da — mới dùng làm thân túi.\n\nBước 2: Cắt rập\nRập giấy được đặt lên da, cắt bằng dao chuyên dụng theo thớ da để sản phẩm không bị giãn, biến dạng khi sử dụng lâu dài.\n\nBước 3: Lạng mỏng và xử lý cạnh\nCác mép ghép được lạng mỏng để đường may không bị cộm. Cạnh da được mài, nhuộm và đánh bóng nhiều lớp bằng sáp ong cho đến khi mịn và bóng.\n\nBước 4: Đục lỗ và khâu tay\nThợ dùng dùi đục từng lỗ may theo khoảng cách đều tăm tắp, rồi khâu bằng kỹ thuật khâu hai kim (saddle stitch) với chỉ sáp — đường khâu bền hơn máy may vì đứt một mũi, mũi còn lại vẫn giữ chắc.\n\nBước 5: Gắn phụ kiện\nKhóa, khoen, đinh tán bằng đồng thau nguyên chất được gắn và kiểm tra độ chắc chắn, độ mượt khi đóng mở.\n\nBước 6: Hoàn thiện và lên dầu\nToàn bộ sản phẩm được thoa dầu dưỡng, đánh bóng thủ công, kiểm tra từng đường chỉ trước khi đóng gói.\n\nĐó là lý do một chiếc túi da thủ công có thể đồng hành cùng bạn 5–10 năm, càng dùng càng đẹp — và luôn mang dấu ấn riêng không chiếc nào giống chiếc nào.",
    "daysAgo": 18
  },
];
const blogBefore = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
if (blogBefore === 0) {
  const insPost = db.prepare(
    'INSERT INTO posts (title, slug, cover_image_url, excerpt, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const p of blogPosts) {
    const d = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    insPost.run(p.title, p.slug, p.coverImageUrl, p.excerpt, p.content, 'published', d, d);
  }
  console.log(`  - Đã thêm ${blogPosts.length} bài viết blog mẫu`);
} else {
  console.log(`  - Đã có ${blogBefore} bài viết, bỏ qua seed blog`);
}

console.log('Seed hoàn tất!');
