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
const otController = require('../controllers/otController');
const payslipController = require('../controllers/payslipController');
const missionController = require('../controllers/missionController');
const rewardController = require('../controllers/rewardController');
const announcementController = require('../controllers/announcementController');
const notificationController = require('../controllers/notificationController');
const hrController = require('../controllers/hrController');
const approvalController = require('../controllers/approvalController');
const auditController = require('../controllers/auditController');
const { authenticate, requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

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
router.post('/auth/change-password', requireAuth, settingsController.changePassword);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/forgot-password', authController.forgotPassword);
// MED-7 FIX: Server-side refresh token endpoint
router.post('/auth/refresh', authController.refreshToken);

// -------------------------------------------------------------
// 3. Admin Routes (requireAdmin = requireAuth + role check)
// -------------------------------------------------------------
router.get('/admins', requireAdmin, adminController.getAdmins);
router.post('/admins', requireAdmin, adminController.createAdmin);
router.put('/admins/:id', requireAdmin, adminController.updateAdmin);
router.delete('/admins/:id', requireAdmin, adminController.deleteAdmin);

// -------------------------------------------------------------
// 4. Employee Routes
// -------------------------------------------------------------
router.get('/employees', requireAuth, employeeController.getAllEmployees);
router.get('/employees/:id', requireAuth, employeeController.getEmployeeById);
router.post('/employees', requireAdmin, employeeController.createEmployee);
router.post('/employees/set-password', employeeController.setPassword);
router.put('/employees/:id', requireAdmin, employeeController.updateEmployee);
router.delete('/employees/:id', requireAdmin, employeeController.deleteEmployee);

// -------------------------------------------------------------
// 5. Organization Structure Routes (Departments, Positions)
// -------------------------------------------------------------
router.get('/departments', requireAuth, departmentController.getDepartments);
router.post('/departments', requireAdmin, departmentController.createDepartment);
router.put('/departments/:id', requireAdmin, departmentController.updateDepartment);
router.delete('/departments/:id', requireAdmin, departmentController.deleteDepartment);

router.get('/positions', requireAuth, departmentController.getPositions);
router.post('/positions', requireAdmin, departmentController.createPosition);
router.put('/positions/:id', requireAdmin, departmentController.updatePosition);
router.delete('/positions/:id', requireAdmin, departmentController.deletePosition);
router.get('/departments/positions', requireAuth, departmentController.getPositions);
router.post('/departments/positions', requireAdmin, departmentController.createPosition);
router.put('/departments/positions/:id', requireAdmin, departmentController.updatePosition);
router.delete('/departments/positions/:id', requireAdmin, departmentController.deletePosition);

router.get('/departments/sections', requireAuth, departmentController.getSections);
router.post('/departments/sections', requireAdmin, departmentController.createSection);
router.put('/departments/sections/:id', requireAdmin, departmentController.updateSection);
router.delete('/departments/sections/:id', requireAdmin, departmentController.deleteSection);
router.get('/sections', requireAuth, departmentController.getSections);

router.get('/departments/groups', requireAuth, departmentController.getGroups);
router.post('/departments/groups', requireAdmin, departmentController.createGroup);
router.put('/departments/groups/:id', requireAdmin, departmentController.updateGroup);
router.delete('/departments/groups/:id', requireAdmin, departmentController.deleteGroup);
router.get('/employee-groups', requireAuth, departmentController.getGroups);

// -------------------------------------------------------------
// 6. Time & Attendance Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.post('/attendance/clock-in', requireAuth, attendanceController.clockIn);
router.post('/attendance/clock-out', requireAuth, attendanceController.clockOut);
router.get('/attendance/today', requireAuth, attendanceController.getTodayStatus);
router.get('/attendance/history', requireAuth, attendanceController.getHistory);
router.get('/attendance/summary', requireAuth, attendanceController.getSummary);
router.get('/attendance/corrections', requireAuth, attendanceController.getCorrections);
router.get('/time-corrections', requireAuth, attendanceController.getCorrections);
router.post('/attendance/corrections', requireAuth, attendanceController.addCorrection);
router.post('/time-corrections', requireAuth, attendanceController.addCorrection);
router.get('/attendance/corrections/my-requests', requireAuth, attendanceController.getMyCorrections);
router.get('/time-corrections/my-requests', requireAuth, attendanceController.getMyCorrections);

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
// 8. Overtime (OT) Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/attendance/overtime', requireAuth, otController.getAllOtRequests);
router.get('/overtime', requireAuth, otController.getAllOtRequests);
router.post('/overtime', requireAuth, otController.createOtRequest);
router.get('/overtime/my-requests', requireAuth, otController.getMyOtRequests);
router.get('/overtime/:id', requireAuth, otController.getOtById);
router.delete('/overtime/:id/cancel', requireAuth, otController.cancelOt);

// -------------------------------------------------------------
// 9. Payslips & Payroll Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/payslips', requireAuth, payslipController.getPayslips);
router.get('/payslips/my-payslips', requireAuth, payslipController.getMyPayslips);
router.get('/payslips/my-slips', requireAuth, payslipController.getMyPayslips);
router.post('/payslips/generate', requireAdmin, payslipController.generatePayslip);
router.get('/payslips/:id', requireAuth, payslipController.getPayslipById);

// -------------------------------------------------------------
// 10. Wellness & Missions Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/missions', requireAuth, missionController.getMissions);
router.post('/missions', requireAdmin, missionController.createMission);
router.delete('/missions/:id', requireAdmin, missionController.deleteMission);
router.post('/missions/sync-steps', requireAuth, missionController.syncSteps);
router.post('/missions/:id/progress', requireAuth, missionController.updateProgress);
router.post('/missions/:id/claim', requireAuth, missionController.claimMission);

// -------------------------------------------------------------
// 11. Rewards & Points System Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/rewards', requireAuth, rewardController.getRewards);
router.post('/rewards', requireAdmin, rewardController.createReward);
router.delete('/rewards/:id', requireAdmin, rewardController.deleteReward);
router.get('/rewards/my-coupons', requireAuth, rewardController.getMyCoupons);
router.get('/rewards/:id', requireAuth, rewardController.getRewardById);
router.post('/rewards/:id/redeem', requireAuth, rewardController.redeemReward);
router.get('/points/history', requireAuth, rewardController.getPointHistory);

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
router.get('/hr/dashboard/stats', requireAuth, hrController.getDashboardStats);
router.get('/hr/reports/attendance', requireAuth, hrController.getAttendanceReport);

// -------------------------------------------------------------
// 15. System Settings
// -------------------------------------------------------------
router.get('/settings', requireAuth, settingsController.getSettings);
router.put('/settings', requireAdmin, settingsController.updateSettings);

// -------------------------------------------------------------
// 16. Employee & Boss Approval Workflow Routes (MED-1 FIX: requireAuth added)
// -------------------------------------------------------------
router.get('/approvals/pending', requireAuth, approvalController.getPendingApprovals);
router.patch('/approvals/:requestType/:id', requireAuth, approvalController.processApproval);

// -------------------------------------------------------------
// 17. Enterprise Audit Trail & Logs (PDPA Compliance)
// -------------------------------------------------------------
router.get('/audit-logs', requireAdmin, auditController.getLogs);
router.get('/admin/audit-logs', requireAdmin, auditController.getLogs);

module.exports = router;




