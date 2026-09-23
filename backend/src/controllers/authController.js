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

// Strip sensitive fields before sending to client
const stripSensitive = (user) => {
  if (!user) return user;
  const { password, ...safe } = user;
  return safe;
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

    // Support Demo Account ("demo" / "demo") for Mobile App
    if (cleanUsername === 'demo' && (cleanPassword === 'demo' || cleanPassword === '1234')) {
      if (isWebPortal) {
        return res.status(403).json({
          success: false,
          message: 'บัญชีนี้เป็นพนักงานทดสอบ (Demo) สามารถเข้าใช้งานได้เฉพาะบน Mobile App เท่านั้น',
        });
      }

      const demoUser = {
        id: 'EMP-DEMO',
        code: 'EMP-DEMO',
        username: 'demo',
        name: 'พนักงานทดสอบ (Demo Account)',
        email: 'demo@wellx989.com',
        phone: '081-234-5678',
        role: 'Employee',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        position: 'Mobile Developer',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };

      const demoToken = signAccessToken({
        id: demoUser.id,
        code: demoUser.code,
        username: demoUser.username,
        role: demoUser.role,
        portal: 'app',
      }, '1d');
      const demoRefreshToken = signRefreshToken({
        id: demoUser.id,
        role: demoUser.role,
      }, '30d');

      return res.status(200).json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ (Demo Mobile App)',
        token: demoToken,
        accessToken: demoToken,
        refreshToken: demoRefreshToken,
        user: demoUser,
        tokenConfig: {
          accessTokenMinutes: 1440,
          refreshTokenDays: 30,
        },
      });
    }

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

      const expectedPassword = String(foundAdmin.password || '1234').trim();
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

      const expectedPassword = String(foundEmployee.password || '1234').trim();
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
      const expectedPassword = String(foundAdmin.password || '1234').trim();
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
      const expectedPassword = String(foundEmployee.password || '1234').trim();
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

    const isAdmin = admins.some((a) => a.id === user.id);
    const portal = isAdmin ? 'web' : 'app';
    const expiresIn = isAdmin ? '1d' : '15m';

    const newAccessToken = signAccessToken({
      id: user.id,
      code: user.code,
      username: user.username,
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

    if (targetId && String(targetId).toLowerCase().includes('demo')) {
      return res.status(200).json({
        success: true,
        user: {
          id: 'EMP-DEMO',
          code: 'EMP-DEMO',
          username: 'demo',
          name: 'พนักงานทดสอบ (Demo Account)',
          email: 'demo@wellx989.com',
          phone: '081-234-5678',
          role: 'Employee',
          department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
          position: 'Mobile Developer',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        },
      });
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
    const { employeeId, email } = req.body;
    const identifier = String(employeeId || email || '').trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกรหัสพนักงานหรืออีเมล',
      });
    }

    // Support demo account
    if (identifier === 'demo' || identifier === 'emp-demo' || identifier === 'demo@wellx989.com') {
      const emailPreview = await emailService.sendPasswordSetupEmail({
        name: 'พนักงานทดสอบ (Demo)',
        email: 'demo@wellx989.com',
        role: 'Employee',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        code: 'EMP-DEMO',
      });

      logAudit(req, {
        action: 'FORGOT_PASSWORD_REQUEST',
        resourceType: 'Auth',
        resourceId: 'EMP-DEMO',
        details: { identifier: 'demo', email: 'demo@wellx989.com' },
      });

      return res.json({
        success: true,
        message: 'ระบบได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมล demo@wellx989.com เรียบร้อยแล้ว',
        email: 'demo@wellx989.com',
        resetUrl: emailPreview?.setupLink || '/set-password?email=demo%40wellx989.com',
      });
    }

    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);
    const allUsers = [...employees, ...admins];

    const found = allUsers.find(
      (u) =>
        (u.code && String(u.code).toLowerCase() === identifier) ||
        (u.email && String(u.email).toLowerCase() === identifier) ||
        (u.username && String(u.username).toLowerCase() === identifier) ||
        (u.id && String(u.id).toLowerCase() === identifier)
    );

    if (!found) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบบัญชีที่ตรงกับ "${identifier}" ในระบบ กรุณาตรวจสอบรหัสพนักงานหรือติดต่อฝ่าย HR`,
      });
    }

    const targetEmail = found.email || `${found.username || 'user'}@wellx989.com`;

    const emailPreview = await emailService.sendPasswordSetupEmail({
      name: found.name || found.username || 'ผู้ใช้งาน',
      email: targetEmail,
      role: found.role || 'Employee',
      department: found.department || 'General',
      code: found.code || found.id,
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
      email: targetEmail,
      maskedEmail,
      resetUrl: emailPreview?.setupLink || `/set-password?email=${encodeURIComponent(targetEmail)}`,
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    return res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลคำขอรีเซ็ตรหัสผ่าน',
    });
  }
};
