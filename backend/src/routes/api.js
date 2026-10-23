const express = require('express');
const router = express.Router();

// Import Controllers
const authController = require('../controllers/authController');
const employeeController = require('../controllers/employeeController');
const departmentController = require('../controllers/departmentController');
const settingsController = require('../controllers/settingsController');
const adminController = require('../controllers/adminController');
const attendanceController = require('../controllers/attendanceController');
const leaveController = require('../controllers/leaveController');
const leavePolicyController = require('../controllers/leavePolicyController');
const questController = require('../controllers/questController');
const workLocationController = require('../controllers/workLocationController');
const uploadController = require('../controllers/uploadController');
const rewardController = require('../controllers/rewardController');
const announcementController = require('../controllers/announcementController');
const notificationController = require('../controllers/notificationController');
const hrController = require('../controllers/hrController');
const approvalController = require('../controllers/approvalController');
const auditController = require('../controllers/auditController');
const holidayController = require('../controllers/holidayController');
const { authenticate, requireAuth, requireAdmin, requireSuperAdmin, requireApprover } = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');

// Strict limiter for brute-forceable public auth endpoints (PIN / reset / set-password)
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
  skip: () => process.env.NODE_ENV === 'test',
});

// -------------------------------------------------------------
// Global Token Parsing Middleware
// -------------------------------------------------------------
router.use(authenticate);

// -------------------------------------------------------------
// 1. Health Check Route (Public)
// -------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WellX989 Backend API', timestamp: new Date() });
});

// -------------------------------------------------------------
// 2. Auth Routes (Login & Forgot Password are Public)
// -------------------------------------------------------------
router.post('/auth/login', authController.login);
router.post('/login', authController.login);
router.get('/auth/profile', requireAuth, authController.getProfile);
router.put('/auth/profile/avatar', requireAuth, authController.updateMyAvatar);
router.post('/auth/change-password', requireAuth, settingsController.changePassword);
router.post('/auth/forgot-password', sensitiveLimiter, authController.forgotPassword);
// MED-7 FIX: Server-side refresh token endpoint
router.post('/auth/refresh', authController.refreshToken);
router.post('/auth/logout', authController.logout);
// PIN Feature Routes (6-digit PIN Authentication & Setup)
router.post('/auth/set-pin', requireAuth, authController.setPin);
router.post('/auth/verify-pin', sensitiveLimiter, authController.verifyPin);
router.post('/auth/remove-pin', requireAuth, authController.removePin);
router.get('/auth/pin-status', requireAuth, authController.getPinStatus);

// -------------------------------------------------------------
// 3. Admin Routes (Strictly Super Admin access)
// -------------------------------------------------------------
router.get('/admins', requireSuperAdmin, adminController.getAdmins);
router.post('/admins', requireSuperAdmin, adminController.createAdmin);
router.post('/admins/set-password', sensitiveLimiter, adminController.setPassword);
router.post('/admins/:id/resend-invite', requireSuperAdmin, adminController.resendInvite);
router.put('/admins/:id', requireSuperAdmin, adminController.updateAdmin);
router.delete('/admins/:id', requireSuperAdmin, adminController.deleteAdmin);

// -------------------------------------------------------------
// 4. Employee Routes
// -------------------------------------------------------------
router.get('/employees', requireAuth, employeeController.getAllEmployees);
router.get('/employees/:id', requireAuth, employeeController.getEmployeeById);
router.post('/employees', requireAdmin, employeeController.createEmployee);
router.post('/employees/set-password', sensitiveLimiter, employeeController.setPassword);
router.post('/employees/:id/reset-password', requireAdmin, employeeController.resetEmployeePassword);
router.put('/employees/:id', requireAdmin, employeeController.updateEmployee);
router.delete('/employees/:id', requireAdmin, employeeController.deleteEmployee);

// -------------------------------------------------------------
// 5. Organization Structure Routes (Departments)
// -------------------------------------------------------------
router.get('/departments', requireAuth, departmentController.getDepartments);
router.post('/departments', requireAdmin, departmentController.createDepartment);
router.put('/departments/:id', requireAdmin, departmentController.updateDepartment);
router.delete('/departments/:id', requireAdmin, departmentController.deleteDepartment);

// -------------------------------------------------------------
// 6. Time & Attendance Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.post('/attendance/clock-in', requireAuth, attendanceController.clockIn);
router.post('/attendance/clock-out', requireAuth, attendanceController.clockOut);
router.get('/attendance/today', requireAuth, attendanceController.getTodayStatus);
// Work locations: the app lists the ones the employee may use; admins manage them from the web
router.get('/attendance/locations', requireAuth, workLocationController.getMyWorkLocations);
// Leave attachments: upload (employee), get a short-lived link (owner / approver), open the file with that link
router.post('/uploads/leave-attachment', requireAuth, uploadController.uploadLeaveAttachment);
router.get('/uploads/leave/:id/link', requireAuth, uploadController.getLeaveAttachmentLink);
router.get('/uploads/leave/:id/file', uploadController.downloadLeaveAttachment);
router.get('/work-locations', requireAdmin, workLocationController.getWorkLocations);
router.post('/work-locations', requireAdmin, workLocationController.createWorkLocation);
router.put('/work-locations/:id', requireAdmin, workLocationController.updateWorkLocation);
router.delete('/work-locations/:id', requireAdmin, workLocationController.deleteWorkLocation);
router.get('/attendance/history', requireAuth, attendanceController.getHistory);
router.get('/attendance/summary', requireAuth, attendanceController.getSummary);
router.get('/attendance/corrections', requireApprover, attendanceController.getCorrections);
router.post('/attendance/corrections', requireAuth, attendanceController.addCorrection);
router.get('/attendance/corrections/my-requests', requireAuth, attendanceController.getMyCorrections);

// -------------------------------------------------------------
// 7. Leave Management & Policy Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/leaves/balances', requireAuth, leaveController.getBalances);
router.post('/leaves', requireAuth, leaveController.createLeaveRequest);
router.get('/leaves/my-requests', requireAuth, leaveController.getMyRequests);
router.get('/leaves/:id', requireAuth, leaveController.getLeaveById);
router.delete('/leaves/:id/cancel', requireAuth, leaveController.cancelLeave);

// Leave Quotas & Policies API
router.get('/leave-policies', requireAuth, leavePolicyController.getLeavePolicies);
router.post('/leave-policies', requireAdmin, leavePolicyController.createLeavePolicy);
router.put('/leave-policies/:id', requireAdmin, leavePolicyController.updateLeavePolicy);
router.delete('/leave-policies/:id', requireAdmin, leavePolicyController.deleteLeavePolicy);

// -------------------------------------------------------------
// 10. Quests (admin builds quests; employee-side flow comes later)
// -------------------------------------------------------------
router.get('/quests', requireAdmin, questController.getQuests);
// Employee side: quests assigned to me, take the quiz, submit (auto graded and approved)
router.get('/my-quests', requireAuth, questController.getMyQuests);
router.get('/my-quests/:id', requireAuth, questController.getMyQuest);
router.post('/my-quests/:id/submit', requireAuth, questController.submitMyQuest);
router.get('/quests/:id', requireAdmin, questController.getQuestById);
router.post('/quests', requireAdmin, questController.createQuest);
router.put('/quests/:id', requireAdmin, questController.updateQuest);
router.delete('/quests/:id', requireAdmin, questController.deleteQuest);

// -------------------------------------------------------------
// 11. Rewards & Points System Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/reward-categories', requireAdmin, rewardController.getRewardCategories);
router.post('/reward-categories', requireAdmin, rewardController.createRewardCategory);
router.put('/reward-categories/:id', requireAdmin, rewardController.updateRewardCategory);
router.delete('/reward-categories/:id', requireAdmin, rewardController.deleteRewardCategory);
router.get('/rewards', requireAuth, rewardController.getRewards);
router.post('/rewards', requireAdmin, rewardController.createReward);
router.delete('/rewards/:id', requireAdmin, rewardController.deleteReward);
router.get('/rewards/my-coupons', requireAuth, rewardController.getMyCoupons);
router.get('/rewards/:id', requireAuth, rewardController.getRewardById);
router.post('/rewards/:id/redeem', requireAuth, rewardController.redeemReward);
router.get('/points/history', requireAuth, rewardController.getPointHistory);
router.get('/leaderboard', requireAuth, rewardController.getLeaderboard);

// -------------------------------------------------------------
// 12. Announcements & News Routes (GET is public for visibility)
// -------------------------------------------------------------
router.get('/announcements', announcementController.getAnnouncements);
router.get('/announcements/:id', announcementController.getAnnouncementById);
router.post('/announcements', requireAdmin, announcementController.createAnnouncement);
router.delete('/announcements/:id', requireAdmin, announcementController.deleteAnnouncement);

// -------------------------------------------------------------
// 13. Notifications Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/notifications', requireAuth, notificationController.getNotifications);
router.patch('/notifications/read-all', requireAuth, notificationController.markAllRead);
router.patch('/notifications/:id/read', requireAuth, notificationController.markAsRead);
router.post('/notifications/push-token', requireAuth, notificationController.registerPushToken);

// -------------------------------------------------------------
// 14. HR Dashboard & Reports Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/hr/dashboard/stats', requireApprover, hrController.getDashboardStats);
router.get('/hr/reports/attendance', requireApprover, hrController.getAttendanceReport);

// -------------------------------------------------------------
// 15. System Settings
// -------------------------------------------------------------
router.get('/settings', requireAuth, settingsController.getSettings);
router.put('/settings', requireAdmin, settingsController.updateSettings);

// -------------------------------------------------------------
// 16. Employee & Boss Approval Workflow Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/approvals/pending', requireApprover, approvalController.getPendingApprovals);
router.get('/approvals/history', requireApprover, approvalController.getApprovalHistory);
router.patch('/approvals/:requestType/:id', requireApprover, approvalController.processApproval);

// -------------------------------------------------------------
// 17. Enterprise Audit Trail & Logs (PDPA Compliance)
// -------------------------------------------------------------
router.get('/audit-logs', requireAdmin, auditController.getLogs);

// -------------------------------------------------------------
// 18. Official Calendar & Public Holidays (Real Calendar)
// -------------------------------------------------------------
router.get('/holidays', holidayController.getHolidays);

module.exports = router;




