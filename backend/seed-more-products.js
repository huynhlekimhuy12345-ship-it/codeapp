// Script thêm 14 SẢN PHẨM ẢO (đợt 2) cho catalog BI99 — chạy tay bằng lệnh:
//   node seed-more-products.js       (trong thư mục backend)
// - Thêm theo TÊN: sản phẩm nào đã có trong DB sẽ bị bỏ qua → chạy lại an toàn.
// - Mỗi sản phẩm có sẵn mô tả chi tiết; ảnh là ảnh đồ da thật trên Pexels (đã kiểm tra sống).
// - Chạy XONG script này, chạy tiếp `node seed-gallery.js` để các sản phẩm mới
//   cũng có ảnh phụ ở trang chi tiết.
const db = require('./db');

const PX = (path) => `https://images.pexels.com/photos/${path}?auto=compress&cs=tinysrgb&w=800`;

// [tên, danh mục, mô tả, giá, tồn kho, ảnh]
const PRODUCTS = [
  ['Ví da bò gập ba', 'Ví da', 'Nhỏ gọn trong lòng bàn tay mà chứa được cả thế giới của bạn: tiền mặt, thẻ và giấy tờ xếp gọn trong ba lớp gập khéo léo. Da bò thật khâu tay chắc chắn, bề mặt đanh và lên bóng dần theo năm tháng. Một chiếc ví cho người đàn ông thích sự gọn gàng — bỏ túi nào cũng vừa, lấy ra lúc nào cũng sang.', 690000, 35, PX('915917/pexels-photo-915917.jpeg')],
  ['Ví đựng thẻ da bò', 'Ví da', 'Khi bạn chỉ cần mang theo vài tấm thẻ và ít tiền lẻ: chiếc ví thẻ mỏng nhẹ bằng da bò thật, ôm gọn trong túi áo hay túi quần mà không cộm. Các ngăn thẻ may vừa khít để thẻ không tuột, mép da mài nhẵn mịn tay. Càng dùng da càng bóng — món phụ kiện tối giản mà tinh tế cho nhịp sống hiện đại.', 290000, 120, PX('28028264/pexels-photo-28028264/free-photo-of-small-leather-card-holders.jpeg')],
  ['Ví nữ mini da thật', 'Ví da', 'Nhỏ xinh như một món trang sức: chiếc ví mini với sắc cam đất ấm áp, làm từ da thật mềm tay. Đựng vừa thẻ, tiền gập và những vật nhỏ xinh trong túi xách của nàng. Đường may tỉ mỉ, form ví cứng cáp giữ dáng lâu dài — càng dùng, màu da càng lên tông trầm sang trọng rất riêng.', 450000, 55, PX('37326694/pexels-photo-37326694/free-photo-of-minimalist-orange-leather-wallet-on-beige-background.jpeg')],
  ['Túi xách da bò sáp', 'Túi xách da', 'Da bò sáp với bề mặt lì và những vệt sáng tối tự nhiên như mây trời — mỗi chiếc túi là một bản duy nhất. Form túi rộng rãi cho ngày dài bận rộn: laptop mỏng, sổ tay, ví và cả thế giới của bạn đều có chỗ. Quai đeo chắc chắn, đường khâu tay đều đẹp; càng dùng, da sáp càng bóng và lên màu sâu đầy cuốn hút.', 2190000, 18, PX('31867644/pexels-photo-31867644/free-photo-of-close-up-of-brown-leather-bag-on-black-leather-surface.jpeg')],
  ['Túi xách da nữ đỏ đô', 'Túi xách da', 'Sắc đỏ đô trầm sang như ly rượu vang — điểm nhấn khiến mọi bộ trang phục bỗng có thần thái. Túi làm từ da thật với form đứng thanh lịch, quai xách vừa tay và ngăn trong bố trí gọn gàng. Dù đi làm, dự tiệc hay dạo phố cuối tuần, chiếc túi đỏ đô luôn biết cách làm bạn nổi bật một cách tinh tế.', 1690000, 22, PX('22434764/pexels-photo-22434764/free-photo-of-red-bag-on-white-background.jpeg')],
  ['Túi tote da nữ', 'Túi xách da', 'Chiếc tote da thật với khóa kéo mạ vàng sáng bóng — rộng rãi mà không hề xuề xòa. Đựng vừa laptop 13 inch, tài liệu và đồ cá nhân cho một ngày trọn vẹn từ văn phòng đến quán cà phê. Da mềm nhưng giữ form, quai đeo vai êm ái. Một chiếc túi “đi đâu cũng hợp” mà tủ đồ của nàng nào cũng nên có.', 1790000, 26, PX('27046147/pexels-photo-27046147/free-photo-of-leather-bags-in-a-studio.jpeg')],
  ['Thắt lưng da bò khóa kim', 'Thắt lưng da', 'Da bò nguyên tấm dày dặn kết hợp mặt khóa kim sáng bóng, phom dáng hiện đại. Sợi dây giữ phom quần chỉn chu, hợp cả quần tây công sở lẫn jeans thường ngày. Mép dây được mài nhẵn và sơn cạnh tỉ mỉ, càng dùng da càng bóng đẹp — chi tiết nhỏ nâng tầm cả bộ trang phục.', 550000, 70, PX('31432650/pexels-photo-31432650/free-photo-of-luxury-leather-belt-with-metallic-buckle.png')],
  ['Thắt lưng da bò khóa đồng', 'Thắt lưng da', 'Mặt khóa đồng thau với sắc vàng trầm ấm, càng dùng càng lên màu vintage rất có hồn. Thân dây là da bò thật nguyên miếng, đanh và bền, ôm eo vừa vặn suốt ngày dài. Một sợi thắt lưng cho người đàn ông yêu vẻ đẹp cổ điển — phối cùng giày da nâu là trọn vẹn một phong cách lịch lãm.', 590000, 65, PX('35392687/pexels-photo-35392687/free-photo-of-high-quality-leather-belt-with-brass-buckle.jpeg')],
  ['Giày tây da bò Derby', 'Giày da', 'Phom Derby nâu trầm với phần buộc dây mở linh hoạt — dễ xỏ, ôm chân và lịch lãm không kém Oxford. Da bò thật được hoàn thiện thủ công, đế chắc chắn êm bước. Từ phòng họp đến tiệc cưới, đôi Derby luôn giữ cho bạn vẻ ngoài chỉn chu; càng đi, da càng mềm và bóng đẹp theo dấu chân của riêng bạn.', 1890000, 28, PX('33039735/pexels-photo-33039735/free-photo-of-elegant-brown-leather-shoes-on-wooden-table.jpeg')],
  ['Giày thuyền da bò', 'Giày da', 'Đôi boat shoes bằng da bò với đế trắng trẻ trung — sinh ra cho những ngày rong ruổi: dạo phố, cà phê, du lịch biển. Da mềm êm chân ngay từ lần mang đầu, dây da buộc quanh cổ giày là điểm nhấn thủ công tinh tế. Càng mang, da càng lên màu nắng gió — đúng tinh thần tự do của những chuyến đi.', 1290000, 34, PX('7887198/pexels-photo-7887198.jpeg')],
  ['Giày tây da đen bóng', 'Giày da', 'Sắc đen bóng sang trọng trên phom giày tây cổ điển — đôi giày dành cho những dịp quan trọng nhất: lễ cưới, sự kiện, buổi ký kết. Da bò thật được đánh bóng thủ công, đế khâu chắc chắn. Mang vào là dáng đứng thẳng, bước đi tự tin — khí chất của một quý ông thực thụ.', 1990000, 24, PX('37465528/pexels-photo-37465528/free-photo-of-elegant-black-formal-shoes-on-grey-background.jpeg')],
  ['Áo khoác da bò nâu vintage', 'Áo khoác da', 'Sắc nâu vintage như đã đi qua nhiều mùa nắng gió — chiếc áo khoác da bò cho người đàn ông yêu vẻ đẹp phong trần. Da dày, đanh, form áo ôm vừa người; càng mặc, da càng mềm và lên những vệt sáng tối rất riêng không chiếc áo thứ hai nào có. Một món đồ để đời, mặc năm này qua năm khác vẫn chất.', 3190000, 14, PX('32555321/pexels-photo-32555321/free-photo-of-young-man-in-urban-parking-garage-setting.jpeg')],
  ['Áo khoác da nữ đen', 'Áo khoác da', 'Chiếc áo khoác da đen với phom dáng gọn gàng, tôn eo và vai — khoác ngoài váy hay phối cùng jeans đều toát lên vẻ cá tính, hiện đại. Da thật mềm, nhẹ, không cứng vai; đường may tỉ mỉ theo form dáng phụ nữ Á Đông. Một chiếc áo khiến nàng bước xuống phố với thần thái tự tin và cuốn hút khó quên.', 2690000, 16, PX('15161530/pexels-photo-15161530/free-photo-of-a-woman-in-black-leather-jacket-posing.jpeg')],
  ['Bộ ví da + ví thẻ cao cấp', 'Phụ kiện da', 'Bộ đôi hoàn hảo cho người yêu sự ngăn nắp: một ví da bò đựng tiền và một ví thẻ mỏng nhẹ đi kèm, cùng tông màu, cùng chất da thật khâu tay. Mua cho mình để dùng đồng bộ, hay làm quà tặng sinh nhật, tân gia đều sang trọng và thiết thực. Da càng dùng càng bóng — bộ đôi sẽ đồng hành cùng bạn nhiều năm tháng.', 1190000, 40, PX('7952556/pexels-photo-7952556.jpeg')],
];

(async () => {
  let added = 0;
  for (const [name, catName, desc, price, stock, img] of PRODUCTS) {
    const cat = await db.prepare('SELECT id FROM categories WHERE name = ?').get(catName);
    if (!cat) { console.log(`— Không thấy danh mục "${catName}" (bỏ qua "${name}")`); continue; }
    const exists = await db.prepare('SELECT id FROM products WHERE name = ?').get(name);
    if (exists) { console.log(`— Đã có: ${name}`); continue; }
    await db.prepare(
      'INSERT INTO products (category_id, name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(cat.id, name, desc, price, stock, img);
    added++;
    console.log(`✓ Đã thêm: ${name}`);
  }
  console.log(`Xong: thêm mới ${added}/${PRODUCTS.length} sản phẩm.`);
  process.exit(0);
})().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
