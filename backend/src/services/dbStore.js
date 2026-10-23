/**
 * WellX989 Database & In-Memory Store Facade
 * 
 * Refactored into Domain-Driven Stores:
 * - userStore: Employees, Departments, Positions, Admins
 * - systemStore: Settings, Announcements, Notifications
 * - attendanceStore: Clock In/Out, History, Corrections, HR Attendance Reports
 * - leaveStore: Leave Quotas, Policies, Requests, Approvals
 * - gamificationStore: Rewards, Points, Coupons
 * - questStore: Quests (quiz builder), their assignments and progress
 * - locationStore: Work locations where employees may clock in / out
 * 
 * Provides 100% backward compatibility with all 16 controllers.
 */

const createUserStore = require('../stores/userStore');
const createSystemStore = require('../stores/systemStore');
const createAttendanceStore = require('../stores/attendanceStore');
const createLeaveStore = require('../stores/leaveStore');
const createGamificationStore = require('../stores/gamificationStore');
const createQuestStore = require('../stores/questStore');
const createLocationStore = require('../stores/locationStore');
const createQuestPlayStore = require('../stores/questPlayStore');

// Unified Facade Object
const dbStore = {};

// Instantiate Domain Stores with the shared Facade reference
const userStore = createUserStore(dbStore);
const systemStore = createSystemStore(dbStore);
const attendanceStore = createAttendanceStore(dbStore);
const leaveStore = createLeaveStore(dbStore);
const gamificationStore = createGamificationStore(dbStore);
const questStore = createQuestStore(dbStore);
const locationStore = createLocationStore(dbStore);
const questPlayStore = createQuestPlayStore(dbStore);

// Merge all domain methods into the facade
Object.assign(
  dbStore,
  userStore,
  systemStore,
  attendanceStore,
  leaveStore,
  gamificationStore,
  questStore,
  locationStore,
  questPlayStore
);

module.exports = dbStore;
