// backend/tests/verify_mobile_web_parity.test.js
// Automated verification for Web-to-Mobile ported features:
// 1. Employee Directory API & Screen
// 2. Team Attendance Status API & Screen
// 3. Leave Policies Modal API & Integration
// 4. Manager Approval & History Toggle API
// 5. HR Dashboard Live Stats

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');

process.chdir(path.join(__dirname, '..'));
const apiRoutes = require('../src/routes/api');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

async function runParityTests() {
  console.log('================================================================');
  console.log('📱 AUTOMATED TEST: MOBILE-WEB PARITY FEATURE VERIFICATION');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Obtain verified Mobile Employee Token via Login
    const mobileLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: '1234', portal: 'app' }),
    });
    const mobileLoginData = await mobileLoginRes.json();
    const mobileToken = mobileLoginData.token;
    assert(mobileToken, 'Mobile employee successfully authenticated');

    // 2. Obtain verified Admin/Manager Token via Login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '1234', portal: 'web' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    assert(adminToken, 'Admin / Manager successfully authenticated');

    // --- TEST 1: Employee Directory API (used by EmployeeDirectoryScreen) ---
    console.log('\n--- 1. Colleague Directory (/api/employees) ---');
    const empRes = await fetch(`${baseUrl}/api/employees`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    const empData = await empRes.json();
    assert(empRes.status === 200, 'GET /api/employees returns 200 status');
    assert(Array.isArray(empData.employees) && empData.employees.length > 0, `Returns list of colleagues (found ${empData.employees?.length || 0})`);
    if (empData.employees && empData.employees.length > 0) {
      const sampleEmp = empData.employees[0];
      assert(sampleEmp.name && sampleEmp.department, 'Colleague entries contain name and department');
      assert(!sampleEmp.password, 'Employee passwords are strictly omitted from directory');
    }

    // --- TEST 2: Team Attendance Data (/api/attendance/summary & /api/employees) ---
    console.log('\n--- 2. Team Attendance Breakdown ---');
    const attRes = await fetch(`${baseUrl}/api/attendance/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attData = await attRes.json();
    assert(attRes.status === 200, 'GET /api/attendance/summary returns 200 status');
    assert(typeof attData.presentDays === 'number' || typeof attData.totalDays === 'number' || attData.summary, 'Attendance metrics returned accurately');

    // --- TEST 3: Leave Policies Guide API (/api/leave-policies) ---
    console.log('\n--- 3. Leave Policies Guide Modal (/api/leave-policies) ---');
    const polRes = await fetch(`${baseUrl}/api/leave-policies`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    const polData = await polRes.json();
    assert(polRes.status === 200, 'GET /api/leave-policies returns 200 status');
    assert(Array.isArray(polData.policies) && polData.policies.length >= 3, 'Returns standard company leave policies');
    const sickPolicy = polData.policies.find((p) => p.categoryKey === 'sick' || p.code === 'SICK' || (p.typeName && p.typeName.includes('ป่วย')) || (p.name && p.name.includes('ป่วย')));
    assert(sickPolicy && (sickPolicy.defaultQuota || sickPolicy.quotaDays || sickPolicy.quota) > 0, 'Sick leave policy contains quota and rules');

    // --- TEST 4: Manager Approval Pending & Action (/api/approvals/pending) ---
    console.log('\n--- 4. Manager Approvals & History Workflow ---');
    const appRes = await fetch(`${baseUrl}/api/approvals/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const appData = await appRes.json();
    assert(appRes.status === 200, 'GET /api/approvals/pending returns 200 status');
    assert(Array.isArray(appData.approvals), 'Pending approvals list returned');

    // --- TEST 5: HR Dashboard Dynamic KPI Stats (/api/hr/dashboard/stats) ---
    console.log('\n--- 5. HR Dashboard Live Stats (/api/hr/dashboard/stats) ---');
    const hrRes = await fetch(`${baseUrl}/api/hr/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const hrData = await hrRes.json();
    assert(hrRes.status === 200, 'GET /api/hr/dashboard/stats returns 200 status');
    assert(hrData.stats && typeof hrData.stats.totalEmployees === 'number', 'Dynamic total employees KPI stat returned');
    assert(typeof hrData.stats.presentToday === 'number', 'Present today KPI stat returned');

    console.log('\n================================================================');
    console.log(`📊 PARITY TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runParityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
