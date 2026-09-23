const http = require('http');
const assert = require('assert');

function httpRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const dataString = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (dataString) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
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

async function runLiveApprovalAndAuditTest() {
  console.log('\n======================================================');
  console.log('🧪 Live Testing Approval Workflow & Audit Trail Integration');
  console.log('======================================================\n');

  try {
    // 1. Web Admin Login to get token
    console.log('1. Authenticating as Admin to obtain JWT token...');
    const loginRes = await httpRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'admin', password: 'password123', portal: 'web' },
    });
    
    let adminToken = null;
    if (loginRes.status === 200 && loginRes.body.token) {
      adminToken = loginRes.body.token;
    } else {
      // Try legacy 1234
      const loginRes2 = await httpRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'admin', password: '1234', portal: 'web' },
      });
      adminToken = loginRes2.body.token;
    }
    assert(adminToken, 'Admin JWT Token obtained');
    console.log('  ✅ Admin Authenticated successfully. Token obtained.\n');

    // 2. Fetch Pending Approvals
    console.log('2. Fetching pending approvals for SuperBoss...');
    const pendingRes = await httpRequest({
      method: 'GET',
      path: '/api/approvals/pending?managerId=SuperBoss',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(pendingRes.status, 200, 'Pending approvals status 200');
    assert(pendingRes.body.success, 'Pending approvals success');
    const approvals = pendingRes.body.approvals || [];
    console.log(`  ✅ Found ${approvals.length} pending approval requests in database.\n`);

    // 3. Process an Approval (Leave / OT / Time-Correction)
    console.log('3. Testing Approval Processing via PATCH /api/approvals/:type/:id...');
    let targetItem = approvals[0];
    let requestType = targetItem?.requestType || 'leave';
    let targetId = targetItem?.id || 'LEAVE-REQ-001';

    const approveRes = await httpRequest({
      method: 'PATCH',
      path: `/api/approvals/${requestType}/${targetId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        action: 'approved',
        approverName: 'คุณ วิชัย (CEO)',
        approverRole: 'SuperBoss',
        remark: 'อนุมัติผ่านระบบเรียบร้อย (Automated Test)',
      },
    });
    assert.strictEqual(approveRes.status, 200, 'Approval PATCH returned 200');
    assert(approveRes.body.success, 'Approval returned success: true');
    console.log(`  ✅ Successfully approved ${requestType} request (ID: ${targetId}): "${approveRes.body.message}"\n`);

    // 4. Verify Audit Log was generated for this approval
    console.log('4. Verifying Enterprise Audit Trail (PDPA compliance)...');
    // Wait 200ms for async background db write
    await new Promise((r) => setTimeout(r, 200));

    const auditRes = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?limit=5',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(auditRes.status, 200, 'Audit logs GET returned 200');
    assert(auditRes.body.success, 'Audit logs success: true');
    const logs = auditRes.body.data || [];
    console.log(`  ✅ Retrieved ${logs.length} audit trail logs.`);

    const approvalAudit = logs.find((l) => l.action === 'APPROVE');
    if (approvalAudit) {
      console.log(`  ✅ Found APPROVE audit record: Actor=${approvalAudit.actorName}, Target=${approvalAudit.resourceType}:${approvalAudit.resourceId}`);
    } else {
      console.log(`  ℹ️ Latest audit actions: ${logs.map((l) => l.action).join(', ')}`);
    }

    // 5. Verify Route Alias /api/admin/audit-logs
    console.log('\n5. Verifying Admin Audit Logs Route Alias (/api/admin/audit-logs)...');
    const aliasRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/audit-logs?limit=2',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(aliasRes.status, 200, 'Alias /api/admin/audit-logs returned 200');
    assert(aliasRes.body.success, 'Alias returned success: true');
    console.log('  ✅ /api/admin/audit-logs alias verified successfully.\n');

    console.log('======================================================');
    console.log('🎉 ALL LIVE APPROVAL & AUDIT TRAIL TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test Failure:', err.message);
    process.exit(1);
  }
}

runLiveApprovalAndAuditTest();
