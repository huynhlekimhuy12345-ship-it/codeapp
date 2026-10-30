// Script bỏ sẵn ẢNH PHỤ cho mọi sản phẩm — chạy tay bằng lệnh:
//   node seed-gallery.js        (trong thư mục backend, sau khi chạy npm install)
// Mỗi sản phẩm CHƯA có ảnh phụ sẽ được thêm 4 ảnh vào thư viện:
//   ảnh chính của sản phẩm (thứ tự 0) + 3 ảnh "mặt khác" được CẮT từ chính ảnh chính đó
//   (cận chi tiết ở giữa / nửa trái / góc dưới-phải) — cùng một món đồ, các mặt khác nhau.
// Ảnh cắt lưu dạng data URL trong bảng product_images (giống cách admin tải ảnh lên)
// nên chạy được cả trong Docker lẫn máy dev, không cần quản lý file.
// Chạy lại nhiều lần an toàn: sản phẩm đã có ảnh phụ sẽ bị bỏ qua.
const fs = require('fs');
const path = require('path');
const db = require('./db');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Chưa có thư viện sharp — chạy "npm install" trong thư mục backend trước.');
  process.exit(1);
}

async function sourceBuffer(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return null;
  if (url.startsWith('data:')) {
    const b64 = url.split(',')[1];
    return b64 ? Buffer.from(b64, 'base64') : null;
  }
  if (/^https?:\/\//i.test(url)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }
  const rel = url.replace(/^\//, '');
  const candidates = [
    path.join(__dirname, '..', 'frontend', 'public', rel),
    path.join(__dirname, '..', 'frontend', 'dist', rel),
    path.join(__dirname, 'public', rel),
    path.join(__dirname, '..', rel),
  ];
  for (const c of candidates) {
    try { return fs.readFileSync(c); } catch (e) { /* thử đường tiếp theo */ }
  }
  return null;
}

async function makeViews(buf) {
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  if (!w || !h) return [];
  const cw = Math.round(w * 0.62);
  const ch = Math.round(h * 0.62);
  const views = [
    { left: Math.round((w - cw) / 2), top: Math.round((h - ch) / 2), width: cw, height: ch }, // cận giữa
    { left: 0, top: 0, width: Math.round(w * 0.55), height: h }, // nửa trái
    { left: Math.round(w * 0.45), top: Math.round(h * 0.38), width: Math.round(w * 0.55), height: Math.round(h * 0.62) }, // góc dưới-phải
  ];
  const out = [];
  for (const v of views) {
    const b = await sharp(buf)
      .extract(v)
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    out.push('data:image/jpeg;base64,' + b.toString('base64'));
  }
  return out;
}

(async () => {
  const products = await db.prepare('SELECT id, name, image_url FROM products ORDER BY id').all();
  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of products) {
    const existing = await db.prepare('SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?').get(p.id);
    if (existing && existing.c > 0) { skipped++; continue; }
    if (!p.image_url) {
      console.log(`#${p.id} ${p.name}: chưa có ảnh chính — bỏ qua`);
      failed++;
      continue;
    }
    try {
      const buf = await sourceBuffer(p.image_url);
      if (!buf) {
        console.log(`#${p.id} ${p.name}: không đọc được ảnh chính — bỏ qua`);
        failed++;
        continue;
      }
      const views = await makeViews(buf);
      const rows = [p.image_url, ...views];
      for (let i = 0; i < rows.length; i++) {
        await db.prepare(
          'INSERT INTO product_images (product_id, variant_id, image_url, sort_order) VALUES (?, NULL, ?, ?)'
        ).run(p.id, rows[i], i);
      }
      console.log(`#${p.id} ${p.name}: +${rows.length} ảnh (1 chính + ${views.length} mặt khác)`);
      done++;
    } catch (e) {
      console.log(`#${p.id} ${p.name}: LỖI ${e.message}`);
      failed++;
    }
  }
  console.log(`Xong: ${done} sản phẩm có ảnh phụ mới, ${skipped} đã có sẵn, ${failed} bỏ qua/lỗi.`);
  process.exit(0);
})();
