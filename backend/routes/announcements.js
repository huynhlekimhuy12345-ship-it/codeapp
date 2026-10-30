// Thông báo / tin tức của shop (BI99).
// - Admin/sale (staffOnly) được viết/sửa/xóa/bật-tắt.
// - Public: GET /active trả về các tin đang bật (banner trang chủ + chuông thông báo).
const express = require('express');
const db = require('../db');
const { auth, staffOnly } = require('../middleware/auth');

const router = express.Router();

// Chuẩn hoá thông số khung banner: zoom 1–2.5, vị trí 0–100 (%)
const clampZoom = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(2.5, Math.max(1, n)) : fb; };
const clampPos = (v, fb) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fb; };

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    author_name: r.author_name || null,
    author_role: r.author_role || null,
    title: r.title,
    content: r.content || '',
    badge: r.badge || '',
    cta_text: r.cta_text || '',
    cta_link: r.cta_link || '',
    image_url: r.image_url || '',
    image_caption: r.image_caption || '',
    image_zoom: r.image_zoom != null ? Number(r.image_zoom) : 1,
    image_pos_x: r.image_pos_x != null ? Number(r.image_pos_x) : 50,
    image_pos_y: r.image_pos_y != null ? Number(r.image_pos_y) : 50,
    show_on_banner: !!r.show_on_banner,
    send_notification: !!r.send_notification,
    is_active: !!r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/announcements/active — tin đang bật, mới nhất trước (public, không cần đăng nhập)
router.get('/active', async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.is_active = 1 ORDER BY a.id DESC LIMIT 20`
    ).all();
    res.json({ announcements: rows.map(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// GET /api/announcements — toàn bộ tin (mới nhất trước), chỉ staff
router.get('/', auth, staffOnly, async (req, res) => {
  try {
    const rows = await db.prepare(`SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.id DESC`).all();
    res.json({ announcements: rows.map(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// Gửi thông báo chuông cho MỌI khách hàng khi một tin được phát hành (tạo mới đang
// bật / sửa từ tắt → bật / bật lại) và tin có tick "gửi thông báo" — trước đây cờ
// send_notification chỉ lưu xuống DB mà không ai thực thi. Nguyên tắc user chốt:
// có gì mới là báo trên chuông. Lỗi gửi không làm hỏng thao tác của staff.
async function notifyAnnouncementPublished(ann) {
  try {
    // Link đích: nút CTA của tin nếu là link nội bộ; không thì mở thẳng trang
    // chi tiết tin (/tin-tuc/:id hiển thị đúng thông báo này cho khách).
    const link = ann.cta_link && String(ann.cta_link).startsWith('/')
      ? ann.cta_link
      : (ann.id ? `/tin-tuc/${ann.id}` : '/');
    const customers = await db.prepare("SELECT id FROM users WHERE role = 'customer'").all();
    const insNotif = db.prepare(
      'INSERT INTO user_notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)'
    );
    await db.transaction(async () => {
      for (const c of customers) {
        await insNotif.run(c.id, 'announcement', `📣 ${ann.title}`, String(ann.content || '').slice(0, 300), link);
      }
    })();
  } catch (e) { console.error('notifyAnnouncementPublished:', e); }
}

// POST /api/announcements — tạo tin mới, chỉ staff
router.post('/', auth, staffOnly, async (req, res) => {
  try {
    const { title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active } = req.body || {};
    if (!(title || '').trim()) return res.status(400).json({ error: 'Thiếu tiêu đề thông báo' });
    if (!(content || '').trim()) return res.status(400).json({ error: 'Thiếu nội dung thông báo' });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const r = await db.prepare(
      `INSERT INTO announcements (title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title.trim(), content.trim(), (badge || '').trim(), (cta_text || '').trim(), (cta_link || '').trim(),
      (image_url || '').trim(), (image_caption || '').trim(),
      clampZoom(image_zoom, 1), clampPos(image_pos_x, 50), clampPos(image_pos_y, 50),
      show_on_banner === false ? 0 : 1, send_notification === false ? 0 : 1, is_active === false ? 0 : 1,
      req.user ? req.user.id : null, now, now
    );
    const created = row(await db.prepare('SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(r.lastInsertRowid));
    if (created && created.is_active && created.send_notification) await notifyAnnouncementPublished(created);
    res.status(201).json({ announcement: created });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/announcements/:id — sửa tin, chỉ staff
router.put('/:id', auth, staffOnly, async (req, res) => {
  try {
    const cur = await db.prepare('SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    const { title, content, badge, cta_text, cta_link, image_url, image_caption, image_zoom, image_pos_x, image_pos_y, show_on_banner, send_notification, is_active } = req.body || {};
    if (title !== undefined && !String(title).trim()) return res.status(400).json({ error: 'Tiêu đề không được để trống' });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.prepare(
      `UPDATE announcements SET title = ?, content = ?, badge = ?, cta_text = ?, cta_link = ?,
       image_url = ?, image_caption = ?, image_zoom = ?, image_pos_x = ?, image_pos_y = ?,
       show_on_banner = ?, send_notification = ?, is_active = ?, updated_at = ? WHERE id = ?`
    ).run(
      title !== undefined ? String(title).trim() : cur.title,
      content !== undefined ? String(content).trim() : cur.content,
      badge !== undefined ? String(badge).trim() : cur.badge,
      cta_text !== undefined ? String(cta_text).trim() : cur.cta_text,
      cta_link !== undefined ? String(cta_link).trim() : cur.cta_link,
      image_url !== undefined ? String(image_url).trim() : (cur.image_url || ''),
      image_caption !== undefined ? String(image_caption).trim() : (cur.image_caption || ''),
      clampZoom(image_zoom, cur.image_zoom != null ? Number(cur.image_zoom) : 1),
      clampPos(image_pos_x, cur.image_pos_x != null ? Number(cur.image_pos_x) : 50),
      clampPos(image_pos_y, cur.image_pos_y != null ? Number(cur.image_pos_y) : 50),
      show_on_banner !== undefined ? (show_on_banner ? 1 : 0) : cur.show_on_banner,
      send_notification !== undefined ? (send_notification ? 1 : 0) : cur.send_notification,
      is_active !== undefined ? (is_active ? 1 : 0) : cur.is_active,
      now, req.params.id
    );
    const updated = row(await db.prepare('SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(req.params.id));
    if (!cur.is_active && updated && updated.is_active && updated.send_notification) await notifyAnnouncementPublished(updated);
    res.json({ announcement: updated });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// PUT /api/announcements/:id/toggle — bật/tắt hiển thị, chỉ staff
router.put('/:id/toggle', auth, staffOnly, async (req, res) => {
  try {
    const cur = await db.prepare('SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.prepare(`UPDATE announcements SET is_active = ?, updated_at = ? WHERE id = ?`)
      .run(cur.is_active ? 0 : 1, now, req.params.id);
    const toggled = row(await db.prepare('SELECT a.*, u.name AS author_name, u.role AS author_role FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?').get(req.params.id));
    if (toggled && toggled.is_active && toggled.send_notification) await notifyAnnouncementPublished(toggled);
    res.json({ announcement: toggled });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

// DELETE /api/announcements/:id — xóa tin, chỉ staff
router.delete('/:id', auth, staffOnly, async (req, res) => {
  try {
    const r = await db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Lỗi máy chủ' }); }
});

module.exports = router;
