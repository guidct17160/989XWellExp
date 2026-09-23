// =====================================================
// emailService.js - Wellexp Exact Password Setup Email Service
// =====================================================
require('dotenv').config();
const nodemailer = require('nodemailer');

exports.sendPasswordSetupEmail = async ({ name, email, role, department, code }) => {
  const setupToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const setupLink = `http://localhost:8081/set-password?email=${encodeURIComponent(email)}&token=${setupToken}`;
  const deepLink = `wellx989://set-password?email=${encodeURIComponent(email)}&token=${setupToken}`;
  
  const subject = `"WellX989" set new password `;
  
  const plainTextBody = `Hi ${name},

We received a request to set your password for WellX989 Application.

Username: ${email}

Set your password here (Open in App): ${setupLink}

Mobile App Link: ${deepLink}

This link will expire in 24 hours. If you did not request this, please ignore this email.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #333333; line-height: 1.6; background: #FFFFFF;">
      <p style="font-size: 15px; margin-bottom: 16px;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 14px; margin-bottom: 16px;">We received a request to set your password for <strong>WellX989 Mobile Application</strong>.</p>
      <p style="font-size: 14px; margin-bottom: 16px;">Username: <a href="mailto:${email}" style="color: #0066CC; text-decoration: none; font-weight: bold;">${email}</a></p>
      <p style="font-size: 14px; margin-bottom: 16px;">Set your password here: <a href="${setupLink}" style="color: #E91E63; font-weight: bold; text-decoration: underline;">Set Password (Open App)</a></p>
      <p style="font-size: 14px; margin-bottom: 20px;">Or click URL: <a href="${setupLink}" style="color: #E91E63; text-decoration: underline;">${setupLink}</a></p>
      <p style="color: #666666; font-size: 13px; margin-top: 24px; border-top: 1px solid #EEEEEE; padding-top: 12px;">This link will expire in 24 hours. If you did not request this, please ignore this email.</p>
    </div>
  `;

  // Real Gmail Web Direct Compose URL
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log(`⚠️ Invalid email format: ${email}`);
    return { to: email, subject, sentAt: new Date().toLocaleString('th-TH'), setupLink, setupToken, gmailComposeUrl, plainTextBody, realSmtpSent: false };
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

  return {
    to: email,
    subject: subject,
    sentAt: new Date().toLocaleString('th-TH'),
    setupLink,
    setupToken,
    gmailComposeUrl,
    plainTextBody,
    realSmtpSent,
  };
};
