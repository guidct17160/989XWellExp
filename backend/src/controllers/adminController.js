const crypto = require('crypto');
const dbStore = require('../services/dbStore');
const emailService = require('../services/emailService');
const { hashPassword, verifySetupToken } = require('../utils/security');
const { logAudit } = require('../utils/auditLogger');
const { send: sendError } = require('../utils/httpError');

// Strip sensitive fields before sending to client (Senior Cyber Sec Hardening)
const stripSensitive = (admin) => {
  if (!admin) return admin;
  const { password, pinHash, pin_hash, ...safe } = admin;
  safe.hasPin = Boolean(pinHash || pin_hash);
  return safe;
};

// GET /api/admins
exports.getAdmins = async (req, res) => {
  try {
    const admins = await dbStore.getAdmins();
    return res.status(200).json({
      success: true,
      total: admins.length,
      admins: admins.map(stripSensitive),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admins (Create Admin Account - Only Super Admin)
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, role, startDate } = req.body;

    // 1. Mandatory validation
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อ-นามสกุล Admin',
      });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมลสำหรับ Admin (ใช้เป็น Username สำหรับเข้าสู่ระบบ)',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      });
    }

    // 2. Strict Role: Only 2 roles allowed (Super Admin, HR Admin)
    const validRoles = ['Super Admin', 'HR Admin'];
    const finalRole = validRoles.includes(role) ? role : 'HR Admin';

    // 3. Duplicate check in admins
    const existingAdmins = await dbStore.getAdmins();
    const dupAdmin = existingAdmins.find(
      (a) =>
        (a.email && a.email.toLowerCase() === cleanEmail) ||
        (a.username && a.username.toLowerCase() === cleanEmail)
    );
    if (dupAdmin) {
      return res.status(400).json({
        success: false,
        message: `อีเมล / Username "${cleanEmail}" มีอยู่ในระบบแล้ว ไม่สามารถสร้างซ้ำได้`,
      });
    }

    // 4. Generate random temporary password hash for token binding
    const tempSecret = crypto.randomBytes(32).toString('hex');
    const initialPasswordHash = await hashPassword(tempSecret);

    let adminCode;
    do {
      adminCode = `ADM-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 900 + 100)}`;
    } while (existingAdmins.some((a) => a.id === adminCode || a.code === adminCode));
    const adminData = {
      id: adminCode,
      code: adminCode,
      username: cleanEmail, // Email is the login Username
      password: initialPasswordHash,
      name: String(name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : '-',
      department: '-', // Admins do NOT belong to any department
      role: finalRole,
      status: 'Pending Password', // Waiting for admin to set password via email link
      startDate: startDate || new Date().toISOString().split('T')[0],
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
    };

    const createdAdmin = await dbStore.addAdmin(adminData);

    // 5. Send password setup email targeting Web Admin portal
    console.log(`📧 [Admin Invite Target] Sending Web Admin setup email to: ${cleanEmail}`);
    const emailPreview = await emailService.sendAdminPasswordSetupEmail({
      name: createdAdmin.name,
      email: cleanEmail,
      role: finalRole,
      passwordHash: initialPasswordHash,
    });

    logAudit(req, {
      action: 'CREATE_ADMIN',
      resourceType: 'admin',
      resourceId: createdAdmin.id,
      details: { name: createdAdmin.name, email: cleanEmail, role: finalRole },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `สร้างบัญชีผู้ดูแลระบบ "${createdAdmin.name}" สำเร็จแล้ว และได้ส่งลิงก์กำหนดรหัสผ่านไปยัง ${cleanEmail}`,
      admin: stripSensitive(createdAdmin),
      emailPreview,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admins/set-password (Set Web Admin Password via Email Link)
exports.setPassword = async (req, res) => {
  try {
    const { email, password, token } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมลและรหัสผ่านใหม่',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ลิงก์ไม่ถูกต้อง กรุณาเปิดลิงก์จากอีเมลอีกครั้ง (Missing token)',
      });
    }

    const admins = await dbStore.getAdmins();
    const foundAdmin = admins.find((a) => a.email && a.email.toLowerCase() === cleanEmail);

    if (!foundAdmin || !verifySetupToken(token, cleanEmail, foundAdmin.password)) {
      return res.status(401).json({
        success: false,
        message: 'ลิงก์กำหนดรหัสผ่านไม่ถูกต้อง หรือหมดอายุแล้ว (มีอายุการใช้งาน 15 นาที) กรุณาติดต่อ Super Admin เพื่อขอลิงก์ใหม่',
      });
    }

    const newHash = await hashPassword(cleanPassword);
    const wasPending = ['Pending Password', 'Pending', 'รอตั้งรหัสผ่าน'].includes(foundAdmin.status);
    const updated = await dbStore.updateAdmin(foundAdmin.id, {
      password: newHash,
      ...(wasPending ? { status: 'Active' } : {}),
      username: cleanEmail,
    });

    logAudit(req, {
      action: 'ADMIN_SET_PASSWORD',
      resourceType: 'admin',
      resourceId: foundAdmin.id,
      details: { email: cleanEmail, role: foundAdmin.role },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'กำหนดรหัสผ่านผู้ดูแลระบบเรียบร้อยแล้ว สามารถเข้าสู่ระบบ Web Admin ได้ทันที',
      admin: stripSensitive(updated),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admins/:id/resend-invite (Resend Password Setup Email - Super Admin only)
exports.resendInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await dbStore.getAdminById(id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ดูแลระบบนี้' });
    }

    // Refresh password hash to a new random hash if still pending, to invalidate old links
    let passHash = admin.password;
    if (admin.status === 'Pending Password' || admin.status === 'Pending') {
      const tempSecret = crypto.randomBytes(32).toString('hex');
      passHash = await hashPassword(tempSecret);
      await dbStore.updateAdmin(admin.id, { password: passHash });
    }

    const isReset = !(admin.status === 'Pending Password' || admin.status === 'Pending');
    const emailPreview = await emailService.sendAdminPasswordSetupEmail({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      passwordHash: passHash,
      isReset,
    });

    logAudit(req, {
      action: isReset ? 'ADMIN_PASSWORD_RESET_EMAIL' : 'RESEND_ADMIN_INVITE',
      resourceType: 'admin',
      resourceId: admin.id,
      details: { email: admin.email, role: admin.role },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยัง ${admin.email} เรียบร้อยแล้ว`,
      emailPreview,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/admins/:id (Update Admin Account - Super Admin only)
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Admins do not have departments
    delete updateData.department;

    // Enforce 2 roles only
    if (updateData.role) {
      updateData.role = updateData.role === 'Super Admin' ? 'Super Admin' : 'HR Admin';
    }

    // Admin statuses: Active / Inactive (plus Pending Password before the invite is accepted)
    if (updateData.status !== undefined) {
      if (updateData.status === 'Resign' || updateData.status === 'Resigned') updateData.status = 'Inactive';
      if (!['Active', 'Inactive', 'Pending Password'].includes(updateData.status)) {
        return res.status(400).json({ success: false, message: 'สถานะ Admin ต้องเป็น Active หรือ Inactive เท่านั้น' });
      }
      if (updateData.status === 'Inactive') {
        if (req.user?.id === id) {
          return res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองเป็น Inactive ได้' });
        }
        const allAdmins = await dbStore.getAdmins();
        const target = allAdmins.find((a) => a.id === id);
        const activeSupers = allAdmins.filter((a) => a.role === 'Super Admin' && a.status === 'Active');
        if (target && target.role === 'Super Admin' && activeSupers.length <= 1 && activeSupers[0]?.id === target.id) {
          return res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยน Super Admin คนสุดท้ายของระบบเป็น Inactive ได้' });
        }
      }
    }

    // Sync username with email if email updated
    if (updateData.email) {
      updateData.email = String(updateData.email).trim().toLowerCase();
      updateData.username = updateData.email;
    }

    if (updateData.password && String(updateData.password).trim()) {
      updateData.password = await hashPassword(String(updateData.password).trim());
    }

    // Never let the body overwrite identity / security columns
    delete updateData.id;
    delete updateData.pinHash;
    delete updateData.pin_hash;
    delete updateData.hasPin;
    if (!updateData.password) delete updateData.password;

    const updated = await dbStore.updateAdmin(id, updateData);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ดูแลระบบนี้' });
    }

    return res.status(200).json({
      success: true,
      message: 'อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว',
      admin: stripSensitive(updated),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/admins/:id (Delete Admin - Super Admin only)
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account if logged in
    if (req.user && (req.user.id === id || req.user.username === id)) {
      return res.status(400).json({
        success: false,
        message: 'คุณไม่สามารถลบบัญชีผู้ดูแลระบบของตนเองที่กำลังเข้าสู่ระบบอยู่ได้',
      });
    }

    const allAdmins = await dbStore.getAdmins();
    const target = allAdmins.find((a) => a.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ดูแลระบบนี้' });
    }
    if (target.role === 'Super Admin' && allAdmins.filter((a) => a.role === 'Super Admin').length <= 1) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบ Super Admin คนสุดท้ายของระบบได้' });
    }

    await dbStore.deleteAdmin(id);

    logAudit(req, {
      action: 'DELETE_ADMIN',
      resourceType: 'admin',
      resourceId: id,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'ลบบัญชีผู้ดูแลระบบเรียบร้อยแล้ว',
    });
  } catch (error) {
    return sendError(res, error);
  }
};
