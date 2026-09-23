const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const list = await dbStore.getNotifications(empId);

    return res.status(200).json({
      success: true,
      total: list.length,
      unreadCount: list.filter((n) => !n.isRead).length,
      notifications: list,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const updated = await dbStore.markNotificationRead(req.params.id);
    return res.status(200).json({
      success: true,
      notification: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    const empId = getEmpId(req);
    await dbStore.markAllNotificationsRead(empId);

    return res.status(200).json({
      success: true,
      message: 'ทำรายการอ่านทั้งหมดเรียบร้อยแล้ว',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/notifications/push-token
exports.registerPushToken = async (req, res) => {
  try {
    const { token, employeeId } = req.body;
    const empId = employeeId || req.user?.id || 'EMP-IT-DEV';

    if (!token) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Push Token' });
    }

    await dbStore.savePushToken(empId, token);

    return res.status(200).json({
      success: true,
      message: 'ลงทะเบียน Expo Push Token เรียบร้อยแล้ว',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
