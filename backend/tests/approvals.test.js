// เทส API: การอนุมัติใบลา / คำขอปรับปรุงเวลา (กติกาสำคัญที่สุดของระบบ)
//   - Boss อนุมัติ/ไม่อนุมัติคำขอของ Employee ในแผนกเดียวกัน "ครั้งเดียวจบ" (ไม่ส่งต่อ)
//   - คำขอของ Boss และของพนักงานในแผนกที่ไม่มี Boss ไปที่ SuperBoss
//   - Boss อนุมัติของตัวเอง / ของ Boss ด้วยกัน / ของแผนกอื่นไม่ได้ (403)
//   - SuperBoss: คำขอแก้เวลาอนุมัติทันที ใบลายังต้องอนุมัติ
//   - ประวัติการอนุมัติแยกตามบัญชี
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

const LEVEL1 = 'รออนุมัติระดับ 1 (Boss)';
const LEVEL2 = 'รออนุมัติระดับ 2 (Superboss)';

const dayBefore = (n) => {
  const [y, m, d] = h.todayBkk().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

describe('Approval workflow', () => {
  let server, api, adminToken;
  let it, hr, mkt; // แผนก
  let boss, boss2, superBoss, e1, e2, hrEmp; // ผู้ใช้
  let tok; // token ของแต่ละคน

  const leave = async (who, extra = {}) => {
    const r = await api('POST', '/leaves', { token: tok[who.id], body: { leaveType: 'ลากิจ (Personal Leave)', startDate: '2099-01-05', endDate: '2099-01-05', reason: 'approval test', ...extra } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.request;
  };
  const correction = async (who, extra = {}) => {
    const r = await api('POST', '/attendance/corrections', { token: tok[who.id], body: { dateIso: dayBefore(1), newCheckIn: '08:00', newCheckOut: '17:00', reason: 'approval test', ...extra } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.correction;
  };
  const decide = (who, type, id, action = 'approved', remark) => api('PATCH', `/approvals/${type}/${id}`, { token: tok[who.id], body: { action, remark } });
  const leaveRow = async (id) => (await h.sql('SELECT status, approver, decided_by, remark FROM leave_requests WHERE id = $1', [id]))[0];
  const corrRow = async (id) => (await h.sql('SELECT status, approver, decided_by, remark FROM time_corrections WHERE id = $1', [id]))[0];

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    [it, hr, mkt] = [await h.makeDept('IT Dept'), await h.makeDept('HR Dept (no boss)'), await h.makeDept('MKT Dept')];
    boss = await h.makeEmployee({ dept: it, role: 'Boss', name: 'Boss One' });
    boss2 = await h.makeEmployee({ dept: mkt, role: 'Boss', name: 'Boss Two' });
    superBoss = await h.makeEmployee({ dept: it, role: 'SuperBoss', name: 'Super Boss' });
    e1 = await h.makeEmployee({ dept: it, name: 'Employee One' });
    e2 = await h.makeEmployee({ dept: it, name: 'Employee Two' });
    hrEmp = await h.makeEmployee({ dept: hr, name: 'HR Employee' });
    tok = {};
    for (const u of [boss, boss2, superBoss, e1, e2, hrEmp]) tok[u.id] = await h.loginApp(api, u);
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('who approves what', () => {
    // [Critical] คำขอของ Employee ที่แผนกมี Boss เริ่มที่ระดับ 1 และ Boss เห็นในรายการรออนุมัติ (Boss แผนกอื่นไม่เห็น)
    test('[Critical] TC-APR-001 an Employee request starts at level 1 and reaches the Boss of the same department', async () => {
      const l = await leave(e1);
      assert.equal(l.status, LEVEL1);
      assert.equal((await leaveRow(l.id)).status, LEVEL1);
      const mine = (await api('GET', '/approvals/pending', { token: tok[boss.id] })).body.approvals;
      assert.ok(mine.some((x) => x.id === l.id), 'Boss แผนกเดียวกันต้องเห็น');
      const other = (await api('GET', '/approvals/pending', { token: tok[boss2.id] })).body.approvals;
      assert.ok(!other.some((x) => x.id === l.id), 'Boss แผนกอื่นต้องไม่เห็น');
    });

    // [Critical] Boss อนุมัติคำขอของ Employee -> อนุมัติแล้วทันที ไม่ส่งต่อ, บันทึกผู้ตัดสิน, แจ้งเตือนพนักงาน, ทำซ้ำไม่ได้ (409)
    test('[Critical] TC-APR-002 a Boss approval of an Employee request is FINAL (no forwarding) and cannot be repeated', async () => {
      const l = await leave(e1);
      const r = await decide(boss, 'leave', l.id, 'approved', 'ok');
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.status, 'อนุมัติแล้ว');
      const row = await leaveRow(l.id);
      assert.equal(row.status, 'อนุมัติแล้ว');
      assert.equal(row.decided_by, boss.id);
      assert.ok(row.approver, 'ต้องเก็บชื่อผู้อนุมัติ');
      const notes = await api('GET', '/notifications', { token: tok[e1.id] });
      assert.ok(JSON.stringify(notes.body).includes('ได้รับการอนุมัติ'), 'พนักงานต้องได้รับแจ้งเตือน');
      const again = await decide(boss, 'leave', l.id, 'rejected');
      assert.equal(again.status, 409);
      assert.equal((await leaveRow(l.id)).status, 'อนุมัติแล้ว');
    });

    // [Critical] Boss ไม่อนุมัติ -> ไม่อนุมัติทันทีและเก็บเหตุผล
    test('[Critical] TC-APR-003 a Boss rejection is final and keeps the reason', async () => {
      const l = await leave(e1);
      const r = await decide(boss, 'leave', l.id, 'rejected', 'ช่วงนี้งานเยอะ');
      assert.equal(r.status, 200);
      const row = await leaveRow(l.id);
      assert.equal(row.status, 'ไม่อนุมัติ');
      assert.equal(row.remark, 'ช่วงนี้งานเยอะ');
      assert.equal(row.decided_by, boss.id);
    });

    // [Critical] คำขอของ Boss ไปที่ SuperBoss: Boss ตัวเอง / Boss คนอื่นอนุมัติไม่ได้ SuperBoss อนุมัติได้
    test('[Critical] TC-APR-004 a Boss request goes to the SuperBoss; no Boss (self or other) can approve it', async () => {
      const l = await leave(boss);
      assert.equal(l.status, LEVEL2);
      assert.equal((await decide(boss, 'leave', l.id)).status, 403, 'อนุมัติของตัวเอง');
      assert.equal((await decide(boss2, 'leave', l.id)).status, 403, 'Boss คนอื่น');
      assert.equal((await decide(boss, 'leave', l.id, 'rejected')).status, 403, 'ไม่อนุมัติของตัวเองก็ไม่ได้');
      assert.equal((await leaveRow(l.id)).status, LEVEL2);
      const ok = await decide(superBoss, 'leave', l.id);
      assert.equal(ok.status, 200);
      const row = await leaveRow(l.id);
      assert.equal(row.status, 'อนุมัติแล้ว');
      assert.equal(row.decided_by, superBoss.id);
    });

    // [Critical] พนักงานในแผนกที่ไม่มี Boss ไป SuperBoss โดยตรง และ Boss แผนกอื่นอนุมัติไม่ได้
    test('[Critical] TC-APR-005 an employee of a department without a Boss goes to the SuperBoss; other-department Boss gets 403', async () => {
      const l = await leave(hrEmp);
      assert.equal(l.status, LEVEL2);
      assert.equal((await decide(boss, 'leave', l.id)).status, 403);
      assert.equal((await leaveRow(l.id)).status, LEVEL2);
      assert.equal((await decide(superBoss, 'leave', l.id, 'rejected', 'no')).status, 200);
      assert.equal((await leaveRow(l.id)).status, 'ไม่อนุมัติ');
    });

    // [Critical] Boss แผนกอื่นอนุมัติคำขอของ Employee แผนกนี้ไม่ได้
    test('[Critical] TC-APR-006 a Boss of another department cannot decide an Employee request (403, status unchanged)', async () => {
      const l = await leave(e2);
      assert.equal((await decide(boss2, 'leave', l.id)).status, 403);
      assert.equal((await decide(boss2, 'leave', l.id, 'rejected')).status, 403);
      assert.equal((await leaveRow(l.id)).status, LEVEL1);
    });

    // [Critical] Employee ทั่วไปอนุมัติไม่ได้ (รวมของตัวเอง) และต้องล็อกอิน
    test('[Critical] TC-APR-007 an Employee cannot approve (403) and anonymous calls get 401', async () => {
      const l = await leave(e1);
      assert.equal((await decide(e1, 'leave', l.id)).status, 403);
      assert.equal((await decide(e2, 'leave', l.id)).status, 403);
      assert.equal((await api('PATCH', `/approvals/leave/${l.id}`, { body: { action: 'approved' } })).status, 401);
      assert.equal((await leaveRow(l.id)).status, LEVEL1);
    });

    // [High] ค่าที่ไม่ถูกต้อง: action ผิด, ประเภทคำขอผิด, ไม่พบคำขอ
    test('[High] TC-APR-008 bad action, bad request type and unknown id are refused', async () => {
      const l = await leave(e1);
      assert.equal((await decide(boss, 'leave', l.id, 'maybe')).status, 400);
      assert.equal((await api('PATCH', `/approvals/leave/${l.id}`, { token: tok[boss.id], body: {} })).status, 400);
      assert.equal((await decide(boss, 'overtime', l.id)).status, 400);
      assert.equal((await decide(boss, 'leave', 'leave-does-not-exist')).status, 404);
      assert.equal((await leaveRow(l.id)).status, LEVEL1);
    });

    // [High] สองคนกดพร้อมกัน: สำเร็จครั้งเดียว อีกครั้งได้ 409
    test('[High] TC-APR-009 two simultaneous decisions: exactly one wins, the other gets 409', async () => {
      const l = await leave(e1);
      const [a, b] = await Promise.all([decide(boss, 'leave', l.id, 'approved'), decide(superBoss, 'leave', l.id, 'rejected')]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    });
  });

  describe('time corrections', () => {
    // [Critical] Boss อนุมัติคำขอแก้เวลา -> เวลาในตาราง attendance ถูกแก้ตามที่ขอ
    test('[Critical] TC-APR-020 an approved correction rewrites the attendance record', async () => {
      const day = dayBefore(2);
      await h.sql(
        "INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color) VALUES ($1, $2, $3, '10:30 น.', NULL, '00:00:00 ชม.', 'สาย', '#EF4444')",
        [`att-c-${h.uid()}`, e1.id, day]
      );
      const c = await correction(e1, { dateIso: day, newCheckIn: '08:00', newCheckOut: '17:30' });
      assert.equal(c.status, LEVEL1);
      assert.equal((await decide(boss, 'time-correction', c.id)).status, 200);
      assert.equal((await corrRow(c.id)).status, 'อนุมัติแล้ว');
      const [att] = await h.sql('SELECT * FROM attendance WHERE employee_id = $1 AND date_iso = $2', [e1.id, day]);
      assert.equal(att.check_in, '08:00 น.');
      assert.equal(att.check_out, '17:30 น.');
      assert.equal(att.duration, '09:30:00 ชม.');
      assert.equal(att.status, 'ลงเวลาเข้า-ออกครบถ้วน');
    });

    // [Critical] ไม่อนุมัติ -> เวลาเดิมไม่ถูกแตะ
    test('[Critical] TC-APR-021 a rejected correction leaves the attendance record untouched', async () => {
      const day = dayBefore(3);
      await h.sql(
        "INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color) VALUES ($1, $2, $3, '10:30 น.', '18:00 น.', '07:30:00 ชม.', 'สาย', '#EF4444')",
        [`att-c-${h.uid()}`, e1.id, day]
      );
      const c = await correction(e1, { dateIso: day, newCheckIn: '08:00' });
      assert.equal((await decide(boss, 'time-correction', c.id, 'rejected', 'ไม่มีหลักฐาน')).status, 200);
      const [att] = await h.sql('SELECT * FROM attendance WHERE employee_id = $1 AND date_iso = $2', [e1.id, day]);
      assert.equal(att.check_in, '10:30 น.');
      assert.equal(att.status, 'สาย');
    });

    // [Critical] Boss แก้เวลาของตัวเอง: ไปที่ SuperBoss และอนุมัติเองไม่ได้
    test('[Critical] TC-APR-022 a Boss correction goes to the SuperBoss and the Boss cannot approve it', async () => {
      const c = await correction(boss);
      assert.equal(c.status, LEVEL2);
      assert.equal((await decide(boss, 'time-correction', c.id)).status, 403);
      assert.equal((await decide(superBoss, 'time-correction', c.id)).status, 200);
    });

    // [Critical] SuperBoss: คำขอแก้เวลาอนุมัติทันที (ไม่ต้องรอใคร) มี audit log และเวลาถูกแก้จริง
    test('[Critical] TC-APR-023 a SuperBoss correction is approved at once and audited; a leave still needs approval', async () => {
      const day = dayBefore(4);
      const r = await api('POST', '/attendance/corrections', { token: tok[superBoss.id], body: { dateIso: day, newCheckIn: '07:00', newCheckOut: '19:00', reason: 'superboss' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.correction.status, 'อนุมัติแล้ว');
      assert.equal((await corrRow(r.body.correction.id)).status, 'อนุมัติแล้ว');
      const [att] = await h.sql('SELECT check_in, check_out FROM attendance WHERE employee_id = $1 AND date_iso = $2', [superBoss.id, day]);
      assert.deepEqual([att.check_in, att.check_out], ['07:00 น.', '19:00 น.']);
      const audit = await h.sql("SELECT 1 FROM audit_logs WHERE action = 'APPROVE_REQUEST' AND resource_id = $1", [r.body.correction.id]);
      assert.equal(audit.length, 1);
      const l = await leave(superBoss);
      assert.match(l.status, /^รออนุมัติ/, 'ใบลาของ SuperBoss ยังต้องอนุมัติ');
    });

    // [High] ตรวจข้อมูลคำขอแก้เวลา: วันที่ในอนาคต / รูปแบบวัน / ไม่ระบุเวลา / รูปแบบเวลา
    test('[High] TC-APR-024 correction validation: future date, bad date, no time, bad time are all 400', async () => {
      const post = (body) => api('POST', '/attendance/corrections', { token: tok[e1.id], body });
      assert.equal((await post({ dateIso: '2099-01-01', newCheckIn: '08:00', reason: 'x' })).status, 400);
      assert.equal((await post({ dateIso: '01/02/2026', newCheckIn: '08:00', reason: 'x' })).status, 400);
      assert.equal((await post({ dateIso: dayBefore(1), reason: 'x' })).status, 400);
      assert.equal((await post({ dateIso: dayBefore(1), newCheckIn: '-', newCheckOut: '', reason: 'x' })).status, 400);
      assert.equal((await post({ dateIso: dayBefore(1), newCheckIn: 'eight', reason: 'x' })).status, 400);
    });
  });

  describe('history per account', () => {
    let hBoss, hSuper, hBoss2;
    before(async () => {
      // ล้างรายการเก่าในตารางคำขอ เพื่อให้นับประวัติของแต่ละบัญชีได้ตรง
      await h.sql('TRUNCATE leave_requests, time_corrections');
      const approved = await leave(e1);
      const rejected = await leave(e2);
      await decide(boss, 'leave', approved.id, 'approved', 'ok');
      await decide(boss, 'leave', rejected.id, 'rejected', 'ไม่ผ่าน');
      const bossLeave = await leave(boss);
      await decide(superBoss, 'leave', bossLeave.id, 'approved');
      const c = await correction(e1, { newCheckIn: '08:15', newCheckOut: '17:45' });
      await decide(boss, 'time-correction', c.id, 'approved');
      hBoss = (await api('GET', '/approvals/history', { token: tok[boss.id] })).body;
      hSuper = (await api('GET', '/approvals/history', { token: tok[superBoss.id] })).body;
      hBoss2 = (await api('GET', '/approvals/history', { token: tok[boss2.id] })).body;
    });

    // [Critical] ประวัติแยกตามบัญชี: แต่ละคนเห็นเฉพาะที่ตัวเองตัดสินใจ
    test('[Critical] TC-APR-030 each account sees only the requests it decided itself', async () => {
      assert.equal(hBoss.total, 3, 'Boss ตัดสิน 3 รายการ (ลา 2 + แก้เวลา 1)');
      assert.equal(hSuper.total, 1, 'SuperBoss ตัดสิน 1 รายการ (ใบลาของ Boss)');
      assert.equal(hBoss2.total, 0, 'Boss แผนกอื่นไม่ตัดสินอะไรเลย');
    });

    // [Critical] ผลที่แสดงตรงกับที่ตัดสินจริง (อนุมัติ / ไม่อนุมัติ) และเหตุผลที่ไม่อนุมัติ
    test('[Critical] TC-APR-031 history rows show the real outcome and the reject reason', async () => {
      const statuses = hBoss.history.map((x) => x.status).sort();
      assert.deepEqual(statuses, ['อนุมัติแล้ว', 'อนุมัติแล้ว', 'ไม่อนุมัติ']);
      const rej = hBoss.history.find((x) => x.status === 'ไม่อนุมัติ');
      assert.equal(rej.rejectReason, 'ไม่ผ่าน');
      assert.equal(hSuper.history[0].status, 'อนุมัติแล้ว');
    });

    // [High] ประวัติแก้เวลามีวันที่และเวลาเดิม/ใหม่
    test('[High] TC-APR-032 a correction row carries its date and the old / new times', async () => {
      const row = hBoss.history.find((x) => x.requestType === 'time-correction');
      assert.ok(row, JSON.stringify(hBoss.history));
      assert.equal(row.dateIso, dayBefore(1));
      assert.ok(JSON.stringify(row).includes('08:15'));
      assert.ok(JSON.stringify(row).includes('17:45'));
    });

    // [High] Employee ดูประวัติของคนอื่นไม่ได้ (เปิดหน้าอนุมัติไม่ได้)
    test('[High] TC-APR-033 an Employee cannot read any approval history', async () => {
      assert.equal((await api('GET', '/approvals/history', { token: tok[e1.id] })).status, 403);
      assert.equal((await api('GET', '/approvals/history')).status, 401);
    });
  });

  describe('audit trail', () => {
    // [High] ทุกการอนุมัติ/ไม่อนุมัติถูกบันทึกใน audit log พร้อมผู้ตัดสิน
    test('[High] TC-APR-040 approve and reject are written to the audit log with the approver', async () => {
      const a = await leave(e1);
      const b = await leave(e1);
      await decide(boss, 'leave', a.id, 'approved');
      await decide(boss, 'leave', b.id, 'rejected', 'no');
      await h.sleep(300); // audit log เขียนแบบไม่รอผลลัพธ์
      const rows = await h.sql("SELECT action, resource_id FROM audit_logs WHERE resource_id = ANY($1) ORDER BY action", [[a.id, b.id]]);
      assert.deepEqual(rows.map((r) => r.action).sort(), ['APPROVE_REQUEST', 'REJECT_REQUEST']);
    });
  });
});
