// Gửi email qua SMTP (dùng cho mã đặt lại mật khẩu).
// Cấu hình qua biến môi trường: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
// Chưa cấu hình -> KHÔNG gửi thật, chỉ ghi log ở console server (để admin/test xem mã),
// để tính năng vẫn chạy được trong lúc chờ shop cấp tài khoản email.
let transporter = null;
let triedInit = false;

function getTransporter() {
  if (triedInit) return transporter;
  triedInit = true;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  try {
    const nodemailer = require('nodemailer');
    const port = Number(SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } catch (e) {
    console.error('mailer init:', e);
    transporter = null;
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[MAILER - chưa cấu hình SMTP] Tới: ${to} | ${subject} | ${text}`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (e) {
    console.error('sendMail:', e);
    return false;
  }
}

module.exports = { sendMail };
