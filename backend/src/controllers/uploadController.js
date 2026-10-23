const crypto = require('crypto');
const dbStore = require('../services/dbStore');
const httpError = require('../utils/httpError');
const { send: sendError } = httpError;
const getEmpId = require('../helpers/getEmployeeId');
const { isApproverRole } = require('../middlewares/authMiddleware');
const { signAccessToken, verifyAccessToken } = require('../utils/security');

// What an employee may attach to a leave request: photos, PDF and common documents
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ID_PATTERN = /^att-[a-z0-9]+$/;

// Check the real file content (not just the name the phone sent) so a script cannot be stored as "photo.jpg"
const matchesSignature = (mime, buf) => {
  const head = (n) => buf.subarray(0, n);
  if (mime === 'image/jpeg') return head(3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mime === 'image/png') return head(4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/webp') return head(4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  if (mime === 'application/pdf') return head(4).toString('latin1') === '%PDF';
  if (mime === 'application/msword') return head(4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  if (mime.endsWith('wordprocessingml.document')) return head(2).toString('latin1') === 'PK';
  return false;
};

const cleanFileName = (name, ext) => {
  const base = String(name || 'attachment').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120) || 'attachment';
  return /\.[A-Za-z0-9]{2,5}$/.test(base) ? base : `${base}.${ext}`;
};

// POST /api/uploads/leave-attachment   { fileName, mimeType, dataBase64 }
exports.uploadLeaveAttachment = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const { fileName, mimeType, dataBase64 } = req.body || {};

    const ext = ALLOWED_TYPES[String(mimeType || '').toLowerCase()];
    if (!ext) throw httpError(400, 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP), PDF และเอกสาร Word เท่านั้น');
    if (typeof dataBase64 !== 'string' || !dataBase64) throw httpError(400, 'ไม่พบข้อมูลไฟล์');

    const buffer = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length === 0) throw httpError(400, 'ไฟล์ว่างเปล่า');
    if (buffer.length > MAX_BYTES) throw httpError(400, 'ไฟล์ใหญ่เกิน 5 MB กรุณาเลือกไฟล์ที่เล็กลง');
    if (!matchesSignature(String(mimeType).toLowerCase(), buffer)) throw httpError(400, 'เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่ระบุ');

    const id = `att-${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
    const saved = await dbStore.addLeaveAttachment({
      id,
      employeeId: empId,
      fileName: cleanFileName(fileName, ext),
      mimeType: String(mimeType).toLowerCase(),
      buffer,
    });

    return res.status(201).json({
      success: true,
      message: 'อัปโหลดไฟล์เรียบร้อยแล้ว',
      attachment: { id: saved.id, fileName: saved.fileName, mimeType: saved.mimeType, size: saved.size, url: `/uploads/leave/${saved.id}` },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// The leave attachment id inside a stored attachment url ("/uploads/leave/<id>"), or null
exports.attachmentIdFromUrl = (url) => {
  const m = String(url || '').match(/^\/uploads\/leave\/([^/?#]+)$/);
  return m && ID_PATTERN.test(m[1]) ? m[1] : null;
};

// GET /api/uploads/leave/:id/link  -> a 5-minute link that opens the file (phones open it in the browser / viewer)
exports.getLeaveAttachmentLink = async (req, res) => {
  try {
    const file = await dbStore.getLeaveAttachment(req.params.id);
    if (!file) throw httpError(404, 'ไม่พบไฟล์แนบ');
    // the owner, or someone who approves leave (managers / HR / admins)
    if (file.employeeId !== req.user.id && !isApproverRole(req.user.role)) {
      throw httpError(403, 'คุณไม่มีสิทธิ์เปิดไฟล์แนบนี้');
    }
    const ft = signAccessToken({ purpose: 'leave-file', fileId: file.id }, '5m');
    const url = `${req.protocol}://${req.get('host')}/api/uploads/leave/${encodeURIComponent(file.id)}/file?ft=${ft}`;
    return res.status(200).json({ success: true, url, fileName: file.fileName, mimeType: file.mimeType });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/uploads/leave/:id/file?ft=<token>  (no Authorization header: opened from the browser with the short-lived token)
exports.downloadLeaveAttachment = async (req, res) => {
  try {
    const decoded = verifyAccessToken(String(req.query.ft || ''));
    if (!decoded || decoded.purpose !== 'leave-file' || decoded.fileId !== req.params.id) {
      throw httpError(401, 'ลิงก์เปิดไฟล์หมดอายุหรือไม่ถูกต้อง กรุณาเปิดจากแอปอีกครั้ง');
    }
    const file = await dbStore.getLeaveAttachment(req.params.id);
    if (!file) throw httpError(404, 'ไม่พบไฟล์แนบ');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.buffer.length);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).send(file.buffer);
  } catch (error) {
    return sendError(res, error);
  }
};
