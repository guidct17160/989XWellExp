// เทส API: PIN เข้าสู่ระบบ (ตั้งเอง ไม่มีค่าเริ่มต้น, ล็อกเมื่อผิดหลายครั้ง) และการจัดการบัญชีแอดมิน (Super Admin เท่านั้น)
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

describe('PIN login and admin accounts', () => {
  let server, api, adminToken, dept;

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Pin Dept');
  });
  after(async () => { await server.stop(); await h.closePool(); });

  const mkUser = async () => {
    const u = await h.makeEmployee({ dept });
    return { u, token: await h.loginApp(api, u) };
  };

  describe('PIN', () => {
    // [Critical] ไม่มี PIN เริ่มต้น (ไม่คำนวณจากวันเกิด): ยังไม่ตั้ง PIN แล้ว verify ต้องปฏิเสธและบอกว่าไม่มี PIN
    test('[Critical] TC-PIN-001 there is no default PIN: verify before setting one is refused', async () => {
      const { u, token } = await mkUser();
      assert.equal((await api('GET', '/auth/pin-status', { token })).body.hasPin, false);
      for (const pin of ['000000', '123456', '020000']) {
        const r = await api('POST', '/auth/verify-pin', { token, body: { pin } });
        assert.equal(r.status, 401, pin);
        assert.equal(r.body.hasPin, false);
      }
      assert.ok(u);
    });

    // [Critical] ตั้ง PIN: ต้อง 6 หลักตัวเลข เก็บเป็น hash (ไม่เก็บตัวเลขจริง) แล้ว verify ได้ ผิดไม่ได้
    test('[Critical] TC-PIN-002 a PIN must be 6 digits, is stored hashed, and then verifies correctly', async () => {
      const { u, token } = await mkUser();
      for (const bad of ['12345', '1234567', 'abcdef', '12 456', '']) {
        assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: bad } })).status, 400, `"${bad}"`);
      }
      assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: '482915' } })).status, 200);
      const [row] = await h.sql('SELECT pin_hash FROM employees WHERE id = $1', [u.id]);
      assert.ok(row.pin_hash && row.pin_hash !== '482915' && row.pin_hash.startsWith('$2'));
      assert.equal((await api('GET', '/auth/pin-status', { token })).body.hasPin, true);
      assert.equal((await api('POST', '/auth/verify-pin', { token, body: { pin: '482915' } })).status, 200);
      assert.equal((await api('POST', '/auth/verify-pin', { token, body: { pin: '111111' } })).status, 401);
      const profile = await api('GET', '/auth/profile', { token });
      assert.ok(!JSON.stringify(profile.body).includes('pin_hash') && !JSON.stringify(profile.body).includes(row.pin_hash));
    });

    // [Critical] เปลี่ยน PIN ต้องยืนยัน PIN เดิมหรือรหัสผ่าน
    test('[Critical] TC-PIN-003 changing an existing PIN requires the current PIN or the password', async () => {
      const { token } = await mkUser();
      await api('POST', '/auth/set-pin', { token, body: { pin: '482915' } });
      assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: '999999' } })).status, 400);
      assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: '999999', currentPin: '000000' } })).status, 400);
      assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: '999999', currentPin: '482915' } })).status, 200);
      assert.equal((await api('POST', '/auth/verify-pin', { token, body: { pin: '999999' } })).status, 200);
      assert.equal((await api('POST', '/auth/set-pin', { token, body: { pin: '777777', currentPassword: h.PASSWORD } })).status, 200);
    });

    // [Critical] ใส่ PIN ผิดติดกันหลายครั้ง -> ล็อก 429 แม้ใส่ถูกก็ยังเข้าไม่ได้ชั่วคราว
    test('[Critical] TC-PIN-004 too many wrong PINs lock the account (429), even a right PIN is refused', async () => {
      const { token } = await mkUser();
      await api('POST', '/auth/set-pin', { token, body: { pin: '482915' } });
      const codes = [];
      for (let i = 0; i < 8; i++) codes.push((await api('POST', '/auth/verify-pin', { token, body: { pin: '000001' } })).status);
      assert.ok(codes.includes(429), codes.join(','));
      assert.equal((await api('POST', '/auth/verify-pin', { token, body: { pin: '482915' } })).status, 429);
    });

    // [High] ยกเลิก PIN ต้องยืนยันรหัสผ่านให้ถูกต้อง
    test('[High] TC-PIN-005 removing a PIN needs the right password', async () => {
      const { u, token } = await mkUser();
      await api('POST', '/auth/set-pin', { token, body: { pin: '482915' } });
      assert.equal((await api('POST', '/auth/remove-pin', { token, body: { password: 'wrong' } })).status, 401);
      assert.equal((await api('POST', '/auth/remove-pin', { token, body: { password: h.PASSWORD } })).status, 200);
      assert.equal((await h.sql('SELECT pin_hash FROM employees WHERE id = $1', [u.id]))[0].pin_hash, null);
      assert.equal((await api('POST', '/auth/set-pin', { body: { pin: '482915' } })).status, 401);
    });
  });

  describe('admin accounts (Super Admin)', () => {
    const mkAdmin = (over = {}) => api('POST', '/admins', { token: adminToken, body: { name: 'New Admin', email: `adm-${h.uid()}@test.local`, role: 'HR Admin', ...over } });

    // [Critical] สร้างแอดมิน: ต้องมีชื่อ + อีเมลถูกรูปแบบ ซ้ำไม่ได้ สถานะรอตั้งรหัสผ่าน ไม่ส่งอีเมลจริง และเข้าสู่ระบบไม่ได้จนกว่าจะตั้งรหัสผ่าน
    test('[Critical] TC-ADMIN-001 creating an admin validates input and the new account cannot log in until it sets a password', async () => {
      assert.equal((await mkAdmin({ name: '' })).status, 400);
      assert.equal((await mkAdmin({ email: '' })).status, 400);
      assert.equal((await mkAdmin({ email: 'not-an-email' })).status, 400);
      const email = `adm-${h.uid()}@test.local`;
      const ok = await mkAdmin({ email });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(ok.body.admin.password, undefined);
      assert.equal(ok.body.emailPreview.realSmtpSent, false);
      assert.equal((await mkAdmin({ email })).status, 400, 'อีเมลซ้ำ');
      assert.equal((await h.sql('SELECT status, role FROM admins WHERE email = $1', [email]))[0].status, 'Pending Password');
      const login = await api('POST', '/auth/login', { body: { username: email, password: 'Whatever1', portal: 'web' } });
      assert.equal(login.status, 403);
    });

    // [Critical] ตั้งรหัสผ่านแอดมินผ่านลิงก์ -> เข้าเว็บได้ role ที่ไม่ถูกต้องถูกปรับเป็น HR Admin
    test('[Critical] TC-ADMIN-002 the invite link sets the password and unlocks web login; unknown roles become HR Admin', async () => {
      const email = `adm-${h.uid()}@test.local`;
      const created = await mkAdmin({ email, role: 'Root' });
      assert.equal(created.body.admin.role, 'HR Admin');
      const token = created.body.emailPreview.setupToken;
      assert.ok(token);
      const set = await api('POST', '/admins/set-password', { body: { email, token, password: 'Admin1234' } });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      const again = await api('POST', '/admins/set-password', { body: { email, token, password: 'Other1234' } });
      assert.ok([400, 401].includes(again.status), 'ลิงก์ใช้ได้ครั้งเดียว');
      const login = await api('POST', '/auth/login', { body: { username: email, password: 'Admin1234', portal: 'web' } });
      assert.equal(login.status, 200, JSON.stringify(login.body));
    });

    // [Critical] ลบ/ปิดบัญชีตัวเอง และ Super Admin คนสุดท้ายไม่ได้
    test('[Critical] TC-ADMIN-003 an admin cannot delete or deactivate their own account or the last Super Admin', async () => {
      assert.equal((await api('DELETE', '/admins/ADM-001', { token: adminToken })).status, 400, 'ลบตัวเอง');
      assert.equal((await api('PUT', '/admins/ADM-001', { token: adminToken, body: { status: 'Inactive' } })).status, 400, 'ปิดตัวเอง');
      const other = (await mkAdmin({ role: 'Super Admin' })).body.admin;
      const otherToken = await (async () => {
        await h.sql("UPDATE admins SET status = 'Active', password = (SELECT password FROM admins WHERE id = 'ADM-001') WHERE id = $1", [other.id]);
        return h.loginAdmin(api, { username: other.username, password: '1234' });
      })();
      // Super Admin ที่สองลบ Super Admin คนแรกได้ (ยังเหลืออีกคน) แต่คนสุดท้ายห้ามลบ
      assert.equal((await api('PUT', `/admins/${other.id}`, { token: adminToken, body: { status: 'Bogus' } })).status, 400);
      assert.equal((await api('DELETE', '/admins/ADM-001', { token: otherToken })).status, 200);
      assert.equal((await api('DELETE', `/admins/${other.id}`, { token: otherToken })).status, 400, 'ลบตัวเอง');
      assert.equal((await h.sql("SELECT COUNT(*)::int n FROM admins WHERE role = 'Super Admin'"))[0].n, 1);
      await h.sql("INSERT INTO admins (id, code, username, password, name, email, role, status) VALUES ('ADM-001','ADM-001','admin',(SELECT password FROM admins WHERE id = $1),'ผู้ดูแลระบบ (Web Admin)','admin@wellx989.com','Super Admin','Active') ON CONFLICT DO NOTHING", [other.id]);
      await h.sql('DELETE FROM admins WHERE id = $1', [other.id]);
    });

    // [High] แก้อีเมลแอดมินแล้ว username ตามอีเมล, ไม่ให้แก้ id / PIN จาก body
    test('[High] TC-ADMIN-004 editing an admin keeps username in sync with email and protects id/PIN', async () => {
      const a = (await mkAdmin()).body.admin;
      const email = `renamed-${h.uid()}@test.local`;
      const r = await api('PUT', `/admins/${a.id}`, { token: adminToken, body: { email, name: 'Renamed', id: 'HACK', pinHash: 'x', department: 'IT' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const [row] = await h.sql('SELECT id, username, email, name, pin_hash, department FROM admins WHERE id = $1', [a.id]);
      assert.equal(row.username, email);
      assert.equal(row.name, 'Renamed');
      assert.equal(row.pin_hash, null);
      assert.notEqual(row.department, 'IT', 'แอดมินไม่สังกัดแผนก');
      assert.equal((await h.sql("SELECT 1 FROM admins WHERE id = 'HACK'")).length, 0);
      assert.equal((await api('PUT', '/admins/ADM-NONE', { token: adminToken, body: { name: 'x' } })).status, 404);
    });
  });
});
