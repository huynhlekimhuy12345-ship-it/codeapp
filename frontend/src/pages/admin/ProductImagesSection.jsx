import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import ImageField from '../../components/ImageField';

/**
 * Mục "Ảnh phụ" trong form Sửa sản phẩm (admin/sale): quản lý thư viện ảnh của SP.
 * Ảnh thêm ở đây (không gắn biến thể) hiện ngay trong gallery trang chi tiết cho khách.
 * Thêm ảnh bằng chính ô ImageField dùng chung (kéo thả file hoặc dán link) + nút Thêm;
 * xóa có xác nhận inline 2 bước ngay trên thumbnail.
 */
export default function ProductImagesSection({ productId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!productId) return;
    setLoading(true);
    api.getProductImages(productId)
      .then((d) => setImages(d.images || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const url = (newUrl || '').trim();
    if (!url) return;
    setBusy(true); setErr('');
    try {
      await api.addProductImage(productId, { image_url: url });
      setNewUrl('');
      load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const remove = async (id) => {
    setBusy(true); setErr('');
    try {
      await api.deleteProductImage(id);
      setConfirmId(null);
      load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="pimg-section">
      <div className="pimg-head">🖼️ Ảnh phụ — hiện ở trang chi tiết cho khách ({images.length} ảnh)</div>
      {err && <div className="form-error">{err}</div>}
      {loading ? (
        <p className="muted">Đang tải ảnh…</p>
      ) : images.length === 0 ? (
        <p className="muted">Chưa có ảnh phụ nào.</p>
      ) : (
        <div className="pimg-grid">
          {images.map((img) => (
            <div key={img.id} className="pimg-item">
              <img src={img.image_url} alt="" loading="lazy" />
              {img.variant_id ? <span className="pimg-badge">Theo biến thể</span> : null}
              {confirmId === img.id ? (
                <span className="pimg-confirm">
                  <button type="button" className="pimg-yes" disabled={busy} onClick={() => remove(img.id)}>Xóa</button>
                  <button type="button" className="pimg-no" disabled={busy} onClick={() => setConfirmId(null)}>Hủy</button>
                </span>
              ) : (
                <button type="button" className="pimg-del" title="Xóa ảnh" aria-label="Xóa ảnh" onClick={() => setConfirmId(img.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      <ImageField label="Thêm ảnh phụ" height={96} value={newUrl} onChange={setNewUrl} />
      <button type="button" className="btn btn-small" disabled={busy || !newUrl.trim()} onClick={add}>
        ＋ Thêm vào thư viện
      </button>
    </div>
  );
}
