const dbStore = require('../services/dbStore');
const { hashPassword } = require('../utils/security');

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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admins (Create Admin Account)
exports.createAdmin = async (req, res) => {
  try {
    const { name, username, email, phone, password, role, department } = req.body;

    if (!name || !username) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อ-นามสกุล และชื่อผู้ใช้งาน (Username)',
      });
    }

    // Check duplicate username/email
    const existingAdmins = await dbStore.getAdmins();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const dupUsername = existingAdmins.find(
      (a) => a.username && a.username.toLowerCase() === cleanUsername
    );
    if (dupUsername) {
      return res.status(400).json({
        success: false,
        message: `ชื่อผู้ใช้งาน "${username}" ถูกใช้งานในระบบแล้ว`,
      });
    }

    if (cleanEmail) {
      const dupEmail = existingAdmins.find(
        (a) => a.email && a.email.toLowerCase() === cleanEmail
      );
      if (dupEmail) {
        return res.status(400).json({
          success: false,
          message: `อีเมล "${cleanEmail}" ถูกใช้งานในระบบแล้ว`,
        });
      }
    }

    const rawPassword = password && password.trim() ? password.trim() : '1234';
    const hashedPassword = await hashPassword(rawPassword);

    const adminCode = `ADM-${Date.now().toString().slice(-4)}`;
    const adminData = {
      id: adminCode,
      code: adminCode,
      username: username.trim(),
      password: hashedPassword,
      name: name.trim(),
      email: email ? email.trim() : `${username}@wellx989.com`,
      phone: phone || '-',
      department: department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      role: role || 'Admin',
      status: 'Active',
      startDate: new Date().toISOString().split('T')[0],
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
    };

    const createdAdmin = await dbStore.addAdmin(adminData);

    return res.status(201).json({
      success: true,
      message: `สร้างบัญชีผู้ดูแลระบบ ${name} สำเร็จ`,
      admin: stripSensitive(createdAdmin),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admins/:id (Update Admin Account)
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    if (updateData.password && String(updateData.password).trim()) {
      updateData.password = await hashPassword(String(updateData.password).trim());
    }

    const updated = await dbStore.updateAdmin(id, updateData);

    return res.status(200).json({
      success: true,
      message: 'อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว',
      admin: stripSensitive(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/admins/:id
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    await dbStore.deleteAdmin(id);
    return res.status(200).json({
      success: true,
      message: 'ลบบัญชีผู้ดูแลระบบเรียบร้อยแล้ว',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
