/**
 * WellX989 Database & In-Memory Store Facade
 * 
 * Refactored into Domain-Driven Stores:
 * - userStore: Employees, Departments, Positions, Admins
 * - systemStore: Settings, Announcements, Notifications
 * - attendanceStore: Clock In/Out, History, Overtime, Corrections, HR Attendance Reports
 * - leaveStore: Leave Quotas, Policies, Requests, Approvals
 * - payrollStore: Payslips
 * - gamificationStore: Missions, Rewards, Points, Coupons
 * 
 * Provides 100% backward compatibility with all 16 controllers.
 */

const createUserStore = require('../stores/userStore');
const createSystemStore = require('../stores/systemStore');
const createAttendanceStore = require('../stores/attendanceStore');
const createLeaveStore = require('../stores/leaveStore');
const createPayrollStore = require('../stores/payrollStore');
const createGamificationStore = require('../stores/gamificationStore');

// Unified Facade Object
const dbStore = {};

// Instantiate Domain Stores with the shared Facade reference
const userStore = createUserStore(dbStore);
const systemStore = createSystemStore(dbStore);
const attendanceStore = createAttendanceStore(dbStore);
const leaveStore = createLeaveStore(dbStore);
const payrollStore = createPayrollStore(dbStore);
const gamificationStore = createGamificationStore(dbStore);

// Merge all domain methods into the facade
Object.assign(
  dbStore,
  userStore,
  systemStore,
  attendanceStore,
  leaveStore,
  payrollStore,
  gamificationStore
);

module.exports = dbStore;
