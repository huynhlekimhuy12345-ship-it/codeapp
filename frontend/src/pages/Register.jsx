import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useStore();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container page">
      <form className="form-card" onSubmit={submit}>
        <h2>Đăng ký tài khoản</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Họ tên</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mật khẩu (ít nhất 6 ký tự)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }}>Đăng ký</button>
        <div className="form-link">Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></div>
      </form>
    </div>
  );
}
