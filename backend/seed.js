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

// 1b. Tài khoản nhân viên sale mặc định (đăng nhập xong đổi mật khẩu ngay)
const saleAccounts = [
  ['Nhân viên sale 1', 'sale@dodashop.vn', 'sale123'],
  ['Nhân viên sale 2', 'sale2@dodashop.vn', 'sale123'],
];
for (const [name, email, password] of saleAccounts) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!exists) {
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email, bcrypt.hashSync(password, 10), 'sale');
    console.log(`  - Đã tạo sale: ${email} / ${password}`);
  }
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
  ['Ví da bò nam cao cấp', 'Ví da', 'Được cắt từ tấm da bò nguyên miếng thuộc thảo mộc và khâu tay hai kim tại xưởng BI99 Hội An, chiếc ví giữ nguyên vân da cùng lỗ chân lông tự nhiên — sờ vào là cảm nhận được chất da thật đanh, dày và “sống”. Bên trong, các ngăn thẻ và ngăn tiền mặt được tính toán vừa vặn cho nhịp sống hằng ngày: đủ gọn để bỏ túi quần, đủ sang để đặt lên bàn làm việc. Càng dùng, da càng lên nước bóng patina sậm màu rất riêng — chiếc ví không cũ đi, nó trưởng thành cùng bạn.', 890000, 50, U('photo-1627123424574-724758594e93')],
  ['Ví da nữ dáng dài', 'Ví da', 'Dáng dài thanh thoát với những đường cong mềm mại, chiếc ví được làm từ da thật mềm tay, khóa kéo YKK trơn tru và lớp lót mịn êm. Các ngăn đựng tiền, thẻ và điện thoại được bố trí rộng rãi mà form ví vẫn gọn gàng khi cầm tay hay bỏ vào túi xách. Sắc da lên màu đều và bóng dần theo thời gian, như một món trang sức lặng lẽ tôn lên phong cách của người phụ nữ hiện đại — dịu dàng mà đầy khí chất.', 750000, 40, 'https://images.pexels.com/photos/20015774/pexels-photo-20015774.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Ví da cá sấu nam', 'Ví da', 'Vân cá sấu nổi khối, sắc nét và không tấm nào giống tấm nào — đó là dấu ấn của đẳng cấp thật sự. Chiếc ví được chế tác thủ công từ da vân cá sấu cao cấp, đường khâu tay đều tăm tắp, mép da lạng mỏng và đánh bóng bằng tay đến khi mịn màng. Đây không chỉ là nơi giữ tiền và giấy tờ: mỗi lần rút ví là một lần khẳng định vị thế của người đàn ông thành đạt. Một món quà xứng tầm dành cho đối tác, cấp trên hay người cha đáng kính.', 2490000, 20, 'https://images.pexels.com/photos/12865963/pexels-photo-12865963.jpeg?auto=compress&cs=tinysrgb&w=800'],
  // Túi xách da
  ['Túi xách da công sở', 'Túi xách da', 'Sinh ra cho những ngày làm việc bận rộn: ngăn chính đựng vừa laptop 15.6 inch cùng tài liệu, ngăn phụ để điện thoại, ví và vật dụng nhỏ luôn nằm đúng chỗ. Da bò sáp cao cấp cho bề mặt lì sang trọng, càng dùng càng bóng và lên màu sâu rất “tây”. Quai xách cùng các điểm chịu lực được gia cố khâu kép, form túi đứng vững dù mang nặng. Đồng hành cùng bộ suit hay chiếc sơ mi, chiếc cặp giúp bạn bước vào phòng họp với vẻ chỉn chu và tự tin hơn hẳn.', 1890000, 25, 'https://images.pexels.com/photos/10973347/pexels-photo-10973347.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Balo da du lịch', 'Túi xách da', 'Một chiếc balo da bò mềm mang tinh thần vintage — như những chuyến đi không vội vã. Sức chứa lớn cho laptop, quần áo và vật dụng cá nhân, đủ cho chuyến công tác ngắn ngày hay cuối tuần rong ruổi. Da mềm ôm vai, quai đeo êm, khóa và đường chỉ làm chắc chắn để đồng hành cùng bạn qua nhiều hành trình. Theo thời gian, bề mặt da ghi lại dấu vết của từng chuyến đi bằng lớp patina sậm màu — mỗi vết xước nhỏ là một câu chuyện.', 1590000, 30, 'https://images.pexels.com/photos/3155047/pexels-photo-3155047.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Túi đeo chéo da nam', 'Túi xách da', 'Nhỏ gọn mà vừa đủ cho cả thế giới của bạn: điện thoại, ví, chìa khóa, tai nghe — tất cả nằm gọn trong chiếc túi đeo chéo bằng da bò thật, khâu tay chắc chắn. Đeo chéo trước ngực khi dạo phố, lệch vai khi cà phê cuối tuần; form túi gọn gàng, không cồng kềnh mà vẫn nam tính. Da bò càng đeo càng mềm và bóng, biến món phụ kiện hằng ngày thành điểm nhấn phong cách rất riêng của bạn.', 990000, 45, 'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=800'],
  // Thắt lưng da
  ['Thắt lưng da bò mặt khóa tự động', 'Thắt lưng da', 'Một tấm da bò nguyên miếng — không ghép, không ép keo — dày dặn và đanh tay, kết hợp mặt khóa tự động cao cấp đóng mở nhẹ nhàng mà không cần đục lỗ. Sợi dây ôm eo vừa vặn, giữ phom quần chỉn chu suốt ngày dài ở văn phòng hay trong những buổi gặp gỡ quan trọng. Bề mặt da càng dùng càng bóng đẹp, mặt khóa giữ nguyên độ sáng — một chi tiết nhỏ nhưng đủ nâng tầm cả bộ trang phục.', 490000, 80, U('photo-1624222247344-550fb60583dc')],
  ['Thắt lưng da cá sấu', 'Thắt lưng da', 'Vân cá sấu sang trọng với những mảng vân lớn nhỏ đan xen tự nhiên — mỗi sợi dây là duy nhất. Da được thuộc và hoàn thiện thủ công, mép dây mài nhẵn, sơn cạnh tỉ mỉ; mặt khóa chắc tay và sáng bóng. Đây là món quà đầy ý nghĩa dành cho người đàn ông bạn trân trọng: một sợi thắt lưng không chỉ giữ trang phục ngay ngắn, mà còn giữ cả sự tự tin và đẳng cấp của người đeo.', 1290000, 35, 'https://images.pexels.com/photos/30975839/pexels-photo-30975839.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Thắt lưng da lộn casual', 'Thắt lưng da', 'Bề mặt da lộn mịn như nhung với sắc màu trầm ấm — sợi thắt lưng dành cho những ngày không cần quá trịnh trọng. Phong cách trẻ trung, dễ phối cùng quần jeans, kaki hay chinos; đeo vào là tổng thể bỗng phóng khoáng và có gu hơn hẳn. Da lộn thật mềm và nhẹ, càng dùng càng ôm dáng. Một món đồ nhỏ để bạn làm mới phong cách mỗi ngày mà chẳng cần cố gắng.', 390000, 60, 'https://images.pexels.com/photos/10340815/pexels-photo-10340815.jpeg?auto=compress&cs=tinysrgb&w=800'],
  // Giày da
  ['Giày tây da bò Oxford', 'Giày da', 'Đỉnh cao của giày tây nam: phom Oxford kinh điển, da bò thật đánh bóng thủ công và đế da khâu Goodyear — kỹ thuật khâu đế danh giá giúp giày bền, êm và có thể thay đế để đi nhiều năm. Những ngày đầu da còn hơi cứng, rồi sẽ mềm dần và ôm trọn bàn chân như được đo ni đóng giày. Diện cùng vest trong ngày trọng đại hay sơ mi quần tây đi làm, đôi Oxford mang lại vẻ lịch lãm, vững chãi rất đàn ông.', 2190000, 30, U('photo-1614252235316-8c857d38b5f4')],
  ['Giày lười da nam', 'Giày da', 'Xỏ chân vào và đi — đôi giày lười sinh ra cho nhịp sống bận rộn mà vẫn chỉn chu. Da mềm êm chân ngay từ lần mang đầu tiên, phom giày gọn gàng, hợp cả quần tây công sở lẫn jeans dạo phố. Không dây buộc rườm rà, không đau chân cuối ngày; chỉ có cảm giác nhẹ nhàng và vẻ ngoài trẻ trung, lịch sự. Càng mang, da càng mềm và lên màu đẹp — đôi giày ruột mà tủ đồ của quý ông nào cũng nên có.', 1490000, 40, 'https://images.pexels.com/photos/10259873/pexels-photo-10259873.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Boots da cổ cao', 'Giày da', 'Cổ cao ôm chân, da bò dày dặn và phom dáng bụi bặm — đôi boots dành cho những tâm hồn thích xê dịch và khác biệt. Đế chắc chắn bám đường, cổ boots giữ ấm và bảo vệ cổ chân trong những chuyến đi xa hay ngày đông lạnh. Phối cùng jeans và áo khoác da là đủ một diện mạo phong trần đầy cá tính. Da thật càng đi càng mềm; những vết xước và nếp gấp theo năm tháng chỉ làm đôi boots thêm chất.', 1990000, 25, U('photo-1520639888713-7851133b1ed0')],
  // Áo khoác da
  ['Áo khoác da bò biker', 'Áo khoác da', 'Chiếc áo khoác biker bằng da bò thật với khóa kéo chéo bất đối xứng huyền thoại, thêm lớp lót nỉ ấm áp cho những ngày gió lạnh. Da dày, đanh và có sức nặng của một món đồ để đời — mặc vào là thấy vai thẳng, dáng đứng vững và khí chất khác hẳn. Đây là kiểu áo không chạy theo mùa: năm nay mặc đẹp, mười năm nữa lấy ra vẫn đẹp, chỉ thêm lớp patina bóng sậm kể câu chuyện của riêng bạn.', 3490000, 15, U('photo-1551028719-00167b16eac5')],
  ['Áo khoác da cừu bomber', 'Áo khoác da', 'Da cừu mềm và nhẹ hơn hẳn da bò — chiếc bomber khoác lên người êm như một lớp áo thứ hai, không cứng, không nặng vai. Phom bomber hiện đại với bo gấu và cổ áo thể thao, dễ phối từ áo thun quần jeans đến sơ mi lịch sự. Bề mặt da cừu mịn, lên màu đều và sang; càng mặc càng ôm dáng người mặc. Một chiếc áo cho những ngày se lạnh, khi bạn muốn vừa ấm áp vừa thật phong cách.', 2990000, 18, 'https://images.pexels.com/photos/16060730/pexels-photo-16060730.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Áo vest da nam', 'Áo khoác da', 'Khi chiếc vest quen thuộc được làm mới bằng da thật: vẫn phom dáng lịch lãm, chít eo tôn dáng, nhưng thêm vào đó là bề mặt da sang trọng và cá tính không trộn lẫn. Áo vest da hợp với những buổi tiệc, sự kiện, hay ngày bạn muốn xuất hiện thật khác biệt giữa đám đông. Đường may đo tỉ mỉ, lớp lót mượt mà — khoác lên là thấy ngay sự đầu tư cho hình ảnh của một quý ông hiện đại.', 2790000, 12, 'https://images.pexels.com/photos/10854422/pexels-photo-10854422.jpeg?auto=compress&cs=tinysrgb&w=800'],
  // Phụ kiện da
  ['Móc khóa da khắc tên', 'Phụ kiện da', 'Nhỏ xinh mà chứa đựng cả tấm lòng: chiếc móc khóa cắt từ da bò thật, khắc tên hoặc thông điệp theo yêu cầu với nét khắc sắc sảo, bền mãi cùng thời gian. Da càng cầm càng bóng, móc kim loại chắc chắn đi theo chùm chìa khóa mỗi ngày — để mỗi lần mở cửa, bạn lại nhớ đến người tặng. Một món quà sinh nhật, kỷ niệm hay tri ân nhỏ gọn mà ý nghĩa, chẳng ai nỡ để quên trong ngăn kéo.', 149000, 100, 'https://images.pexels.com/photos/15440419/pexels-photo-15440419.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Bao da điện thoại', 'Phụ kiện da', 'Chiếc điện thoại là vật bất ly thân — hãy để nó nằm trong một chiếc bao da thật làm thủ công, vừa khít nhiều dòng máy. Da bò mềm ôm máy, bảo vệ khỏi trầy xước khi bỏ chung túi xách hay balo; lớp lót êm ái nâng niu mặt kính. Càng dùng, da càng bóng và ôm sát form máy như được sinh ra cho nhau. Nhỏ gọn, tinh tế — món phụ kiện khiến chiếc điện thoại quen thuộc bỗng trở nên sang hẳn.', 299000, 70, 'https://images.pexels.com/photos/14833708/pexels-photo-14833708.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Dây đồng hồ da', 'Phụ kiện da', 'Chỉ thay một sợi dây, chiếc đồng hồ quen thuộc như được thổi hồn mới: ấm áp, cổ điển và cá tính hơn hẳn dây kim loại lạnh. Dây làm từ da bò thật (có bản da cá sấu cho người chơi đồng hồ sành điệu), mặt dưới lót da mềm chống thấm mồ hôi, viền khâu tay đều tăm tắp, khóa thép không gỉ bền màu. Nhiều size vừa mọi cổ tay — để mỗi lần xem giờ lại là một lần ngắm nhìn món đồ mình yêu.', 349000, 90, 'https://images.pexels.com/photos/1265619/pexels-photo-1265619.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Ví da bò gập ba', 'Ví da', 'Nhỏ gọn trong lòng bàn tay mà chứa được cả thế giới của bạn: tiền mặt, thẻ và giấy tờ xếp gọn trong ba lớp gập khéo léo. Da bò thật khâu tay chắc chắn, bề mặt đanh và lên bóng dần theo năm tháng. Một chiếc ví cho người đàn ông thích sự gọn gàng — bỏ túi nào cũng vừa, lấy ra lúc nào cũng sang.', 690000, 35, 'https://images.pexels.com/photos/915917/pexels-photo-915917.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Ví đựng thẻ da bò', 'Ví da', 'Khi bạn chỉ cần mang theo vài tấm thẻ và ít tiền lẻ: chiếc ví thẻ mỏng nhẹ bằng da bò thật, ôm gọn trong túi áo hay túi quần mà không cộm. Các ngăn thẻ may vừa khít để thẻ không tuột, mép da mài nhẵn mịn tay. Càng dùng da càng bóng — món phụ kiện tối giản mà tinh tế cho nhịp sống hiện đại.', 290000, 120, 'https://images.pexels.com/photos/28028264/pexels-photo-28028264/free-photo-of-small-leather-card-holders.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Ví nữ mini da thật', 'Ví da', 'Nhỏ xinh như một món trang sức: chiếc ví mini với sắc cam đất ấm áp, làm từ da thật mềm tay. Đựng vừa thẻ, tiền gập và những vật nhỏ xinh trong túi xách của nàng. Đường may tỉ mỉ, form ví cứng cáp giữ dáng lâu dài — càng dùng, màu da càng lên tông trầm sang trọng rất riêng.', 450000, 55, 'https://images.pexels.com/photos/37326694/pexels-photo-37326694/free-photo-of-minimalist-orange-leather-wallet-on-beige-background.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Túi xách da bò sáp', 'Túi xách da', 'Da bò sáp với bề mặt lì và những vệt sáng tối tự nhiên như mây trời — mỗi chiếc túi là một bản duy nhất. Form túi rộng rãi cho ngày dài bận rộn: laptop mỏng, sổ tay, ví và cả thế giới của bạn đều có chỗ. Quai đeo chắc chắn, đường khâu tay đều đẹp; càng dùng, da sáp càng bóng và lên màu sâu đầy cuốn hút.', 2190000, 18, 'https://images.pexels.com/photos/31867644/pexels-photo-31867644/free-photo-of-close-up-of-brown-leather-bag-on-black-leather-surface.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Túi xách da nữ đỏ đô', 'Túi xách da', 'Sắc đỏ đô trầm sang như ly rượu vang — điểm nhấn khiến mọi bộ trang phục bỗng có thần thái. Túi làm từ da thật với form đứng thanh lịch, quai xách vừa tay và ngăn trong bố trí gọn gàng. Dù đi làm, dự tiệc hay dạo phố cuối tuần, chiếc túi đỏ đô luôn biết cách làm bạn nổi bật một cách tinh tế.', 1690000, 22, 'https://images.pexels.com/photos/22434764/pexels-photo-22434764/free-photo-of-red-bag-on-white-background.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Túi tote da nữ', 'Túi xách da', 'Chiếc tote da thật với khóa kéo mạ vàng sáng bóng — rộng rãi mà không hề xuề xòa. Đựng vừa laptop 13 inch, tài liệu và đồ cá nhân cho một ngày trọn vẹn từ văn phòng đến quán cà phê. Da mềm nhưng giữ form, quai đeo vai êm ái. Một chiếc túi “đi đâu cũng hợp” mà tủ đồ của nàng nào cũng nên có.', 1790000, 26, 'https://images.pexels.com/photos/27046147/pexels-photo-27046147/free-photo-of-leather-bags-in-a-studio.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Thắt lưng da bò khóa kim', 'Thắt lưng da', 'Da bò nguyên tấm dày dặn kết hợp mặt khóa kim sáng bóng, phom dáng hiện đại. Sợi dây giữ phom quần chỉn chu, hợp cả quần tây công sở lẫn jeans thường ngày. Mép dây được mài nhẵn và sơn cạnh tỉ mỉ, càng dùng da càng bóng đẹp — chi tiết nhỏ nâng tầm cả bộ trang phục.', 550000, 70, 'https://images.pexels.com/photos/31432650/pexels-photo-31432650/free-photo-of-luxury-leather-belt-with-metallic-buckle.png?auto=compress&cs=tinysrgb&w=800'],
  ['Thắt lưng da bò khóa đồng', 'Thắt lưng da', 'Mặt khóa đồng thau với sắc vàng trầm ấm, càng dùng càng lên màu vintage rất có hồn. Thân dây là da bò thật nguyên miếng, đanh và bền, ôm eo vừa vặn suốt ngày dài. Một sợi thắt lưng cho người đàn ông yêu vẻ đẹp cổ điển — phối cùng giày da nâu là trọn vẹn một phong cách lịch lãm.', 590000, 65, 'https://images.pexels.com/photos/35392687/pexels-photo-35392687/free-photo-of-high-quality-leather-belt-with-brass-buckle.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Giày tây da bò Derby', 'Giày da', 'Phom Derby nâu trầm với phần buộc dây mở linh hoạt — dễ xỏ, ôm chân và lịch lãm không kém Oxford. Da bò thật được hoàn thiện thủ công, đế chắc chắn êm bước. Từ phòng họp đến tiệc cưới, đôi Derby luôn giữ cho bạn vẻ ngoài chỉn chu; càng đi, da càng mềm và bóng đẹp theo dấu chân của riêng bạn.', 1890000, 28, 'https://images.pexels.com/photos/33039735/pexels-photo-33039735/free-photo-of-elegant-brown-leather-shoes-on-wooden-table.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Giày thuyền da bò', 'Giày da', 'Đôi boat shoes bằng da bò với đế trắng trẻ trung — sinh ra cho những ngày rong ruổi: dạo phố, cà phê, du lịch biển. Da mềm êm chân ngay từ lần mang đầu, dây da buộc quanh cổ giày là điểm nhấn thủ công tinh tế. Càng mang, da càng lên màu nắng gió — đúng tinh thần tự do của những chuyến đi.', 1290000, 34, 'https://images.pexels.com/photos/7887198/pexels-photo-7887198.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Giày tây da đen bóng', 'Giày da', 'Sắc đen bóng sang trọng trên phom giày tây cổ điển — đôi giày dành cho những dịp quan trọng nhất: lễ cưới, sự kiện, buổi ký kết. Da bò thật được đánh bóng thủ công, đế khâu chắc chắn. Mang vào là dáng đứng thẳng, bước đi tự tin — khí chất của một quý ông thực thụ.', 1990000, 24, 'https://images.pexels.com/photos/37465528/pexels-photo-37465528/free-photo-of-elegant-black-formal-shoes-on-grey-background.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Áo khoác da bò nâu vintage', 'Áo khoác da', 'Sắc nâu vintage như đã đi qua nhiều mùa nắng gió — chiếc áo khoác da bò cho người đàn ông yêu vẻ đẹp phong trần. Da dày, đanh, form áo ôm vừa người; càng mặc, da càng mềm và lên những vệt sáng tối rất riêng không chiếc áo thứ hai nào có. Một món đồ để đời, mặc năm này qua năm khác vẫn chất.', 3190000, 14, 'https://images.pexels.com/photos/32555321/pexels-photo-32555321/free-photo-of-young-man-in-urban-parking-garage-setting.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Áo khoác da nữ đen', 'Áo khoác da', 'Chiếc áo khoác da đen với phom dáng gọn gàng, tôn eo và vai — khoác ngoài váy hay phối cùng jeans đều toát lên vẻ cá tính, hiện đại. Da thật mềm, nhẹ, không cứng vai; đường may tỉ mỉ theo form dáng phụ nữ Á Đông. Một chiếc áo khiến nàng bước xuống phố với thần thái tự tin và cuốn hút khó quên.', 2690000, 16, 'https://images.pexels.com/photos/15161530/pexels-photo-15161530/free-photo-of-a-woman-in-black-leather-jacket-posing.jpeg?auto=compress&cs=tinysrgb&w=800'],
  ['Bộ ví da + ví thẻ cao cấp', 'Phụ kiện da', 'Bộ đôi hoàn hảo cho người yêu sự ngăn nắp: một ví da bò đựng tiền và một ví thẻ mỏng nhẹ đi kèm, cùng tông màu, cùng chất da thật khâu tay. Mua cho mình để dùng đồng bộ, hay làm quà tặng sinh nhật, tân gia đều sang trọng và thiết thực. Da càng dùng càng bóng — bộ đôi sẽ đồng hành cùng bạn nhiều năm tháng.', 1190000, 40, 'https://images.pexels.com/photos/7952556/pexels-photo-7952556.jpeg?auto=compress&cs=tinysrgb&w=800'],
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


// 4. Bài viết Blog mẫu (port từ web artifact BI99)
const blogPosts = [
  {
    "title": "Cách bảo quản đồ da bền đẹp theo thời gian",
    "slug": "cach-bao-quan-do-da-ben-dep",
    "coverImageUrl": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Đồ da thật càng dùng càng bóng đẹp nếu được chăm sóc đúng cách. Cùng BI99 tìm hiểu các nguyên tắc vệ sinh, dưỡng ẩm và cất giữ để chiếc túi, ví da của bạn bền đẹp nhiều năm.",
    "content": "Da bò thật là chất liệu \"sống\": càng dùng lâu, bề mặt da càng lên nước, mềm và bóng đẹp — người chơi da gọi đó là patina. Nhưng để da đạt được vẻ đẹp ấy, bạn cần chăm sóc đúng cách.\n\n1. Vệ sinh đúng cách\nDùng khăn mềm khô hoặc hơi ẩm lau nhẹ bề mặt để loại bỏ bụi bẩn. Tuyệt đối không ngâm nước, không dùng hóa chất tẩy rửa mạnh hay xăng, cồn lên bề mặt da. Với vết bẩn cứng đầu, hãy dùng dung dịch vệ sinh chuyên dụng cho đồ da.\n\n2. Dưỡng ẩm cho da\nSau khi vệ sinh, thoa một lớp mỏng kem dưỡng da (leather conditioner) hoặc mỡ chồn, để khoảng 15 phút rồi lau lại bằng khăn sạch. Dưỡng ẩm giúp da không bị khô nứt, giữ độ mềm mại và màu sắc đều đẹp. Chỉ cần thực hiện 1–2 tháng một lần.\n\n3. Cất giữ nơi khô thoáng\nKhi không sử dụng, hãy nhồi giấy mềm vào trong túi/ví để giữ form, cho vào túi vải chống bụi và để nơi khô ráo, tránh ánh nắng trực tiếp. Không bọc đồ da trong túi nilon kín vì da cần \"thở\"; môi trường ẩm kín dễ khiến da mốc.\n\n4. Xử lý khi bị ướt\nNếu đồ da dính mưa, thấm khô bằng khăn mềm và để khô tự nhiên ở nhiệt độ phòng. Không dùng máy sấy hay phơi nắng gắt — nhiệt độ cao làm da co, cứng và nứt.\n\n5. Mang đi bảo dưỡng định kỳ\nVới sản phẩm của BI99, bạn được bảo hành 1 tháng và hỗ trợ bảo dưỡng, đánh bóng, sửa đường chỉ trọn đời tại xưởng. Đừng ngần ngại mang sản phẩm ghé xưởng để thợ da kiểm tra và chăm sóc giúp bạn.",
    "daysAgo": 2
  },
  {
    "title": "Cách phân biệt da thật và da giả đơn giản, chính xác",
    "slug": "cach-phan-biet-da-that-da-gia",
    "coverImageUrl": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80",
    "excerpt": "Da thật, da PU, da microfiber... thị trường có quá nhiều loại \"da\" khiến người mua bối rối. Bài viết này giúp bạn nhận biết da bò thật chỉ với vài thao tác đơn giản.",
    "content": "Không phải sản phẩm nào gắn mác \"da\" cũng là da thật. Dưới đây là những cách phân biệt đơn giản mà thợ da lâu năm vẫn dùng.\n\n1. Quan sát bề mặt\nDa thật có lỗ chân lông tự nhiên, vân da không đều và không lặp lại theo quy luật. Da giả (PU, simili) có bề mặt quá đồng đều, vân da lặp đi lặp lại như được in khuôn.\n\n2. Ấn tay kiểm tra độ đàn hồi\nDùng ngón tay ấn mạnh lên bề mặt da rồi thả ra. Da thật sẽ xuất hiện các nếp nhăn li ti quanh chỗ ấn và nhanh chóng trở lại trạng thái ban đầu. Da giả bị ấn sẽ không tạo nếp nhăn tự nhiên hoặc để lại vết lõm lâu.\n\n3. Kiểm tra bằng nước\nNhỏ một giọt nước lên bề mặt. Da thật thấm nước từ từ và để lại vệt sẫm màu khi thấm. Da giả có lớp phủ nhựa nên nước đọng thành giọt, trượt đi mà không thấm.\n\n4. Ngửi mùi\nDa thật có mùi ngai ngái đặc trưng của da thuộc. Da giả thường có mùi nhựa, mùi hóa chất hắc.\n\n5. Kiểm tra mặt trái và cạnh cắt\nMặt trái của da thật là lớp da lộn xù xì, sờ vào thấy nhám tay. Da giả mặt trái thường là lớp vải hoặc foam trơn. Ở cạnh cắt, da thật cho thấy các sợi da xốp đan xen, còn da giả lộ rõ lớp nhựa và lớp vải nền.\n\nLưu ý: một số loại da giả cao cấp (microfiber) khá giống da thật. Cách chắc chắn nhất là mua tại xưởng, cửa hàng uy tín có cam kết chất liệu và chính sách bảo hành rõ ràng — như cam kết da bò thật 100% tại BI99.",
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
    "excerpt": "Từ tấm da bò nguyên miếng đến chiếc túi hoàn thiện trên tay bạn là hành trình qua 7 công đoạn thủ công tỉ mỉ. Mời bạn ghé thăm xưởng của BI99 qua bài viết này.",
    "content": "Mỗi chiếc túi da thủ công tại BI99 mất từ 6 đến 10 giờ chế tác liên tục. Khác với hàng sản xuất hàng loạt, mọi công đoạn đều qua tay người thợ.\n\nBước 1: Chọn da\nThợ chọn tấm da bò thuộc thảo mộc (vegetable-tanned), kiểm tra độ dày, vân da, vết sẹo tự nhiên. Chỉ phần da lưng — phần đẹp và bền nhất của tấm da — mới dùng làm thân túi.\n\nBước 2: Cắt rập\nRập giấy được đặt lên da, cắt bằng dao chuyên dụng theo thớ da để sản phẩm không bị giãn, biến dạng khi sử dụng lâu dài.\n\nBước 3: Lạng mỏng và xử lý cạnh\nCác mép ghép được lạng mỏng để đường may không bị cộm. Cạnh da được mài, nhuộm và đánh bóng nhiều lớp bằng sáp ong cho đến khi mịn và bóng.\n\nBước 4: Đục lỗ và khâu tay\nThợ dùng dùi đục từng lỗ may theo khoảng cách đều tăm tắp, rồi khâu bằng kỹ thuật khâu hai kim (saddle stitch) với chỉ sáp — đường khâu bền hơn máy may vì đứt một mũi, mũi còn lại vẫn giữ chắc.\n\nBước 5: Gắn phụ kiện\nKhóa, khoen, đinh tán bằng đồng thau nguyên chất được gắn và kiểm tra độ chắc chắn, độ mượt khi đóng mở.\n\nBước 6: Hoàn thiện và lên dầu\nToàn bộ sản phẩm được thoa dầu dưỡng, đánh bóng thủ công, kiểm tra từng đường chỉ trước khi đóng gói.\n\nĐó là lý do một chiếc túi da thủ công có thể đồng hành cùng bạn 5–10 năm, càng dùng càng đẹp — và luôn mang dấu ấn riêng không chiếc nào giống chiếc nào.",
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

// 5. Thông báo / tin tức mẫu (kèm hình banner)
const sampleAnnouncements = [
  {
    title: 'Sale 11.11 — Ưu đãi lớn nhất năm sắp bắt đầu',
    content: 'Từ 00:00 ngày 11/11, toàn bộ ví da, túi xách và thắt lưng giảm đến 30%, kèm voucher SALE1111 giảm thêm 11% cho đơn từ 500.000đ. Số lượng voucher có hạn — lưu mã ngay từ hôm nay.',
    badge: 'Khuyến mãi sắp diễn ra',
    cta_text: 'Săn sale ngay', cta_link: '/khuyen-mai',
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Ví da bò BI99',
    show_on_banner: 1, send_notification: 1, daysAgo: 0,
  },
  {
    title: 'Chính sách bảo hành 1 tháng cho mọi sản phẩm da thật',
    content: 'Từ nay, mọi sản phẩm da thật tại BI99 đều được bảo hành 1 tháng về đường chỉ, khóa kéo và lỗi chất liệu; hỗ trợ đánh bóng, dưỡng da miễn phí trong 6 tháng đầu.',
    badge: 'Chính sách mới',
    cta_text: '', cta_link: '',
    image_url: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Thắt lưng da bò BI99',
    show_on_banner: 0, send_notification: 1, daysAgo: 2,
  },
  {
    title: 'Bộ sưu tập Thu — Đông 2026 vừa cập bến',
    content: '12 mẫu túi xách và ví da bò sáp mới với tông nâu cognac chủ đạo đã có mặt tại cửa hàng và trên website. Ghé xem và trải nghiệm chất da thật ngay hôm nay.',
    badge: 'Hàng mới về',
    cta_text: 'Khám phá ngay', cta_link: '/bo-suu-tap',
    image_url: 'https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80',
    image_caption: 'Túi xách da bò BI99',
    show_on_banner: 0, send_notification: 0, daysAgo: 4,
  },
];
const annIns = db.prepare(
  'INSERT INTO announcements (title, content, badge, cta_text, cta_link, image_url, image_caption, show_on_banner, send_notification, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
);
let annAdded = 0;
for (const a of sampleAnnouncements) {
  const exists = db.prepare('SELECT id FROM announcements WHERE title = ?').get(a.title);
  if (!exists) {
    const d = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    annIns.run(a.title, a.content, a.badge, a.cta_text, a.cta_link, a.image_url, a.image_caption,
      a.show_on_banner, a.send_notification, d, d);
    annAdded++;
  }
}
console.log(annAdded > 0 ? `  - Đã thêm ${annAdded} thông báo mẫu` : '  - Đã có thông báo, bỏ qua seed announcements');

console.log('Seed hoàn tất!');
