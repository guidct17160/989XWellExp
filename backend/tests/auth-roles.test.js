// เทส API: การเข้าสู่ระบบ และสิทธิ์ตาม role (requireAuth / requireAdmin / requireApprover / requireSuperAdmin)
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

describe('Auth & role guards', () => {
  let server, api;
  let adminToken, employee, boss, superBoss, empToken, bossToken, superBossToken;

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    const dept = await h.makeDept('Auth Dept');
    employee = await h.makeEmployee({ dept });
    boss = await h.makeEmployee({ dept, role: 'Boss' });
    superBoss = await h.makeEmployee({ dept, role: 'SuperBoss' });
    [empToken, bossToken, superBossToken] = await Promise.all([employee, boss, superBoss].map((u) => h.loginApp(api, u)));
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('login', () => {
    // [Critical] Super Admin เข้าเว็บได้ และ token ใช้เรียก API ที่ต้องเป็นแอดมินได้
    test('[Critical] TC-AUTH-001 web admin logs in and the token works on an admin endpoint', async () => {
      const r = await api('POST', '/auth/login', { body: { username: 'admin', password: '1234', portal: 'web' } });
      assert.equal(r.status, 200);
      assert.ok(r.body.token);
      assert.equal(r.body.user.password, undefined, 'ต้องไม่ส่งรหัสผ่านกลับ');
      assert.equal((await api('GET', '/audit-logs', { token: r.body.token })).status, 200);
    });

    // [Critical] รหัสผ่านผิดต้อง 401 และไม่ออก token
    test('[Critical] TC-AUTH-002 a wrong password is refused with 401 and no token', async () => {
      const r = await api('POST', '/auth/login', { body: { username: 'admin', password: 'wrong', portal: 'web' } });
      assert.equal(r.status, 401);
      assert.equal(r.body.success, false);
      assert.equal(r.body.token, undefined);
    });

    // [Critical] พนักงานเข้าเว็บแอดมินไม่ได้ และแอดมินเข้าแอปพนักงานไม่ได้
    test('[Critical] TC-AUTH-003 employees cannot use the web portal and admins cannot use the app portal', async () => {
      const web = await api('POST', '/auth/login', { body: { username: employee.username, password: h.PASSWORD, portal: 'web' } });
      assert.equal(web.status, 403);
      const app = await api('POST', '/auth/login', { body: { username: 'admin', password: '1234', portal: 'app' } });
      assert.equal(app.status, 403);
    });

    // [High] ไม่กรอกชื่อผู้ใช้/รหัสผ่านต้อง 400
    test('[High] TC-AUTH-004 missing username or password is a 400', async () => {
      assert.equal((await api('POST', '/auth/login', { body: { password: 'x', portal: 'web' } })).status, 400);
      assert.equal((await api('POST', '/auth/login', { body: { username: 'admin', portal: 'web' } })).status, 400);
      assert.equal((await api('POST', '/auth/login', { body: { portal: 'web' } })).status, 400);
    });

    // [High] บัญชี Inactive / Resign / Pending เข้าแอปไม่ได้
    test('[High] TC-AUTH-005 inactive, resigned and pending employees cannot log in', async () => {
      for (const status of ['Inactive', 'Resign', 'Pending']) {
        const u = await h.makeEmployee({ status });
        const r = await api('POST', '/auth/login', { body: { username: u.username, password: h.PASSWORD, portal: 'app' } });
        assert.equal(r.status, 403, `status ${status}`);
        assert.equal(r.body.token, undefined);
      }
    });
  });

  describe('token', () => {
    // [Critical] ไม่มี token / token ปลอม ต้อง 401 ทุกเส้นที่ต้องล็อกอิน
    test('[Critical] TC-AUTH-010 protected endpoints answer 401 without a valid token', async () => {
      const paths = [['GET', '/auth/profile'], ['GET', '/employees'], ['POST', '/attendance/clock-in'], ['GET', '/approvals/pending'], ['GET', '/rewards'], ['GET', '/notifications'], ['POST', '/leaves']];
      for (const [m, p] of paths) {
        assert.equal((await api(m, p, { body: m === 'POST' ? {} : undefined })).status, 401, `${m} ${p} (ไม่มี token)`);
        assert.equal((await api(m, p, { token: 'not.a.jwt', body: m === 'POST' ? {} : undefined })).status, 401, `${m} ${p} (token ปลอม)`);
      }
    });

    // [Critical] ตัวตนต้องมาจาก token เท่านั้น ไม่เชื่อ header/query/body (IDOR)
    test('[Critical] TC-AUTH-011 identity comes from the token only, x-employee-id and query are ignored', async () => {
      const other = await h.makeEmployee();
      const r = await api('GET', `/auth/profile?employeeId=${other.id}`, { token: empToken, headers: { 'x-employee-id': other.id } });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.id, employee.id);
      assert.equal((await api('GET', '/leaves/my-requests', { headers: { 'x-employee-id': other.id } })).status, 401);
    });

    // [High] ข้อมูลโปรไฟล์ไม่มีรหัสผ่านหรือ PIN hash
    test('[High] TC-AUTH-012 the profile never exposes the password or PIN hash', async () => {
      const r = await api('GET', '/auth/profile', { token: empToken });
      assert.equal(r.status, 200);
      const keys = Object.keys(r.body.user).join(',').toLowerCase();
      assert.ok(!/password|pin_?hash/.test(keys), keys);
    });
  });

  describe('password reset policy', () => {
    // [Critical] พนักงาน (แอป) รีเซ็ตรหัสผ่านเองไม่ได้ /auth/forgot-password ต้อง 403 ถ้าไม่ได้มาจากเว็บ
    test('[Critical] TC-AUTH-020 forgot-password is refused (403) unless it comes from the web portal', async () => {
      assert.equal((await api('POST', '/auth/forgot-password', { body: { employeeId: employee.username } })).status, 403);
      assert.equal((await api('POST', '/auth/forgot-password', { body: { employeeId: employee.username, portal: 'app' } })).status, 403);
    });

    // [High] Admin เท่านั้นที่กด Reset password ให้พนักงานได้ (Employee / Boss 403)
    test('[High] TC-AUTH-021 only an admin can reset an employee password', async () => {
      assert.equal((await api('POST', `/employees/${employee.id}/reset-password`, { token: empToken })).status, 403);
      assert.equal((await api('POST', `/employees/${employee.id}/reset-password`, { token: bossToken })).status, 403);
    });
  });

  describe('role guards', () => {
    const adminOnly = [
      ['POST', '/departments', { name: 'X' }],
      ['POST', '/employees', { name: 'X' }],
      ['POST', '/work-locations', { name: 'X' }],
      ['POST', '/leave-policies', { typeName: 'X' }],
      ['POST', '/rewards', { title: 'X' }],
      ['POST', '/reward-categories', { name: 'X' }],
      ['POST', '/quests', { title: 'X' }],
      ['POST', '/announcements', { title: 'X' }],
      ['PUT', '/settings/work-time', { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 0 }],
      ['GET', '/audit-logs'],
      ['GET', '/work-locations'],
      ['GET', '/quests'],
      ['GET', '/announcements/all'],
    ];

    // [Critical] Employee / Boss / SuperBoss (พนักงาน) เรียก API ฝั่งแอดมินไม่ได้ -> 403
    test('[Critical] TC-ROLE-001 employee roles (Employee, Boss, SuperBoss) get 403 on admin-only endpoints', async () => {
      for (const [who, token] of [['Employee', empToken], ['Boss', bossToken], ['SuperBoss', superBossToken]]) {
        for (const [m, p, body] of adminOnly) {
          const r = await api(m, p, { token, body });
          assert.equal(r.status, 403, `${who} ${m} ${p}`);
        }
      }
    });

    // [Critical] แอดมินเรียก API ฝั่งแอดมินได้ (ไม่ใช่ 401/403)
    test('[Critical] TC-ROLE-002 an admin is allowed on the same endpoints (never 401/403)', async () => {
      for (const [m, p, body] of adminOnly) {
        const r = await api(m, p, { token: adminToken, body });
        assert.ok(![401, 403].includes(r.status), `${m} ${p} -> ${r.status}`);
      }
    });

    // [Critical] หน้าอนุมัติ: Employee 403, Boss / SuperBoss / Admin ได้
    test('[Critical] TC-ROLE-003 approval endpoints are closed to Employee and open to Boss, SuperBoss and Admin', async () => {
      for (const p of ['/approvals/pending', '/approvals/history', '/attendance/corrections', '/hr/dashboard/stats', '/hr/reports/attendance']) {
        assert.equal((await api('GET', p, { token: empToken })).status, 403, `Employee ${p}`);
        for (const t of [bossToken, superBossToken, adminToken]) assert.equal((await api('GET', p, { token: t })).status, 200, p);
      }
      assert.equal((await api('PATCH', '/approvals/leave/none', { token: empToken, body: { action: 'approved' } })).status, 403);
    });

    // [Critical] จัดการบัญชีแอดมิน (/admins) เฉพาะ Super Admin: Admin ธรรมดา, SuperBoss และ Employee ไม่ได้
    test('[Critical] TC-ROLE-004 /admins is Super Admin only (Admin, SuperBoss and Employee get 403)', async () => {
      const plain = await h.sql("INSERT INTO admins (id, code, username, password, name, email, role, status) VALUES ('ADM-T1','ADM-T1','plainadmin',(SELECT password FROM admins WHERE username='admin'),'Plain Admin','plain@test.local','Admin','Active') ON CONFLICT DO NOTHING RETURNING id");
      assert.ok(plain.length >= 0);
      const plainToken = await h.loginAdmin(api, { username: 'plainadmin', password: '1234' });
      for (const t of [plainToken, superBossToken, bossToken, empToken]) {
        assert.equal((await api('GET', '/admins', { token: t })).status, 403);
        assert.equal((await api('POST', '/admins', { token: t, body: { name: 'X', email: 'x@test.local' } })).status, 403);
        assert.equal((await api('DELETE', '/admins/ADM-001', { token: t })).status, 403);
      }
      assert.equal((await api('GET', '/admins', { token: adminToken })).status, 200);
      // Admin ธรรมดายังเข้า API แอดมินทั่วไปได้
      assert.equal((await api('GET', '/work-locations', { token: plainToken })).status, 200);
    });
  });
});
