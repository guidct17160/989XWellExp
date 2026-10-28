// เทส E2E: ลงเวลาเข้า-ออกงาน (HomeScreen + PunchLocationModal) และการแสดงผลสถานะในปฏิทิน
// กฎจาก CLAUDE.md: ต้องส่ง locationId + พิกัด, server คำนวณระยะเอง (นอกรัศมีตอบ 403), ไม่มีปุ่มยืนยัน,
// ถ้าไม่มีสถานที่ใกล้เคียงต้องลงเวลาไม่ได้, SuperBoss ไม่ถูกนับว่าสาย/ทำงานไม่ครบเวลา
const { test, expect } = require('./pw');
const { USERS, LOCATIONS, setup, openApp, expectScreen, alertButton, text, todayIsoBkk } = require('./helpers');

// พิกัดอุปกรณ์จำลอง (ตรงกับ geolocation ใน playwright.config.js)
const POSITION = { latitude: 13.7563, longitude: 100.5018 };

const punchButton = (page) => page.getByTestId('home-checkin-checkout-btn');

/** แถวประวัติของวันนี้ที่ server จะคืนมา */
const todayRow = (over = {}) => ({
  id: 'att-today',
  dateIso: todayIsoBkk(),
  checkIn: '08:55 น.',
  checkOut: null,
  duration: '00:00:00 ชม.',
  status: 'ปกติ',
  ...over,
});

test.describe('ลงเวลาเข้างาน', () => {
  test('TC-APP-CLOCK-01 @critical เข้างาน: แสดงเฉพาะสถานที่ที่อยู่ในรัศมี และส่ง locationId + พิกัดไป server', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.employee,
      data: { locations: { required: true, locations: [LOCATIONS.near, LOCATIONS.far] } },
      routes: {
        'POST /attendance/clock-in': (ctx) => {
          ctx.data.history.unshift(todayRow());
          return { body: { success: true, attendance: {}, pointsAwarded: 0 } };
        },
      },
    });
    await openApp(page, '/main');
    await expectScreen(page, 'home');
    await expect(punchButton(page)).toContainText('เข้างาน');

    await punchButton(page).click();

    // แสดงเฉพาะที่อยู่ในรัศมี (สถานที่ไกลเกินรัศมีไม่ถูกแสดง) พร้อมระยะห่าง
    await expect(text(page, 'เลือกพื้นที่เข้างาน')).toBeVisible();
    await expect(page.getByTestId('punch-location-loc-hq')).toBeVisible();
    await expect(page.getByTestId('punch-location-loc-hq')).toContainText('สำนักงานใหญ่ (HQ)');
    await expect(page.getByTestId('punch-location-loc-hq')).toContainText('35 ม.');
    await expect(page.getByTestId('punch-location-loc-far')).toHaveCount(0);
    await expect(page.getByText('สาขาเชียงใหม่')).toHaveCount(0);

    // ตอนโหลดสถานที่ ต้องส่งพิกัดปัจจุบันไปให้ server คำนวณระยะ
    const loc = api.callsTo('GET', '/attendance/locations');
    expect(loc).toHaveLength(1);
    expect(Number(loc[0].query.latitude)).toBeCloseTo(POSITION.latitude, 4);
    expect(Number(loc[0].query.longitude)).toBeCloseTo(POSITION.longitude, 4);

    await page.getByTestId('punch-location-loc-hq').click();

    // ส่ง locationId + พิกัด + ชื่อสถานที่ (ครั้งเดียว)
    await expect(punchButton(page)).toContainText('ออกงาน');
    const punches = api.callsTo('POST', '/attendance/clock-in');
    expect(punches).toHaveLength(1);
    expect(punches[0].body).toEqual({
      latitude: POSITION.latitude,
      longitude: POSITION.longitude,
      locationId: 'loc-hq',
      locationName: 'สำนักงานใหญ่ (HQ)',
    });
    expect(punches[0].headers.authorization).toBe('Bearer e2e-access-token');
    await expect(page.getByTestId('home-checkin-time-text')).not.toHaveText('--:--');
  });

  test('TC-APP-CLOCK-02 @critical ไม่มีสถานที่ใกล้เคียง: แสดงข้อความเดียว ไม่มีปุ่มยืนยัน และไม่ส่งคำขอลงเวลา', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.employee,
      data: { locations: { required: true, locations: [LOCATIONS.far] } },
    });
    await openApp(page, '/main');
    await punchButton(page).click();

    await expect(text(page, 'ไม่มีสถานที่ใกล้เคียง ไม่สามารถลงเวลาได้')).toBeVisible();
    // ไม่มีรายการสถานที่ให้เลือก และไม่มีปุ่มยืนยัน/ลงเวลาใดๆ
    await expect(page.getByTestId('punch-location-loc-far')).toHaveCount(0);
    await expect(page.getByText('สาขาเชียงใหม่')).toHaveCount(0);
    await expect(page.getByText(/ยืนยัน/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /ยืนยัน|ลงเวลา/ })).toHaveCount(0);
    expect(api.callsTo('POST', '/attendance/clock-in')).toHaveLength(0);

    // ปิดหน้าเลือกสถานที่ได้ และสถานะยังเป็นยังไม่เข้างาน
    await page.getByTestId('punch-location-close').click();
    await expect(punchButton(page)).toContainText('เข้างาน');
  });

  test('TC-APP-CLOCK-03 @critical SuperBoss ก็ต้องอยู่ในพื้นที่เช่นกัน: ไม่มีสถานที่ใกล้เคียงก็ลงเวลาไม่ได้', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.superboss,
      data: { locations: { required: true, locations: [LOCATIONS.far] } },
    });
    await openApp(page, '/main');
    await punchButton(page).click();

    await expect(text(page, 'ไม่มีสถานที่ใกล้เคียง ไม่สามารถลงเวลาได้')).toBeVisible();
    await expect(page.getByText(/ยืนยัน/)).toHaveCount(0);
    expect(api.callsTo('POST', '/attendance/clock-in')).toHaveLength(0);
  });

  test('TC-APP-CLOCK-04 ไม่มีสถานที่ที่พนักงานใช้ได้ (รายการว่าง) แจ้งให้ติดต่อ HR', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { locations: { required: true, locations: [] } } });
    await openApp(page, '/main');
    await punchButton(page).click();
    await expect(text(page, 'ยังไม่มีสถานที่ทำงานที่คุณลงเวลาได้ กรุณาติดต่อ HR')).toBeVisible();
    await expect(page.getByText(/ยืนยัน/)).toHaveCount(0);
  });

  test('TC-APP-CLOCK-05 @critical แอดมินยังไม่ได้สร้างสถานที่เลย: ลงเวลาไม่ได้ ไม่มีปุ่มลองใหม่/ยืนยัน', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee, data: { locations: { required: false, locations: [] } } });
    await openApp(page, '/main');
    await punchButton(page).click();

    await expect(text(page, 'ยังไม่ได้กำหนดสถานที่ทำงาน ไม่สามารถลงเวลาได้ กรุณาติดต่อ HR')).toBeVisible();
    await expect(page.getByTestId('punch-location-retry')).toHaveCount(0);
    await expect(page.getByText(/ยืนยัน/)).toHaveCount(0);
    expect(api.callsTo('POST', '/attendance/clock-in')).toHaveLength(0);
  });

  test('TC-APP-CLOCK-06 @critical server ตอบ 403 นอกรัศมี: แสดงข้อความของ server และไม่บันทึกเวลาในเครื่อง', async ({ page }) => {
    const message = 'คุณอยู่นอกพื้นที่ "สำนักงานใหญ่ (HQ)" (ห่าง 350 ม. อนุญาตภายใน 200 ม.) กรุณาเดินทางไปยังสถานที่ก่อนลงเวลา';
    const api = await setup(page, {
      user: USERS.employee,
      data: { locations: { required: true, locations: [LOCATIONS.near] } },
      routes: { 'POST /attendance/clock-in': { status: 403, body: { success: false, message } } },
    });
    await openApp(page, '/main');
    await punchButton(page).click();
    await page.getByTestId('punch-location-loc-hq').click();

    await expect(text(page, 'บันทึกเวลาเข้างานไม่สำเร็จ')).toBeVisible();
    await expect(text(page, message)).toBeVisible();
    await alertButton(page, 'ตกลง').click();

    expect(api.callsTo('POST', '/attendance/clock-in')).toHaveLength(1);
    // ไม่บันทึกสิ่งที่ server ปฏิเสธ: ปุ่มยังเป็นเข้างาน และเวลาเข้างานยังว่าง
    await expect(punchButton(page)).toContainText('เข้างาน');
    await expect(page.getByTestId('home-checkin-time-text')).toHaveText('--:--');
  });

  test('TC-APP-CLOCK-07 @critical ไม่มีตำแหน่ง GPS: ไม่ใช้พิกัดปลอม แจ้งให้เปิด GPS และไม่เรียกโหลดสถานที่', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (ok, fail) => fail && fail({ code: 1, message: 'User denied Geolocation' });
    });
    const api = await setup(page, {
      user: USERS.employee,
      data: { locations: { required: true, locations: [LOCATIONS.near] } },
    });
    await openApp(page, '/main');
    await punchButton(page).click();

    await expect(text(page, 'ไม่พบตำแหน่งของคุณ กรุณาอนุญาตการเข้าถึงตำแหน่ง (GPS) แล้วลองใหม่อีกครั้ง')).toBeVisible();
    await expect(page.getByTestId('punch-location-retry')).toBeVisible();
    expect(api.callsTo('GET', '/attendance/locations')).toHaveLength(0);
    expect(api.callsTo('POST', '/attendance/clock-in')).toHaveLength(0);
  });
});

test.describe('ลงเวลาออกงาน', () => {
  const openClockedIn = async (page, routes = {}, user = USERS.employee) => {
    const api = await setup(page, {
      user,
      data: { history: [todayRow()], locations: { required: true, locations: [LOCATIONS.near, LOCATIONS.far] } },
      routes,
    });
    await openApp(page, '/main');
    await expectScreen(page, 'home');
    // server มีแถวเข้างานที่ยังไม่ออก -> ปุ่มต้องเป็น "ออกงาน"
    await expect(punchButton(page)).toContainText('ออกงาน');
    return api;
  };

  test('TC-APP-CLOCK-08 @critical ออกงาน: ส่ง locationId + พิกัด และแสดงแต้มที่ได้จากการเข้างานตรงเวลา+ทำงานครบ', async ({ page }) => {
    const api = await openClockedIn(page, {
      'POST /attendance/clock-out': (ctx) => {
        ctx.data.history[0] = todayRow({ checkOut: '17:30 น.', duration: '09:35:00 ชม.', status: 'ปกติ' });
        ctx.data.points = 50;
        return { body: { success: true, attendance: {}, pointsAwarded: 50 } };
      },
    });

    await punchButton(page).click();
    await expect(text(page, 'เลือกพื้นที่ออกงาน')).toBeVisible();
    await expect(page.getByTestId('punch-location-loc-far')).toHaveCount(0);
    await page.getByTestId('punch-location-loc-hq').click();

    await expect(page.getByText(/เข้างานตรงเวลาและทำงานครบเวลา/)).toBeVisible();
    await expect(text(page, 'คุณได้รับ 50 แต้ม')).toBeVisible();

    const outs = api.callsTo('POST', '/attendance/clock-out');
    expect(outs).toHaveLength(1);
    expect(outs[0].body).toEqual({
      latitude: POSITION.latitude,
      longitude: POSITION.longitude,
      locationId: 'loc-hq',
      locationName: 'สำนักงานใหญ่ (HQ)',
    });

    // แต้มใหม่ถูกดึงจาก server (ไม่บวกในเครื่องเอง)
    await alertButton(page, 'ตกลง').click();
    await expect.poll(() => api.callsTo('GET', '/points/history').length).toBeGreaterThan(1);
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('50');
    await expect(punchButton(page)).toContainText('เข้างาน');
  });

  test('TC-APP-CLOCK-09 ออกงานโดยไม่ได้แต้ม (สาย/ทำงานไม่ครบ): ไม่มีข้อความแต้ม', async ({ page }) => {
    const api = await openClockedIn(page, {
      'POST /attendance/clock-out': (ctx) => {
        ctx.data.history[0] = todayRow({ checkOut: '12:00 น.', duration: '03:05:00 ชม.' });
        return { body: { success: true, attendance: {}, pointsAwarded: 0 } };
      },
    });
    await punchButton(page).click();
    await page.getByTestId('punch-location-loc-hq').click();

    await expect(punchButton(page)).toContainText('เข้างาน');
    await expect(page.getByText(/แต้ม/).filter({ hasText: 'คุณได้รับ' })).toHaveCount(0);
    await expect(page.getByText(/เข้างานตรงเวลาและทำงานครบเวลา/)).toHaveCount(0);
    expect(api.callsTo('POST', '/attendance/clock-out')).toHaveLength(1);
  });

  test('TC-APP-CLOCK-10 @critical ออกงานนอกพื้นที่: แสดงข้อความของ server และยังเป็นสถานะกำลังทำงาน', async ({ page }) => {
    const message = 'คุณอยู่นอกพื้นที่ "สำนักงานใหญ่ (HQ)" (ห่าง 480 ม. อนุญาตภายใน 200 ม.) กรุณาเดินทางไปยังสถานที่ก่อนลงเวลา';
    await openClockedIn(page, { 'POST /attendance/clock-out': { status: 403, body: { success: false, message } } });
    await punchButton(page).click();
    await page.getByTestId('punch-location-loc-hq').click();

    await expect(text(page, 'บันทึกเวลาออกงานไม่สำเร็จ')).toBeVisible();
    await expect(text(page, message)).toBeVisible();
    await alertButton(page, 'ตกลง').click();
    await expect(punchButton(page)).toContainText('ออกงาน');
    await expect(page.getByTestId('home-checkout-time-text')).toHaveText('--:--');
  });
});

test.describe('สถานะในปฏิทิน (กฎเวลาทำงาน)', () => {
  // แถวที่ server บันทึกไว้: เข้า 10:30 ออก 12:00 รวม 1.5 ชม. (น้อยกว่า 9 ชม.)
  const shortDay = () => todayRow({ checkIn: '10:30 น.', checkOut: '12:00 น.', duration: '01:30:00 ชม.', status: 'ปกติ' });

  test('TC-APP-WORKRULE-01 @critical พนักงานทั่วไปที่ทำงานไม่ครบชั่วโมง ถูกแสดงเป็น "ทำงานไม่ครบเวลา"', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { history: [shortDay()] } });
    await openApp(page, '/main/time-attendance');
    await expectScreen(page, 'time-attendance');
    await expect(page.getByText(/ทำงานไม่ครบเวลา \(ออกก่อนกำหนด/).first()).toBeVisible();
    await expect(page.getByText('ลงเวลาเข้า-ออกครบถ้วน')).toHaveCount(0);
  });

  test('TC-APP-WORKRULE-02 @critical SuperBoss ไม่ถูกนับว่า "ทำงานไม่ครบเวลา" แม้เข้า 10:30 ออก 12:00', async ({ page }) => {
    await setup(page, { user: USERS.superboss, data: { history: [shortDay()] } });
    await openApp(page, '/main/time-attendance');
    await expectScreen(page, 'time-attendance');
    await expect(text(page, 'ลงเวลาเข้า-ออกครบถ้วน').first()).toBeVisible();
    await expect(page.getByText(/ทำงานไม่ครบเวลา/)).toHaveCount(0);
    await expect(page.getByText(/เข้างานสาย/)).toHaveCount(0);
  });

  test('TC-APP-WORKRULE-03 ใช้ชั่วโมงทำงานต่อวันตามที่ HR ตั้ง (8 ชม.) ไม่ใช่ค่า 9 ชม. ฮาร์ดโค้ด', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      data: {
        // HR ตั้งชั่วโมงทำงานเป็น 8 ชม. ทำงาน 8 ชม. 30 นาที = ครบ (ถ้าฮาร์ดโค้ด 9 ชม. จะกลายเป็นไม่ครบ)
        workRules: { workStartTime: '09:00', lateAfterTime: '10:00', requiredHours: 8, onTimePoints: 0 },
        history: [todayRow({ checkIn: '09:30 น.', checkOut: '18:00 น.', duration: '08:30:00 ชม.', status: 'ปกติ' })],
      },
    });
    await openApp(page, '/main/time-attendance');
    await expect(text(page, 'ลงเวลาเข้า-ออกครบถ้วน').first()).toBeVisible();
    await expect(page.getByText(/เข้างานสาย/)).toHaveCount(0);
  });

  // server ส่งสถานะเต็มข้อความ (อนุมัติแล้ว, รออนุมัติระดับ 1 (Boss) ...) ปฏิทินต้องจับด้วยคำขึ้นต้น ไม่ใช่เทียบตรงตัว
  test('TC-APP-WORKRULE-04 @critical ใบลาที่อนุมัติแล้วและรออนุมัติขึ้นสีส้มในปฏิทิน ส่วนไม่อนุมัติ/ยกเลิกไม่ขึ้น', async ({ page }) => {
    const today = todayIsoBkk();
    // วันที่ 1-5 ของเดือนนี้ ยกเว้นวันนี้ (วันที่เลือกอยู่เป็นสีม่วง)
    const [approved, waiting, rejected, cancelled] = [1, 2, 3, 4, 5].filter((n) => n !== Number(today.slice(8, 10)));
    const iso = (n) => `${today.slice(0, 8)}${String(n).padStart(2, '0')}`;
    const leave = (id, day, status) => ({ id, leaveType: 'ลาป่วย', startDate: iso(day), endDate: iso(day), totalDays: 1, status, reason: 'ไม่สบาย', approver: null, remark: null });
    await setup(page, {
      user: USERS.employee,
      data: {
        myLeaves: [
          leave('lv-ok', approved, 'อนุมัติแล้ว'),
          leave('lv-wait', waiting, 'รออนุมัติระดับ 1 (Boss)'),
          leave('lv-no', rejected, 'ไม่อนุมัติ'),
          leave('lv-cancel', cancelled, 'ยกเลิก'),
        ],
      },
    });
    await openApp(page, '/main/time-attendance');
    await expectScreen(page, 'time-attendance');

    const cell = (n) => page.getByTestId(`time-attendance-day-cell-${n}`);
    const ORANGE = 'rgb(245, 166, 35)';
    await expect(cell(approved)).toHaveCSS('background-color', ORANGE);
    await expect(cell(waiting)).toHaveCSS('background-color', ORANGE);
    await expect(cell(rejected)).not.toHaveCSS('background-color', ORANGE);
    await expect(cell(cancelled)).not.toHaveCSS('background-color', ORANGE);

    // กดวันที่ลา ต้องเห็นการ์ดรายละเอียดพร้อมสถานะ
    await cell(approved).click();
    await expect(text(page, 'อนุมัติแล้ว').first()).toBeVisible();
    await cell(waiting).click();
    await expect(text(page, 'รออนุมัติระดับ 1 (Boss)').first()).toBeVisible();
  });
});
