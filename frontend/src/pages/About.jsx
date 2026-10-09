// Trang Giới thiệu — port từ web artifact Leather House (AboutView)
import { Link } from 'react-router-dom';

const VALUES = [
  ['🥩', 'Da bò thật 100%', 'Chỉ dùng da bò nguyên tấm thuộc thảo mộc, có vân và lỗ chân lông tự nhiên. Cam kết hoàn tiền nếu phát hiện da giả.'],
  ['✋', 'Làm thủ công tại xưởng', 'Mọi công đoạn — cắt, lạng, đục lỗ, khâu hai kim, đánh bóng cạnh — đều qua tay thợ da lành nghề tại Hội An.'],
  ['🛡️', 'Bảo hành & bảo dưỡng', 'Bảo hành 12 tháng đường chỉ, khóa kéo, phụ kiện; hỗ trợ đánh bóng, dưỡng da và sửa chữa trọn đời sản phẩm.'],
];

const STEPS = [
  ['Chọn da', 'Thợ chọn tấm da bò thuộc thảo mộc, kiểm tra độ dày, vân da và chỉ dùng phần da lưng — phần đẹp và bền nhất.'],
  ['Cắt rập', 'Đặt rập giấy lên da, cắt bằng dao chuyên dụng theo thớ da để sản phẩm không giãn, không biến dạng theo thời gian.'],
  ['Lạng mỏng & xử lý cạnh', 'Lạng mỏng các mép ghép, mài — nhuộm — đánh bóng cạnh nhiều lớp bằng sáp ong cho đến khi mịn và bóng.'],
  ['Đục lỗ & khâu tay', 'Đục từng lỗ may đều tăm tắp, khâu hai kim (saddle stitch) bằng chỉ sáp — bền hơn may máy nhiều lần.'],
  ['Gắn phụ kiện', 'Khóa, khoen, đinh tán đồng thau nguyên chất được gắn và kiểm tra độ chắc, độ mượt khi đóng mở.'],
  ['Hoàn thiện', 'Thoa dầu dưỡng, đánh bóng thủ công, kiểm tra từng đường chỉ trước khi đóng gói gửi tới tay bạn.'],
];

export default function About() {
  return (
    <div className="container page">
      <div className="about-story">
        <div>
          <span className="kicker">Giới thiệu</span>
          <h2>Câu chuyện Leather House — xưởng da thủ công giữa lòng Hội An</h2>
          <p>Leather House khởi đầu là một xưởng da nhỏ trong con hẻm yên tĩnh ở phố cổ Hội An, nơi những người thợ lành nghề dành trọn ngày dài bên tấm da bò, cây dùi đục và cuộn chỉ sáp. Chúng tôi tin rằng một món đồ da tốt không chỉ để dùng — nó đồng hành cùng chủ nhân nhiều năm, lên nước bóng đẹp theo thời gian và kể câu chuyện của riêng mình.</p>
          <p>Khác với hàng sản xuất hàng loạt, mỗi sản phẩm tại xưởng đều được làm thủ công từ da bò thật 100% thuộc thảo mộc: chọn da, cắt rập, lạng mỏng, đục lỗ, khâu hai kim và đánh bóng cạnh — mọi công đoạn đều qua tay người thợ, mất từ 6 đến 10 giờ cho một chiếc túi hoàn thiện.</p>
          <p>Từ Hội An, chúng tôi gửi những chiếc túi, ví, thắt lưng và giày da thủ công tới khách hàng trên khắp Việt Nam, với cam kết chất liệu minh bạch và chế độ bảo hành, bảo dưỡng trọn đời.</p>
          <div className="about-cta">
            <Link to="/cua-hang" className="btn btn-primary">Xem sản phẩm</Link>
            <Link to="/lien-he" className="btn btn-outline">Liên hệ xưởng</Link>
          </div>
        </div>
        <img
          src="https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=1200&q=80"
          alt="Thợ da đang chế tác thủ công tại xưởng"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="section">
        <div className="section-head"><h2>Giá trị cốt lõi</h2></div>
        <div className="value-grid">
          {VALUES.map(([icon, t, s]) => (
            <div key={t} className="glass value-card">
              <span className="vicon" aria-hidden>{icon}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Quy trình chế tác đồ da</h2></div>
        <p style={{ color: 'var(--muted)', marginBottom: 18 }}>Sáu công đoạn thủ công cho một sản phẩm hoàn thiện — mất từ 6 đến 10 giờ chế tác liên tục.</p>
        <div className="value-grid">
          {STEPS.map(([t, s], i) => (
            <div key={t} className="glass value-card">
              <span className="step-num">{i + 1}</span>
              <h3>{t}</h3>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
