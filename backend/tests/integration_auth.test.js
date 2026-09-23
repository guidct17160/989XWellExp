/**
 * Automated Integration Test for Login, Profile & Token Verification
 * Role: QA / Lead Developer / Security Tester
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
app.use(express.json());
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

async function runIntegrationTests() {
  console.log('\n======================================================');
  console.log('🚀 Running Full-Stack Auth & API Integration Tests');
  console.log('======================================================\n');

  // Start test server on random port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      console.log(`📡 Test Server listening on port ${serverPort}\n`);
      resolve();
    });
  });

  try {
    // 1. Health Check
    console.log('--- Test 1: Health Check Endpoint ---');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');
    console.log('  ✅ PASS: /api/health returns status ok\n');

    // 2. Web Admin Login
    console.log('--- Test 2: Web Admin Login Flow ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: '1234',
      portal: 'web',
    });

    assert.strictEqual(adminLogin.status, 200);
    assert.strictEqual(adminLogin.body.success, true);
    assert.ok(adminLogin.body.token, 'Must return JWT token');
    assert.ok(!adminLogin.body.user.password, 'CRITICAL: Password must NOT be returned in user profile');
    assert.strictEqual(adminLogin.body.user.username, 'admin');
    console.log('  ✅ PASS: Web Admin logged in successfully with JWT');
    console.log('  ✅ PASS: Sensitive password field is completely omitted\n');

    const adminToken = adminLogin.body.token;

    // 3. Authenticated Admin Profile Query
    console.log('--- Test 3: Authenticated /api/auth/profile with Bearer Token ---');
    const adminProfile = await request('GET', '/api/auth/profile', null, {
      Authorization: `Bearer ${adminToken}`,
    });

    assert.strictEqual(adminProfile.status, 200);
    assert.strictEqual(adminProfile.body.success, true);
    assert.strictEqual(adminProfile.body.user.id, adminLogin.body.user.id);
    assert.ok(!adminProfile.body.user.password, 'CRITICAL: Password must NOT be in profile response');
    console.log('  ✅ PASS: Profile accurately retrieved using verified JWT');
    console.log('  ✅ PASS: Verified no password in profile\n');

    // 4. Mobile App Demo Account Login
    console.log('--- Test 4: Mobile App Demo Account Login Flow ---');
    const demoLogin = await request('POST', '/api/auth/login', {
      username: 'demo',
      password: 'demo',
      portal: 'app',
    });

    assert.strictEqual(demoLogin.status, 200);
    assert.strictEqual(demoLogin.body.success, true);
    assert.ok(demoLogin.body.token, 'Must return JWT token');
    assert.ok(demoLogin.body.refreshToken, 'Must return Refresh token');
    assert.ok(!demoLogin.body.user.password, 'CRITICAL: Password must NOT be in demo user profile');
    console.log('  ✅ PASS: Mobile Demo account logged in successfully with JWT & Refresh token\n');

    // 5. Test Invalid Password Rejection
    console.log('--- Test 5: Wrong Password Protection ---');
    const failedLogin = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'wrong_password_999',
      portal: 'web',
    });

    assert.strictEqual(failedLogin.status, 401);
    assert.strictEqual(failedLogin.body.success, false);
    console.log('  ✅ PASS: Rejected invalid password with 401 Unauthorized\n');

    // 6. Test Admin Mutation Route Protection
    console.log('--- Test 6: RBAC Protection on Admin Create Route ---');
    // Without token
    const unauthCreate = await request('POST', '/api/admins', {
      name: 'Hacker',
      username: 'hacker',
    });
    assert.strictEqual(unauthCreate.status, 401, 'Unauthenticated admin creation must be blocked with 401');
    console.log('  ✅ PASS: Unauthenticated POST /api/admins correctly blocked (401)');

    // With employee token
    const empToken = demoLogin.body.token;
    const forbiddenCreate = await request('POST', '/api/admins', {
      name: 'Unauthorized Admin',
      username: 'unauth_admin',
    }, {
      Authorization: `Bearer ${empToken}`,
    });
    assert.strictEqual(forbiddenCreate.status, 403, 'Employee attempting to create admin must be blocked with 403');
    console.log('  ✅ PASS: Employee token accessing admin route blocked (403 Forbidden)\n');

    console.log('======================================================');
    console.log('🎉 All Integration Tests Passed Successfully! (6/6)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runIntegrationTests();
