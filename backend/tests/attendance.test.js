// เทส API: ลงเวลาเข้า-ออกงาน, สถานที่ลงเวลา (Work Locations), กฎเวลาทำงาน, แต้มเข้างานตรงเวลา, ตัดเที่ยงคืน
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
//
// เคสที่ขึ้นกับเวลาปัจจุบัน (ไทย) ตั้งค่า workStart/lateAfter ให้ผลไม่ขึ้นกับเวลาที่รัน และข้ามเมื่อใกล้เที่ยงคืน/ตี 1
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

// ใกล้ Bangkok Centre; ห่างประมาณ 1.1 กม. ต่อ 0.01 องศา
const BASE = { latitude: 13.7563, longitude: 100.5018 };
const NEAR = { ...BASE };
const FAR = { latitude: 13.7763, longitude: 100.5018 }; // ~2.2 กม.

const RULES = { workStartTime: '00:00', lateAfterTime: '23:59', requiredHours: 9, onTimePoints: 0 };

describe('Attendance & work locations', () => {
  let server, api, adminToken, dept;

  const setRules = async (patch) => {
    const r = await api('PUT', '/settings/work-time', { token: adminToken, body: { ...RULES, ...patch } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  };
  const punchIn = (token, loc, extra = {}) => api('POST', '/attendance/clock-in', { token, body: { locationId: loc.id, ...NEAR, ...extra } });
  const punchOut = (token, loc, extra = {}) => api('POST', '/attendance/clock-out', { token, body: { locationId: loc.id, ...NEAR, ...extra } });
  const user = async (role = 'Employee', opts = {}) => {
    const u = await h.makeEmployee({ role, dept, ...opts });
    return { u, token: await h.loginApp(api, u) };
  };

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Attendance Dept');
    await setRules({});
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('work locations (geofence)', () => {
    // [Critical] ยังไม่มีสถานที่ลงเวลา -> ลงเวลาไม่ได้ (ไม่มีทางผ่านโดยไม่ต้องมีสถานที่)
    test('[Critical] TC-ATT-001 clock-in and clock-out are refused (403) while no work location exists', async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations');
      const { token } = await user();
      const bogus = { id: 'none' };
      assert.equal((await punchIn(token, bogus)).status, 403);
      assert.equal((await punchOut(token, bogus)).status, 403);
      const list = await api('GET', '/attendance/locations', { token });
      assert.equal(list.body.required, false);
      assert.deepEqual(list.body.locations, []);
    });

    // [Critical] ต้องส่ง locationId และพิกัด
    test('[Critical] TC-ATT-002 a punch without locationId or coordinates is a 400', async () => {
      const loc = await h.makeLocation(api, adminToken);
      const { token } = await user();
      assert.equal((await api('POST', '/attendance/clock-in', { token, body: { ...NEAR } })).status, 400);
      assert.equal((await api('POST', '/attendance/clock-in', { token, body: { locationId: loc.id } })).status, 400);
      assert.equal((await api('POST', '/attendance/clock-in', { token, body: { locationId: loc.id, latitude: null, longitude: null } })).status, 400);
    });

    // [Critical] นอกรัศมี 403 (server คำนวณระยะเอง) ในรัศมีผ่านและ server ใส่ชื่อสถานที่ที่ตรวจแล้ว ไม่เชื่อชื่อที่ client ส่งมา
    test('[Critical] TC-ATT-003 outside the radius is 403, inside is allowed and the verified location name is stored', async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      const loc = await h.makeLocation(api, adminToken, { name: 'HQ Tower', radiusM: 100 });
      const { u, token } = await user();
      const far = await punchIn(token, loc, { ...FAR, locationName: 'FAKE' });
      assert.equal(far.status, 403);
      assert.match(far.body.message, /นอกพื้นที่/);
      assert.equal((await h.sql('SELECT 1 FROM attendance WHERE employee_id = $1', [u.id])).length, 0, 'ปฏิเสธแล้วต้องไม่มีแถวเวลา');
      const ok = await punchIn(token, loc, { locationName: 'FAKE', distanceM: 0 });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const [row] = await h.sql('SELECT * FROM attendance WHERE employee_id = $1', [u.id]);
      assert.equal(row.location_name, 'HQ Tower');
      assert.equal(row.work_location_id, loc.id);
      assert.equal(Number(row.latitude), BASE.latitude);
    });

    // [High] สถานที่แบบเลือกแผนก/รายบุคคล: คนนอกกลุ่มลงเวลาไม่ได้ และไม่เห็นในรายการ
    test('[High] TC-ATT-004 department and member scoped locations are closed to everyone else', async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      const otherDept = await h.makeDept('Other Dept');
      const inDept = await user();
      const outsider = await h.makeEmployee({ dept: otherDept });
      const outsiderToken = await h.loginApp(api, outsider);
      const deptLoc = await h.makeLocation(api, adminToken, { name: 'Dept Only', scope: 'departments', departmentIds: [dept.id] });
      assert.equal((await punchIn(outsiderToken, deptLoc)).status, 403);
      assert.deepEqual((await api('GET', `/attendance/locations?latitude=${BASE.latitude}&longitude=${BASE.longitude}`, { token: outsiderToken })).body.locations, []);
      assert.equal((await punchIn(inDept.token, deptLoc)).status, 200);

      const member = await user();
      const memberLoc = await h.makeLocation(api, adminToken, { name: 'Members Only', scope: 'members', memberIds: [member.u.id] });
      const names = (r) => r.body.locations.map((l) => l.name);
      assert.ok(names(await api('GET', '/attendance/locations', { token: member.token })).includes('Members Only'));
      assert.ok(!names(await api('GET', '/attendance/locations', { token: outsiderToken })).includes('Members Only'));
      assert.equal((await punchIn(outsiderToken, memberLoc)).status, 403);
    });

    // [High] รายการสถานที่เรียงใกล้ไปไกล และบอกว่าอยู่ในรัศมีหรือไม่
    test('[High] TC-ATT-005 /attendance/locations is sorted by distance and flags inRange', async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      await h.makeLocation(api, adminToken, { name: 'Far Place', ...FAR, radiusM: 100 });
      await h.makeLocation(api, adminToken, { name: 'Near Place', ...NEAR, radiusM: 100 });
      const { token } = await user();
      const r = await api('GET', `/attendance/locations?latitude=${NEAR.latitude}&longitude=${NEAR.longitude}`, { token });
      assert.equal(r.body.required, true);
      assert.deepEqual(r.body.locations.map((l) => l.name), ['Near Place', 'Far Place']);
      assert.equal(r.body.locations[0].inRange, true);
      assert.equal(r.body.locations[1].inRange, false);
      assert.ok(r.body.locations[1].distanceM > 1000);
    });

    // [High] สถานที่ที่ปิด (Inactive) ใช้ลงเวลาไม่ได้
    test('[High] TC-ATT-006 an inactive location cannot be used', async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      const loc = await h.makeLocation(api, adminToken, { status: 'Inactive' });
      const { token } = await user();
      assert.equal((await punchIn(token, loc)).status, 403);
    });

    // [High] แอดมินสร้างสถานที่ด้วยค่าไม่ถูกต้อง -> 400
    test('[High] TC-ATT-007 invalid location data is rejected with 400', async () => {
      const bad = [
        { name: '' }, { latitude: 91 }, { longitude: 181 }, { latitude: '' }, { radiusM: 10 }, { radiusM: 6000 },
        { scope: 'departments', departmentIds: [] }, { scope: 'members', memberIds: [] },
      ];
      for (const patch of bad) {
        const r = await api('POST', '/work-locations', { token: adminToken, body: { name: 'X', latitude: 13.7, longitude: 100.5, radiusM: 100, ...patch } });
        assert.equal(r.status, 400, JSON.stringify(patch));
      }
    });
  });

  describe('clock-in / clock-out', () => {
    let loc;
    before(async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      loc = await h.makeLocation(api, adminToken, { name: 'Main Office', radiusM: 200 });
    });

    // [Critical] เข้างานซ้ำวันเดียวกันไม่ได้, ออกงานโดยไม่เข้างานไม่ได้, ออกงานซ้ำไม่ได้
    test('[Critical] TC-ATT-010 no double clock-in, no clock-out without clock-in, no double clock-out', async () => {
      const { token } = await user();
      assert.equal((await punchOut(token, loc)).status, 400);
      assert.equal((await punchIn(token, loc)).status, 200);
      const again = await punchIn(token, loc);
      assert.equal(again.status, 400);
      assert.match(again.body.message, /แล้ว/);
      assert.equal((await punchOut(token, loc)).status, 200);
      assert.equal((await punchOut(token, loc)).status, 400);
    });

    // [Critical] ออกงานเก็บ GPS ตอนออกงาน (คอลัมน์ check_out_*) แยกจากตอนเข้างาน
    test('[Critical] TC-ATT-011 clock-out stores its own GPS and the verified location name', async () => {
      const { u, token } = await user();
      await punchIn(token, loc);
      const out = await api('POST', '/attendance/clock-out', { token, body: { locationId: loc.id, latitude: 13.7564, longitude: 100.5019, locationName: 'FAKE' } });
      assert.equal(out.status, 200, JSON.stringify(out.body));
      const [row] = await h.sql('SELECT * FROM attendance WHERE employee_id = $1', [u.id]);
      assert.equal(Number(row.check_out_latitude), 13.7564);
      assert.equal(Number(row.check_out_longitude), 100.5019);
      assert.equal(row.check_out_location_name, 'Main Office');
      assert.equal(Number(row.latitude), BASE.latitude, 'พิกัดเข้างานต้องไม่ถูกทับ');
      assert.match(row.check_out, /น\.$/);
      assert.match(row.duration, /^\d\d:\d\d:\d\d ชม\.$/);
    });

    // [Critical] นอกรัศมีตอนออกงานก็ 403 และต้องไม่บันทึกเวลาออก
    test('[Critical] TC-ATT-012 clock-out outside the radius is refused and nothing is saved', async () => {
      const { u, token } = await user();
      await punchIn(token, loc);
      assert.equal((await punchOut(token, loc, FAR)).status, 403);
      const [row] = await h.sql('SELECT check_out FROM attendance WHERE employee_id = $1', [u.id]);
      assert.ok(!row.check_out);
    });

    // [High] ประวัติเวลาของตัวเองเท่านั้น และรายงาน HR มีฟิลด์ที่เว็บใช้ (role, ชื่อ-นามสกุล, GPS ออกงาน)
    test('[High] TC-ATT-013 history is per account and the HR report carries role, names and clock-out GPS', async () => {
      const a = await user();
      const b = await user();
      await punchIn(a.token, loc);
      await punchOut(a.token, loc);
      assert.equal((await api('GET', '/attendance/history', { token: a.token })).body.history.length, 1);
      assert.equal((await api('GET', '/attendance/history', { token: b.token })).body.history.length, 0);
      const today = (await api('GET', '/attendance/today', { token: a.token })).body.attendance;
      assert.ok(today && today.checkIn);
      const report = await api('GET', `/hr/reports/attendance?date=${h.todayBkk()}`, { token: adminToken });
      const row = report.body.report.find((r) => r.employeeId === a.u.id);
      assert.ok(row, 'แถวของพนักงานต้องอยู่ในรายงาน');
      assert.equal(row.role, 'Employee');
      assert.ok(row.firstName && row.lastName);
      assert.equal(row.checkOutLocationName, 'Main Office');
      assert.ok(Number(row.checkOutLatitude));
    });
  });

  describe('late, hours and on-time points', () => {
    let loc;
    before(async () => {
      await h.sql('TRUNCATE work_location_departments, work_location_members, work_locations CASCADE');
      loc = await h.makeLocation(api, adminToken, { radiusM: 200 });
    });
    after(async () => { await setRules({}); });

    // [Critical] เข้างานหลังเวลาสายเป็น 'สาย' แต่ SuperBoss ไม่เคยสาย (server ดู role จากข้อมูลพนักงาน)
    test('[Critical] TC-ATT-020 late check-in is saved as สาย but a SuperBoss is never late', async (t) => {
      if (h.bkkSeconds() < 30) return t.skip('ใกล้เที่ยงคืนมาก (เวลาสาย 00:00 ไม่แน่นอน)');
      await setRules({ workStartTime: '00:00', lateAfterTime: '00:00' });
      const emp = await user();
      const boss = await user('Boss');
      const sup = await user('SuperBoss');
      for (const x of [emp, boss, sup]) assert.equal((await punchIn(x.token, loc)).status, 200);
      const status = async (x) => (await h.sql('SELECT status, status_color FROM attendance WHERE employee_id = $1', [x.u.id]))[0];
      assert.equal((await status(emp)).status, 'สาย');
      assert.equal((await status(boss)).status, 'สาย');
      const s = await status(sup);
      assert.equal(s.status, 'ปกติ');
      assert.equal(s.status_color, '#10B981');
    });

    // [Critical] เข้างานก่อนเวลาสายเป็น 'ปกติ'
    test('[Critical] TC-ATT-021 check-in before the late time is ปกติ', async (t) => {
      if (h.bkkSeconds() > 86400 - 120) return t.skip('ใกล้เที่ยงคืนมาก');
      await setRules({ workStartTime: '00:00', lateAfterTime: '23:59' });
      const emp = await user();
      assert.equal((await punchIn(emp.token, loc)).status, 200);
      assert.equal((await h.sql('SELECT status FROM attendance WHERE employee_id = $1', [emp.u.id]))[0].status, 'ปกติ');
    });

    // ชั่วโมงทำงานนับจากเวลาเข้างานจนถึงตอนออกงาน (คนมาก่อนเวลาเริ่มงานนับจากเวลาเริ่มงาน)
    // จึงสร้างแถวเข้างานของวันนี้เวลา 00:00 ไว้ก่อน แล้วค่อยกดออกงานผ่าน API
    const seedCheckIn = async (emp, status = 'ปกติ') => {
      await h.sql(
        `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color, work_location_id)
         VALUES ($1, $2, $3, '00:00 น.', NULL, '00:00:00 ชม.', $4, '#10B981', $5)`,
        [`att-seed-${h.uid()}`, emp.id, h.todayBkk(), status, loc.id]
      );
    };
    const afterOne = (t) => (h.bkkSeconds() < 3700 || h.bkkSeconds() > 86400 - 120) && t.skip('ต้องรันหลัง 01:02 น. (ครบ 1 ชม. นับจาก 00:00)');

    // [Critical] ตรงเวลา + ทำงานครบชั่วโมง -> ได้แต้มครั้งเดียว เข้าบัญชีแต้มและประวัติ (หมวด Attendance)
    test('[Critical] TC-ATT-022 on time and full hours pays the points once, ledger and balance agree', async (t) => {
      if (afterOne(t)) return;
      await setRules({ workStartTime: '00:00', lateAfterTime: '23:59', requiredHours: 1, onTimePoints: 25 });
      const emp = await user('Employee', { points: 10 });
      await seedCheckIn(emp.u);
      const out = await punchOut(emp.token, loc);
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.equal(out.body.pointsAwarded, 25);
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [emp.u.id]))[0].points, 35);
      const tx = await h.sql("SELECT * FROM point_transactions WHERE employee_id = $1 AND category = 'Attendance'", [emp.u.id]);
      assert.equal(tx.length, 1);
      assert.equal(tx[0].points, 25);
      assert.equal(tx[0].type, 'earn');
      assert.equal((await punchOut(emp.token, loc)).status, 400, 'ออกงานซ้ำต้องไม่จ่ายแต้มซ้ำ');
      assert.equal((await h.sql('SELECT COUNT(*)::int n FROM point_transactions WHERE employee_id = $1', [emp.u.id]))[0].n, 1);
    });

    // [Critical] สาย / ทำงานไม่ครบ / ปิดแต้ม (0) -> ไม่ได้แต้ม และยอดแต้มไม่เปลี่ยน
    test('[Critical] TC-ATT-023 no points when late, when hours are short, or when points are switched off', async (t) => {
      if (afterOne(t)) return;
      const run = async ({ rules, status = 'ปกติ', viaApi = false }) => {
        await setRules(rules);
        const emp = await user();
        if (viaApi) await punchIn(emp.token, loc); else await seedCheckIn(emp.u, status);
        const out = await punchOut(emp.token, loc);
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [emp.u.id]))[0].points, 0);
        assert.equal((await h.sql('SELECT COUNT(*)::int n FROM point_transactions WHERE employee_id = $1', [emp.u.id]))[0].n, 0);
        return out.body.pointsAwarded;
      };
      const ON = { workStartTime: '00:00', lateAfterTime: '23:59', requiredHours: 1, onTimePoints: 25 };
      assert.equal(await run({ rules: ON, status: 'สาย' }), 0, 'เข้างานสาย');
      assert.equal(await run({ rules: ON, viaApi: true }), 0, 'ทำงานไม่ครบชั่วโมง (เข้างานเมื่อกี้)');
      assert.equal(await run({ rules: { ...ON, onTimePoints: 0 } }), 0, 'ปิดแต้ม');
    });
  });

  describe('work time settings', () => {
    // [Critical] แอดมินตั้งค่าได้และค่าถูกเก็บจริง พนักงานอ่านได้แต่แก้ไม่ได้
    test('[Critical] TC-ATT-030 an admin saves the rules, everyone reads them, employees cannot change them', async () => {
      const { token } = await user();
      const body = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 20 };
      assert.equal((await api('PUT', '/settings/work-time', { token: adminToken, body })).status, 200);
      const got = await api('GET', '/settings/work-time', { token });
      assert.equal(got.status, 200);
      assert.deepEqual(got.body.rules, body);
      assert.equal((await api('PUT', '/settings/work-time', { token, body: { ...body, onTimePoints: 99 } })).status, 403);
      assert.equal((await api('GET', '/settings/work-time', { token })).body.rules.onTimePoints, 20);
      await setRules({});
    });

    // [High] ค่าที่ไม่ถูกต้องถูกปฏิเสธ 400 และไม่ทับค่าเดิม
    test('[High] TC-ATT-031 invalid rules are rejected with 400 and the stored rules stay', async () => {
      const ok = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 5 };
      await api('PUT', '/settings/work-time', { token: adminToken, body: ok });
      const bad = [
        { workStartTime: '10:00' }, // เริ่มงานช้ากว่าเวลาสาย
        { requiredHours: 0 }, { requiredHours: 17 }, { requiredHours: 8.3 },
        { onTimePoints: -1 }, { onTimePoints: 1.5 }, { onTimePoints: 100001 },
        { workStartTime: '25:00' }, { lateAfterTime: 'abc' },
      ];
      for (const patch of bad) {
        const r = await api('PUT', '/settings/work-time', { token: adminToken, body: { ...ok, ...patch } });
        assert.equal(r.status, 400, JSON.stringify(patch));
      }
      assert.deepEqual((await api('GET', '/settings/work-time', { token: adminToken })).body.rules, ok);
      await setRules({});
    });
  });

  describe('midnight auto clock-out', () => {
    // [High] กะที่ลืมออกงานของวันก่อนถูกปิดที่ 23:59 และนับชั่วโมงจากเวลาเข้างาน ไม่ใช่สถานะแปลก
    test('[High] TC-ATT-040 a forgotten clock-out from an earlier day is closed at 23:59 with the worked time', async () => {
      const emp = await h.makeEmployee({ dept });
      await h.sql(
        `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color)
         VALUES ('att-stale-1', $1, '2020-01-02', '08:30 น.', NULL, '00:00:00 ชม.', 'ปกติ', '#10B981')`,
        [emp.id]
      );
      const second = await h.startServer(); // งานตัดเที่ยงคืนทำงานทันทีตอน backend เริ่ม
      try {
        let row;
        for (let i = 0; i < 40; i++) {
          [row] = await h.sql("SELECT check_out, duration, status FROM attendance WHERE id = 'att-stale-1'");
          if (row.check_out) break;
          await h.sleep(250);
        }
        assert.equal(row.check_out, '23:59 น.');
        assert.equal(row.duration, '15:29:00 ชม.');
        assert.equal(row.status, 'ปกติ', 'ไม่เปลี่ยนสถานะ ไม่มีสถานะ "ไม่ลงเวลาออกงาน"');
      } finally {
        await second.stop();
      }
    });
  });
});
