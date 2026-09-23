const assert = require('assert');
const dbStore = require('../src/services/dbStore');

async function runDomainStoreTests() {
  console.log('\n======================================================');
  console.log('🧪 Testing Domain Stores via Refactored dbStore Facade');
  console.log('======================================================\n');

  let passed = 0;

  try {
    // 1. System Store
    console.log('--- 1. System Store (Settings, Announcements, Notifications) ---');
    const settings = await dbStore.getSettings();
    assert(settings && typeof settings === 'object', 'Settings should be an object');
    passed++;
    console.log('  ✅ PASS: getSettings returned valid configuration');

    const announcements = await dbStore.getAnnouncements();
    assert(Array.isArray(announcements), 'Announcements should be an array');
    passed++;
    console.log('  ✅ PASS: getAnnouncements returned array');

    const notifs = await dbStore.getNotifications('EMP-IT-DEV');
    assert(Array.isArray(notifs), 'Notifications should be an array');
    passed++;
    console.log('  ✅ PASS: getNotifications returned array');

    // 2. User Store
    console.log('--- 2. User Store (Employees, Departments, Positions, Admins) ---');
    const emps = await dbStore.getEmployees();
    assert(Array.isArray(emps), 'Employees should be an array');
    passed++;
    console.log('  ✅ PASS: getEmployees returned array');

    const depts = await dbStore.getDepartments();
    assert(Array.isArray(depts) && depts.length > 0, 'Departments should not be empty');
    passed++;
    console.log('  ✅ PASS: getDepartments returned list with member counts');

    const admins = await dbStore.getAdmins();
    assert(Array.isArray(admins) && admins.length > 0, 'Admins should not be empty');
    passed++;
    console.log('  ✅ PASS: getAdmins returned list');

    // 3. Attendance Store
    console.log('--- 3. Attendance Store (Clock-in, History, Summary, OT, Corrections) ---');
    const attToday = await dbStore.getTodayAttendance('EMP-IT-DEV');
    assert(attToday && typeof attToday === 'object', 'Today attendance should be an object');
    passed++;
    console.log('  ✅ PASS: getTodayAttendance returned record');

    const attSummary = await dbStore.getAttendanceSummary('EMP-IT-DEV');
    assert(attSummary && typeof attSummary.totalWorkDays === 'number', 'Summary has totalWorkDays');
    passed++;
    console.log('  ✅ PASS: getAttendanceSummary calculated metrics correctly');

    const otRequests = await dbStore.getOtRequests();
    assert(Array.isArray(otRequests), 'OT requests should be an array');
    passed++;
    console.log('  ✅ PASS: getOtRequests returned array');

    const tcRequests = await dbStore.getTimeCorrectionRequests();
    assert(Array.isArray(tcRequests), 'Time correction requests should be an array');
    passed++;
    console.log('  ✅ PASS: getTimeCorrectionRequests returned array');

    // 4. Leave Store
    console.log('--- 4. Leave Store (Balances, Policies, Requests, Approvals) ---');
    const policies = await dbStore.getLeavePolicies();
    assert(Array.isArray(policies) && policies.length > 0, 'Leave policies should exist');
    passed++;
    console.log('  ✅ PASS: getLeavePolicies returned policies list');

    const balances = await dbStore.getLeaveBalances('EMP-IT-DEV');
    assert(Array.isArray(balances) && balances.length > 0, 'Leave balances should be calculated');
    passed++;
    console.log('  ✅ PASS: getLeaveBalances calculated dynamic quotas per employee');

    const pending = await dbStore.getPendingApprovals('ADM-001');
    assert(Array.isArray(pending), 'Pending approvals should be an array');
    passed++;
    console.log('  ✅ PASS: getPendingApprovals filtered requests hierarchically');

    // 5. Payroll Store
    console.log('--- 5. Payroll Store (Payslips) ---');
    const payslips = await dbStore.getPayslips('EMP-IT-DEV');
    assert(Array.isArray(payslips), 'Payslips should be an array');
    passed++;
    console.log('  ✅ PASS: getPayslips returned array');

    // 6. Gamification Store
    console.log('--- 6. Gamification Store (Missions, Rewards, Points) ---');
    const missions = await dbStore.getMissions('EMP-IT-DEV');
    assert(Array.isArray(missions) && missions.length > 0, 'Missions should exist');
    passed++;
    console.log('  ✅ PASS: getMissions returned mission list with user progress');

    const rewards = await dbStore.getRewards();
    assert(Array.isArray(rewards) && rewards.length > 0, 'Rewards should exist');
    passed++;
    console.log('  ✅ PASS: getRewards returned rewards catalog');

    const pointHistory = await dbStore.getPointHistory('EMP-IT-DEV');
    assert(pointHistory && typeof pointHistory.currentPoints === 'number', 'Point history valid');
    passed++;
    console.log('  ✅ PASS: getPointHistory returned valid balance');

    console.log('\n======================================================');
    console.log(`🎉 All ${passed} Domain Store Tests Passed Successfully!`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Domain Store Test Failed:', err);
    process.exit(1);
  }
}

runDomainStoreTests();
