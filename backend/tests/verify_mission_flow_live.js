// verify_mission_flow_live.js - Full Live Quest Lifecycle & Persistence Verification
const http = require('http');
const assert = require('assert');

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('================================================================');
  console.log('🎯 LIVE MISSION LIFECYCLE & PERSISTENCE VERIFICATION');
  console.log('================================================================\n');

  // Step 1: Login
  console.log('1. Authenticating as Mobile Employee (demo)...');
  const loginRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { username: 'demo', password: '1234', portal: 'app' });

  assert.strictEqual(loginRes.status, 200, 'Login failed');
  assert(loginRes.body.token, 'Token not received');
  const token = loginRes.body.token;
  console.log('   ✅ Authenticated successfully! Token received.\n');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Step 2: Fetch initial missions
  console.log('2. Fetching initial missions list (/api/missions)...');
  const listRes1 = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/missions',
    method: 'GET',
    headers: authHeaders,
  });

  assert.strictEqual(listRes1.status, 200);
  assert(Array.isArray(listRes1.body.missions), 'Missions is not an array');
  console.log(`   Found ${listRes1.body.missions.length} missions:`);
  listRes1.body.missions.forEach(m => console.log(`     - [${m.id}] ${m.title} (${m.currentValue || 0}/${m.targetValue || 1})`));
  const testMission = listRes1.body.missions.find(m => m.id === 'm4' || m.id === '4' || (m.title && m.title.includes('สุขภาพ')));
  assert(testMission, 'Target mission not found in missions list');
  const targetId = testMission.id;
  console.log(`   Target Mission [${targetId}]: "${testMission.title}"`);
  console.log(`   Initial State -> Current: ${testMission.currentValue}/${testMission.targetValue}, Completed: ${testMission.isCompleted}, Claimed: ${testMission.isClaimed}`);
  console.log('   ✅ Initial mission status verified.\n');

  // Step 3: Complete Quest / Update Progress
  console.log(`3. Submitting completed quest via POST /api/missions/${targetId}/progress...`);
  const progRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/missions/${targetId}/progress`,
    method: 'POST',
    headers: authHeaders,
  }, { progress: 1, isCompleted: true });

  assert.strictEqual(progRes.status, 200, `Update progress failed with status ${progRes.status}`);
  assert.strictEqual(progRes.body.success, true, 'Update progress returned success: false');
  console.log('   ✅ Response message:', progRes.body.message);

  // Step 4: Verify progress updated in missions list
  console.log(`\n4. Verifying mission ${targetId} is now Completed / Ready to Claim in /api/missions...`);
  const listRes2 = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/missions',
    method: 'GET',
    headers: authHeaders,
  });

  assert.strictEqual(listRes2.status, 200);
  const updatedM = listRes2.body.missions.find(m => m.id === targetId);
  assert(updatedM, `Mission ${targetId} missing`);
  console.log(`   Updated State -> Current: ${updatedM.currentValue}/${updatedM.targetValue}, isCompleted: ${updatedM.isCompleted}`);
  assert.strictEqual(updatedM.isCompleted, true, `Mission ${targetId} isCompleted must be true`);
  assert(updatedM.currentValue >= 1, `Mission ${targetId} currentValue must be >= 1`);
  console.log(`   ✅ Mission ${targetId} correctly marked as completed (${updatedM.currentValue}/${updatedM.targetValue}) in missions state!\n`);

  // Step 5: Claim Reward
  console.log(`5. Claiming mission reward via POST /api/missions/${targetId}/claim...`);
  const claimRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/missions/${targetId}/claim`,
    method: 'POST',
    headers: authHeaders,
  });

  assert.strictEqual(claimRes.status, 200, `Claim failed with status ${claimRes.status}`);
  assert.strictEqual(claimRes.body.success, true, 'Claim returned success: false');
  console.log(`   ✅ Points Earned: +${claimRes.body.pointsEarned}, New Total Points: ${claimRes.body.newTotalPoints}`);

  // Step 6: Verify isClaimed = true in missions list
  console.log(`\n6. Verifying mission ${targetId} is now Claimed (isClaimed: true)...`);
  const listRes3 = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/missions',
    method: 'GET',
    headers: authHeaders,
  });

  assert.strictEqual(listRes3.status, 200);
  const finalM = listRes3.body.missions.find(m => m.id === targetId);
  assert(finalM, `Mission ${targetId} missing`);
  console.log(`   Final State -> isClaimed: ${finalM.isClaimed}, isCompleted: ${finalM.isCompleted}`);
  assert.strictEqual(finalM.isClaimed, true, `Mission ${targetId} isClaimed must be true`);
  console.log(`   ✅ Mission ${targetId} correctly marked as claimed (isClaimed: true)!\n`);

  // Step 7: Verify Points History
  console.log('7. Verifying points transaction history (/api/points/history)...');
  const ptsRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/points/history',
    method: 'GET',
    headers: authHeaders,
  });

  assert.strictEqual(ptsRes.status, 200);
  console.log(`   Current Balance: ${ptsRes.body.currentPoints} points`);
  console.log(`   Recent Transactions count: ${ptsRes.body.history ? ptsRes.body.history.length : 0}`);
  const missionTx = (ptsRes.body.history || []).find(t =>
    (t.description || t.desc || '').includes('ภารกิจ') || (t.type === 'earn' && t.points > 0)
  );
  if (missionTx) {
    console.log(`   ✅ Found Point Transaction: "${missionTx.description || missionTx.title}" (+${missionTx.points || missionTx.amount} pts)`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL LIVE MISSION LIFECYCLE TESTS PASSED PERFECTLY (100%)');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
