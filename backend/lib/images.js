// Kiểm tra danh sách ảnh minh họa đính kèm yêu cầu hậu mãi (đổi/trả, bảo hành).
// Ảnh do trình duyệt nén sẵn thành data URL (JPEG) trước khi gửi; máy chủ kiểm tra lại:
// bắt buộc 1–3 ảnh, đúng định dạng data:image, mỗi ảnh không quá ~1,1MB dữ liệu gốc.
const MAX_IMAGES = 3;
const MAX_IMAGE_CHARS = 1_500_000; // độ dài chuỗi base64 (~1,1MB ảnh)
const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0)
    return { error: 'Vui lòng đính kèm ít nhất 1 ảnh minh họa' };
  if (images.length > MAX_IMAGES)
    return { error: `Tối đa ${MAX_IMAGES} ảnh minh họa` };
  for (const img of images) {
    if (typeof img !== 'string' || !DATA_URL_RE.test(img))
      return { error: 'Ảnh minh họa không đúng định dạng' };
    if (img.length > MAX_IMAGE_CHARS)
      return { error: 'Ảnh minh họa quá lớn, vui lòng chọn ảnh nhỏ hơn' };
  }
  return { value: JSON.stringify(images) };
}

// Parse cột images (JSON) thành mảng; dữ liệu cũ/hỏng -> []
function parseImages(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

module.exports = { validateImages, parseImages, MAX_IMAGES };
