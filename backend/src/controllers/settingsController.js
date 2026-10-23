const dbStore = require('../services/dbStore');
const { comparePassword, hashPassword } = require('../utils/security');
const getEmployeeId = require('../helpers/getEmployeeId');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await dbStore.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
    }
    const updated = await dbStore.updateSettings(req.body);
    res.json({ success: true, message: 'Settings updated successfully', settings: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const empId = getEmployeeId(req, req.body?.employeeId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
      });
    }

    if (!empId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Employee ID หรือ Admin ID',
      });
    }

    // Try finding the user (employee or admin)
    const [employees, admins] = await Promise.all([
      dbStore.getEmployees(),
      dbStore.getAdmins(),
    ]);
    const all = [...employees, ...admins];

    const cleanId = String(empId).trim().toLowerCase();
    const user = all.find(
      (u) =>
        (u.id && String(u.id).toLowerCase() === cleanId) ||
        (u.code && String(u.code).toLowerCase() === cleanId) ||
        (u.username && String(u.username).toLowerCase() === cleanId) ||
        (u.email && String(u.email).toLowerCase() === cleanId)
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ',
      });
    }

    // Verify current password (supports both bcrypt and legacy plaintext)
    const expectedPassword = String(user.password || '').trim();
    const check = await comparePassword(currentPassword, expectedPassword);
    if (!check.valid) {
      return res.status(401).json({
        success: false,
        message: 'รหัสผ่านเดิมไม่ถูกต้อง',
      });
    }

    const hashedPassword = await hashPassword(newPassword.trim());

    // Determine if user is employee or admin and update accordingly
    const isAdmin = admins.some((a) => a.id === user.id);
    if (isAdmin) {
      await dbStore.updateAdmin(user.id, { password: hashedPassword });
    } else {
      await dbStore.updateEmployee(user.id, { password: hashedPassword });
    }

    return res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
