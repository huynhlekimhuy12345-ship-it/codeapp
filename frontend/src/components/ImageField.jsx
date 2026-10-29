import { useRef, useState } from 'react';
import { fileToCompressedDataUrl } from '../utils/image';

// Ô nhập ảnh dùng chung cho khu vực quản trị (admin/sale): 2 cách thay ảnh —
// kéo thả file (hoặc bấm để chọn, ảnh tự nén thành data URL như ảnh hậu mãi)
// hoặc dán link ảnh vào ô bên dưới. value là URL hoặc data URL.
export default function ImageField({ value, onChange, label = 'Ảnh', height = 132 }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  const isData = typeof value === 'string' && value.startsWith('data:');

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('File đã chọn không phải ảnh'); return; }
    setBusy(true);
    setErr('');
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch {
      setErr('Không đọc được ảnh này, thử ảnh khác');
    }
    setBusy(false);
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className={`image-drop${drag ? ' drag' : ''}`}
        style={{ minHeight: height }}
        role="button"
        tabIndex={0}
        aria-label="Kéo thả ảnh hoặc bấm để chọn ảnh"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
      >
        {value ? <img src={value} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
        <div className="image-drop-hint">
          {busy ? 'Đang xử lý ảnh…' : value ? '🖼️ Bấm hoặc kéo ảnh khác vào để thay' : '🖼️ Kéo thả ảnh vào đây, hoặc bấm để chọn ảnh'}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
      <div className="image-url-row">
        <input
          value={isData ? '' : (value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="hoặc dán link ảnh https://..."
        />
        {value && (
          <button type="button" className="btn btn-small btn-outline" onClick={() => onChange('')}>Xóa ảnh</button>
        )}
      </div>
      {isData && <p className="image-note">Ảnh đang dùng được tải lên từ máy (đã nén sẵn). Dán link vào ô trên nếu muốn đổi sang link.</p>}
      {err && <p className="image-err">{err}</p>}
    </div>
  );
}
