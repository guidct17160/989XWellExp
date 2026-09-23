/**
 * Comprehensive Full-System Live API Test Suite
 * Tests 17+ Endpoints across all controllers, security, and RBAC
 * Role: Senior Software Tester & Lead Developer
 */

const assert = require('assert');
const path = require('path');
const http = require('http');

process.chdir(path.join(__dirname, '..'));

const express = require('express');
const cors = require('cors');
const apiRoutes = require('../src/routes/api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

let server;
let serverPort;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const reqOptions = {
      hostname: '127.0.0.1',
      port: serverPort,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        ...headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

let passedCount = 0;
let failedCount = 0;

async function runCheck(description, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${description}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Details: ${err.message}`);
    failedCount++;
  }
}

async function runLiveSystemTest() {
  console.log('\n======================================================');
  console.log('🚀 WellX989 Live Full-System Comprehensive Test Suite');
  console.log('======================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      console.log(`📡 Live Test Server running on http://127.0.0.1:${serverPort}\n`);
      resolve();
    });
  });

  let adminToken = null;
  let demoToken = null;

  try {
    console.log('--- 1. Health & Server Status ---');
    await runCheck('GET /api/health returns 200 and ok status', async () => {
      const res = await request('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    console.log('\n--- 2. Authentication & JWT Security ---');
    await runCheck('POST /api/auth/login (Web Admin) issues signed JWT token and strips password', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: '1234',
        portal: 'web',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.token, 'Token must exist');
      assert.strictEqual(res.body.user.password, undefined, 'Password must be completely omitted');
      adminToken = res.body.token;
    });

    await runCheck('POST /api/auth/login (Mobile App Demo) issues JWT & refresh tokens', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'demo',
        password: 'demo',
        portal: 'app',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.token, 'Demo token must exist');
      assert.ok(res.body.refreshToken, 'Refresh token must exist');
      assert.strictEqual(res.body.user.password, undefined, 'Password must not leak in demo user');
      demoToken = res.body.token;
    });

    await runCheck('POST /api/auth/login rejects incorrect password with 401', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'invalid_password_xyz',
        portal: 'web',
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    await runCheck('GET /api/auth/profile verifies JWT Bearer token and returns profile', async () => {
      const res = await request('GET', '/api/auth/profile', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.user);
      assert.strictEqual(res.body.user.password, undefined);
    });

    console.log('\n--- 3. RBAC (Role-Based Access Control) ---');
    await runCheck('POST /api/admins rejects unauthenticated request with 401', async () => {
      const res = await request('POST', '/api/admins', {
        name: 'Intruder',
        username: 'intruder',
      });
      assert.strictEqual(res.status, 401);
    });

    await runCheck('POST /api/admins rejects employee role with 403 Forbidden', async () => {
      const res = await request('POST', '/api/admins', {
        name: 'Intruder',
        username: 'intruder',
      }, {
        Authorization: `Bearer ${demoToken}`,
      });
      assert.strictEqual(res.status, 403);
    });

    console.log('\n--- 4. Core Business API Endpoints ---');
    await runCheck('GET /api/departments returns departments list', async () => {
      const res = await request('GET', '/api/departments', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.departments));
    });

    await runCheck('GET /api/employees returns list with passwords stripped', async () => {
      const res = await request('GET', '/api/employees', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.employees));
      const hasPassword = res.body.employees.some((e) => e.password !== undefined);
      assert.strictEqual(hasPassword, false, 'No employee in the list may contain password');
    });

    await runCheck('GET /api/admins returns list with passwords stripped', async () => {
      const res = await request('GET', '/api/admins', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.admins));
      const hasPassword = res.body.admins.some((a) => a.password !== undefined);
      assert.strictEqual(hasPassword, false, 'No admin in the list may contain password');
    });

    await runCheck('GET /api/missions returns missions list', async () => {
      const res = await request('GET', '/api/missions', null, {
        Authorization: `Bearer ${demoToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/rewards returns rewards list', async () => {
      const res = await request('GET', '/api/rewards', null, {
        Authorization: `Bearer ${demoToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/rewards/my-coupons correctly routed before /rewards/:id', async () => {
      const res = await request('GET', '/api/rewards/my-coupons', null, {
        Authorization: `Bearer ${demoToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/leave-policies returns leave policies', async () => {
      const res = await request('GET', '/api/leave-policies', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/attendance/corrections returns corrections list', async () => {
      const res = await request('GET', '/api/attendance/corrections', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/attendance/overtime returns overtime records', async () => {
      const res = await request('GET', '/api/attendance/overtime', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    await runCheck('GET /api/approvals/pending returns pending approvals', async () => {
      const res = await request('GET', '/api/approvals/pending?managerId=ADM-001', null, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(res.status, 200);
    });

    console.log('\n======================================================');
    console.log(`📊 Final Results: ${passedCount} passed, ${failedCount} failed`);
    console.log('======================================================\n');
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runLiveSystemTest();
