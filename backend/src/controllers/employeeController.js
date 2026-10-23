const dbStore = require('../services/dbStore');
const emailService = require('../services/emailService');
const { hashPassword, verifySetupToken } = require('../utils/security');
const { logAudit } = require('../utils/auditLogger');
const { isAdminRole } = require('../middlewares/authMiddleware');
const { send: sendError } = require('../utils/httpError');
const { todayIso } = require('../utils/time');
const crypto = require('crypto');

// Strip sensitive fields before sending to client (Senior Cyber Sec Hardening)
const stripSensitive = (emp) => {
  if (!emp) return emp;
  const { password, pinHash, pin_hash, ...safe } = emp;
  safe.hasPin = Boolean(pinHash || pin_hash);
  return safe;
};

// Non-admin viewers must not see colleagues' birth date
const stripForViewer = (req) => (emp) => {
  const safe = stripSensitive(emp);
  if (safe && !isAdminRole(req.user?.role) && safe.id !== req.user?.id) {
    // Birth date is the default first-time PIN -> never expose it to colleagues
    delete safe.birthDate;
    delete safe.dob;
  }
  return safe;
};

// POST /api/employees/:id/reset-password  (Admin only)
// Employees cannot reset their own password; an Admin sends the employee a fresh set-password link (opens in the mobile app).
exports.resetEmployeePassword = async (req, res) => {
  try {
    const emp = await dbStore.getEmployeeById(req.params.id);
    if (!emp) {
      return res.status(404).json({ success: false, message: 'ไม่พบพนักงานที่ต้องการรีเซ็ตรหัสผ่าน' });
    }
    if (emp.status === 'Resign' || emp.status === 'Resigned') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถรีเซ็ตรหัสผ่านของพนักงานที่ลาออกแล้ว' });
    }
    if (!emp.email) {
      return res.status(400).json({ success: false, message: 'พนักงานคนนี้ไม่มีอีเมล จึงส่งลิงก์ตั้งรหัสผ่านไม่ได้' });
    }

    const emailPreview = await emailService.sendPasswordSetupEmail({
      name: emp.name,
      email: emp.email,
      role: emp.role,
      department: emp.department,
      code: emp.code,
      passwordHash: emp.password,
    });

    logAudit(req, {
      action: 'RESET_EMPLOYEE_PASSWORD',
      resourceType: 'employee',
      resourceId: emp.id,
      details: { code: emp.code, email: emp.email },
    }).catch(() => {});

    // Masked email e.g. s***i@company.com (never echo the full address back to the browser)
    const [local, domain] = String(emp.email).split('@');
    const maskedEmail = domain && local.length > 2 ? `${local[0]}***${local.slice(-1)}@${domain}` : emp.email;

    return res.json({
      success: true,
      message: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล ${maskedEmail} ของ ${emp.name} แล้ว`,
      maskedEmail,
      emailPreview,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/employees
exports.getAllEmployees = async (req, res) => {
  try {
    const { department, position, search, status } = req.query;
    let list = await dbStore.getEmployees();

    if (department) {
      list = list.filter((e) => e.department === department);
    }
    if (position) {
      list = list.filter((e) => e.position === position);
    }
    if (status) {
      list = list.filter((e) => e.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.name && e.name.toLowerCase().includes(q)) ||
          (e.email && e.email.toLowerCase().includes(q)) ||
          (e.code && e.code.toLowerCase().includes(q)) ||
          (e.department && e.department.toLowerCase().includes(q))
      );
    }

    return res.status(200).json({
      success: true,
      total: list.length,
      employees: list.map(stripForViewer(req)),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/employees/:id
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await dbStore.getEmployeeById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    return res.status(200).json({ success: true, employee: stripForViewer(req)(employee) });
  } catch (error) {
    return sendError(res, error);
  }
};

const recentCreations = new Map();

// POST /api/employees (Register / Add New Employee)
exports.createEmployee = async (req, res) => {
  try {
    const { name, firstName, lastName, email, password, code, role, department } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (cleanEmail && recentCreations.has(cleanEmail)) {
      const lastTime = recentCreations.get(cleanEmail);
      if (Date.now() - lastTime < 5000) {
        return res.status(429).json({
          success: false,
          message: 'กำลังประมวลผลการส่งอีเมลสำหรับบัญชีนี้อยู่ กรุณารอสักครู่ก่อนลองอีกครั้ง',
        });
      }
    }
    if (cleanEmail) {
      recentCreations.set(cleanEmail, Date.now());
      setTimeout(() => recentCreations.delete(cleanEmail), 5000);
    }

    if ((!name && !firstName) || !email) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกชื่อและอีเมลพนักงาน',
      });
    }

    // Check duplicate Email & Code in system
    const existingEmployees = await dbStore.getEmployees();
    const duplicateEmail = existingEmployees.find(
      (e) => e.email && e.email.trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      return res.status(400).json({
        success: false,
        message: `อีเมล "${cleanEmail}" นี้ถูกใช้งานในระบบแล้ว ไม่สามารถสร้างซ้ำได้`,
      });
    }

    if (code && code.trim()) {
      const cleanCode = code.trim().toUpperCase();
      const duplicateCode = existingEmployees.find(
        (e) => e.code && e.code.trim().toUpperCase() === cleanCode
      );
      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message: `รหัสพนักงาน "${cleanCode}" นี้ถูกใช้งานในระบบแล้ว`,
        });
      }
    }

    const newEmp = await dbStore.addEmployee({
      ...req.body,
      // Hash an admin-supplied initial password; otherwise a random unusable secret (employee sets it via the email link)
      password: await hashPassword(
        req.body.password && String(req.body.password).trim()
          ? String(req.body.password).trim()
          : crypto.randomBytes(32).toString('hex')
      ),
    });
    const storedEmp = (await dbStore.getEmployees()).find((e) => e.id === newEmp.id) || newEmp;

    // Trigger Gmail setup email notification to the exact email typed in the form
    console.log(`📧 [Recipient Target] Sending password setup email to: ${newEmp.email}`);
    const emailPreview = await emailService.sendPasswordSetupEmail({
      name: newEmp.name,
      email: newEmp.email,
      role: newEmp.role,
      department: newEmp.department,
      code: newEmp.code,
      passwordHash: storedEmp.password,
    });

    logAudit(req, {
      action: 'CREATE_EMPLOYEE',
      resourceType: 'employee',
      resourceId: newEmp.id,
      details: { name: newEmp.name, email: newEmp.email, role: newEmp.role, department: newEmp.department },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `สมัครพนักงาน ${newEmp.name} สำเร็จแล้ว และได้ส่งอีเมลตั้งรหัสผ่านไปยัง Gmail (${newEmp.email})`,
      employee: stripSensitive(newEmp),
      emailPreview,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/employees/set-password (Set Username & Password via link)
exports.setPassword = async (req, res) => {
  try {
    const { email, username, password, token } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมลและรหัสผ่านใหม่',
      });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase() : '';
    const cleanPassword = password.trim();

    // 1. Username Security Validation (If custom username provided and different from email)
    if (cleanUsername && cleanUsername !== cleanEmail) {
      const usernameRegex = /^[a-zA-Z0-9._]{4,30}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          message: 'ชื่อผู้ใช้งาน (Username) ต้องเป็นภาษาอังกฤษ ตัวเลข, _ หรือ . ความยาว 4-30 ตัวอักษรเท่านั้น',
        });
      }

      // Check if username is taken by another employee
      const employees = await dbStore.getEmployees();
      const isTaken = employees.some(
        (e) =>
          e.username &&
          e.username.toLowerCase() === cleanUsername &&
          e.email.toLowerCase() !== cleanEmail
      );
      if (isTaken) {
        return res.status(400).json({
          success: false,
          message: `ชื่อผู้ใช้งาน "${cleanUsername}" ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้งานอื่น`,
        });
      }
    }

    // 2. Password Security Validation (400 Bad Request on invalid format)
    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{6,30}$/;
    if (!passwordRegex.test(cleanPassword)) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านต้องประกอบด้วยตัวอักษรภาษาอังกฤษและตัวเลขอย่างน้อยประเภทละ 1 ตัว',
      });
    }

    // 3. Setup/Reset Token Validation
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'ลิงก์ไม่ถูกต้อง กรุณาเปิดลิงก์จากอีเมลอีกครั้ง (Missing token)',
      });
    }

    // Find employee by email
    const employees = await dbStore.getEmployees();
    const found = employees.find((e) => e.email && e.email.toLowerCase() === cleanEmail);

    // Same generic error for unknown email / invalid / expired / already-used token
    if (!found || !verifySetupToken(token, cleanEmail, found.password)) {
      return res.status(401).json({
        success: false,
        message: 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง หมดอายุแล้ว (มีอายุการใช้งาน 15 นาที) หรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่',
      });
    }

    const hashedPassword = await hashPassword(cleanPassword);
    const updatePayload = {
      password: hashedPassword,
      status: 'Active',
    };
    if (cleanUsername) {
      updatePayload.username = cleanUsername;
    }

    await dbStore.updateEmployee(found.id, updatePayload);

    return res.status(200).json({
      success: true,
      message: `บันทึกชื่อผู้ใช้งาน (${cleanUsername || found.username}) และรหัสผ่านใหม่สำเร็จแล้ว`,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/employees/:id
exports.updateEmployee = async (req, res) => {
  try {
    const existing = await dbStore.getEmployeeById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (existing.status === 'Resign' || existing.status === 'Resigned') {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถแก้ไขข้อมูลพนักงานที่ลาออกแล้ว (Resign) ได้ เนื่องจากบัญชีนี้พ้นสภาพการทำงานแล้ว',
      });
    }

    const updateData = { ...req.body };
    // Never let the request body overwrite identity / security columns
    delete updateData.id;
    delete updateData.pinHash;
    delete updateData.pin_hash;
    delete updateData.hasPin;
    delete updateData.createdAt;
    if (updateData.password && String(updateData.password).trim()) {
      updateData.password = await hashPassword(String(updateData.password).trim());
    } else {
      // blank password in an edit form = "unchanged" (must not wipe the stored hash)
      delete updateData.password;
    }

    const updated = await dbStore.updateEmployee(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const isResignAction = updateData.status === 'Resign' || updateData.status === 'Resigned';

    logAudit(req, {
      action: isResignAction ? 'EMPLOYEE_RESIGNED' : 'UPDATE_EMPLOYEE',
      resourceType: 'employee',
      resourceId: req.params.id,
      details: isResignAction
        ? {
            name: updated.name,
            code: updated.code,
            email: updated.email,
            department: updated.department,
            status: 'Resign',
            resignDate: updated.resignDate || updateData.resignDate || todayIso(),
            note: 'บันทึกสถานะพนักงานลาออก (Resigned)',
          }
        : { updatedFields: Object.keys(req.body) },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      employee: stripSensitive(updated),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/employees/:id
exports.deleteEmployee = async (req, res) => {
  try {
    const deleted = await dbStore.deleteEmployee(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'ไม่พบพนักงานที่ต้องการลบ' });
    }

    logAudit(req, {
      action: 'DELETE_EMPLOYEE',
      resourceType: 'employee',
      resourceId: req.params.id,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'ลบข้อมูลพนักงานออกจากระบบเรียบร้อยแล้ว',
    });
  } catch (error) {
    return sendError(res, error);
  }
};
