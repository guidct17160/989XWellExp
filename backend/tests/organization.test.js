// เทส API: องค์กร (แผนก), พนักงาน (CRUD, ตั้ง/รีเซ็ตรหัสผ่าน), ประกาศ, แจ้งเตือน, Audit log, วันหยุด, แดชบอร์ด HR
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
// อีเมลไม่ถูกส่งจริง (harness ตัด SMTP) ทุกเคสที่สร้าง/รีเซ็ตพนักงานตรวจว่า realSmtpSent เป็น false
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

const PNG = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]).toString('base64')}`;
const addDays = (n) => {
  const [y, m, d] = h.todayBkk().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

describe('Organization, employees, announcements', () => {
  let server, api, adminToken, dept, emp, empToken;
  const admin = (m, p, body) => api(m, p, { token: adminToken, body });

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Org Dept');
    emp = await h.makeEmployee({ dept });
    empToken = await h.loginApp(api, emp);
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('departments', () => {
    // [Critical] สร้างแผนกได้ ชื่อห้ามว่าง ชื่อห้ามซ้ำ (ไม่สนตัวพิมพ์) ทั้งตอนสร้างและตอนเปลี่ยนชื่อ
    test('[Critical] TC-DEPT-001 a department needs a name and the name is unique (case-insensitive)', async () => {
      assert.equal((await admin('POST', '/departments', { name: '  ' })).status, 400);
      const a = await admin('POST', '/departments', { name: 'Finance', code: 'FIN' });
      assert.equal(a.status, 201, JSON.stringify(a.body));
      assert.equal((await admin('POST', '/departments', { name: 'finance' })).status, 409);
      const b = (await admin('POST', '/departments', { name: 'Legal', code: 'LEG' })).body.department;
      assert.equal((await admin('PUT', `/departments/${b.id}`, { name: 'FINANCE' })).status, 409);
      assert.equal((await admin('PUT', `/departments/${b.id}`, { manager: 'Khun Legal' })).status, 200);
      const list = (await api('GET', '/departments', { token: empToken })).body.departments;
      const legal = list.find((d) => d.id === b.id);
      assert.equal(legal.name, 'Legal', 'แก้บางฟิลด์ต้องไม่ล้างฟิลด์อื่น');
      assert.equal(legal.manager, 'Khun Legal');
    });

    // [Critical] ลบแผนกที่ยังมีพนักงานไม่ได้ (409) ลบแผนกว่างได้ และ client ส่ง id มาทับแผนกอื่นไม่ได้
    test('[Critical] TC-DEPT-002 a department with members cannot be deleted; an empty one can; a client id cannot overwrite', async () => {
      const del = await admin('DELETE', `/departments/${dept.id}`);
      assert.equal(del.status, 409);
      assert.equal((await h.sql('SELECT 1 FROM departments WHERE id = $1', [dept.id])).length, 1);
      const empty = (await admin('POST', '/departments', { name: 'Temp Dept' })).body.department;
      assert.equal((await admin('DELETE', `/departments/${empty.id}`)).status, 200);
      assert.equal((await admin('DELETE', `/departments/${empty.id}`)).status, 404);
      const evil = await admin('POST', '/departments', { id: dept.id, name: 'Hijack' });
      assert.equal(evil.status, 201);
      assert.notEqual(evil.body.department.id, dept.id);
      assert.equal((await h.sql('SELECT name FROM departments WHERE id = $1', [dept.id]))[0].name, dept.name);
    });

    // [High] เปลี่ยนชื่อแผนก -> ชื่อของพนักงานในแผนกเปลี่ยนตาม
    test('[High] TC-DEPT-003 renaming a department cascades the name to its employees', async () => {
      const d = (await admin('POST', '/departments', { name: 'Ops Old' })).body.department;
      const e = await h.makeEmployee({ dept: { id: d.id, name: 'Ops Old' } });
      assert.equal((await admin('PUT', `/departments/${d.id}`, { name: 'Ops New' })).status, 200);
      assert.equal((await h.sql('SELECT department FROM employees WHERE id = $1', [e.id]))[0].department, 'Ops New');
    });
  });

  describe('employees', () => {
    // [Critical] สร้างพนักงาน: ต้องมีชื่อและอีเมล, อีเมล/รหัสซ้ำไม่ได้, ไม่ส่งรหัสผ่านกลับ, ไม่ส่งอีเมลจริง, สถานะรอตั้งรหัสผ่านเข้าแอปไม่ได้
    test('[Critical] TC-EMP-001 create validates name/email/code, hides secrets and sends no real email', async () => {
      const email = `new-${h.uid()}@test.local`;
      const body = { name: 'New Person', firstName: 'New', lastName: 'Person', email, code: `NP-${h.uid()}`.toUpperCase(), department: dept.name, role: 'Employee' };
      const ok = await admin('POST', '/employees', body);
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(ok.body.employee.password, undefined);
      assert.equal(ok.body.emailPreview.realSmtpSent, false, 'เทสต้องไม่ส่งอีเมลจริง');
      assert.equal((await h.sql('SELECT status FROM employees WHERE email = $1', [email]))[0].status, 'Pending Password');
      const login = await api('POST', '/auth/login', { body: { username: email, password: 'Whatever1', portal: 'app' } });
      assert.equal(login.status, 403, 'ยังไม่ตั้งรหัสผ่านต้องเข้าไม่ได้');
      await h.sleep(5200); // กันซ้ำภายใน 5 วินาทีของ backend
      assert.equal((await admin('POST', '/employees', { ...body, code: `X-${h.uid()}`.toUpperCase() })).status, 400, 'อีเมลซ้ำ');
      assert.equal((await admin('POST', '/employees', { ...body, email: `o-${h.uid()}@test.local` })).status, 400, 'รหัสพนักงานซ้ำ');
      assert.equal((await admin('POST', '/employees', { name: 'No Email' })).status, 400);
      assert.equal((await admin('POST', '/employees', { email: `n-${h.uid()}@test.local` })).status, 400, 'ไม่มีชื่อ');
    });

    // [Critical] ตั้งรหัสผ่านผ่านลิงก์ในอีเมล: ใช้ได้ครั้งเดียว, รหัสผ่านต้องแข็งแรง, ตั้งแล้วล็อกอินแอปได้
    test('[Critical] TC-EMP-002 the set-password link works once, enforces password rules and unlocks login', async () => {
      const email = `link-${h.uid()}@test.local`;
      const created = await admin('POST', '/employees', { name: 'Link Person', firstName: 'Link', lastName: 'Person', email, code: `LK-${h.uid()}`.toUpperCase(), department: dept.name });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const token = created.body.emailPreview.setupToken;
      assert.ok(token, 'non-production ต้องส่ง token มากับ preview');
      const set = (body) => api('POST', '/employees/set-password', { body: { email, token, ...body } });
      assert.equal((await set({ password: 'abc' })).status, 400, 'สั้นเกินไป');
      assert.equal((await set({ password: 'onlyletters' })).status, 400, 'ต้องมีตัวเลข');
      assert.equal((await set({ password: 'Valid123', username: 'ab' })).status, 400, 'username สั้นเกินไป');
      assert.equal((await api('POST', '/employees/set-password', { body: { email, token: 'bad.token', password: 'Valid123' } })).status, 401);
      const ok = await set({ password: 'Valid123', username: `link.${h.uid()}`.slice(0, 20) });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal((await set({ password: 'Another123' })).status, 401, 'ลิงก์ใช้ได้ครั้งเดียว');
      const login = await api('POST', '/auth/login', { body: { username: email, password: 'Valid123', portal: 'app' } });
      assert.equal(login.status, 200, JSON.stringify(login.body));
    });

    // [Critical] Admin รีเซ็ตรหัสผ่านพนักงาน -> ลิงก์ใหม่ใช้ได้ รหัสเดิมยังใช้ได้จนกว่าจะตั้งใหม่ ไม่ส่งอีเมลจริง และพนักงานที่ลาออกรีเซ็ตไม่ได้
    test('[Critical] TC-EMP-003 an admin reset creates a working link; a resigned employee cannot be reset', async () => {
      const r = await admin('POST', `/employees/${emp.id}/reset-password`);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.emailPreview.realSmtpSent, false);
      assert.ok(!r.body.message.includes(`${emp.id.toLowerCase()}@test.local`), 'ต้องไม่ส่งอีเมลเต็มกลับ (mask)');
      const set = await api('POST', '/employees/set-password', { body: { email: `${emp.id.toLowerCase()}@test.local`, token: r.body.emailPreview.setupToken, password: 'Reset1234' } });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      assert.equal((await api('POST', '/auth/login', { body: { username: emp.username, password: 'Reset1234', portal: 'app' } })).status, 200);
      assert.equal((await admin('POST', '/employees/emp-nope/reset-password')).status, 404);
      const gone = await h.makeEmployee({ dept, status: 'Resign' });
      assert.equal((await admin('POST', `/employees/${gone.id}/reset-password`)).status, 400);
    });

    // [Critical] แก้ไขพนักงาน: รหัสผ่านว่างไม่ล้างรหัสเดิม ห้ามแก้ id/pin, พนักงานที่ลาออกแก้ไม่ได้, role ที่ไม่ใช่แอดมินแก้ไม่ได้
    test('[Critical] TC-EMP-004 update keeps the password when blank, protects id/PIN and refuses resigned employees', async () => {
      const e = await h.makeEmployee({ dept });
      const before = (await h.sql('SELECT password FROM employees WHERE id = $1', [e.id]))[0].password;
      const r = await admin('PUT', `/employees/${e.id}`, { phone: '081-000-0000', password: '', id: 'HACK', pinHash: 'x' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const [row] = await h.sql('SELECT id, password, phone, pin_hash FROM employees WHERE id = $1', [e.id]);
      assert.equal(row.phone, '081-000-0000');
      assert.equal(row.password, before);
      assert.equal(row.pin_hash, null);
      assert.equal((await h.sql("SELECT 1 FROM employees WHERE id = 'HACK'")).length, 0);
      assert.equal((await admin('PUT', '/employees/emp-nope', { phone: '1' })).status, 404);
      const gone = await h.makeEmployee({ dept, status: 'Resign' });
      assert.equal((await admin('PUT', `/employees/${gone.id}`, { phone: '1' })).status, 400);
      assert.equal((await api('PUT', `/employees/${e.id}`, { token: empToken, body: { role: 'SuperBoss' } })).status, 403);
    });

    // [High] ลบพนักงาน และไม่พบ -> 404, พนักงานทั่วไปลบไม่ได้
    test('[High] TC-EMP-005 delete removes the employee, unknown is 404, an Employee cannot delete', async () => {
      const e = await h.makeEmployee({ dept });
      assert.equal((await api('DELETE', `/employees/${e.id}`, { token: empToken })).status, 403);
      assert.equal((await admin('DELETE', `/employees/${e.id}`)).status, 200);
      assert.equal((await h.sql('SELECT 1 FROM employees WHERE id = $1', [e.id])).length, 0);
      assert.equal((await admin('DELETE', `/employees/${e.id}`)).status, 404);
    });
  });

  describe('announcements', () => {
    const body = (over = {}) => ({ title: 'Holiday notice', description: 'Office closed', startDate: h.todayBkk(), startTime: '00:00', noEndDate: true, ...over });

    // [Critical] สร้าง/แก้/ลบประกาศ (แอดมิน) และตรวจข้อมูล: ชื่อ, รายละเอียด, วันที่, วันสิ้นสุดหลังวันเริ่ม และไม่อยู่ในอดีต
    test('[Critical] TC-ANN-001 admin manages announcements and the dates are validated', async () => {
      const ok = await admin('POST', '/announcements', body());
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      const id = ok.body.announcement.id;
      const bad = [
        { title: '' }, { description: '' }, { startDate: '' }, { startTime: '25:00' },
        { noEndDate: false, endDate: '' },
        { noEndDate: false, endDate: addDays(-1), endTime: '10:00', startDate: addDays(-3) }, // สิ้นสุดเป็นอดีต
        { noEndDate: false, startDate: addDays(2), endDate: addDays(1), endTime: '10:00' }, // สิ้นสุดก่อนเริ่ม
      ];
      for (const patch of bad) assert.equal((await admin('POST', '/announcements', body(patch))).status, 400, JSON.stringify(patch));
      assert.equal((await admin('PUT', `/announcements/${id}`, body({ title: 'Edited' }))).status, 200);
      assert.equal((await admin('GET', `/announcements/${id}`)).body.announcement.title, 'Edited');
      assert.equal((await admin('DELETE', `/announcements/${id}`)).status, 200);
      assert.equal((await admin('GET', `/announcements/${id}`)).status, 404);
    });

    // [Critical] แอป (สาธารณะ) เห็นเฉพาะที่ Active ตอนนี้ แอดมินเห็นทุกสถานะ (Scheduled / Active / Expired)
    test('[Critical] TC-ANN-002 the public list holds only Active announcements, the admin list shows every status', async () => {
      await h.sql('TRUNCATE announcements');
      const active = (await admin('POST', '/announcements', body({ title: 'Active one' }))).body.announcement;
      const scheduled = (await admin('POST', '/announcements', body({ title: 'Scheduled one', startDate: addDays(3) }))).body.announcement;
      const expiredId = `ann-expired-${h.uid()}`;
      const expired = (await admin('POST', '/announcements', body({ title: 'Soon expired', noEndDate: false, endDate: addDays(1), endTime: '10:00' }))).body.announcement;
      await h.sql("UPDATE announcements SET end_date = '2020-01-02' WHERE id = $1", [expired.id]);
      const pub = (await api('GET', '/announcements')).body.announcements.map((a) => a.title);
      assert.deepEqual(pub, ['Active one']);
      const all = (await admin('GET', '/announcements/all')).body.announcements;
      const status = (t) => all.find((a) => a.title === t).status;
      assert.equal(status('Active one'), 'Active');
      assert.equal(status('Scheduled one'), 'Scheduled');
      assert.equal(status('Soon expired'), 'Expired');
      assert.ok(active.id && scheduled.id && expiredId);
    });

    // [High] รูปประกาศ: เฉพาะ PNG/GIF ตามเนื้อไฟล์จริง, เสิร์ฟพร้อม CORP cross-origin (แอปเปิดจากอีกโดเมนได้)
    test('[High] TC-ANN-003 only real PNG/GIF images are stored and the image is served cross-origin', async () => {
      const fakePng = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
      assert.equal((await admin('POST', '/announcements', body({ image: fakePng }))).status, 400);
      assert.equal((await admin('POST', '/announcements', body({ image: 'data:image/jpeg;base64,AAAA' }))).status, 400);
      const ok = await admin('POST', '/announcements', body({ title: 'With picture', image: PNG }));
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(ok.body.announcement.hasImage, true);
      const img = await fetch(`${server.base}/announcements/${ok.body.announcement.id}/image`);
      assert.equal(img.status, 200);
      assert.equal(img.headers.get('content-type'), 'image/png');
      assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin');
      assert.equal((await fetch(`${server.base}/announcements/ann-none/image`)).status, 404);
    });

    // [Critical] พนักงานสร้าง/แก้/ลบประกาศไม่ได้
    test('[Critical] TC-ANN-004 employees cannot create, edit or delete announcements', async () => {
      assert.equal((await api('POST', '/announcements', { token: empToken, body: body() })).status, 403);
      const a = (await admin('POST', '/announcements', body())).body.announcement;
      assert.equal((await api('PUT', `/announcements/${a.id}`, { token: empToken, body: body() })).status, 403);
      assert.equal((await api('DELETE', `/announcements/${a.id}`, { token: empToken })).status, 403);
    });
  });

  describe('notifications', () => {
    // [Critical] แจ้งเตือนเป็นของใครของมัน: อ่านแล้วนับ unread ถูก และ mark ของคนอื่นไม่ได้
    test('[Critical] TC-NOTI-001 notifications are per account: unread count, mark read, no touching others', async () => {
      const a = await h.makeEmployee({ dept });
      const b = await h.makeEmployee({ dept });
      const [ta, tb] = await Promise.all([h.loginApp(api, a), h.loginApp(api, b)]);
      for (const [id, n] of [['n-a1', a.id], ['n-a2', a.id], ['n-b1', b.id]]) {
        await h.sql("INSERT INTO notifications (id, employee_id, title, message, type, is_read) VALUES ($1, $2, 'T', 'M', 'info', false)", [id, n]);
      }
      const list = await api('GET', '/notifications', { token: ta });
      assert.equal(list.body.total, 2);
      assert.equal(list.body.unreadCount, 2);
      await api('PATCH', '/notifications/n-b1/read', { token: ta }); // ของ b: a ทำไม่ได้
      assert.equal((await h.sql("SELECT is_read FROM notifications WHERE id = 'n-b1'"))[0].is_read, false);
      assert.equal((await api('PATCH', '/notifications/n-a1/read', { token: ta })).status, 200);
      assert.equal((await api('GET', '/notifications', { token: ta })).body.unreadCount, 1);
      assert.equal((await api('PATCH', '/notifications/read-all', { token: ta })).status, 200);
      assert.equal((await api('GET', '/notifications', { token: ta })).body.unreadCount, 0);
      assert.equal((await api('GET', '/notifications', { token: tb })).body.unreadCount, 1, 'read-all ของ a ไม่กระทบ b');
    });

    // [High] push token: ต้องระบุ token, พนักงานฝากของคนอื่นไม่ได้ (บันทึกเป็นของตัวเองเสมอ)
    test('[High] TC-NOTI-002 a push token is required and always saved for the caller', async () => {
      const a = await h.makeEmployee({ dept });
      const ta = await h.loginApp(api, a);
      assert.equal((await api('POST', '/notifications/push-token', { token: ta, body: {} })).status, 400);
      assert.equal((await api('POST', '/notifications/push-token', { token: ta, body: { token: 'ExponentPushToken[abc]', employeeId: emp.id } })).status, 200);
    });
  });

  describe('audit logs, holidays and HR dashboard', () => {
    // [High] การกระทำสำคัญของแอดมินถูกบันทึก (สร้างพนักงาน/แผนก) และดูได้เฉพาะแอดมิน
    test('[High] TC-AUDIT-001 admin actions are logged and only admins can read the log', async () => {
      const name = `Audit Dept ${h.uid()}`;
      await admin('POST', '/departments', { name });
      await admin('POST', '/work-locations', { name: 'Audit place', latitude: 13.7, longitude: 100.5, radiusM: 100 });
      await h.sleep(300);
      const logs = await admin('GET', '/audit-logs');
      assert.equal(logs.status, 200);
      const text = JSON.stringify(logs.body);
      assert.ok(text.includes('CREATE_WORK_LOCATION'), 'ต้องมีบันทึกการสร้างสถานที่');
      assert.ok(text.includes('LOGIN_SUCCESS'));
      assert.equal((await api('GET', '/audit-logs', { token: empToken })).status, 403);
    });

    // [High] วันหยุดดูได้โดยไม่ต้องล็อกอิน, แดชบอร์ด HR ต้องเป็นผู้อนุมัติ
    test('[High] TC-HR-001 holidays are public, dashboard stats are for approvers only', async () => {
      const hol = await api('GET', '/holidays');
      assert.equal(hol.status, 200);
      assert.ok((hol.body.holidays || hol.body.data || []).length > 0, 'ต้องมีวันหยุดตั้งต้น');
      const stats = await api('GET', '/hr/dashboard/stats', { token: adminToken });
      assert.equal(stats.status, 200);
      assert.ok(stats.body.stats && typeof stats.body.stats === 'object');
      assert.equal((await api('GET', '/hr/dashboard/stats', { token: empToken })).status, 403);
    });
  });
});
