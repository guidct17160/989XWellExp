// เทส API: ใบลา, นโยบายการลา (โควตา เพศที่ใช้ได้ ต้องแนบเอกสาร) และไฟล์แนบใบลา
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

// ไฟล์ตัวอย่างที่ลายเซ็นไฟล์ถูกต้อง
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]).toString('base64');
const PDF = Buffer.from('%PDF-1.4\n%test\n').toString('base64');

// โควตาลานับต่อปีปฏิทิน (ปีปัจจุบันตามเวลาไทย) เคสโควตาจึงใช้วันที่ในปีนี้
const YEAR = h.todayBkk().slice(0, 4);

describe('Leaves, policies and attachments', () => {
  let server, api, adminToken, dept, emp, empToken, other, otherToken, female, femaleToken;

  const post = (token, body) => api('POST', '/leaves', { token, body: { leaveType: 'ลากิจ', startDate: '2099-03-02', endDate: '2099-03-02', reason: 'test', ...body } });
  const policy = (body) => api('POST', '/leave-policies', { token: adminToken, body });

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Leave Dept');
    emp = await h.makeEmployee({ dept });
    other = await h.makeEmployee({ dept });
    female = await h.makeEmployee({ dept, gender: 'Female' });
    [empToken, otherToken, femaleToken] = await Promise.all([emp, other, female].map((u) => h.loginApp(api, u)));
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('leave request validation', () => {
    // [Critical] ใบลาต้องครบ: ประเภท, วันที่, เหตุผล, รูปแบบวัน, วันสิ้นสุดไม่ก่อนวันเริ่ม, จำนวนวันไม่เกินช่วงวัน
    test('[Critical] TC-LEAVE-001 incomplete or inconsistent requests are rejected with 400', async () => {
      const bad = [
        { leaveType: '' }, { startDate: '' }, { endDate: '' }, { reason: '' },
        { startDate: '05/03/2099' }, { endDate: '2099-03-01' }, // สิ้นสุดก่อนเริ่ม
        { totalDays: 2 }, { totalDays: 0 }, { totalDays: -1 }, { totalDays: 0.3 }, // เกินช่วงวัน / ศูนย์ / ลบ / ไม่ใช่ครึ่งวัน
      ];
      for (const patch of bad) assert.equal((await post(empToken, patch)).status, 400, JSON.stringify(patch));
      assert.equal((await h.sql('SELECT COUNT(*)::int n FROM leave_requests WHERE employee_id = $1', [emp.id]))[0].n, 0);
    });

    // [High] ลาครึ่งวันได้ (0.5)
    test('[High] TC-LEAVE-002 a half day (0.5) is accepted and stored', async () => {
      const r = await post(empToken, { totalDays: 0.5 });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(Number((await h.sql('SELECT total_days FROM leave_requests WHERE id = $1', [r.body.request.id]))[0].total_days), 0.5);
    });

    // [Critical] ยื่นใบลาในนามตัวเองเท่านั้น (employeeId ใน body ถูกเมิน)
    test('[Critical] TC-LEAVE-003 a request is always filed for the token owner, a body employeeId is ignored', async () => {
      const r = await post(empToken, { employeeId: other.id });
      assert.equal(r.status, 201);
      assert.equal(r.body.request.employeeId, emp.id);
      assert.equal((await api('GET', '/leaves/my-requests', { token: otherToken })).body.requests.some((x) => x.id === r.body.request.id), false);
    });
  });

  describe('ownership', () => {
    // [Critical] ดู/ยกเลิกใบลาของคนอื่นไม่ได้ (Employee) แต่ผู้อนุมัติดูได้
    test('[Critical] TC-LEAVE-010 an Employee cannot read or cancel someone else\'s leave', async () => {
      const l = (await post(empToken, {})).body.request;
      assert.equal((await api('GET', `/leaves/${l.id}`, { token: otherToken })).status, 403);
      assert.equal((await api('DELETE', `/leaves/${l.id}/cancel`, { token: otherToken })).status, 403);
      assert.equal((await api('GET', `/leaves/${l.id}`, { token: empToken })).status, 200);
      assert.equal((await api('GET', `/leaves/${l.id}`, { token: adminToken })).status, 200, 'ผู้อนุมัติ/แอดมินดูได้');
      assert.equal((await api('GET', '/leaves/leave-nope', { token: empToken })).status, 404);
    });

    // [High] ยกเลิกใบลาของตัวเองได้ครั้งเดียว และยกเลิกใบที่ไม่อนุมัติแล้วไม่ได้
    test('[High] TC-LEAVE-011 the owner can cancel once; a rejected leave cannot be cancelled', async () => {
      const l = (await post(empToken, {})).body.request;
      assert.equal((await api('DELETE', `/leaves/${l.id}/cancel`, { token: empToken })).status, 200);
      assert.equal((await h.sql('SELECT status FROM leave_requests WHERE id = $1', [l.id]))[0].status, 'ยกเลิก');
      assert.equal((await api('DELETE', `/leaves/${l.id}/cancel`, { token: empToken })).status, 400);
      const boss = await h.makeEmployee({ dept, role: 'Boss' }); // ต้องมี Boss ในแผนกก่อนยื่น คำขอจึงไปที่ Boss
      const r = (await post(empToken, {})).body.request;
      assert.equal((await api('PATCH', `/approvals/leave/${r.id}`, { token: await h.loginApp(api, boss), body: { action: 'rejected' } })).status, 200);
      assert.equal((await api('DELETE', `/leaves/${r.id}/cancel`, { token: empToken })).status, 400);
    });
  });

  describe('leave policies', () => {
    // [Critical] นโยบายลาแก้ได้เฉพาะแอดมิน และ Policy ID ห้ามซ้ำ/ต้องรูปแบบถูก
    test('[Critical] TC-POLICY-001 admin creates, updates and deletes a policy; the ID must be unique and well formed', async () => {
      const c = await policy({ id: 'LP-T1', typeName: 'Test Leave', defaultQuota: 5, applicableGender: 'all' });
      assert.equal(c.status, 201, JSON.stringify(c.body));
      assert.equal((await policy({ id: 'lp-t1', typeName: 'Dup' })).status, 409, 'ID ซ้ำ (ไม่สนตัวพิมพ์)');
      assert.equal((await policy({ id: 'bad id!', typeName: 'X' })).status, 400);
      assert.equal((await policy({ typeName: '' })).status, 400);
      assert.equal((await api('PUT', '/leave-policies/LP-T1', { token: adminToken, body: { typeName: 'Test Leave 2', defaultQuota: 7 } })).status, 200);
      const list = (await api('GET', '/leave-policies', { token: empToken })).body.policies;
      assert.equal(list.find((p) => p.id === 'LP-T1').defaultQuota, 7);
      assert.equal((await api('PUT', '/leave-policies/LP-T1', { token: empToken, body: { defaultQuota: 99 } })).status, 403);
      assert.equal((await api('DELETE', '/leave-policies/LP-T1', { token: empToken })).status, 403);
      assert.equal((await api('DELETE', '/leave-policies/LP-T1', { token: adminToken })).status, 200);
      assert.equal((await api('GET', '/leave-policies', { token: empToken })).body.policies.some((p) => p.id === 'LP-T1'), false);
    });

    // [Critical] โควตา: ขอเกินสิทธิ์คงเหลือไม่ได้ (server บังคับ)
    test('[Critical] TC-POLICY-002 a request above the remaining quota is refused by the server', async () => {
      await policy({ id: 'LP-Q2', typeName: 'Quota Leave', categoryKey: 'quota2', defaultQuota: 2 });
      const u = await h.makeEmployee({ dept });
      const t = await h.loginApp(api, u);
      const big = await post(t, { leaveType: 'Quota Leave', startDate: `${YEAR}-12-01`, endDate: `${YEAR}-12-05`, totalDays: 3 });
      assert.equal(big.status, 400);
      assert.match(big.body.message, /เกิน|คงเหลือ/);
      assert.equal((await post(t, { leaveType: 'Quota Leave', startDate: `${YEAR}-12-01`, endDate: `${YEAR}-12-02`, totalDays: 2 })).status, 201);
    });

    // [Critical] ใช้สิทธิ์ครบแล้ว (อนุมัติครบโควตา) ขอเพิ่มไม่ได้
    test('[Critical] TC-POLICY-003 once the quota is used up (approved), no further request is accepted', async () => {
      await policy({ id: 'LP-Q1', typeName: 'One Day Leave', categoryKey: 'oneday', defaultQuota: 1 });
      const boss = await h.makeEmployee({ dept, role: 'Boss' });
      const bossToken = await h.loginApp(api, boss);
      const u = await h.makeEmployee({ dept });
      const t = await h.loginApp(api, u);
      const l = await post(t, { leaveType: 'One Day Leave', startDate: `${YEAR}-12-29`, endDate: `${YEAR}-12-29`, totalDays: 1 });
      assert.equal(l.status, 201, JSON.stringify(l.body));
      assert.equal((await api('PATCH', `/approvals/leave/${l.body.request.id}`, { token: bossToken, body: { action: 'approved' } })).status, 200);
      const more = await post(t, { leaveType: 'One Day Leave', startDate: `${YEAR}-12-30`, endDate: `${YEAR}-12-30`, totalDays: 1 });
      assert.equal(more.status, 400);
      const bal = (await api('GET', '/leaves/balances', { token: t })).body.balances.find((b) => b.policyId === 'LP-Q1' || b.id === 'oneday');
      assert.equal(bal.remaining, 0);
    });

    // [High] เพศที่ใช้ได้: ลาที่เฉพาะหญิงชายยื่นไม่ได้
    test('[High] TC-POLICY-004 a female-only leave type refuses a male employee and accepts a female one', async () => {
      await policy({ id: 'LP-F', typeName: 'Maternity Test', categoryKey: 'maternity_t', defaultQuota: 90, applicableGender: 'female' });
      const male = await post(empToken, { leaveType: 'Maternity Test' });
      assert.equal(male.status, 400);
      assert.match(male.body.message, /เพศหญิง/);
      assert.equal((await post(femaleToken, { leaveType: 'Maternity Test' })).status, 201);
    });

    // [Critical] ต้องแนบเอกสาร: ไม่แนบ -> 400, แนบไฟล์ปลอม/ของคนอื่น -> 400, แนบไฟล์ของตัวเอง -> ผ่าน
    test('[Critical] TC-POLICY-005 a policy that requires an attachment refuses a request without a valid own file', async () => {
      await policy({ id: 'LP-A', typeName: 'Sick Test', categoryKey: 'sick_t', defaultQuota: 30, requireAttachment: true });
      assert.equal((await post(empToken, { leaveType: 'Sick Test' })).status, 400);
      assert.equal((await post(empToken, { leaveType: 'Sick Test', attachmentUrl: '/uploads/leave/att-doesnotexist' })).status, 400);
      const up = await api('POST', '/uploads/leave-attachment', { token: otherToken, body: { fileName: 'cert.pdf', mimeType: 'application/pdf', dataBase64: PDF } });
      assert.equal(up.status, 201, JSON.stringify(up.body));
      assert.equal((await post(empToken, { leaveType: 'Sick Test', attachmentUrl: up.body.attachment.url })).status, 400, 'ไฟล์ของคนอื่น');
      const mine = await api('POST', '/uploads/leave-attachment', { token: empToken, body: { fileName: 'cert.pdf', mimeType: 'application/pdf', dataBase64: PDF } });
      const ok = await post(empToken, { leaveType: 'Sick Test', attachmentUrl: mine.body.attachment.url });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
    });
  });

  describe('attachments', () => {
    const upload = (token, body) => api('POST', '/uploads/leave-attachment', { token, body });

    // [Critical] ตรวจชนิดไฟล์จากเนื้อหาจริง ไม่เชื่อนามสกุล/ชนิดที่ส่งมา
    test('[Critical] TC-ATTACH-001 file type is checked from the real content, size and type are limited', async () => {
      assert.equal((await upload(empToken, { fileName: 'a.png', mimeType: 'image/png', dataBase64: PNG })).status, 201);
      const fake = Buffer.from('<script>alert(1)</script>').toString('base64');
      assert.equal((await upload(empToken, { fileName: 'photo.png', mimeType: 'image/png', dataBase64: fake })).status, 400, 'สคริปต์ที่ตั้งชื่อเป็นรูป');
      assert.equal((await upload(empToken, { fileName: 'a.exe', mimeType: 'application/x-msdownload', dataBase64: PDF })).status, 400);
      assert.equal((await upload(empToken, { fileName: 'a.pdf', mimeType: 'application/pdf', dataBase64: '' })).status, 400);
      const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024 + 10)]).toString('base64');
      assert.equal((await upload(empToken, { fileName: 'big.pdf', mimeType: 'application/pdf', dataBase64: big })).status, 400, 'เกิน 5 MB');
      assert.equal((await api('POST', '/uploads/leave-attachment', { body: { mimeType: 'application/pdf', dataBase64: PDF } })).status, 401);
    });

    // [Critical] เปิดไฟล์ได้เฉพาะเจ้าของ/ผู้อนุมัติ ผ่านลิงก์อายุสั้นที่ผูกกับไฟล์นั้นเท่านั้น
    test('[Critical] TC-ATTACH-002 only the owner or an approver gets a link, and the link opens only that file', async () => {
      const a = (await upload(empToken, { fileName: 'a.pdf', mimeType: 'application/pdf', dataBase64: PDF })).body.attachment;
      const b = (await upload(empToken, { fileName: 'b.pdf', mimeType: 'application/pdf', dataBase64: PDF })).body.attachment;
      assert.equal((await api('GET', `/uploads/leave/${a.id}/link`, { token: otherToken })).status, 403);
      assert.equal((await api('GET', `/uploads/leave/${a.id}/link`)).status, 401);
      const link = await api('GET', `/uploads/leave/${a.id}/link`, { token: empToken });
      assert.equal(link.status, 200);
      assert.equal((await api('GET', `/uploads/leave/${a.id}/link`, { token: adminToken })).status, 200);
      const file = await fetch(link.body.url.replace(/^https?:\/\/[^/]+/, server.base.replace('/api', '')));
      assert.equal(file.status, 200);
      assert.equal(file.headers.get('content-type'), 'application/pdf');
      assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
      // token ของไฟล์ a ใช้เปิดไฟล์ b ไม่ได้ และไม่มี token ก็เปิดไม่ได้
      const ft = new URL(link.body.url).searchParams.get('ft');
      assert.equal((await api('GET', `/uploads/leave/${b.id}/file?ft=${ft}`)).status, 401);
      assert.equal((await api('GET', `/uploads/leave/${a.id}/file`)).status, 401);
    });
  });
});
