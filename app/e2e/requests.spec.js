// เทส E2E: ใบลา (LeaveRequestScreen), ปรับปรุงเวลา (TimeCorrectionScreen), สถานะคำขอ (RequestStatusScreen)
// ข้อความไทยคัดลอกจากซอร์สของแต่ละหน้า
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, alertButton, text, todayIsoBkk, daysAgoIsoBkk } = require('./helpers');

const BALANCES = [
  { id: 'annual', policyId: 'pol-annual', label: 'ลาพักร้อน', fullName: 'ลาพักร้อน (Annual Leave)', categoryKey: 'annual', total: 10, used: 7, remaining: 3, color: '#F5A623', icon: 'umbrella-outline' },
  { id: 'sick', policyId: 'pol-sick', label: 'ลาป่วย', fullName: 'ลาป่วย', categoryKey: 'sick', total: 30, used: 0, remaining: 30, color: '#F5A623', icon: 'medical-outline' },
  { id: 'personal', policyId: 'pol-personal', label: 'ลากิจ', fullName: 'ลากิจ', categoryKey: 'personal', total: 6, used: 6, remaining: 0, color: '#F5A623', icon: 'briefcase-outline' },
];

const POLICIES = [
  { id: 'pol-annual', typeName: 'ลาพักร้อน', categoryKey: 'annual', defaultQuota: 10, requireAttachment: false, applicableGender: 'all', status: 'Active' },
  { id: 'pol-sick', typeName: 'ลาป่วย', categoryKey: 'sick', defaultQuota: 30, requireAttachment: true, applicableGender: 'all', status: 'Active' },
  { id: 'pol-personal', typeName: 'ลากิจ', categoryKey: 'personal', defaultQuota: 6, requireAttachment: false, applicableGender: 'all', status: 'Active' },
];

const leaveSetup = (page, routes = {}) =>
  setup(page, { user: USERS.employee, data: { balances: BALANCES, policies: POLICIES }, routes });

const openLeaveForm = async (page, typeId) => {
  await openApp(page, '/leave-request');
  await expectScreen(page, 'leave-request');
  await page.getByTestId(`leave-balance-card-${typeId}`).click();
  await expect(text(page, 'ส่งใบลา')).toBeVisible();
};

test.describe('ขอลา', () => {
  test('TC-APP-LEAVE-01 แสดงสิทธิ์การลาทุกประเภท และประเภทที่ใช้ครบสิทธิ์แล้วกดไม่ได้', async ({ page }) => {
    await leaveSetup(page);
    await openApp(page, '/leave-request');
    await expectScreen(page, 'leave-request');

    await expect(page.getByTestId('leave-balance-card-annual')).toContainText('ลาพักร้อน');
    await expect(page.getByTestId('leave-balance-card-annual')).toContainText('3 วัน');
    await expect(page.getByTestId('leave-balance-card-sick')).toContainText('30 วัน');
    await expect(page.getByTestId('leave-balance-card-personal')).toContainText('0 วัน');

    // ลากิจเหลือ 0 วัน: กดแล้วไม่เปิดฟอร์ม
    await page.getByTestId('leave-balance-card-personal').click({ force: true });
    await expect(text(page, 'ส่งใบลา')).toHaveCount(0);
  });

  test('TC-APP-LEAVE-02 @critical ส่งใบลา: ส่งประเภท/วันที่(เวลาไทย)/จำนวนวัน/เหตุผลไป server ครั้งเดียว แล้วปิดฟอร์ม', async ({ page }) => {
    const api = await leaveSetup(page);
    await openLeaveForm(page, 'annual');
    const today = todayIsoBkk();

    // ฟอร์มเริ่มด้วยวันนี้ (เวลาไทย) 1 วัน และแสดงสิทธิ์คงเหลือ
    await expect(page.getByText('คงเหลือ 3 วัน / สิทธิ์ทั้งหมด 10 วัน')).toBeVisible();
    await expect(text(page, today)).toHaveCount(2);
    await page.getByPlaceholder('ระบุเหตุผลในการลา...').fill('ไปธุระที่ต่างจังหวัด');
    await text(page, 'ส่งใบลา').click();

    await expect(text(page, 'ส่งใบลา')).toHaveCount(0);
    const posts = api.callsTo('POST', '/leaves');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({
      leaveType: 'ลาพักร้อน',
      startDate: today,
      endDate: today,
      totalDays: 1,
      reason: 'ไปธุระที่ต่างจังหวัด',
    });
    expect(posts[0].headers.authorization).toBe('Bearer e2e-access-token');
    // รายการและสิทธิ์ถูกโหลดใหม่จาก server หลังส่ง
    await expect.poll(() => api.callsTo('GET', '/leaves/balances').length).toBeGreaterThan(1);
  });

  test('TC-APP-LEAVE-03 @critical วันที่เริ่มต้นของใบลาใช้วัน "วันนี้" เวลาไทย แม้เวลา UTC ยังเป็นเมื่อวาน (00:00-06:59 น.)', async ({ page }) => {
    // 2026-10-26 18:30 UTC = 2026-10-27 01:30 เวลาไทย: toISOString() ธรรมดาจะได้ 2026-10-26 (ผิด)
    await page.clock.setFixedTime(new Date('2026-10-26T18:30:00Z'));
    const api = await leaveSetup(page);
    await openLeaveForm(page, 'annual');

    await expect(text(page, '2026-10-27')).toHaveCount(2);
    await expect(text(page, '2026-10-26')).toHaveCount(0);
    await text(page, 'ส่งใบลา').click();
    await expect(text(page, 'ส่งใบลา')).toHaveCount(0);
    const posts = api.callsTo('POST', '/leaves');
    expect(posts).toHaveLength(1);
    expect(posts[0].body.startDate).toBe('2026-10-27');
    expect(posts[0].body.endDate).toBe('2026-10-27');
  });

  test('TC-APP-LEAVE-04 จำนวนวันเลือกได้ไม่เกินสิทธิ์คงเหลือ และวันสิ้นสุดคำนวณให้อัตโนมัติ', async ({ page }) => {
    const api = await leaveSetup(page);
    await openLeaveForm(page, 'annual');

    await text(page, '1 วัน').last().click(); // เปิดรายการจำนวนวัน
    await expect(text(page, 'เลือกจำนวนวันลา')).toBeVisible();
    // เหลือ 3 วัน => เลือกได้ 1-3 วัน ไม่มี 4 วัน
    await expect(text(page, '2 วัน').last()).toBeVisible();
    await expect(text(page, '4 วัน')).toHaveCount(0);
    await text(page, '3 วัน').last().click();

    await text(page, 'ส่งใบลา').click();
    await expect(text(page, 'ส่งใบลา')).toHaveCount(0);
    const posts = api.callsTo('POST', '/leaves');
    expect(posts).toHaveLength(1);
    const start = new Date(`${todayIsoBkk()}T00:00:00Z`);
    const end = new Date(start.getTime() + 2 * 86400 * 1000).toISOString().slice(0, 10);
    expect(posts[0].body.totalDays).toBe(3);
    expect(posts[0].body.startDate).toBe(todayIsoBkk());
    expect(posts[0].body.endDate).toBe(end);
  });

  test('TC-APP-LEAVE-05 @critical ประเภทที่ตั้งให้ต้องแนบเอกสาร: ส่งโดยไม่แนบไม่ได้ และไม่เรียก server', async ({ page }) => {
    const api = await leaveSetup(page);
    await openLeaveForm(page, 'sick');

    await expect(text(page, 'เอกสารแนบ (จำเป็นต้องแนบ) *')).toBeVisible();
    await text(page, 'ส่งใบลา').click();

    await expect(text(page, 'ต้องแนบเอกสาร')).toBeVisible();
    await expect(page.getByText(/ประเภทการลา "ลาป่วย" ต้องแนบเอกสารประกอบการลา/)).toBeVisible();
    expect(api.callsTo('POST', '/leaves')).toHaveLength(0);
    await alertButton(page, 'ตกลง').click();
    await expect(text(page, 'ส่งใบลา')).toBeVisible(); // ฟอร์มยังเปิดอยู่
  });

  test('TC-APP-LEAVE-06 @critical แนบไฟล์ PDF: อัปโหลดขึ้น server ก่อน แล้วส่งใบลาพร้อม attachmentUrl', async ({ page }) => {
    const api = await leaveSetup(page);
    await openLeaveForm(page, 'sick');

    await text(page, 'อัปโหลดไฟล์').click();
    await expect(text(page, 'เลือกวิธีแนบไฟล์')).toBeVisible();
    const chooserPromise = page.waitForEvent('filechooser');
    await text(page, 'เลือกไฟล์ (PDF / Word / รูป)').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'medical-cert.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });

    await expect(text(page, 'medical-cert.pdf')).toBeVisible();
    const uploads = api.callsTo('POST', '/uploads/leave-attachment');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].body.fileName).toBe('medical-cert.pdf');
    expect(uploads[0].body.mimeType).toBe('application/pdf');
    expect(Buffer.from(uploads[0].body.dataBase64, 'base64').toString()).toBe('%PDF-1.4 test');

    await text(page, 'ส่งใบลา').click();
    await expect(text(page, 'ส่งใบลา')).toHaveCount(0);
    const posts = api.callsTo('POST', '/leaves');
    expect(posts).toHaveLength(1);
    expect(posts[0].body.leaveType).toBe('ลาป่วย');
    expect(posts[0].body.attachmentUrl).toBe('/uploads/leave/att-1');
  });

  test('TC-APP-LEAVE-07 server ปฏิเสธใบลา: แสดงข้อความของ server และฟอร์มยังเปิดอยู่', async ({ page }) => {
    const msg = 'ไม่อนุญาตให้ยื่นลาประเภท "ลาพักร้อน" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศหญิงเท่านั้น';
    const api = await leaveSetup(page, { 'POST /leaves': { status: 400, body: { success: false, message: msg } } });
    await openLeaveForm(page, 'annual');
    await text(page, 'ส่งใบลา').click();

    await expect(text(page, 'ข้อผิดพลาด')).toBeVisible();
    await expect(text(page, msg)).toBeVisible();
    expect(api.callsTo('POST', '/leaves')).toHaveLength(1);
    await alertButton(page, 'ตกลง').click();
    await expect(text(page, 'ส่งใบลา')).toBeVisible();
  });
});

test.describe('ปรับปรุงเวลา', () => {
  // วันที่ลืมกดออกงาน (ย้อนหลัง 3 วัน) = server มีแถวเข้างานที่ไม่มีเวลาออก
  const staleOpenRow = () => ({
    id: 'att-old',
    dateIso: daysAgoIsoBkk(3),
    checkIn: '08:00 น.',
    checkOut: null,
    duration: '00:00:00 ชม.',
    status: 'เข้างานไม่ครบ',
  });

  test('TC-APP-TCORR-01 @critical ต้องกรอกหมายเหตุ: ไม่กรอกส่งไม่ได้ กรอกแล้วส่งเวลาใหม่ไป server ครั้งเดียว', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee, data: { history: [staleOpenRow()] } });
    await openApp(page, '/main');
    await expectScreen(page, 'home');
    // รอให้ประวัติเวลาจาก server ถูกโหลดเข้าเครื่องก่อน (ผู้ใช้จริงเข้าหน้านี้จากหน้าหลัก)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('attendance_state_EMP-001') || '')).toContain('att-old');
    await page.getByTestId('home-menu-item-TimeCorrection').click();
    await expect(page.getByTestId('time-correction-issues-list')).toBeVisible();
    // รายการวันที่ต้องแก้ไข
    await expect(text(page, 'ปรับปรุง').first()).toBeVisible();
    await text(page, 'ปรับปรุง').first().click();
    await expect(text(page, 'ปรับปรุงเวลาทำงาน')).toBeVisible();

    // ไม่กรอกหมายเหตุ -> ส่งไม่ได้
    await text(page, 'ส่งคำขอ').click();
    await expect(text(page, 'ข้อผิดพลาด')).toBeVisible();
    await expect(text(page, 'กรุณาระบุหมายเหตุการขอปรับปรุงเวลา')).toBeVisible();
    expect(api.callsTo('POST', '/attendance/corrections')).toHaveLength(0);
    await alertButton(page, 'ตกลง').click();

    await page.getByPlaceholder('กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน...').fill('ลืมกดออกงาน');
    await text(page, 'ส่งคำขอ').click();

    await expect.poll(() => api.callsTo('POST', '/attendance/corrections').length).toBe(1);
    const posts = api.callsTo('POST', '/attendance/corrections');
    // (วันที่ของคำขอ dateIso ตรวจในเคส fixme TC-APP-TCORR-01b ด้านล่าง เพราะพบบั๊ก)
    expect(posts[0].body).toMatchObject({
      oldCheckIn: '-',
      newCheckIn: '08:00 น.',
      oldCheckOut: '-',
      newCheckOut: '17:00 น.',
      reason: 'ลืมกดออกงาน',
    });
    expect(posts[0].headers.authorization).toBe('Bearer e2e-access-token');
    // วันที่ส่งแล้วไม่ถูกเสนอให้แก้ซ้ำ
    await expect(text(page, 'ข้อมูลเวลาเข้าออกงานของเดือนนี้สมบูรณ์เรียบร้อย')).toBeVisible();
  });

  // บั๊กจริงใน app/src/services/leaveStorage.js (addTimeCorrectionRequest): regex ตรวจรูปแบบวันที่เขียนว่า
  //   /^d{4}-d{2}-d{2}/ (ขาดเครื่องหมาย backslash หน้า d ทุกตัว ต้องเป็น /^\d{4}-\d{2}-\d{2}/) จึงไม่เคยจับคู่ 'YYYY-MM-DD'
  // ผล: คำขอปรับปรุงเวลาที่เลือกจากรายการ "ยื่นปรับปรุงเวลา" (ส่ง dateIso แบบ ISO) ถูกส่งไป server ด้วยวันที่ "วันนี้"
  //   แทนวันที่เลือก (ทางลัดจากปฏิทินส่ง dd/mm/yyyy ซึ่งผ่านเพราะมี '/') regex ซ้ำใน pointsStorage.js (วันที่ในประวัติแต้มไม่แปลงเป็นวันไทย)
  test.fixme('TC-APP-TCORR-01b @critical คำขอปรับปรุงเวลาที่เลือกจากรายการต้องส่งวันที่ของวันที่เลือก (ไม่ใช่วันนี้)', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee, data: { history: [staleOpenRow()] } });
    await openApp(page, '/main');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('attendance_state_EMP-001') || '')).toContain('att-old');
    await page.getByTestId('home-menu-item-TimeCorrection').click();
    await text(page, 'ปรับปรุง').first().click();
    await page.getByPlaceholder('กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน...').fill('ลืมกดออกงาน');
    await text(page, 'ส่งคำขอ').click();
    await expect.poll(() => api.callsTo('POST', '/attendance/corrections').length).toBe(1);
    expect(api.callsTo('POST', '/attendance/corrections')[0].body.dateIso).toBe(daysAgoIsoBkk(3));
  });

  // พบจากการเขียนเทส: เปิด /time-correction ตรงๆ (รีเฟรชเว็บที่หน้านี้) ขณะที่ประวัติยังโหลดไม่เสร็จ
  // รายการ "วันที่ต้องแก้ไข" จะว่างค้าง เพราะ attendanceStorage แก้ globalState ในที่เดิมแล้วส่ง reference เดิมให้ setAttendance
  // (React ไม่ re-render) และหน้านี้ไม่มีตัวจับเวลาให้ re-render เอง จึงเห็นข้อมูลก็ต่อเมื่อเข้าหน้าหลังโหลดเสร็จแล้ว
  // ไม่กระทบแอปมือถือที่ผ่าน Splash/Home ก่อน แต่เกิดกับเว็บ/ลิงก์ลึก -> ปิดไว้เป็น fixme รอแก้ที่ app/src
  test.fixme('TC-APP-TCORR-00 เปิด /time-correction ตรงๆ แล้วต้องเห็นวันที่ลืมกดออกงานเมื่อประวัติโหลดเสร็จ', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { history: [staleOpenRow()] } });
    await openApp(page, '/time-correction');
    await expect(text(page, 'ปรับปรุง').first()).toBeVisible();
  });

  // วันนี้เข้า 09:30 ออก 17:30 (8 ชม. จากเวลาเริ่มนับ 08:00 ... ไม่ครบ 9 ชม.) ทางเข้าคือปุ่มในปฏิทิน
  const lateToday = () => ({
    id: 'att-late',
    dateIso: todayIsoBkk(),
    checkIn: '09:30 น.',
    checkOut: '17:30 น.',
    duration: '08:00:00 ชม.',
    status: 'สาย',
  });

  const openCorrectionFromCalendar = async (page, routes) => {
    const api = await setup(page, { user: USERS.employee, data: { history: [lateToday()] }, routes });
    await openApp(page, '/main/time-attendance');
    await expectScreen(page, 'time-attendance');
    await text(page, 'ขอปรับปรุงเวลาเข้างาน').click();
    await expect(text(page, 'ปรับปรุงเวลาทำงาน')).toBeVisible();
    return api;
  };

  test('TC-APP-TCORR-02 @critical เวลาทำงานรวมน้อยกว่าที่ HR กำหนด (9 ชม.) ส่งคำขอไม่ได้ และไม่เรียก server', async ({ page }) => {
    const api = await openCorrectionFromCalendar(page);
    await page.getByPlaceholder('กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน...').fill('รถติดหนัก');
    await text(page, 'ส่งคำขอ').click();

    await expect(text(page, 'เงื่อนไขไม่ถูกต้อง')).toBeVisible();
    await expect(
      page.getByText('เวลาทำงานรวมต้องไม่น้อยกว่า 9 ชั่วโมง (เริ่มนับจาก 08:00 น.) ปัจจุบันคำนวณได้เพียง 8 ชม. 0 นาที')
    ).toBeVisible();
    expect(api.callsTo('POST', '/attendance/corrections')).toHaveLength(0);
  });

  test('TC-APP-TCORR-03 @critical แก้เวลาเข้าเป็น 08:30 (ครบ 9 ชม.) แล้วส่งคำขอ: ส่งเวลาใหม่ + วันที่ ISO ไป server', async ({ page }) => {
    const api = await openCorrectionFromCalendar(page);
    // เปิดตัวเลือกเวลาเข้างาน เลือก 08 : 30
    await text(page, '09:30').filter({ visible: true }).first().click();
    await expect(text(page, '⏰ เลือกเวลาเข้างาน')).toBeVisible();
    await text(page, '08').filter({ visible: true }).first().click(); // คอลัมน์ชั่วโมง
    await text(page, '30').filter({ visible: true }).first().click(); // คอลัมน์นาที (ชั่วโมงมีแค่ 00-23)
    await text(page, 'ตกลง').click();

    await page.getByPlaceholder('กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน...').fill('รถติดหนัก');
    await text(page, 'ส่งคำขอ').click();

    await expect.poll(() => api.callsTo('POST', '/attendance/corrections').length).toBe(1);
    const posts = api.callsTo('POST', '/attendance/corrections');
    expect(posts[0].body).toEqual({
      dateIso: todayIsoBkk(),
      oldCheckIn: '-',
      newCheckIn: '08:30 น.',
      oldCheckOut: '-',
      newCheckOut: '17:30 น.',
      reason: 'รถติดหนัก',
    });
  });

  test('TC-APP-TCORR-04 server ปฏิเสธคำขอปรับปรุงเวลา: แสดงข้อความของ server', async ({ page }) => {
    const api = await openCorrectionFromCalendar(page, {
      'POST /attendance/corrections': { status: 400, body: { success: false, message: 'วันนี้มีคำขอปรับปรุงเวลารออนุมัติอยู่แล้ว' } },
    });
    await text(page, '09:30').filter({ visible: true }).first().click();
    await text(page, '08').filter({ visible: true }).first().click();
    await text(page, '30').filter({ visible: true }).first().click();
    await text(page, 'ตกลง').click();
    await page.getByPlaceholder('กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน...').fill('รถติดหนัก');
    await text(page, 'ส่งคำขอ').click();

    await expect(text(page, 'ส่งคำขอไม่สำเร็จ')).toBeVisible();
    await expect(text(page, 'วันนี้มีคำขอปรับปรุงเวลารออนุมัติอยู่แล้ว')).toBeVisible();
    expect(api.callsTo('POST', '/attendance/corrections')).toHaveLength(1);
  });
});

test.describe('สถานะคำขอ', () => {
  const today = () => todayIsoBkk();
  const seedRequests = () => ({
    myLeaves: [
      { id: 'lv-1', leaveType: 'ลาป่วย', startDate: today(), endDate: today(), totalDays: 1, status: 'รออนุมัติระดับ 1 (Boss)', reason: 'เป็นไข้', createdAt: today() },
      { id: 'lv-2', leaveType: 'ลากิจ', startDate: today(), endDate: today(), totalDays: 2, status: 'อนุมัติแล้ว', approver: 'วิชัย หัวหน้าทีม', remark: 'อนุมัติผ่านแอปพลิเคชัน', reason: 'ธุระส่วนตัว', createdAt: today() },
      { id: 'lv-3', leaveType: 'ลาพักร้อน', startDate: today(), endDate: today(), totalDays: 1, status: 'ไม่อนุมัติ', approver: 'วิชัย หัวหน้าทีม', remark: 'ช่วงนั้นมีงานเร่งด่วน', reason: 'พักผ่อน', createdAt: today() },
    ],
    myCorrections: [
      { id: 'tc-1', dateIso: today(), newCheckIn: '08:30 น.', newCheckOut: '17:30 น.', status: 'รออนุมัติระดับ 2 (Superboss)', reason: 'ลืมกดออกงาน', createdAt: today() },
    ],
  });

  test('TC-APP-REQSTAT-01 @critical แสดงใบลาและคำขอปรับปรุงเวลาพร้อมสถานะ ผู้อนุมัติ และหมายเหตุ', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: seedRequests() });
    await openApp(page, '/request-status');
    await expectScreen(page, 'request-status');

    const list = page.getByTestId('request-status-list');
    await expect(list.getByText('ลาป่วย')).toBeVisible();
    await expect(list.getByText('รออนุมัติระดับ 1 (Boss)')).toBeVisible();
    await expect(list.getByText('เหตุผล: เป็นไข้')).toBeVisible();
    await expect(list.getByText('ลากิจ')).toBeVisible();
    await expect(list.getByText('2 วัน')).toBeVisible();
    await expect(list.getByText('ผู้อนุมัติ: วิชัย หัวหน้าทีม').first()).toBeVisible();
    await expect(list.getByText('หมายเหตุ: ช่วงนั้นมีงานเร่งด่วน')).toBeVisible();
    // คำขอปรับปรุงเวลา
    await expect(list.getByText('ปรับปรุงเวลาเข้า-ออกงาน')).toBeVisible();
    await expect(list.getByText(/เวลาเข้า: 08:30 น\.\s+\|\s+เวลาออก: 17:30 น\./)).toBeVisible();
    await expect(list.getByText('เหตุผลการขอปรับปรุง: ลืมกดออกงาน')).toBeVisible();
    await expect(list.getByText('รออนุมัติระดับ 2 (Superboss)')).toBeVisible();
  });

  test('TC-APP-REQSTAT-02 @critical ตัวกรองสถานะ: รออนุมัติ / อนุมัติ / ไม่อนุมัติ แยกรายการถูกต้อง', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: seedRequests() });
    await openApp(page, '/request-status');
    await expectScreen(page, 'request-status');
    const list = page.getByTestId('request-status-list');
    await expect(list.getByText('ลาป่วย')).toBeVisible();

    await page.getByTestId('request-status-st-รออนุมัติ').click();
    await expect(list.getByText('ลาป่วย')).toBeVisible();
    await expect(list.getByText('ปรับปรุงเวลาเข้า-ออกงาน')).toBeVisible(); // รออนุมัติระดับ 2 ก็ยังรออยู่
    await expect(list.getByText('ลากิจ')).toHaveCount(0);
    await expect(list.getByText('ลาพักร้อน')).toHaveCount(0);

    await page.getByTestId('request-status-st-อนุมัติ').click();
    await expect(list.getByText('ลากิจ')).toBeVisible();
    await expect(list.getByText('ลาป่วย')).toHaveCount(0);
    await expect(list.getByText('ลาพักร้อน')).toHaveCount(0);

    await page.getByTestId('request-status-st-ไม่อนุมัติ').click();
    await expect(list.getByText('ลาพักร้อน')).toBeVisible();
    await expect(list.getByText('ลากิจ')).toHaveCount(0);

    await page.getByTestId('request-status-st-all').click();
    await expect(list.getByText('ลากิจ')).toBeVisible();
    await expect(list.getByText('ลาพักร้อน')).toBeVisible();
    await expect(list.getByText('ลาป่วย')).toBeVisible();
  });

  test('TC-APP-REQSTAT-03 เดือนอื่นที่ไม่มีคำขอ แสดงข้อความว่าง', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: seedRequests() });
    await openApp(page, '/request-status');
    await expect(page.getByTestId('request-status-list').getByText('ลาป่วย')).toBeVisible();
    await page.getByTestId('request-status-prev-month-btn').click();
    await expect(text(page, 'ไม่มีรายการคำขอในเดือนนี้')).toBeVisible();
    await page.getByTestId('request-status-next-month-btn').click();
    await expect(page.getByTestId('request-status-list').getByText('ลาป่วย')).toBeVisible();
  });

  test('TC-APP-REQSTAT-04 ไม่มีคำขอเลย แสดงข้อความว่าง', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/request-status');
    await expect(text(page, 'ไม่มีรายการคำขอในเดือนนี้')).toBeVisible();
  });
});
