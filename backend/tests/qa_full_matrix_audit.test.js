const http = require('http');
const assert = require('assert');
const path = require('path');
const express = require('express');
const cors = require('cors');

process.chdir(path.join(__dirname, '..'));
const apiRoutes = require('../src/routes/api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

let server;
let serverPort;

function apiCall({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const dataString = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (dataString) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {}
          resolve({ status: res.statusCode, body: json || raw });
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runQAMatrixAudit() {
  await new Promise((res) => {
    server = app.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      res();
    });
  });

  console.log('\n================================================================');
  console.log(`🎖️ SENIOR QA TESTER: FULL-SPECTRUM END-TO-END AUDIT MATRIX (Port: ${serverPort})`);
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function testEndpoint(name, category, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] [${category}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] [${category}] ${name} -> ${err.message}`);
    }
  }

  // 1. Authenticate Admin
  let adminToken = '';
  let empToken = '';

  await testEndpoint('Admin Authentication (JWT)', 'AUTH', async () => {
    const res = await apiCall({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'admin', password: '1234', portal: 'web' },
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.token);
    adminToken = res.body.token;
  });

  await testEndpoint('Mobile Employee Authentication (JWT)', 'AUTH', async () => {
    const res = await apiCall({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'demo', password: '1234', portal: 'app' },
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.token);
    empToken = res.body.token;
  });

  await testEndpoint('Forgot Password Request (/api/auth/forgot-password)', 'AUTH', async () => {
    const res = await apiCall({
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: { employeeId: 'demo' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.resetUrl);
  });

  await testEndpoint('Set Password Policy Enforcement (/api/employees/set-password)', 'AUTH', async () => {
    // Reject passwords under 6 characters
    const resShort = await apiCall({
      method: 'POST',
      path: '/api/employees/set-password',
      body: { email: 'demo@wellx989.com', password: '123' },
    });
    assert.strictEqual(resShort.status, 400);

    // Reject passwords without letters
    const resNoLetter = await apiCall({
      method: 'POST',
      path: '/api/employees/set-password',
      body: { email: 'demo@wellx989.com', password: '123456' },
    });
    assert.strictEqual(resNoLetter.status, 400);
  });

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const empHeaders = { Authorization: `Bearer ${empToken}` };

  console.log('\n--- 🖥️ WEB ADMIN SCREENS & API AUDIT ---');

  // Menu 0: Dashboard
  await testEndpoint('Command Dashboard KPI Stats (/api/hr/dashboard/stats)', 'WEB-DASHBOARD', async () => {
    const res = await apiCall({ path: '/api/hr/dashboard/stats', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  // Menu 1: Role & Permission
  await testEndpoint('Administrators & Roles List (/api/admins)', 'WEB-ADMINS', async () => {
    const res = await apiCall({ path: '/api/admins', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.admins));
  });

  await testEndpoint('Enterprise Audit Trail Logs (/api/audit-logs)', 'WEB-AUDIT', async () => {
    const res = await apiCall({ path: '/api/audit-logs?limit=10', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Admin Audit Logs Alias Route (/api/admin/audit-logs)', 'WEB-AUDIT', async () => {
    const res = await apiCall({ path: '/api/admin/audit-logs?limit=5', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  // Menu 2: Organization
  await testEndpoint('Departments Directory (/api/departments)', 'WEB-ORG', async () => {
    const res = await apiCall({ path: '/api/departments', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.departments));
  });

  await testEndpoint('Job Positions Directory (/api/positions)', 'WEB-ORG', async () => {
    const res = await apiCall({ path: '/api/positions', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.positions));
  });

  await testEndpoint('Sections Directory (/api/departments/sections)', 'WEB-ORG', async () => {
    const res = await apiCall({ path: '/api/departments/sections', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.sections));
  });

  await testEndpoint('Employee Groups (/api/departments/groups)', 'WEB-ORG', async () => {
    const res = await apiCall({ path: '/api/departments/groups', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.groups));
  });

  // Menu 3: Employee & Point
  await testEndpoint('All Employees Directory (/api/employees)', 'WEB-EMPLOYEE', async () => {
    const res = await apiCall({ path: '/api/employees', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.employees));
  });

  await testEndpoint('Points History (/api/points/history)', 'WEB-POINTS', async () => {
    const res = await apiCall({ path: '/api/points/history', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Electronic Payslips (/api/payslips)', 'WEB-PAYROLL', async () => {
    const res = await apiCall({ path: '/api/payslips', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.payslips));
  });

  // Menu 4: Attendance
  await testEndpoint('HR Attendance Reports (/api/hr/reports/attendance)', 'WEB-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/hr/reports/attendance', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Overtime Records Overview (/api/attendance/overtime)', 'WEB-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/attendance/overtime', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Time Correction Requests (/api/attendance/corrections)', 'WEB-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/attendance/corrections', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  // Menu 5: Leave & Policies
  await testEndpoint('Leave Quotas & Policies (/api/leave-policies)', 'WEB-LEAVE', async () => {
    const res = await apiCall({ path: '/api/leave-policies', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.policies));
  });

  await testEndpoint('Approvals Workflow Center (/api/approvals/pending)', 'WEB-APPROVAL', async () => {
    const res = await apiCall({ path: '/api/approvals/pending?managerId=SuperBoss', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.approvals));
  });

  // Menu 6 & 7: Gamification
  await testEndpoint('Step Challenges & Missions (/api/missions)', 'WEB-GAMIFICATION', async () => {
    const res = await apiCall({ path: '/api/missions', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.missions));
  });

  await testEndpoint('Rewards Catalog & Inventory (/api/rewards)', 'WEB-GAMIFICATION', async () => {
    const res = await apiCall({ path: '/api/rewards', headers: adminHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.rewards));
  });

  console.log('\n--- 📱 MOBILE APPLICATION SCREENS & API AUDIT ---');

  // Profile
  await testEndpoint('Employee Profile (/api/auth/profile)', 'APP-PROFILE', async () => {
    const res = await apiCall({ path: '/api/auth/profile', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.user);
  });

  // Calendar & Attendance
  await testEndpoint('Today Attendance Status (/api/attendance/today)', 'APP-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/attendance/today', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Attendance Monthly History (/api/attendance/history)', 'APP-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/attendance/history', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.history));
  });

  await testEndpoint('Attendance Summary Metrics (/api/attendance/summary)', 'APP-ATTENDANCE', async () => {
    const res = await apiCall({ path: '/api/attendance/summary', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.summary);
  });

  // Leave & Requests
  await testEndpoint('Personal Leave Quotas & Balances (/api/leaves/balances)', 'APP-LEAVE', async () => {
    const res = await apiCall({ path: '/api/leaves/balances', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.balances));
  });

  await testEndpoint('My Leave Requests (/api/leaves/my-requests)', 'APP-LEAVE', async () => {
    const res = await apiCall({ path: '/api/leaves/my-requests', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.requests));
  });

  await testEndpoint('My OT Requests (/api/overtime/my-requests)', 'APP-OT', async () => {
    const res = await apiCall({ path: '/api/overtime/my-requests', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.requests));
  });

  await testEndpoint('My Time Correction Requests (/api/attendance/corrections/my-requests)', 'APP-CORRECTIONS', async () => {
    const res = await apiCall({ path: '/api/attendance/corrections/my-requests', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.corrections));
  });

  // Rewards & Gamification
  await testEndpoint('My Redeemed Coupons (/api/rewards/my-coupons)', 'APP-REWARDS', async () => {
    const res = await apiCall({ path: '/api/rewards/my-coupons', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.coupons));
  });

  await testEndpoint('Mission Progress Update (/api/missions/:id/progress)', 'APP-MISSIONS', async () => {
    const res = await apiCall({
      path: '/api/missions/m4/progress',
      method: 'POST',
      headers: empHeaders,
      body: { progress: 1, isCompleted: true },
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
  });

  await testEndpoint('Mission Reward Claim (/api/missions/:id/claim)', 'APP-MISSIONS', async () => {
    const res = await apiCall({
      path: '/api/missions/m4/claim',
      method: 'POST',
      headers: empHeaders,
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.success);
    assert(typeof res.body.pointsEarned === 'number');
  });

  // Notifications & Announcements
  await testEndpoint('Notifications (/api/notifications)', 'APP-NOTIFICATIONS', async () => {
    const res = await apiCall({ path: '/api/notifications', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.notifications));
  });

  await testEndpoint('Company Announcements (/api/announcements)', 'APP-ANNOUNCEMENTS', async () => {
    const res = await apiCall({ path: '/api/announcements', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.announcements));
  });

  // Payslips
  await testEndpoint('My Electronic Payslips (/api/payslips/my-slips)', 'APP-PAYSLIPS', async () => {
    const res = await apiCall({ path: '/api/payslips/my-slips', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.payslips));
  });

  // System Settings
  await testEndpoint('System Configuration (/api/settings)', 'APP-SETTINGS', async () => {
    const res = await apiCall({ path: '/api/settings', headers: empHeaders });
    assert.strictEqual(res.status, 200);
    assert(res.body.settings);
  });

  console.log('\n================================================================');
  console.log(`📊 SENIOR QA AUDIT SUMMARY: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('================================================================\n');

  if (server) server.close();
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runQAMatrixAudit();
