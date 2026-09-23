/**
 * Automated Security, Auth & RBAC Verification Suite
 * Role: Software Tester / Senior Lead Developer
 */

const assert = require('assert');
const path = require('path');

// Set cwd to backend directory
process.chdir(path.join(__dirname, '..'));

const {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../src/utils/security');

const {
  authenticate,
  requireAuth,
  requireAdmin,
} = require('../src/middlewares/authMiddleware');

const getEmployeeId = require('../src/helpers/getEmployeeId');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Security, Auth & RBAC Automated Test Suite');
  console.log('======================================================\n');

  console.log('--- 1. Bcrypt Password Hashing & Hybrid Verification ---');

  await test('hashPassword should generate a valid Bcrypt hash ($2a$ / $2b$)', async () => {
    const hash = await hashPassword('secretPassword123');
    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Must start with $2a$ or $2b$');
    assert.strictEqual(hash.length, 60, 'Bcrypt hash must be 60 characters');
  });

  await test('comparePassword should verify correct password against Bcrypt hash', async () => {
    const hash = await hashPassword('mypassword');
    const result = await comparePassword('mypassword', hash);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.needsUpgrade, false);
  });

  await test('comparePassword should reject incorrect password against Bcrypt hash', async () => {
    const hash = await hashPassword('mypassword');
    const result = await comparePassword('wrongpassword', hash);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.needsUpgrade, false);
  });

  await test('comparePassword should verify legacy plaintext and flag needsUpgrade = true', async () => {
    const result = await comparePassword('1234', '1234');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.needsUpgrade, true, 'Legacy plaintext must trigger auto-upgrade flag');
  });

  await test('comparePassword should reject wrong legacy plaintext and not flag upgrade', async () => {
    const result = await comparePassword('wrong', '1234');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.needsUpgrade, false);
  });

  console.log('\n--- 2. JWT Generation & Verification ---');

  await test('signAccessToken should create valid signed token verifiable with secret', async () => {
    const payload = { id: 'ADM-001', role: 'Super Admin', portal: 'web' };
    const token = signAccessToken(payload, '1h');
    const decoded = verifyAccessToken(token);
    assert.ok(decoded, 'Token must be decoded');
    assert.strictEqual(decoded.id, 'ADM-001');
    assert.strictEqual(decoded.role, 'Super Admin');
    assert.strictEqual(decoded.portal, 'web');
  });

  await test('verifyAccessToken should reject invalid or tampered token', async () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.tamperedsignature';
    const decoded = verifyAccessToken(invalidToken);
    assert.strictEqual(decoded, null, 'Tampered token must return null');
  });

  await test('verifyAccessToken should reject legacy/backdoor tokens (CRIT-3 fix)', async () => {
    const legacyAdmin = verifyAccessToken('wellx989-jwt-admin-ADM-001');
    assert.strictEqual(legacyAdmin, null, 'Legacy admin backdoor token must be rejected');

    const legacyEmployee = verifyAccessToken('wellx989-jwt-employee-EMP-001');
    assert.strictEqual(legacyEmployee, null, 'Legacy employee backdoor token must be rejected');
  });

  console.log('\n--- 3. Auth & RBAC Middleware ---');

  await test('authenticate middleware extracts user from Bearer header', async () => {
    const token = signAccessToken({ id: 'EMP-777', role: 'Employee', portal: 'app' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextCalled = false;

    authenticate(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.ok(req.user);
    assert.strictEqual(req.user.id, 'EMP-777');
  });

  await test('requireAuth middleware blocks unauthenticated requests (401)', async () => {
    const req = { headers: {} };
    let statusSet = null;
    let jsonSent = null;
    const res = {
      status: (s) => {
        statusSet = s;
        return {
          json: (j) => {
            jsonSent = j;
          },
        };
      },
    };

    requireAuth(req, res, () => {
      assert.fail('next() should not be called');
    });

    assert.strictEqual(statusSet, 401);
    assert.strictEqual(jsonSent.success, false);
  });

  await test('requireAdmin middleware allows admin role', async () => {
    const req = { user: { id: 'ADM-001', role: 'Super Admin' } };
    const res = {};
    let nextCalled = false;

    requireAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  await test('requireAdmin middleware blocks employee role (403)', async () => {
    const req = { user: { id: 'EMP-001', role: 'Employee' } };
    let statusSet = null;
    let jsonSent = null;
    const res = {
      status: (s) => {
        statusSet = s;
        return {
          json: (j) => {
            jsonSent = j;
          },
        };
      },
    };

    requireAdmin(req, res, () => {
      assert.fail('next() should not be called');
    });

    assert.strictEqual(statusSet, 403);
    assert.strictEqual(jsonSent.success, false);
  });

  console.log('\n--- 4. getEmployeeId Priority & Data Integrity ---');

  await test('getEmployeeId prioritizes verified req.user.id over spoofed query or headers', async () => {
    const req = {
      user: { id: 'EMP-REAL-USER' },
      headers: { 'x-employee-id': 'EMP-SPOOFED-HEADER' },
      query: { employeeId: 'EMP-SPOOFED-QUERY' },
      body: { employeeId: 'EMP-SPOOFED-BODY' },
    };

    const extractedId = getEmployeeId(req);
    assert.strictEqual(extractedId, 'EMP-REAL-USER', 'Must prioritize verified JWT user');
  });

  console.log('\n======================================================');
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
