// Script viết lại MÔ TẢ CHI TIẾT cho 18 sản phẩm mẫu của BI99 — chạy tay bằng lệnh:
//   node seed-descriptions.js        (trong thư mục backend)
// - Cập nhật theo TÊN sản phẩm: sản phẩm nào trong DB khớp tên sẽ nhận mô tả mới
//   (dài, chi tiết, giàu cảm xúc — chất liệu / chế tác / trải nghiệm / vẻ đẹp).
// - Chạy lại nhiều lần an toàn (ghi đè cùng một nội dung).
// - Sản phẩm do admin tự thêm (không có trong danh sách này) không bị đụng vào;
//   script sẽ liệt kê chúng ở cuối để bạn tự viết mô tả trong trang quản trị.
const db = require('./db');

const DESCRIPTIONS = {
  'Ví da bò nam cao cấp': 'Được cắt từ tấm da bò nguyên miếng thuộc thảo mộc và khâu tay hai kim tại xưởng BI99 Hội An, chiếc ví giữ nguyên vân da cùng lỗ chân lông tự nhiên — sờ vào là cảm nhận được chất da thật đanh, dày và “sống”. Bên trong, các ngăn thẻ và ngăn tiền mặt được tính toán vừa vặn cho nhịp sống hằng ngày: đủ gọn để bỏ túi quần, đủ sang để đặt lên bàn làm việc. Càng dùng, da càng lên nước bóng patina sậm màu rất riêng — chiếc ví không cũ đi, nó trưởng thành cùng bạn.',
  'Ví da nữ dáng dài': 'Dáng dài thanh thoát với những đường cong mềm mại, chiếc ví được làm từ da thật mềm tay, khóa kéo YKK trơn tru và lớp lót mịn êm. Các ngăn đựng tiền, thẻ và điện thoại được bố trí rộng rãi mà form ví vẫn gọn gàng khi cầm tay hay bỏ vào túi xách. Sắc da lên màu đều và bóng dần theo thời gian, như một món trang sức lặng lẽ tôn lên phong cách của người phụ nữ hiện đại — dịu dàng mà đầy khí chất.',
  'Ví da cá sấu nam': 'Vân cá sấu nổi khối, sắc nét và không tấm nào giống tấm nào — đó là dấu ấn của đẳng cấp thật sự. Chiếc ví được chế tác thủ công từ da vân cá sấu cao cấp, đường khâu tay đều tăm tắp, mép da lạng mỏng và đánh bóng bằng tay đến khi mịn màng. Đây không chỉ là nơi giữ tiền và giấy tờ: mỗi lần rút ví là một lần khẳng định vị thế của người đàn ông thành đạt. Một món quà xứng tầm dành cho đối tác, cấp trên hay người cha đáng kính.',
  'Túi xách da công sở': 'Sinh ra cho những ngày làm việc bận rộn: ngăn chính đựng vừa laptop 15.6 inch cùng tài liệu, ngăn phụ để điện thoại, ví và vật dụng nhỏ luôn nằm đúng chỗ. Da bò sáp cao cấp cho bề mặt lì sang trọng, càng dùng càng bóng và lên màu sâu rất “tây”. Quai xách cùng các điểm chịu lực được gia cố khâu kép, form túi đứng vững dù mang nặng. Đồng hành cùng bộ suit hay chiếc sơ mi, chiếc cặp giúp bạn bước vào phòng họp với vẻ chỉn chu và tự tin hơn hẳn.',
  'Balo da du lịch': 'Một chiếc balo da bò mềm mang tinh thần vintage — như những chuyến đi không vội vã. Sức chứa lớn cho laptop, quần áo và vật dụng cá nhân, đủ cho chuyến công tác ngắn ngày hay cuối tuần rong ruổi. Da mềm ôm vai, quai đeo êm, khóa và đường chỉ làm chắc chắn để đồng hành cùng bạn qua nhiều hành trình. Theo thời gian, bề mặt da ghi lại dấu vết của từng chuyến đi bằng lớp patina sậm màu — mỗi vết xước nhỏ là một câu chuyện.',
  'Túi đeo chéo da nam': 'Nhỏ gọn mà vừa đủ cho cả thế giới của bạn: điện thoại, ví, chìa khóa, tai nghe — tất cả nằm gọn trong chiếc túi đeo chéo bằng da bò thật, khâu tay chắc chắn. Đeo chéo trước ngực khi dạo phố, lệch vai khi cà phê cuối tuần; form túi gọn gàng, không cồng kềnh mà vẫn nam tính. Da bò càng đeo càng mềm và bóng, biến món phụ kiện hằng ngày thành điểm nhấn phong cách rất riêng của bạn.',
  'Thắt lưng da bò mặt khóa tự động': 'Một tấm da bò nguyên miếng — không ghép, không ép keo — dày dặn và đanh tay, kết hợp mặt khóa tự động cao cấp đóng mở nhẹ nhàng mà không cần đục lỗ. Sợi dây ôm eo vừa vặn, giữ phom quần chỉn chu suốt ngày dài ở văn phòng hay trong những buổi gặp gỡ quan trọng. Bề mặt da càng dùng càng bóng đẹp, mặt khóa giữ nguyên độ sáng — một chi tiết nhỏ nhưng đủ nâng tầm cả bộ trang phục.',
  'Thắt lưng da cá sấu': 'Vân cá sấu sang trọng với những mảng vân lớn nhỏ đan xen tự nhiên — mỗi sợi dây là duy nhất. Da được thuộc và hoàn thiện thủ công, mép dây mài nhẵn, sơn cạnh tỉ mỉ; mặt khóa chắc tay và sáng bóng. Đây là món quà đầy ý nghĩa dành cho người đàn ông bạn trân trọng: một sợi thắt lưng không chỉ giữ trang phục ngay ngắn, mà còn giữ cả sự tự tin và đẳng cấp của người đeo.',
  'Thắt lưng da lộn casual': 'Bề mặt da lộn mịn như nhung với sắc màu trầm ấm — sợi thắt lưng dành cho những ngày không cần quá trịnh trọng. Phong cách trẻ trung, dễ phối cùng quần jeans, kaki hay chinos; đeo vào là tổng thể bỗng phóng khoáng và có gu hơn hẳn. Da lộn thật mềm và nhẹ, càng dùng càng ôm dáng. Một món đồ nhỏ để bạn làm mới phong cách mỗi ngày mà chẳng cần cố gắng.',
  'Giày tây da bò Oxford': 'Đỉnh cao của giày tây nam: phom Oxford kinh điển, da bò thật đánh bóng thủ công và đế da khâu Goodyear — kỹ thuật khâu đế danh giá giúp giày bền, êm và có thể thay đế để đi nhiều năm. Những ngày đầu da còn hơi cứng, rồi sẽ mềm dần và ôm trọn bàn chân như được đo ni đóng giày. Diện cùng vest trong ngày trọng đại hay sơ mi quần tây đi làm, đôi Oxford mang lại vẻ lịch lãm, vững chãi rất đàn ông.',
  'Giày lười da nam': 'Xỏ chân vào và đi — đôi giày lười sinh ra cho nhịp sống bận rộn mà vẫn chỉn chu. Da mềm êm chân ngay từ lần mang đầu tiên, phom giày gọn gàng, hợp cả quần tây công sở lẫn jeans dạo phố. Không dây buộc rườm rà, không đau chân cuối ngày; chỉ có cảm giác nhẹ nhàng và vẻ ngoài trẻ trung, lịch sự. Càng mang, da càng mềm và lên màu đẹp — đôi giày ruột mà tủ đồ của quý ông nào cũng nên có.',
  'Boots da cổ cao': 'Cổ cao ôm chân, da bò dày dặn và phom dáng bụi bặm — đôi boots dành cho những tâm hồn thích xê dịch và khác biệt. Đế chắc chắn bám đường, cổ boots giữ ấm và bảo vệ cổ chân trong những chuyến đi xa hay ngày đông lạnh. Phối cùng jeans và áo khoác da là đủ một diện mạo phong trần đầy cá tính. Da thật càng đi càng mềm; những vết xước và nếp gấp theo năm tháng chỉ làm đôi boots thêm chất.',
  'Áo khoác da bò biker': 'Chiếc áo khoác biker bằng da bò thật với khóa kéo chéo bất đối xứng huyền thoại, thêm lớp lót nỉ ấm áp cho những ngày gió lạnh. Da dày, đanh và có sức nặng của một món đồ để đời — mặc vào là thấy vai thẳng, dáng đứng vững và khí chất khác hẳn. Đây là kiểu áo không chạy theo mùa: năm nay mặc đẹp, mười năm nữa lấy ra vẫn đẹp, chỉ thêm lớp patina bóng sậm kể câu chuyện của riêng bạn.',
  'Áo khoác da cừu bomber': 'Da cừu mềm và nhẹ hơn hẳn da bò — chiếc bomber khoác lên người êm như một lớp áo thứ hai, không cứng, không nặng vai. Phom bomber hiện đại với bo gấu và cổ áo thể thao, dễ phối từ áo thun quần jeans đến sơ mi lịch sự. Bề mặt da cừu mịn, lên màu đều và sang; càng mặc càng ôm dáng người mặc. Một chiếc áo cho những ngày se lạnh, khi bạn muốn vừa ấm áp vừa thật phong cách.',
  'Áo vest da nam': 'Khi chiếc vest quen thuộc được làm mới bằng da thật: vẫn phom dáng lịch lãm, chít eo tôn dáng, nhưng thêm vào đó là bề mặt da sang trọng và cá tính không trộn lẫn. Áo vest da hợp với những buổi tiệc, sự kiện, hay ngày bạn muốn xuất hiện thật khác biệt giữa đám đông. Đường may đo tỉ mỉ, lớp lót mượt mà — khoác lên là thấy ngay sự đầu tư cho hình ảnh của một quý ông hiện đại.',
  'Móc khóa da khắc tên': 'Nhỏ xinh mà chứa đựng cả tấm lòng: chiếc móc khóa cắt từ da bò thật, khắc tên hoặc thông điệp theo yêu cầu với nét khắc sắc sảo, bền mãi cùng thời gian. Da càng cầm càng bóng, móc kim loại chắc chắn đi theo chùm chìa khóa mỗi ngày — để mỗi lần mở cửa, bạn lại nhớ đến người tặng. Một món quà sinh nhật, kỷ niệm hay tri ân nhỏ gọn mà ý nghĩa, chẳng ai nỡ để quên trong ngăn kéo.',
  'Bao da điện thoại': 'Chiếc điện thoại là vật bất ly thân — hãy để nó nằm trong một chiếc bao da thật làm thủ công, vừa khít nhiều dòng máy. Da bò mềm ôm máy, bảo vệ khỏi trầy xước khi bỏ chung túi xách hay balo; lớp lót êm ái nâng niu mặt kính. Càng dùng, da càng bóng và ôm sát form máy như được sinh ra cho nhau. Nhỏ gọn, tinh tế — món phụ kiện khiến chiếc điện thoại quen thuộc bỗng trở nên sang hẳn.',
  'Dây đồng hồ da': 'Chỉ thay một sợi dây, chiếc đồng hồ quen thuộc như được thổi hồn mới: ấm áp, cổ điển và cá tính hơn hẳn dây kim loại lạnh. Dây làm từ da bò thật (có bản da cá sấu cho người chơi đồng hồ sành điệu), mặt dưới lót da mềm chống thấm mồ hôi, viền khâu tay đều tăm tắp, khóa thép không gỉ bền màu. Nhiều size vừa mọi cổ tay — để mỗi lần xem giờ lại là một lần ngắm nhìn món đồ mình yêu.',
};

(async () => {
  const names = Object.keys(DESCRIPTIONS);
  let updated = 0;
  for (const name of names) {
    const info = await db.prepare('UPDATE products SET description = ? WHERE name = ?').run(DESCRIPTIONS[name], name);
    if (info.changes) {
      updated++;
      console.log(`✓ ${name}`);
    } else {
      console.log(`— Không thấy sản phẩm tên "${name}" trong DB (bỏ qua)`);
    }
  }
  const all = await db.prepare('SELECT name FROM products ORDER BY id').all();
  const extra = all.map((p) => p.name).filter((n) => !names.includes(n));
  console.log(`Xong: đã cập nhật mô tả cho ${updated}/${names.length} sản phẩm mẫu.`);
  if (extra.length) {
    console.log('Các sản phẩm KHÔNG có trong danh sách mẫu (tự viết mô tả trong trang quản trị):');
    for (const n of extra) console.log('  · ' + n);
  }
  process.exit(0);
})().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
