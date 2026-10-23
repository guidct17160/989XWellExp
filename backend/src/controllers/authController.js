const dbStore = require('../services/dbStore');
const {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../utils/security');
const { logAudit } = require('../utils/auditLogger');
const emailService = require('../services/emailService');

const IS_PROD = process.env.NODE_ENV === 'production';

// Accounts that must NOT be able to sign in / refresh / use PIN
const blockedStatusMessage = (user) => {
  const st = user && user.status;
  if (st === 'Pending' || st === 'Pending Password' || st === 'รอตั้งรหัสผ่าน') {
    return 'บัญชีนี้ยังอยู่ในสถานะรอตั้งรหัสผ่าน (Pending) กรุณาตรวจสอบอีเมลและตั้งรหัสผ่านให้เรียบร้อยก่อนเข้าใช้งาน';
  }
  if (st === 'Inactive') {
    return 'บัญชีนี้ถูกระงับการใช้งาน (Inactive) กรุณาติดต่อผู้ดูแลระบบหรือฝ่ายทรัพยากรบุคคล (HR)';
  }
  if (st === 'Resign' || st === 'Resigned') {
    return 'บัญชีนี้พ้นสภาพการเป็นพนักงานแล้ว (Resign) ไม่สามารถเข้าสู่ระบบได้';
  }
  return null;
};

// Strip sensitive fields before sending to client
const stripSensitive = (user) => {
  if (!user) return user;
  const { password, pin_hash, pinHash, ...safe } = user;
  safe.hasPin = Boolean(user.pin_hash || user.pinHash);
  return safe;
};

// Per-account PIN brute-force lockout (5 failures → 15 min lock)
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const pinFailures = new Map(); // key -> { count, lockedUntil }
const isPinLocked = (key) => {
  const f = pinFailures.get(key);
  return Boolean(f && f.lockedUntil && f.lockedUntil > Date.now());
};
const recordPinFailure = (key) => {
  const f = pinFailures.get(key) || { count: 0, lockedUntil: 0 };
  if (f.lockedUntil && f.lockedUntil <= Date.now()) { f.count = 0; f.lockedUntil = 0; }
  f.count += 1;
  if (f.count >= PIN_MAX_ATTEMPTS) f.lockedUntil = Date.now() + PIN_LOCK_MS;
  pinFailures.set(key, f);
};
const PIN_LOCKED_RESPONSE = {
  success: false,
  message: 'ใส่ PIN ผิดเกินกำหนด บัญชีถูกล็อกชั่วคราว 15 นาที กรุณาเข้าสู่ระบบด้วยรหัสผ่าน',
};

exports.login = async (req, res) => {
  try {
    const { username, password, portal } = req.body;

    if (!username && !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน',
      });
    }
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อผู้ใช้ (Username)',
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัสผ่าน (Password)',
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // Determine Portal Type ('web' or 'app')
    const isWebPortal = portal === 'web' || (req.path && req.path.includes('web'));
    const isAppPortal = portal === 'app' || (req.path && req.path.includes('app'));

    const [admins, employees] = await Promise.all([
      dbStore.getAdmins(),
      dbStore.getEmployees(),
    ]);

    const matchUser = (list) =>
      list.find((e) => {
        if (!e) return false;
        const uName = e.username ? String(e.username).trim().toLowerCase() : '';
        const uCode = e.code ? String(e.code).trim().toLowerCase() : '';
        const uEmail = e.email ? String(e.email).trim().toLowerCase() : '';
        const uId = e.id ? String(e.id).trim().toLowerCase() : '';
        const rawName = e.name ? String(e.name).trim().toLowerCase() : '';
        const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();

        return (
          uName === cleanUsername ||
          uCode === cleanUsername ||
          uEmail === cleanUsername ||
          uId === cleanUsername ||
          rawName === cleanUsername ||
          cleanName === cleanUsername
        );
      });

    const foundAdmin = matchUser(admins);
    const foundEmployee = matchUser(employees);

    // 1. WEB ADMIN PORTAL LOGIN
    if (isWebPortal) {
      if (!foundAdmin) {
        if (foundEmployee) {
          return res.status(403).json({
            success: false,
            message: 'บัญชีนี้เป็นพนักงานทั่วไป สามารถเข้าใช้งานได้เฉพาะบน Mobile App เท่านั้น',
          });
        }
        return res.status(401).json({
          success: false,
          message: 'ชื่อผู้ใช้ (Username) ไม่ถูกต้อง หรือไม่พบบัญชีนี้ในระบบ',
        });
      }

      if (
        foundAdmin.status === 'Pending' ||
        foundAdmin.status === 'Pending Password' ||
        foundAdmin.status === 'รอตั้งรหัสผ่าน'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'บัญชีผู้ดูแลระบบนี้ยังอยู่ในสถานะรอตั้งรหัสผ่าน กรุณาตรวจสอบอีเมลและตั้งรหัสผ่านผ่านลิงก์ที่ได้รับก่อนเข้าใช้งาน',
        });
      }

      if (foundAdmin.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          message: 'บัญชีผู้ดูแลระบบนี้ถูกระงับการใช้งาน (Inactive) กรุณาติดต่อ Super Admin',
        });
      }

      const expectedPassword = String(foundAdmin.password || '').trim();
      const check = await comparePassword(cleanPassword, expectedPassword);

      if (!check.valid) {
        // LOW-5 FIX: Log failed login attempts for brute-force detection
        logAudit(req, {
          action: 'LOGIN_FAILED',
          resourceType: 'admin',
          resourceId: foundAdmin.id,
          details: { portal: 'web', reason: 'Invalid password' },
        }).catch(() => {});
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        });
      }

      // Transparent password auto-upgrade to bcrypt hash
      if (check.needsUpgrade) {
        hashPassword(cleanPassword)
          .then((hashed) => dbStore.updateAdmin(foundAdmin.id, { password: hashed }))
          .catch((err) => console.error('Admin password upgrade failed:', err));
      }

      const jwtToken = signAccessToken({
        id: foundAdmin.id,
        code: foundAdmin.code,
        username: foundAdmin.username,
        name: foundAdmin.name,
        role: foundAdmin.role || 'Admin',
        portal: 'web',
      }, '1d');

      logAudit(req, {
        action: 'LOGIN_SUCCESS',
        resourceType: 'admin',
        resourceId: foundAdmin.id,
        details: { portal: 'web', role: foundAdmin.role },
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบ Web Admin สำเร็จ',
        token: jwtToken,
        accessToken: jwtToken,
        user: stripSensitive(foundAdmin),
        timeoutConfig: {
          idleTimeoutMinutes: 30,
          absoluteTimeoutHours: 8,
          description: 'Web Admin HR: Idle Timeout 30 นาที, Absolute Timeout 8 ชั่วโมง',
        },
      });
    }

    // 2. MOBILE APP PORTAL LOGIN
    if (isAppPortal) {
      if (!foundEmployee) {
        if (foundAdmin) {
          return res.status(403).json({
            success: false,
            message: 'บัญชีนี้เป็นผู้ดูแลระบบ (Admin) สามารถเข้าใช้งานได้เฉพาะบน Web Admin เท่านั้น',
          });
        }
        return res.status(401).json({
          success: false,
          message: 'ชื่อผู้ใช้ (Username) ไม่ถูกต้อง หรือไม่พบบัญชีนี้ในระบบ',
        });
      }

      if (
        foundEmployee.status === 'Pending' ||
        foundEmployee.status === 'Pending Password' ||
        foundEmployee.status === 'รอตั้งรหัสผ่าน'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'บัญชีนี้ยังอยู่ในสถานะรอตั้งรหัสผ่าน (Pending) กรุณาตรวจสอบอีเมลและตั้ง Username/Password ให้เรียบร้อยก่อนเข้าใช้งาน',
        });
      }

      if (foundEmployee.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          message: 'บัญชีนี้ถูกระงับการใช้งาน (Inactive) กรุณาติดต่อฝ่ายทรัพยากรบุคคล (HR)',
        });
      }

      if (foundEmployee.status === 'Resign' || foundEmployee.status === 'Resigned') {
        return res.status(403).json({
          success: false,
          message: 'บัญชีนี้พ้นสภาพการเป็นพนักงานแล้ว (Resign) ไม่สามารถเข้าสู่ระบบได้',
        });
      }

      const expectedPassword = String(foundEmployee.password || '').trim();
      const check = await comparePassword(cleanPassword, expectedPassword);

      if (!check.valid) {
        // LOW-5 FIX: Log failed login attempts for brute-force detection
        logAudit(req, {
          action: 'LOGIN_FAILED',
          resourceType: 'employee',
          resourceId: foundEmployee.id,
          details: { portal: 'app', reason: 'Invalid password' },
        }).catch(() => {});
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        });
      }

      // Transparent password auto-upgrade to bcrypt hash
      if (check.needsUpgrade) {
        hashPassword(cleanPassword)
          .then((hashed) => dbStore.updateEmployee(foundEmployee.id, { password: hashed }))
          .catch((err) => console.error('Employee password upgrade failed:', err));
      }

      const accessToken = signAccessToken({
        id: foundEmployee.id,
        code: foundEmployee.code,
        username: foundEmployee.username,
        name: foundEmployee.name,
        role: foundEmployee.role || 'Employee',
        portal: 'app',
      }, '15m');

      const refreshToken = signRefreshToken({
        id: foundEmployee.id,
        role: foundEmployee.role || 'Employee',
      }, '30d');

      logAudit(req, {
        action: 'LOGIN_SUCCESS',
        resourceType: 'employee',
        resourceId: foundEmployee.id,
        details: { portal: 'app', role: foundEmployee.role },
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบ Mobile App สำเร็จ',
        token: accessToken,
        accessToken,
        refreshToken,
        user: stripSensitive(foundEmployee),
        tokenConfig: {
          accessTokenMinutes: 15,
          refreshTokenDays: 30,
          description: 'App HR สำหรับพนักงาน: Access Token 15 นาที, Refresh Token 30 วัน',
        },
      });
    }

    // DEFAULT (NO PORTAL FLAG): ADMIN -> WEB ONLY, EMPLOYEE -> APP ONLY
    if (foundAdmin) {
      const adminBlocked = blockedStatusMessage(foundAdmin);
      if (adminBlocked) {
        return res.status(403).json({ success: false, message: adminBlocked });
      }
      const expectedPassword = String(foundAdmin.password || '').trim();
      const check = await comparePassword(cleanPassword, expectedPassword);

      if (!check.valid) {
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        });
      }

      if (check.needsUpgrade) {
        hashPassword(cleanPassword)
          .then((hashed) => dbStore.updateAdmin(foundAdmin.id, { password: hashed }))
          .catch(() => {});
      }

      const jwtToken = signAccessToken({
        id: foundAdmin.id,
        code: foundAdmin.code,
        username: foundAdmin.username,
        name: foundAdmin.name,
        role: foundAdmin.role || 'Admin',
        portal: 'web',
      }, '1d');

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ (Admin)',
        token: jwtToken,
        accessToken: jwtToken,
        user: stripSensitive(foundAdmin),
        timeoutConfig: {
          idleTimeoutMinutes: 30,
          absoluteTimeoutHours: 8,
        },
      });
    }

    if (foundEmployee) {
      const employeeBlocked = blockedStatusMessage(foundEmployee);
      if (employeeBlocked) {
        return res.status(403).json({ success: false, message: employeeBlocked });
      }
      const expectedPassword = String(foundEmployee.password || '').trim();
      const check = await comparePassword(cleanPassword, expectedPassword);

      if (!check.valid) {
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่าน (Password) ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
        });
      }

      if (check.needsUpgrade) {
        hashPassword(cleanPassword)
          .then((hashed) => dbStore.updateEmployee(foundEmployee.id, { password: hashed }))
          .catch(() => {});
      }

      const accessToken = signAccessToken({
        id: foundEmployee.id,
        code: foundEmployee.code,
        username: foundEmployee.username,
        name: foundEmployee.name,
        role: foundEmployee.role || 'Employee',
        portal: 'app',
      }, '15m');

      const refreshToken = signRefreshToken({
        id: foundEmployee.id,
        role: foundEmployee.role || 'Employee',
      }, '30d');

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ (Employee)',
        token: accessToken,
        accessToken,
        refreshToken,
        user: stripSensitive(foundEmployee),
        tokenConfig: {
          accessTokenMinutes: 15,
          refreshTokenDays: 30,
        },
      });
    }

    // LOW-5 FIX: Log failed login (user not found)
    logAudit(req, {
      action: 'LOGIN_FAILED',
      resourceType: 'auth',
      resourceId: cleanUsername,
      details: { reason: 'User not found' },
    }).catch(() => {});
    return res.status(401).json({
      success: false,
      message: 'ชื่อผู้ใช้ (Username) ไม่ถูกต้อง หรือไม่พบบัญชีนี้ในระบบ',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MED-7 FIX: POST /api/auth/refresh — Server-side token renewal
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Refresh Token',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Refresh Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      });
    }

    // Find user in database to ensure they still exist and are active
    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);
    const allUsers = [...employees, ...admins];
    const user = allUsers.find(
      (u) => u.id === decoded.id || u.code === decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
      });
    }

    const refreshBlocked = blockedStatusMessage(user);
    if (refreshBlocked) {
      return res.status(403).json({ success: false, message: refreshBlocked });
    }

    const isAdmin = admins.some((a) => a.id === user.id);
    const portal = isAdmin ? 'web' : 'app';
    const expiresIn = isAdmin ? '1d' : '15m';

    const newAccessToken = signAccessToken({
      id: user.id,
      code: user.code,
      username: user.username,
      name: user.name,
      role: user.role || (isAdmin ? 'Admin' : 'Employee'),
      portal,
    }, expiresIn);

    return res.status(200).json({
      success: true,
      message: 'Token renewed successfully',
      accessToken: newAccessToken,
      token: newAccessToken,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Employees change their own profile picture without an Admin. The picture arrives as a small
// image data URL (the app resizes it first) and is stored in employees.avatar_url.
const AVATAR_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX_LENGTH = 600 * 1024; // characters of the data URL (about 450 KB of image)

exports.updateMyAvatar = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้ที่ได้รับสิทธิ์ กรุณาเข้าสู่ระบบก่อน' });
    }

    const avatarUrl = req.body && req.body.avatarUrl;
    if (typeof avatarUrl !== 'string' || !AVATAR_DATA_URL.test(avatarUrl)) {
      return res.status(400).json({ success: false, message: 'ไฟล์รูปภาพไม่ถูกต้อง (รองรับ JPG, PNG, WEBP)' });
    }
    if (avatarUrl.length > AVATAR_MAX_LENGTH) {
      return res.status(400).json({ success: false, message: 'ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง' });
    }

    const employees = await dbStore.getEmployees();
    const emp = employees.find((e) => e.id === userId);
    if (!emp) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน (เปลี่ยนรูปโปรไฟล์ได้เฉพาะบัญชีพนักงานในแอป)' });
    }

    const updated = await dbStore.updateEmployee(emp.id, { avatarUrl });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลพนักงาน' });
    }

    logAudit(req, {
      action: 'UPDATE_OWN_AVATAR',
      resourceType: 'employee',
      resourceId: emp.id,
      details: { code: emp.code },
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว', avatarUrl: updated.avatarUrl });
  } catch (error) {
    console.error('Error in updateMyAvatar:', error);
    return res.status(500).json({ success: false, message: error.message || 'ไม่สามารถเปลี่ยนรูปโปรไฟล์ได้' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const empIdHeader = req.headers['x-employee-id'];
    const queryId = req.query.employeeId || req.query.id;

    let targetId = req.user?.id || empIdHeader || queryId;

    if (!targetId && authHeader) {
      const raw = authHeader.replace('Bearer ', '').trim();
      const decoded = verifyAccessToken(raw);
      if (decoded && decoded.id) {
        targetId = decoded.id;
      }
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);
    const all = [...employees, ...admins];

    let found = null;
    if (targetId) {
      const cleanTarget = String(targetId).toLowerCase();
      found = all.find(
        (u) =>
          (u.id && String(u.id).toLowerCase() === cleanTarget) ||
          (u.code && String(u.code).toLowerCase() === cleanTarget) ||
          (u.username && String(u.username).toLowerCase() === cleanTarget) ||
          (u.email && String(u.email).toLowerCase() === cleanTarget)
      );
    }

    if (found) {
      return res.status(200).json({
        success: true,
        user: stripSensitive(found),
      });
    }

    return res.status(401).json({
      success: false,
      message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/forgot-password (Request Password Reset Link)
exports.forgotPassword = async (req, res) => {
  try {
    const { employeeId, email, portal } = req.body;
    const identifier = String(employeeId || email || '').trim().toLowerCase();
    // A reset requested from the web admin may only reach web admin accounts, so the link always opens the WEB set-password page
    const isWebRequest = portal === 'web';
    // Policy: employees (mobile app) can NOT reset their own password. They ask an Admin, who resets it
    // from the web All Employees menu (POST /employees/:id/reset-password). Only the web admin portal may use this endpoint.
    if (!isWebRequest) {
      return res.status(403).json({
        success: false,
        message: 'พนักงานไม่สามารถรีเซ็ตรหัสผ่านด้วยตัวเองได้ กรุณาแจ้งผู้ดูแลระบบ (Admin) ให้รีเซ็ตรหัสผ่านให้',
      });
    }

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัสพนักงานหรืออีเมล',
      });
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);
    const allUsers = isWebRequest ? [...admins] : [...employees, ...admins];

    const found = allUsers.find(
      (u) =>
        (u.code && String(u.code).toLowerCase() === identifier) ||
        (u.email && String(u.email).toLowerCase() === identifier) ||
        (u.username && String(u.username).toLowerCase() === identifier) ||
        (u.id && String(u.id).toLowerCase() === identifier)
    );

    if (!found) {
      // Production: identical response to avoid account enumeration
      if (IS_PROD) {
        return res.json({
          success: true,
          message: 'หากข้อมูลตรงกับบัญชีในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้',
        });
      }
      return res.status(404).json({
        success: false,
        message: `ไม่พบบัญชีที่ตรงกับ "${identifier}" ในระบบ กรุณาตรวจสอบรหัสพนักงานหรือติดต่อฝ่าย HR`,
      });
    }

    const targetEmail = found.email || `${found.username || 'user'}@wellx989.com`;

    const isAdmin = admins.some((a) => a.id === found.id || a.code === found.id);
    const emailPreview = isAdmin
      ? await emailService.sendAdminPasswordSetupEmail({
          name: found.name || found.username || 'ผู้ดูแลระบบ',
          email: targetEmail,
          role: found.role || 'Admin',
          passwordHash: found.password,
        })
      : await emailService.sendPasswordSetupEmail({
          name: found.name || found.username || 'ผู้ใช้งาน',
          email: targetEmail,
          role: found.role || 'Employee',
          department: found.department || 'General',
          code: found.code || found.id,
          passwordHash: found.password,
        });

    logAudit(req, {
      action: 'FORGOT_PASSWORD_REQUEST',
      resourceType: 'Auth',
      resourceId: found.code || found.id,
      details: { identifier, email: targetEmail },
    });

    // Masked email for display e.g. s***i@company.com
    const emailParts = targetEmail.split('@');
    const maskedEmail = emailParts.length === 2 && emailParts[0].length > 2
      ? `${emailParts[0][0]}***${emailParts[0].slice(-1)}@${emailParts[1]}`
      : targetEmail;

    return res.json({
      success: true,
      message: `ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมล ${maskedEmail} เรียบร้อยแล้ว`,
      maskedEmail,
      // Dev only: link is never returned in production (emailPreview is stripped)
      ...(emailPreview?.setupLink ? { resetUrl: emailPreview.setupLink } : {}),
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลคำขอรีเซ็ตรหัสผ่าน',
    });
  }
};

// -------------------------------------------------------------
// PIN Authentication & Setup Endpoints (Mobile App PIN Feature)
// -------------------------------------------------------------

exports.setPin = async (req, res) => {
  try {
    const memoryStore = require('../stores/memoryStore');
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบข้อมูลผู้ใช้ที่ได้รับสิทธิ์ กรุณาเข้าสู่ระบบก่อน',
      });
    }

    const { pin, currentPin, currentPassword } = req.body;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุรหัส PIN 6 หลัก',
      });
    }

    const cleanPin = String(pin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return res.status(400).json({
        success: false,
        message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น (0-9)',
      });
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);

    let user = employees.find((e) => e.id === userId || e.code === userId || e.username === userId);
    let userType = 'employee';
    if (!user) {
      user = admins.find((a) => a.id === userId || a.code === userId || a.username === userId);
      userType = 'admin';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    // If user already had a PIN set, require verification of currentPin or currentPassword
    const existingPinHash = user.pinHash || user.pin_hash;
    if (existingPinHash) {
      let isVerified = false;
      if (currentPin) {
        const pinCheck = await comparePassword(String(currentPin).trim(), existingPinHash);
        if (pinCheck.valid) isVerified = true;
      }
      if (!isVerified && currentPassword && user?.password) {
        const passCheck = await comparePassword(String(currentPassword).trim(), user.password);
        if (passCheck.valid) isVerified = true;
      }

      if (!isVerified) {
        return res.status(400).json({
          success: false,
          message: 'รหัส PIN เดิมหรือรหัสผ่านไม่ถูกต้อง ไม่สามารถเปลี่ยน PIN ได้',
        });
      }
    }

    // Hash the new 6-digit PIN with bcrypt
    const hashedPin = await hashPassword(cleanPin);

    if (userType === 'employee') {
      await dbStore.updateEmployee(user.id, { pinHash: hashedPin });
    } else if (userType === 'admin') {
      await dbStore.updateAdmin(user.id, { pinHash: hashedPin });
    }

    logAudit(req, {
      action: 'SET_PIN_SUCCESS',
      resourceType: userType,
      resourceId: userId,
      details: { hadPreviousPin: Boolean(existingPinHash) },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'ตั้งรหัส PIN 6 หลักสำเร็จเรียบร้อยแล้ว',
      hasPin: true,
    });
  } catch (error) {
    console.error('Error in setPin:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้งรหัส PIN',
    });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const memoryStore = require('../stores/memoryStore');
    const { pin, username } = req.body;
    const targetUserId = req.user?.id || req.user?.code || username;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัส PIN 6 หลัก',
      });
    }

    const cleanPin = String(pin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return res.status(400).json({
        success: false,
        message: 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก',
      });
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุบัญชีผู้ใช้หรือส่ง Token เพื่อตรวจสอบ PIN',
      });
    }

    const cleanTarget = String(targetUserId).trim().toLowerCase();

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);

    const all = [...employees, ...admins];
    const found = all.find(
      (u) =>
        (u.id && String(u.id).toLowerCase() === cleanTarget) ||
        (u.code && String(u.code).toLowerCase() === cleanTarget) ||
        (u.username && String(u.username).toLowerCase() === cleanTarget) ||
        (u.email && String(u.email).toLowerCase() === cleanTarget)
    );

    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบัญชีผู้ใช้งานในระบบ',
      });
    }

    const pinBlocked = blockedStatusMessage(found);
    if (pinBlocked) {
      return res.status(403).json({ success: false, message: pinBlocked });
    }
    if (isPinLocked(found.id)) {
      return res.status(429).json(PIN_LOCKED_RESPONSE);
    }

    // Login PIN is user-defined only (no default derived from the birth date).
    const storedPinHash = found.pinHash || found.pin_hash;
    if (!storedPinHash) {
      return res.status(401).json({
        success: false,
        message: 'บัญชีนี้ยังไม่ได้ตั้ง PIN เข้าสู่ระบบ กรุณาเข้าสู่ระบบด้วยรหัสผ่านแล้วตั้ง PIN 6 หลัก',
        hasPin: false,
      });
    }

    if (isPinLocked(found.id)) {
      return res.status(429).json(PIN_LOCKED_RESPONSE);
    }

    const check = await comparePassword(cleanPin, storedPinHash);
    if (!check.valid) {
      recordPinFailure(found.id);
      logAudit(req, {
        action: 'VERIFY_PIN_FAILED',
        resourceType: 'auth',
        resourceId: found.id,
        details: { reason: 'Invalid PIN' },
      }).catch(() => {});

      if (isPinLocked(found.id)) {
        return res.status(429).json(PIN_LOCKED_RESPONSE);
      }
      return res.status(401).json({
        success: false,
        message: 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
      });
    }
    pinFailures.delete(found.id);

    // PIN is valid! Issue fresh JWT token for seamless session
    const accessToken = signAccessToken({
      id: found.id,
      code: found.code,
      username: found.username,
      name: found.name,
      role: found.role || 'Employee',
      portal: found.role === 'Admin' || found.role === 'Super Admin' ? 'web' : 'app',
    }, '15m');

    const refreshToken = signRefreshToken({
      id: found.id,
      role: found.role || 'Employee',
    }, '30d');

    logAudit(req, {
      action: 'VERIFY_PIN_SUCCESS',
      resourceType: 'auth',
      resourceId: found.id,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'ยืนยันรหัส PIN ถูกต้อง',
      token: accessToken,
      accessToken,
      refreshToken,
      user: stripSensitive(found),
    });
  } catch (error) {
    console.error('Error in verifyPin:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัส PIN',
    });
  }
};

exports.removePin = async (req, res) => {
  try {
    const memoryStore = require('../stores/memoryStore');
    const userId = req.user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'กรุณาเข้าสู่ระบบก่อน',
      });
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);

    let user = employees.find((e) => e.id === userId || e.code === userId);
    let userType = 'employee';
    if (!user) {
      user = admins.find((a) => a.id === userId || a.code === userId);
      userType = 'admin';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้' });
    }

    if (password) {
      const passCheck = await comparePassword(String(password).trim(), user.password);
      if (!passCheck.valid) {
        return res.status(401).json({
          success: false,
          message: 'รหัสผ่านไม่ถูกต้อง ไม่สามารถยกเลิก PIN ได้',
        });
      }
    }

    if (userType === 'employee') {
      await dbStore.updateEmployee(user.id, { pinHash: null });
    } else {
      await dbStore.updateAdmin(user.id, { pinHash: null });
    }

    logAudit(req, {
      action: 'REMOVE_PIN_SUCCESS',
      resourceType: userType,
      resourceId: user.id,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'ยกเลิกการใช้งานรหัส PIN เรียบร้อยแล้ว',
      hasPin: false,
    });
  } catch (error) {
    console.error('Error in removePin:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการยกเลิก PIN',
    });
  }
};

exports.getPinStatus = async (req, res) => {
  try {
    const memoryStore = require('../stores/memoryStore');
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);

    const user = [...employees, ...admins].find(
      (u) => u.id === userId || u.code === userId || u.username === userId
    );

    const hasPin = Boolean(user && (user.pinHash || user.pin_hash));
    return res.status(200).json({
      success: true,
      hasPin,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const memoryStore = require('../stores/memoryStore');
    let userId = req.user?.id;
    if (!userId && req.body?.refreshToken) {
      const decodedRefresh = verifyRefreshToken(req.body.refreshToken);
      if (decodedRefresh && decodedRefresh.id) userId = decodedRefresh.id;
    }

    if (userId) {
        const [employees, admins] = await Promise.all([
          dbStore.getEmployees(),
          dbStore.getAdmins(),
        ]);
        const emp = employees.find((e) => e.id === userId || e.code === userId || e.username === userId);
        if (emp) {
          await dbStore.updateEmployee(emp.id, { pinHash: null });
        }
        const adm = admins.find((a) => a.id === userId || a.code === userId || a.username === userId);
        if (adm) {
          await dbStore.updateAdmin(adm.id, { pinHash: null });
        }

      logAudit(req, {
        action: 'LOGOUT_RESET_PIN',
        resourceType: 'auth',
        resourceId: userId,
        details: { resetPin: true },
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'ออกจากระบบและรีเซ็ตรหัส PIN เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error in logout:', error);
    return res.status(200).json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' });
  }
};

