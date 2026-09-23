/**
 * Automated Test Suite for 6-Digit PIN Authentication & Setup
 * Role: Senior Developer & Senior Software Tester
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

async function runPinAuthTests() {
  console.log('\n======================================================');
  console.log('🔐 Running 6-Digit PIN Authentication & Setup Tests');
  console.log('======================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  try {
    // 1. Authenticate Demo Account to get JWT
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'demo',
      password: 'demo',
      portal: 'app',
    });
    test('Mobile Demo Login succeeds with hasPin attribute', () => {
      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.body.success, true);
      assert.ok('hasPin' in loginRes.body.user);
    });

    const token = loginRes.body.token;
    const authHeader = { Authorization: `Bearer ${token}` };

    // 2. Reject Invalid PIN formats
    const invalidPinRes = await request('POST', '/api/auth/set-pin', { pin: '123' }, authHeader);
    test('Reject PIN shorter than 6 digits', () => {
      assert.strictEqual(invalidPinRes.status, 400);
      assert.strictEqual(invalidPinRes.body.success, false);
    });

    const alphaPinRes = await request('POST', '/api/auth/set-pin', { pin: 'abcdef' }, authHeader);
    test('Reject non-numeric PIN', () => {
      assert.strictEqual(alphaPinRes.status, 400);
      assert.strictEqual(alphaPinRes.body.success, false);
    });

    // 3. Set Valid 6-Digit PIN
    const setPinRes = await request('POST', '/api/auth/set-pin', { pin: '889900' }, authHeader);
    test('Set 6-digit PIN successfully', () => {
      assert.strictEqual(setPinRes.status, 200);
      assert.strictEqual(setPinRes.body.success, true);
      assert.strictEqual(setPinRes.body.hasPin, true);
    });

    // 4. Check PIN Status
    const statusRes = await request('GET', '/api/auth/pin-status', null, authHeader);
    test('GET /api/auth/pin-status returns hasPin = true', () => {
      assert.strictEqual(statusRes.status, 200);
      assert.strictEqual(statusRes.body.hasPin, true);
    });

    // 5. Verify Correct PIN
    const verifyCorrectRes = await request('POST', '/api/auth/verify-pin', {
      pin: '889900',
      username: 'demo',
    });
    test('POST /api/auth/verify-pin with correct PIN returns 200 and token', () => {
      assert.strictEqual(verifyCorrectRes.status, 200);
      assert.strictEqual(verifyCorrectRes.body.success, true);
      assert.ok(verifyCorrectRes.body.token);
    });

    // 6. Reject Incorrect PIN
    const verifyWrongRes = await request('POST', '/api/auth/verify-pin', {
      pin: '000000',
      username: 'demo',
    });
    test('POST /api/auth/verify-pin with incorrect PIN returns 401', () => {
      assert.strictEqual(verifyWrongRes.status, 401);
      assert.strictEqual(verifyWrongRes.body.success, false);
    });

    // 7. Change PIN (requires current PIN)
    const changeWithoutCurrentRes = await request(
      'POST',
      '/api/auth/set-pin',
      { pin: '112233', currentPin: 'wrong' },
      authHeader
    );
    test('Changing existing PIN with wrong current PIN fails', () => {
      assert.strictEqual(changeWithoutCurrentRes.status, 400);
    });

    const changeWithCorrectRes = await request(
      'POST',
      '/api/auth/set-pin',
      { pin: '112233', currentPin: '889900' },
      authHeader
    );
    test('Changing existing PIN with correct current PIN succeeds', () => {
      assert.strictEqual(changeWithCorrectRes.status, 200);
      assert.strictEqual(changeWithCorrectRes.body.success, true);
    });

    // Verify new PIN works
    const verifyNewPinRes = await request('POST', '/api/auth/verify-pin', {
      pin: '112233',
      username: 'demo',
    });
    test('New PIN verifies successfully after change', () => {
      assert.strictEqual(verifyNewPinRes.status, 200);
    });

    // 8. Remove PIN
    const removeRes = await request(
      'POST',
      '/api/auth/remove-pin',
      { password: 'demo' },
      authHeader
    );
    test('Remove PIN with password succeeds', () => {
      assert.strictEqual(removeRes.status, 200);
      assert.strictEqual(removeRes.body.hasPin, false);
    });

    const postRemoveStatus = await request('GET', '/api/auth/pin-status', null, authHeader);
    test('GET /api/auth/pin-status returns hasPin = false after removal', () => {
      assert.strictEqual(postRemoveStatus.status, 200);
      assert.strictEqual(postRemoveStatus.body.hasPin, false);
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n======================================================');
  console.log(`📊 PIN TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

server = app.listen(0, () => {
  serverPort = server.address().port;
  runPinAuthTests();
});
