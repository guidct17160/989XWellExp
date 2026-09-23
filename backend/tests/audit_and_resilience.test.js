const assert = require('assert');
const { logAudit, getAuditLogs } = require('../src/utils/auditLogger');

async function runAuditTests() {
  console.log('\n======================================================');
  console.log('🛡️ Starting Audit Trail & Resilience Test Suite');
  console.log('======================================================\n');

  let passed = 0;

  try {
    // 1. Log an action
    console.log('--- 1. Asynchronous Audit Logging ---');
    const mockReq = {
      user: {
        id: 'ADM-TEST-001',
        name: 'Audit Tester',
        role: 'Admin',
      },
      headers: {
        'user-agent': 'AutomatedTestRunner/1.0',
        'x-forwarded-for': '192.168.1.100',
      },
    };

    const entry = await logAudit(mockReq, {
      action: 'TEST_SALARY_CHANGE',
      resourceType: 'employee',
      resourceId: 'EMP-TEST-01',
      details: { oldSalary: 40000, newSalary: 45000, reason: 'Annual review' },
    });

    assert(entry && entry.id, 'Audit entry must have an ID');
    assert.strictEqual(entry.actorId, 'ADM-TEST-001', 'Actor ID must match mock req');
    assert.strictEqual(entry.action, 'TEST_SALARY_CHANGE', 'Action must match');
    assert.strictEqual(entry.ipAddress, '192.168.1.100', 'IP must be extracted');
    passed++;
    console.log('  ✅ PASS: logAudit created and structured audit record accurately');

    // 2. Query audit logs
    console.log('\n--- 2. Querying Audit Trail ---');
    const logs = await getAuditLogs({ limit: 10, action: 'TEST_SALARY_CHANGE' });
    assert(Array.isArray(logs), 'getAuditLogs should return an array');
    assert(logs.length > 0, 'Should find the logged test entry');
    const found = logs.find((l) => l.action === 'TEST_SALARY_CHANGE');
    assert(found, 'Found logged action');
    assert.strictEqual(found.resourceId, 'EMP-TEST-01', 'Resource ID preserved');
    passed++;
    console.log('  ✅ PASS: getAuditLogs retrieved filtered logs successfully');

    // 3. Graceful handling of anonymous / unauthenticated actions
    console.log('\n--- 3. Anonymous Action Logging ---');
    const anonEntry = await logAudit({}, {
      action: 'FAILED_LOGIN_ATTEMPT',
      resourceType: 'auth',
      resourceId: 'hacker@example.com',
    });
    assert.strictEqual(anonEntry.actorId, 'SYSTEM_OR_ANONYMOUS', 'Fallback actor ID');
    passed++;
    console.log('  ✅ PASS: Anonymous events logged gracefully with fallback actor ID');

    console.log('\n======================================================');
    console.log(`🎉 All ${passed} Audit Trail & Resilience Tests Passed!`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Audit Test Failed:', err);
    process.exit(1);
  }
}

runAuditTests();
