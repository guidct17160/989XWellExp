// =====================================================
// emailService.js - Wellexp Exact Password Setup Email Service
// =====================================================
require('dotenv').config();
const nodemailer = require('nodemailer');

const { signSetupToken } = require('../utils/security');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

exports.sendPasswordSetupEmail = async ({ name: rawName, email, role, department, code, passwordHash }) => {
  const name = escapeHtml(rawName);
  const setupToken = signSetupToken(email, passwordHash);
  const appUrl = (process.env.APP_URL || 'http://localhost:8081').replace(/\/$/, '');
  const setupLink = `${appUrl}/set-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(setupToken)}`;
  const deepLink = `wellx989://set-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(setupToken)}`;
  
  const subject = `"WellX989" set new password `;
  
  const plainTextBody = `Hi ${name},

We received a request to set your password for WellX989 Application.

Username: ${email}
Set your password here: ${setupLink}

This link will expire in 15 minutes. If you did not request this, please ignore this email.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; color: #1E293B; line-height: 1.6; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0;">
      <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellX989 - กำหนดรหัสผ่านเข้าใช้งาน</h2>
      <p style="font-size: 15px; margin-bottom: 12px;">เรียนคุณ <strong>${name}</strong>,</p>
      <p style="font-size: 14px; margin-bottom: 16px; color: #475569;">
        ระบบได้ทำการลงทะเบียนบัญชีของคุณสำหรับใช้งานบน <strong>WellX989 Mobile Application</strong> เรียบร้อยแล้ว
      </p>
      
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
        <p style="font-size: 13px; margin: 0; color: #64748B;">ชื่อผู้ใช้งาน (Username):</p>
        <p style="font-size: 15px; margin: 4px 0 0 0; font-weight: bold; color: #0F172A; font-family: monospace;">${email}</p>
      </div>

      <div style="margin: 24px 0 28px 0; text-align: center;">
        <a href="${setupLink}" style="display: inline-block; background: #DC2626; color: #FFFFFF; font-weight: bold; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);">
          กำหนดรหัสผ่าน (Set Password)
        </a>
      </div>

      <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 12px; text-align: center;">
        ลิงก์นี้มีอายุการใช้งาน 15 นาที หากคุณไม่ได้ทำรายการนี้ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้
      </p>
    </div>
  `;

  // Real Gmail Web Direct Compose URL
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log(`⚠️ Invalid email format: ${email}`);
    return exports._safePreview({ to: email, subject, sentAt: new Date().toLocaleString('th-TH'), setupLink, setupToken, gmailComposeUrl, plainTextBody, realSmtpSent: false });
  }

  // Attempt real Nodemailer SMTP send if SMTP_USER is set in environment
  let realSmtpSent = false;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      if (!exports._transporter) {
        exports._transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
        });
      }

      await exports._transporter.sendMail({
        from: `"WellX989" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        text: plainTextBody,
        html: htmlBody,
      });
      realSmtpSent = true;
      console.log(`✅ [Real Gmail SMTP] Successfully sent Wellexp setup email to ${email}`);
    } catch (err) {
      console.log(`⚠️ [SMTP Fallback] SMTP sending failed: ${err.message}`);
      exports._transporter = null; // Reset on failure so next attempt creates fresh connection
    }
  }

  return exports._safePreview({
    to: email,
    subject: subject,
    sentAt: new Date().toLocaleString('th-TH'),
    setupLink,
    setupToken,
    gmailComposeUrl,
    plainTextBody,
    realSmtpSent,
  });
};

exports.sendAdminPasswordSetupEmail = async ({ name: rawName, email, role, passwordHash, isReset = false }) => {
  const name = escapeHtml(rawName);
  const setupToken = signSetupToken(email, passwordHash);
  const webUrl = (process.env.WEB_URL || process.env.ADMIN_WEB_URL || 'http://localhost:3008').replace(/\/$/, '');
  const setupLink = `${webUrl}/set-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(setupToken)}&portal=web&type=admin`;
  
  const roleLabel = role === 'Super Admin' ? 'Super Admin (สิทธิ์สูงสุด)' : 'HR Admin (จัดการพนักงาน/อนุมัติ)';
  const subject = isReset
    ? `"WellX989" ตั้งรหัสผ่านใหม่ Web Admin (${role || 'Admin'})`
    : `"WellX989" กำหนดรหัสผ่านเข้าใช้งาน Web Admin (${role || 'Admin'})`;
  
  const plainTextBody = `Hi ${name},

${isReset ? 'ผู้ดูแลระบบได้ขอให้ตั้งรหัสผ่านใหม่สำหรับบัญชี WellX989 Web Admin ของคุณ' : 'ระบบได้สร้างบัญชีผู้ดูแลระบบสำหรับคุณบน WellX989 Web Admin เรียบร้อยแล้ว'}

ระดับสิทธิ์ (Role): ${role}
Username (ใช้อีเมลในการเข้าสู่ระบบ): ${email}
กำหนดรหัสผ่านของคุณได้ที่: ${setupLink}

ลิงก์นี้มีอายุการใช้งาน 15 นาที หากคุณไม่ได้ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; color: #1E293B; line-height: 1.6; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0;">
      <h2 style="color: #0F172A; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellX989 - กำหนดรหัสผ่านผู้ดูแลระบบ (Web Admin)</h2>
      <p style="font-size: 15px; margin-bottom: 12px;">เรียนคุณ <strong>${name}</strong>,</p>
      <p style="font-size: 14px; margin-bottom: 16px; color: #475569;">
        คุณได้รับสิทธิ์เข้าใช้งานระบบบริหารจัดการ <strong>WellX989 Web Admin</strong> ในระดับสิทธิ์ <strong>${roleLabel}</strong> เรียบร้อยแล้ว
      </p>
      
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
        <p style="font-size: 13px; margin: 0; color: #64748B;">ชื่อผู้ใช้งาน (Username สำหรับเข้าสู่ระบบ):</p>
        <p style="font-size: 15px; margin: 4px 0 0 0; font-weight: bold; color: #DC2626; font-family: monospace;">${email}</p>
        <p style="font-size: 12px; margin: 8px 0 0 0; color: #64748B;">ระดับสิทธิ์ (Role): <strong style="color: #0F172A;">${role}</strong></p>
      </div>

      <div style="margin: 24px 0 28px 0; text-align: center;">
        <a href="${setupLink}" style="display: inline-block; background: #DC2626; color: #FFFFFF; font-weight: bold; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);">
          กำหนดรหัสผ่าน Web Admin (Set Password)
        </a>
      </div>

      <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 12px; text-align: center;">
        ลิงก์นี้เปิดในเว็บเบราว์เซอร์เพื่อตั้งรหัสผ่าน มีอายุการใช้งาน 15 นาที หากมีข้อสงสัยกรุณาติดต่อผู้ดูแลระบบสูงสุด
      </p>
    </div>
  `;

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log(`⚠️ Invalid email format: ${email}`);
    return exports._safePreview({ to: email, subject, sentAt: new Date().toLocaleString('th-TH'), setupLink, setupToken, gmailComposeUrl, plainTextBody, realSmtpSent: false });
  }

  let realSmtpSent = false;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      if (!exports._transporter) {
        exports._transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
        });
      }

      await exports._transporter.sendMail({
        from: `"WellX989 Admin" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        text: plainTextBody,
        html: htmlBody,
      });
      realSmtpSent = true;
      console.log(`✅ [Real Gmail SMTP] Successfully sent Admin setup email to ${email}`);
    } catch (err) {
      console.log(`⚠️ [SMTP Fallback] SMTP sending failed: ${err.message}`);
      exports._transporter = null;
    }
  }

  return exports._safePreview({
    to: email,
    subject: subject,
    sentAt: new Date().toLocaleString('th-TH'),
    setupLink,
    setupToken,
    gmailComposeUrl,
    plainTextBody,
    realSmtpSent,
  });
};

// Never expose setup link/token in API responses on production
exports._safePreview = (preview) => {
  if (process.env.NODE_ENV !== 'production') return preview;
  return { to: preview.to, subject: preview.subject, sentAt: preview.sentAt, realSmtpSent: preview.realSmtpSent };
};

