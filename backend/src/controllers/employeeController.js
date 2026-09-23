const dbStore = require('../services/dbStore');
const emailService = require('../services/emailService');
const { hashPassword } = require('../utils/security');
const { logAudit } = require('../utils/auditLogger');

// Strip sensitive fields before sending to client
const stripSensitive = (emp) => {
  if (!emp) return emp;
  const { password, ...safe } = emp;
  return safe;
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
      employees: list.map(stripSensitive),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/employees/:id
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await dbStore.getEmployeeById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    return res.status(200).json({ success: true, employee: stripSensitive(employee) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    const newEmp = await dbStore.addEmployee(req.body);

    // Trigger Gmail setup email notification to the exact email typed in the form
    console.log(`📧 [Recipient Target] Sending password setup email to: ${newEmp.email}`);
    const emailPreview = await emailService.sendPasswordSetupEmail({
      name: newEmp.name,
      email: newEmp.email,
      role: newEmp.role,
      department: newEmp.department,
      code: newEmp.code,
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
      employee: newEmp,
      emailPreview,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/employees/set-password (Set Username & Password via link)
exports.setPassword = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุอีเมลและรหัสผ่านใหม่',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase() : '';
    const cleanPassword = password.trim();

    // 1. Username Security Validation (If provided)
    if (cleanUsername) {
      const usernameRegex = /^[a-zA-Z0-9._]{4,20}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          message: 'ชื่อผู้ใช้งาน (Username) ต้องเป็นภาษาอังกฤษ ตัวเลข, _ หรือ . ความยาว 4-20 ตัวอักษรเท่านั้น',
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

    // 2. Password Security Validation
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

    // Find employee by email
    const employees = await dbStore.getEmployees();
    const found = employees.find((e) => e.email.toLowerCase() === cleanEmail);

    if (!found) {
      return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/employees/:id
exports.updateEmployee = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.password && String(updateData.password).trim()) {
      updateData.password = await hashPassword(String(updateData.password).trim());
    }

    const updated = await dbStore.updateEmployee(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    logAudit(req, {
      action: 'UPDATE_EMPLOYEE',
      resourceType: 'employee',
      resourceId: req.params.id,
      details: { updatedFields: Object.keys(req.body) },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      employee: stripSensitive(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/employees/:id
exports.deleteEmployee = async (req, res) => {
  try {
    await dbStore.deleteEmployee(req.params.id);

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
    return res.status(500).json({ success: false, message: error.message });
  }
};
