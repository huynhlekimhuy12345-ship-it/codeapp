import { Link } from 'react-router-dom';
import PageTitle from '../components/PageTitle';

export default function NotFound() {
  return (
    <div className="container page">
      <PageTitle title="Không tìm thấy trang" />
      <div className="sale-empty">
        <h1>404 — Không tìm thấy trang</h1>
        <p>Địa chỉ bạn vừa mở không tồn tại hoặc đã bị di chuyển.</p>
        <Link className="btn btn-primary" to="/">Về trang chủ</Link>
      </div>
    </div>
  );
}
