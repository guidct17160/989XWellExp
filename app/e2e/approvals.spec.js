// เทส E2E: การอนุมัติ (ManagerApprovalScreen) และสิทธิ์การเปิดหน้า
// กฎจาก CLAUDE.md: อนุมัติครั้งเดียวจบ ไม่ส่งต่อ, Boss ตัดสินคำขอของ Employee ในแผนกเดียวกัน, Employee เปิดหน้าอนุมัติไม่ได้,
// ประวัติแยกตามบัญชี (server กรองจาก token — แอปต้องไม่ส่งตัวตนใน query), ข้อความผิดพลาดจาก server (403) ต้องแสดง
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, alertButton, text } = require('./helpers');

const LEAVE_REQ = {
  id: 'lv-101',
  requestType: 'leave',
  employeeName: 'สมศรี รักงาน',
  department: 'ฝ่ายขาย',
  leaveType: 'ลาป่วย',
  startDate: '2026-10-28',
  endDate: '2026-10-29',
  totalDays: 2,
  reason: 'เป็นไข้หวัดใหญ่',
  status: 'รออนุมัติระดับ 1 (Boss)',
};

const CORRECTION_REQ = {
  id: 'tc-201',
  requestType: 'time-correction',
  employeeName: 'สมหมาย ตั้งใจ',
  department: 'ฝ่ายขาย',
  dateIso: '2026-10-26',
  oldCheckIn: '09:20 น.',
  oldCheckOut: '-',
  newCheckIn: '08:30 น.',
  newCheckOut: '17:30 น.',
  reason: 'ลืมกดออกงาน',
  status: 'รออนุมัติระดับ 1 (Boss)',
};

const HISTORY = [
  {
    id: 'tc-150',
    requestType: 'time-correction',
    employeeName: 'สมหมาย ตั้งใจ',
    department: 'ฝ่ายขาย',
    dateIso: '2026-10-20',
    oldCheckIn: '09:20 น.',
    oldCheckOut: '-',
    newCheckIn: '08:30 น.',
    newCheckOut: '17:30 น.',
    reason: 'ลืมกดออกงาน',
    status: 'อนุมัติแล้ว',
    approverName: 'วิชัย หัวหน้าทีม',
    actionTime: '21 ต.ค. 2569 10:15 น.',
  },
  {
    id: 'lv-140',
    requestType: 'leave',
    employeeName: 'สมศรี รักงาน',
    department: 'ฝ่ายขาย',
    leaveType: 'ลากิจ',
    startDate: '2026-10-15',
    endDate: '2026-10-15',
    totalDays: 1,
    reason: 'ธุระส่วนตัว',
    status: 'ไม่อนุมัติ',
    rejectReason: 'ช่วงนั้นมีงานเร่งด่วน',
    approverName: 'วิชัย หัวหน้าทีม',
    actionTime: '14 ต.ค. 2569 16:40 น.',
  },
];

/** mock PATCH /approvals/:type/:id ที่ย้ายรายการออกจากรอดำเนินการ (เหมือน server จริง) */
const patchHandler = (ctx) => {
  const [, , type, id] = ctx.path.split('/'); // /approvals/:type/:id
  const idx = ctx.data.approvalsPending.findIndex((r) => r.id === id && r.requestType === type);
  if (idx >= 0) {
    const [done] = ctx.data.approvalsPending.splice(idx, 1);
    ctx.data.approvalsHistory.unshift({ ...done, status: ctx.body.action === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ' });
  }
  return { body: { success: true } };
};

const openBoss = async (page, extra = {}) => {
  const api = await setup(page, {
    user: USERS.boss,
    data: { approvalsPending: [{ ...LEAVE_REQ }, { ...CORRECTION_REQ }], approvalsHistory: [], ...extra.data },
    routes: { 'PATCH /approvals/leave/lv-101': patchHandler, 'PATCH /approvals/time-correction/tc-201': patchHandler, ...extra.routes },
  });
  await openApp(page, '/manager-approval');
  await expectScreen(page, 'manager-approval');
  return api;
};

test.describe('สิทธิ์การเข้าหน้าอนุมัติ', () => {
  test('TC-APP-APPR-01 @critical Employee ไม่เห็นเมนู "อนุมัติคำขอ" ใน HR แต่เห็น "สถานะคำขอ"', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/main/hr');
    await expectScreen(page, 'hr-dashboard');
    await expect(page.getByTestId('hr-menu-item-RequestStatus')).toBeVisible();
    await expect(page.getByTestId('hr-menu-item-LeaveRequest')).toBeVisible();
    await expect(page.getByTestId('hr-menu-item-ManagerApproval')).toHaveCount(0);
    await expect(text(page, 'อนุมัติคำขอ')).toHaveCount(0);
  });

  test('TC-APP-APPR-02 @critical Employee เปิดหน้าอนุมัติตรงๆ (ลิงก์) ไม่ได้ เห็นข้อความ "สำหรับผู้อนุมัติเท่านั้น"', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { approvalsPending: [{ ...LEAVE_REQ }] } });
    await openApp(page, '/manager-approval');
    await expectScreen(page, 'manager-approval');
    await expect(text(page, 'หน้านี้สำหรับผู้อนุมัติเท่านั้น')).toBeVisible();
    // ไม่มีปุ่มอนุมัติ/ไม่อนุมัติ และไม่แสดงรายการคำขอของคนอื่น
    await expect(text(page, 'อนุมัติคำขอ')).toHaveCount(0);
    await expect(page.getByText('สมศรี รักงาน')).toHaveCount(0);
    await expect(page.getByTestId('tab-approval-mode-pending')).toHaveCount(0);
  });

  test('TC-APP-APPR-03 @critical Boss เห็นเมนู "อนุมัติคำขอ" และกดเข้าหน้าอนุมัติได้', async ({ page }) => {
    await setup(page, { user: USERS.boss });
    await openApp(page, '/main/hr');
    await page.getByTestId('hr-menu-item-ManagerApproval').click();
    await expectScreen(page, 'manager-approval');
    await expect(page.getByTestId('tab-approval-mode-pending')).toBeVisible();
  });
});

test.describe('รายการรออนุมัติของ Boss', () => {
  test('TC-APP-APPR-04 @critical แสดงคำขอลา + คำขอปรับปรุงเวลา (เวลาเดิม → ขอปรับเป็น) และกรองตามแท็บได้', async ({ page }) => {
    const api = await openBoss(page);

    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
    await expect(page.getByText('สมหมาย ตั้งใจ')).toBeVisible();
    await expect(page.getByText('2026-10-28 – 2026-10-29')).toBeVisible();
    await expect(page.getByText('2 วัน')).toBeVisible();
    await expect(page.getByText('เป็นไข้หวัดใหญ่')).toBeVisible();
    // คำขอปรับปรุงเวลา: เวลาเดิม -> เวลาที่ขอ
    await expect(text(page, 'เวลาเดิม')).toBeVisible();
    await expect(text(page, '09:20 น. - --:--')).toBeVisible();
    await expect(text(page, 'ขอปรับเป็น')).toBeVisible();
    await expect(text(page, '08:30 น. - 17:30 น.')).toBeVisible();

    // ตัวตนผู้ขอ/ผู้ใช้มาจาก token (header) ไม่ใช่ query
    const pending = api.callsTo('GET', '/approvals/pending');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].query).toEqual({});
    expect(pending[0].headers.authorization).toBe('Bearer e2e-access-token');

    // กรองตามประเภท
    await text(page, 'ขอลางาน').click();
    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
    await expect(page.getByText('สมหมาย ตั้งใจ')).toHaveCount(0);
    await text(page, 'ปรับปรุงเวลา').first().click();
    await expect(page.getByText('สมหมาย ตั้งใจ')).toBeVisible();
    await expect(page.getByText('สมศรี รักงาน')).toHaveCount(0);
  });

  test('TC-APP-APPR-05 ไม่มีคำขอรออนุมัติ แสดงข้อความว่าง', async ({ page }) => {
    await openBoss(page, { data: { approvalsPending: [] } });
    await expect(text(page, 'ไม่มีรายการรออนุมัติ')).toBeVisible();
  });

  test('TC-APP-APPR-06 @critical อนุมัติ: ถามยืนยันก่อน แล้วส่ง PATCH ครั้งเดียว (อนุมัติจบในขั้นเดียว) และรายการหายไป', async ({ page }) => {
    const api = await openBoss(page);

    await text(page, 'อนุมัติคำขอ').first().click();
    await expect(text(page, 'ยืนยันการอนุมัติ')).toBeVisible();
    await expect(page.getByText('คุณต้องการอนุมัติคำขอของ "สมศรี รักงาน" ใช่หรือไม่?')).toBeVisible();
    // ยังไม่ส่งอะไรไป server จนกว่าจะกดยืนยัน
    expect(api.callsTo('PATCH', /^\/approvals\//)).toHaveLength(0);

    await alertButton(page, 'อนุมัติ').click();
    await expect(text(page, 'อนุมัติสำเร็จ')).toBeVisible();
    await alertButton(page, 'ตกลง').click();

    const patches = api.callsTo('PATCH', /^\/approvals\//);
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toBe('/approvals/leave/lv-101');
    expect(patches[0].body.action).toBe('approved');
    expect(patches[0].headers.authorization).toBe('Bearer e2e-access-token');

    // โหลดรายการใหม่ -> คำขอที่อนุมัติแล้วไม่อยู่ในรออนุมัติ และคำขออีกใบยังอยู่
    await expect(page.getByText('สมศรี รักงาน')).toHaveCount(0);
    await expect(page.getByText('สมหมาย ตั้งใจ')).toBeVisible();
  });

  test('TC-APP-APPR-07 @critical ยกเลิกในหน้ายืนยัน ไม่ส่งคำขออนุมัติไป server', async ({ page }) => {
    const api = await openBoss(page);
    await text(page, 'อนุมัติคำขอ').first().click();
    await expect(text(page, 'ยืนยันการอนุมัติ')).toBeVisible();
    await alertButton(page, 'ยกเลิก').click();
    await expect(text(page, 'ยืนยันการอนุมัติ')).toHaveCount(0);
    expect(api.callsTo('PATCH', /^\/approvals\//)).toHaveLength(0);
    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
  });

  test('TC-APP-APPR-08 @critical ไม่อนุมัติ: เปิดหน้าต่างเหตุผล กรอกแล้วส่ง PATCH ครั้งเดียวพร้อมเหตุผล', async ({ page }) => {
    const api = await openBoss(page);

    await text(page, 'ไม่อนุมัติ').first().click();
    await expect(text(page, 'ไม่อนุมัติคำขอนี้')).toBeVisible();
    await expect(text(page, 'ระบุเหตุผลเพื่อแจ้งให้ผู้ยื่นคำขอทราบ')).toBeVisible();
    await expect(page.getByPlaceholder('เช่น ช่วงนั้นมีงานเร่งด่วน กรุณาเลือกวันอื่น')).toBeVisible();

    await page.getByPlaceholder('เช่น ช่วงนั้นมีงานเร่งด่วน กรุณาเลือกวันอื่น').fill('ช่วงนั้นมีงานเร่งด่วน');
    await expect(text(page, '21/300')).toBeVisible();
    await text(page, 'ยืนยันไม่อนุมัติ').click();

    await expect(text(page, 'ปฏิเสธคำขอสำเร็จ')).toBeVisible();
    const patches = api.callsTo('PATCH', /^\/approvals\//);
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toBe('/approvals/leave/lv-101');
    expect(patches[0].body.action).toBe('rejected');
    expect(patches[0].body.remark).toBe('ช่วงนั้นมีงานเร่งด่วน');
  });

  test('TC-APP-APPR-09 ไม่อนุมัติโดยไม่กรอกเหตุผล (ไม่บังคับ) ส่งเหตุผลเริ่มต้น "ไม่อนุมัติคำขอ"', async ({ page }) => {
    const api = await openBoss(page);
    await text(page, 'ไม่อนุมัติ').first().click();
    await text(page, 'ยืนยันไม่อนุมัติ').click();
    await expect(text(page, 'ปฏิเสธคำขอสำเร็จ')).toBeVisible();
    const patches = api.callsTo('PATCH', /^\/approvals\//);
    expect(patches).toHaveLength(1);
    expect(patches[0].body.remark).toBe('ไม่อนุมัติคำขอ');
  });

  test('TC-APP-APPR-10 ปิดหน้าต่างเหตุผล (ยกเลิก) ไม่ส่งอะไรไป server', async ({ page }) => {
    const api = await openBoss(page);
    await text(page, 'ไม่อนุมัติ').first().click();
    await expect(text(page, 'ไม่อนุมัติคำขอนี้')).toBeVisible();
    await text(page, 'ยกเลิก').click();
    await expect(text(page, 'ไม่อนุมัติคำขอนี้')).toHaveCount(0);
    expect(api.callsTo('PATCH', /^\/approvals\//)).toHaveLength(0);
  });

  test('TC-APP-APPR-11 @critical Boss อนุมัติคำขอของตัวเอง/คนละแผนก: server ตอบ 403 แอปแสดงข้อความของ server และรายการไม่หาย', async ({ page }) => {
    const msg = 'คุณสามารถอนุมัติได้เฉพาะคำขอของพนักงานในแผนกเดียวกันเท่านั้น';
    const api = await openBoss(page, {
      routes: { 'PATCH /approvals/leave/lv-101': { status: 403, body: { success: false, message: msg } } },
    });
    await text(page, 'อนุมัติคำขอ').first().click();
    await alertButton(page, 'อนุมัติ').click();

    await expect(text(page, 'เกิดข้อผิดพลาด')).toBeVisible();
    await expect(text(page, msg)).toBeVisible();
    await alertButton(page, 'ตกลง').click();
    expect(api.callsTo('PATCH', /^\/approvals\//)).toHaveLength(1);
    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
    await expect(text(page, 'อนุมัติสำเร็จ')).toHaveCount(0);
  });

  test('TC-APP-APPR-12 @critical ไม่อนุมัติคำขอของตัวเอง: server ตอบ 403 แอปแสดงข้อความของ server', async ({ page }) => {
    const msg = 'ไม่สามารถอนุมัติ/ปฏิเสธคำขอของตนเองได้';
    await openBoss(page, { routes: { 'PATCH /approvals/leave/lv-101': { status: 403, body: { success: false, message: msg } } } });
    await text(page, 'ไม่อนุมัติ').first().click();
    await text(page, 'ยืนยันไม่อนุมัติ').click();
    await expect(text(page, 'เกิดข้อผิดพลาด')).toBeVisible();
    await expect(text(page, msg)).toBeVisible();
  });
});

test.describe('ประวัติการอนุมัติ', () => {
  test('TC-APP-APPR-13 @critical ประวัติแสดงเฉพาะที่ server ส่งมา (ระบุบัญชีจาก token) พร้อมเวลาเดิม/ใหม่ ผู้อนุมัติ และเหตุผลที่ไม่อนุมัติ', async ({ page }) => {
    const api = await openBoss(page, { data: { approvalsHistory: HISTORY } });
    await page.getByTestId('tab-approval-mode-history').click();

    // ใบที่ 1: ปรับปรุงเวลา (อนุมัติแล้ว) เห็นเวลาเก่า-ใหม่
    await expect(page.getByText('สมหมาย ตั้งใจ')).toBeVisible();
    await expect(text(page, '09:20 น. - --:--')).toBeVisible();
    await expect(text(page, '08:30 น. - 17:30 น.')).toBeVisible();
    await expect(text(page, 'อนุมัติแล้ว')).toBeVisible();
    await expect(page.getByText('ผู้อนุมัติ: วิชัย หัวหน้าทีม').first()).toBeVisible();
    await expect(text(page, '21 ต.ค. 2569 10:15 น.')).toBeVisible();

    // ใบที่ 2: ลา (ไม่อนุมัติ) เห็นเหตุผล
    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
    await expect(text(page, 'ไม่อนุมัติ').first()).toBeVisible();
    await expect(text(page, 'เหตุผลการไม่อนุมัติ')).toBeVisible();
    await expect(text(page, 'ช่วงนั้นมีงานเร่งด่วน')).toBeVisible();

    // ไม่ส่งรหัสพนักงานใน query: server แยกประวัติตามบัญชีจาก token เอง
    const calls = api.callsTo('GET', '/approvals/history');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.query).toEqual({});
      expect(c.headers.authorization).toBe('Bearer e2e-access-token');
    }
  });

  test('TC-APP-APPR-14 ไม่มีประวัติ แสดงข้อความว่าง', async ({ page }) => {
    await openBoss(page, { data: { approvalsHistory: [] } });
    await page.getByTestId('tab-approval-mode-history').click();
    await expect(text(page, 'ไม่มีประวัติการอนุมัติ')).toBeVisible();
  });

  test('TC-APP-APPR-15 อนุมัติแล้วรายการย้ายไปอยู่ในแท็บประวัติ', async ({ page }) => {
    await openBoss(page);
    await text(page, 'อนุมัติคำขอ').first().click();
    await alertButton(page, 'อนุมัติ').click();
    await alertButton(page, 'ตกลง').click();
    await expect(page.getByText('สมศรี รักงาน')).toHaveCount(0);

    await page.getByTestId('tab-approval-mode-history').click();
    await expect(page.getByText('สมศรี รักงาน')).toBeVisible();
    await expect(text(page, 'อนุมัติแล้ว')).toBeVisible();
  });
});

test.describe('SuperBoss (ตัดสินขั้นสุดท้าย)', () => {
  test('TC-APP-APPR-16 SuperBoss เห็นป้าย Boss ที่คำขอของหัวหน้า และอนุมัติได้ในขั้นเดียว', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.superboss,
      data: {
        approvalsPending: [
          {
            ...LEAVE_REQ,
            id: 'lv-300',
            employeeName: 'วิชัย หัวหน้าทีม',
            requesterRole: 'Boss',
            status: 'รออนุมัติระดับ 2 (Superboss)',
          },
        ],
      },
      routes: { 'PATCH /approvals/leave/lv-300': patchHandler },
    });
    await openApp(page, '/manager-approval');
    await expectScreen(page, 'manager-approval');
    await expect(page.getByText('วิชัย หัวหน้าทีม')).toBeVisible();
    await expect(text(page, 'Boss')).toBeVisible();

    await text(page, 'อนุมัติคำขอ').first().click();
    await alertButton(page, 'อนุมัติ').click();
    await expect(text(page, 'อนุมัติสำเร็จ')).toBeVisible();
    const patches = api.callsTo('PATCH', /^\/approvals\//);
    expect(patches).toHaveLength(1);
    expect(patches[0].body.action).toBe('approved');
    expect(patches[0].body.approverRole).toBe('SuperBoss');
  });
});
