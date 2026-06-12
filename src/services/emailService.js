import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
}

async function sendLinkEmail(to, { kind, path, token, subject, heading, body, cta, footer }) {
  const t = getTransporter();
  if (!t) {
    logger.warn({ email: to }, `SMTP not configured — skipping ${kind} email`);
    return false;
  }
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const link = `${appUrl}${path}/${token}`;
  await t.sendMail({
    from: `"Pingable" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: `${heading}: ${link}\n${footer.replace(/<br>/g, '\n')}`,
    html: buildHtml(link, { heading, body, cta, footer }),
  });
  return true;
}

export function sendVerificationEmail(to, token) {
  return sendLinkEmail(to, {
    kind: 'verification',
    path: '/auth/verify',
    token,
    subject: 'ยืนยันอีเมลของคุณ — Pingable',
    heading: 'ยืนยันอีเมลของคุณ',
    body: 'คลิกปุ่มด้านล่างเพื่อยืนยันที่อยู่อีเมล แล้วเริ่มเรียนได้เลย',
    cta: 'ยืนยันอีเมล',
    footer: 'ลิงก์นี้ใช้ได้ภายใน 24 ชั่วโมง<br>หากคุณไม่ได้สมัครสมาชิก Pingable ไม่ต้องทำอะไร',
  });
}

export function sendPasswordResetEmail(to, token) {
  return sendLinkEmail(to, {
    kind: 'password reset',
    path: '/auth/reset-password',
    token,
    subject: 'ตั้งรหัสผ่านใหม่ — Pingable',
    heading: 'ตั้งรหัสผ่านใหม่',
    body: 'มีคำขอรีเซ็ตรหัสผ่านของบัญชีนี้ — คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่',
    cta: 'ตั้งรหัสผ่านใหม่',
    footer: 'ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง และใช้ได้ครั้งเดียว<br>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร — รหัสผ่านเดิมยังใช้ได้ตามปกติ',
  });
}

function buildHtml(link, { heading, body, cta, footer }) {
  return `<!doctype html><html><body style="font-family:Inter,sans-serif;background:#080d17;color:#e9eef7;padding:32px;margin:0">
<div style="max-width:480px;margin:0 auto;background:#111a2b;border:1px solid #20304a;border-radius:12px;padding:32px">
  <p style="color:#22c55e;font-weight:700;font-size:1.1rem;margin:0 0 20px;letter-spacing:.05em">PINGABLE</p>
  <h2 style="margin:0 0 12px;font-size:1.25rem;font-weight:700">${heading}</h2>
  <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6">${body}</p>
  <a href="${link}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#032012;border-radius:8px;text-decoration:none;font-weight:700;font-size:.95rem">${cta}</a>
  <p style="color:#5b6b85;font-size:.8rem;margin:28px 0 0;line-height:1.5">${footer}</p>
</div></body></html>`;
}
