const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');
const getEmpId = require('../helpers/getEmployeeId');
const { isAdminRole } = require('../middlewares/authMiddleware');

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
    return sendError(res, error);
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    // SECURITY: a user may only mark THEIR OWN notifications as read
    const updated = await dbStore.markNotificationRead(req.params.id, getEmpId(req));
    return res.status(200).json({
      success: true,
      notification: updated,
    });
  } catch (error) {
    return sendError(res, error);
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
    return sendError(res, error);
  }
};

// POST /api/notifications/push-token
exports.registerPushToken = async (req, res) => {
  try {
    const { token, employeeId } = req.body;
    // SECURITY: Non-admin users cannot overwrite another employee's push token
    const empId = (isAdminRole(req.user?.role) && employeeId) ? employeeId : getEmpId(req);

    if (!token) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ Push Token' });
    }

    await dbStore.savePushToken(empId, token);

    return res.status(200).json({
      success: true,
      message: 'ลงทะเบียน Expo Push Token เรียบร้อยแล้ว',
    });
  } catch (error) {
    return sendError(res, error);
  }
};
