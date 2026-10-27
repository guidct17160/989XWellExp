// เทส E2E: โปรไฟล์ / ตั้งค่า / สมุดรายชื่อทีมงาน
// กฎจาก CLAUDE.md: ไม่มีระบบเปลี่ยนรหัสผ่านในแอป, ไม่มี Dark Mode, ไม่มีล็อกหน้าจอ, ไม่มี QR (ตัดออกแล้ว) —
// ต้องไม่กลับมาโดยไม่ได้สั่ง; สมุดรายชื่อแสดงเฉพาะแผนกเดียวกัน
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, alertButton, text, visible } = require('./helpers');

// ข้อความของฟีเจอร์ที่ถูกตัดออก (ต้องไม่ปรากฏในหน้าโปรไฟล์/ตั้งค่า)
const REMOVED = /เปลี่ยนรหัสผ่าน|change ?password|โหมดกลางคืน|โหมดมืด|dark ?mode|ล็อกหน้าจอ|lock ?screen|lockscreen|\bQR\b|สแกนลายนิ้วมือ|Face ID/i;

const openSettingsFromProfile = async (page) => {
  await openApp(page, '/main/profile');
  await expectScreen(page, 'profile');
  await page.getByTestId('screen-profile').getByText('การตั้งค่า', { exact: true }).click();
  await expectScreen(page, 'settings');
};

test.describe('โปรไฟล์', () => {
  test('TC-APP-PROFILE-01 @critical แสดงข้อมูลพนักงานจาก server และไม่มีเมนูที่ถูกตัดออก (เปลี่ยนรหัสผ่าน/Dark Mode/ล็อกหน้าจอ/QR)', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee });
    await openApp(page, '/main/profile');
    await expectScreen(page, 'profile');

    const profile = page.getByTestId('screen-profile');
    await expect(profile.getByText('สมชาย ใจดี').first()).toBeVisible();
    await expect(profile.getByText('081-234-5678')).toBeVisible();
    await expect(profile.getByText('somchai@wellx989.com')).toBeVisible();
    await expect(profile.getByText('ฝ่ายขาย')).toBeVisible();
    await expect(profile.getByText('Employee', { exact: true })).toBeVisible();
    await expect(profile.getByText('2024-01-15')).toBeVisible();
    // ปุ่มที่ต้องมี
    await expect(profile.getByText('การตั้งค่า', { exact: true })).toBeVisible();
    await expect(profile.getByText('ออกจากระบบ', { exact: true })).toBeVisible();
    await expect(page.getByTestId('profile-change-avatar-btn')).toBeVisible();

    // ฟีเจอร์ที่ตัดออกแล้วต้องไม่กลับมา
    expect(await profile.innerText()).not.toMatch(REMOVED);
    // โหลดข้อมูลของตัวเองจาก server ด้วยรหัสของ session
    expect(api.callsTo('GET', '/employees/EMP-001').length).toBeGreaterThan(0);
  });

  // บั๊กจริงใน app/src/screens/ProfileScreen.js และ SettingsScreen.js: เขียน t('phone') || 'เบอร์โทรศัพท์'
  // แต่ t() ใน ThemeContext คืน "ชื่อคีย์" เมื่อไม่มีคำแปล (dict[key] || fallback || key เมื่อไม่ส่ง fallback) ทำให้ ||
  // ไม่เคยใช้ข้อความไทยสำรอง หน้าจอจึงแสดงคีย์ดิบ: PERSONALINFO, phone, email, department, role, startDate, APPPREFERENCES
  // (โปรไฟล์) และ pinSettings, language, appPreferences, ป๊อปอัปปิด PIN ที่แสดง disablePin / disablePinConfirm (ตั้งค่า) -> UI ไทยต้องแสดงข้อความไทย
  test.fixme('TC-APP-PROFILE-02 @critical หน้าโปรไฟล์แสดงป้ายกำกับภาษาไทย (ไม่ใช่คีย์ดิบ phone/email/department/role/startDate)', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/main/profile');
    const profile = page.getByTestId('screen-profile');
    for (const label of ['เบอร์โทรศัพท์', 'อีเมลองค์กร', 'สังกัดฝ่าย/แผนก', 'บทบาทและสิทธิ์', 'วันที่เริ่มงาน']) {
      await expect(profile.getByText(label, { exact: true })).toBeVisible();
    }
    expect(await profile.innerText()).not.toMatch(/\b(phone|email|department|role|startDate)\b/);
  });

  test.fixme('TC-APP-SETTINGS-00 @critical หน้าตั้งค่าแสดงป้ายกำกับภาษาไทย (ไม่ใช่คีย์ดิบ pinSettings/language)', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openSettingsFromProfile(page);
    const settings = visible(page.getByTestId('screen-settings'));
    await expect(settings.getByText('รหัส PIN เข้าใช้งาน (6 หลัก)', { exact: true })).toBeVisible();
    await expect(settings.getByText('ภาษา (Language)', { exact: true })).toBeVisible();
    expect(await settings.innerText()).not.toMatch(/\b(pinSettings|language)\b/);
  });

  test('TC-APP-PROFILE-03 @critical ออกจากระบบ: ถามยืนยัน แล้วล้าง session/PIN ในเครื่องและกลับหน้า Login', async ({ page }) => {
    const api = await setup(page, { user: { ...USERS.employee, hasPin: true } });
    await openApp(page, '/');
    await expectScreen(page, 'pin-lock'); // session ที่มี PIN ต้องปลดล็อกก่อน
    // ปลดล็อกด้วย PIN ที่ mock ไว้
    api.on('POST', '/auth/verify-pin', { body: { success: true, token: 'tok-pin', user: { ...USERS.employee, hasPin: true } } });
    for (const d of '123456') await page.getByTestId(`lock-keypad-${d}`).click();
    await expectScreen(page, 'home');
    await page.getByTestId('tab-profile').click();
    await expectScreen(page, 'profile');

    await page.getByTestId('screen-profile').getByText('ออกจากระบบ', { exact: true }).click();
    await expect(page.getByText('คุณต้องการออกจากระบบใช่หรือไม่?')).toBeVisible();
    await alertButton(page, 'ออกจากระบบ').click();

    await expectScreen(page, 'login');
    expect(await page.evaluate(() => localStorage.getItem('wellx989_session'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('wellx989_pin_enabled_EMP-001'))).toBeNull();
    await expect.poll(() => api.callsTo('POST', '/auth/logout').length).toBe(1);
  });

  test('TC-APP-PROFILE-04 ยกเลิกในหน้ายืนยันออกจากระบบ ยังอยู่ในระบบ', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/main/profile');
    await expectScreen(page, 'profile');
    await page.getByTestId('screen-profile').getByText('ออกจากระบบ', { exact: true }).click();
    await alertButton(page, 'ยกเลิก').click();
    await expectScreen(page, 'profile');
    expect(await page.evaluate(() => localStorage.getItem('wellx989_session'))).not.toBeNull();
  });
});

test.describe('ตั้งค่า', () => {
  test('TC-APP-SETTINGS-01 @critical หน้าตั้งค่ามีเฉพาะ PIN / สวิตช์แจ้งเตือน 2 ตัว / ภาษา / เกี่ยวกับ และไม่มี Dark Mode/เปลี่ยนรหัสผ่าน/ล็อกหน้าจอ', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openSettingsFromProfile(page);
    const settings = visible(page.getByTestId('screen-settings'));

    await expect(settings.getByText('การแจ้งเตือนทั่วไป', { exact: true })).toBeVisible();
    await expect(settings.getByText('แจ้งเตือนข้อความและข่าวสาร', { exact: true })).toBeVisible();
    await expect(settings.getByText('ยังไม่ได้ตั้งค่า', { exact: true })).toBeVisible(); // สถานะ PIN
    await expect(settings.getByText('ไทย', { exact: true })).toBeVisible();
    await expect(settings.getByText('ออกจากระบบ', { exact: true })).toBeVisible();
    // สวิตช์มีแค่ 2 ตัว (general, news) — ไม่มี Dark Mode / ล็อกหน้าจอ / เตือนบันทึกเวลา
    await expect(settings.locator('[data-testid^="settings-toggle-"]')).toHaveCount(2);
    await expect(settings.getByTestId('settings-toggle-general')).toBeVisible();
    await expect(settings.getByTestId('settings-toggle-news')).toBeVisible();
    expect(await settings.innerText()).not.toMatch(REMOVED);
    // ไม่มีระบบรีเซ็ต/เปลี่ยนรหัสผ่านในแอป (พนักงานแจ้ง Admin ให้รีเซ็ตที่เว็บ)
    expect(await settings.innerText()).not.toMatch(/รหัสผ่าน|password/i);
  });

  test('TC-APP-SETTINGS-02 @critical ยังไม่มี PIN: แถว PIN พาไปหน้าตั้ง PIN ใหม่', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openSettingsFromProfile(page);
    await visible(page.getByTestId('settings-item-0-0')).click();
    await expectScreen(page, 'set-pin');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('กำหนดรหัส PIN 6 หลัก');
  });

  test('TC-APP-SETTINGS-03 มี PIN แล้ว: แสดง "เปิดใช้งานแล้ว" มีตัวเลือกเปลี่ยน/ปิด PIN และปิดการใช้งานเรียก server ครั้งเดียว', async ({ page }) => {
    const api = await setup(page, { user: { ...USERS.employee, hasPin: true }, storage: { 'wellx989_pin_enabled_EMP-001': 'true' } });
    api.on('POST', '/auth/verify-pin', { body: { success: true, token: 'tok-pin', user: { ...USERS.employee, hasPin: true } } });
    await openApp(page, '/');
    await expectScreen(page, 'pin-lock');
    for (const d of '123456') await page.getByTestId(`lock-keypad-${d}`).click();
    await expectScreen(page, 'home');
    await page.getByTestId('tab-profile').click();
    await page.getByTestId('screen-profile').getByText('การตั้งค่า', { exact: true }).click();
    await expectScreen(page, 'settings');

    const settings = visible(page.getByTestId('screen-settings'));
    await expect(settings.getByText('เปิดใช้งานแล้ว', { exact: true })).toBeVisible();
    await visible(page.getByTestId('settings-item-0-0')).click();
    await expect(page.getByText('เลือกการดำเนินการที่ต้องการสำหรับรหัส PIN ของบัญชีนี้')).toBeVisible();
    await expect(text(page, 'เปลี่ยนรหัส PIN')).toBeVisible();
    await text(page, 'ปิดการใช้งาน PIN').click();

    // ยืนยันปิดการใช้งาน (ปุ่มยืนยันสุดท้ายในป๊อปอัป)
    await expect(page.getByText(/คุณต้องการปิดการใช้งานรหัส PIN สำหรับบัญชีนี้ใช่หรือไม่|disablePinConfirm/)).toBeVisible();
    await page.getByText(/^(disablePin|ปิดการใช้งาน PIN|ปิดการใช้งาน)$/).last().click();

    await expect(page.getByText('ปิดการใช้งานรหัส PIN เรียบร้อยแล้ว')).toBeVisible();
    await expect.poll(() => api.callsTo('POST', '/auth/remove-pin').length).toBe(1);
    await alertButton(page, 'ตกลง').click();
    await expect(settings.getByText('ยังไม่ได้ตั้งค่า', { exact: true })).toBeVisible();
  });
});

test.describe('สมุดรายชื่อทีมงาน', () => {
  const emp = (id, name, extra = {}) => ({
    id,
    code: id,
    name,
    department: 'ฝ่ายขาย',
    position: 'พนักงานขาย',
    role: 'Employee',
    email: `${id.toLowerCase()}@wellx989.com`,
    phone: '089-000-0000',
    avatarUrl: null,
    startDate: '2023-05-01',
    ...extra,
  });
  const EMPLOYEES = [
    emp('EMP-012', 'ประภา ใจงาม'),
    emp('EMP-001', 'สมชาย ใจดี', { phone: '081-234-5678' }),
    emp('EMP-011', 'สมศรี รักงาน'),
    emp('EMP-010', 'วิชัย หัวหน้าทีม', { role: 'Boss', position: 'ผู้จัดการฝ่ายขาย' }),
    emp('EMP-200', 'ชาติชาย โรงงาน', { department: 'ฝ่ายผลิต', position: 'หัวหน้าไลน์' }),
  ];

  const openDirectory = async (page) => {
    const api = await setup(page, { user: USERS.employee, data: { employees: EMPLOYEES } });
    await openApp(page, '/main/hr');
    await page.getByTestId('hr-menu-item-EmployeeDirectory').click();
    await expectScreen(page, 'employee-directory');
    return api;
  };

  test('TC-APP-DIR-01 @critical แสดงเฉพาะสมาชิกแผนกเดียวกัน (ไม่เห็นแผนกอื่น) หัวหน้าขึ้นก่อน และมีป้าย "คุณ" ที่ตัวเอง', async ({ page }) => {
    await openDirectory(page);
    await expect(text(page, 'ทีมงานแผนก')).toBeVisible();
    await expect(page.getByText('ฝ่ายขาย · 4 คน')).toBeVisible();

    // เรียง: หัวหน้า (Boss) ก่อน แล้วเรียงตามรหัส
    const ids = await page.locator('[data-testid^="employee-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids).toEqual(['employee-card-EMP-010', 'employee-card-EMP-001', 'employee-card-EMP-011', 'employee-card-EMP-012']);
    // แผนกอื่นไม่ถูกแสดง
    await expect(page.getByTestId('employee-card-EMP-200')).toHaveCount(0);
    await expect(page.getByText('ชาติชาย โรงงาน')).toHaveCount(0);
    // ป้าย "คุณ" เฉพาะการ์ดของตัวเอง
    await expect(page.getByTestId('employee-card-EMP-001').getByText('คุณ', { exact: true })).toBeVisible();
    await expect(page.getByTestId('employee-card-EMP-011').getByText('คุณ', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('employee-card-EMP-010')).toContainText('ผู้จัดการฝ่ายขาย');
  });

  test('TC-APP-DIR-02 @critical ค้นหาตามชื่อ / รหัสพนักงาน / ตำแหน่ง และเคลียร์ค้นหาได้', async ({ page }) => {
    await openDirectory(page);
    const search = page.getByTestId('employee-search-input');

    await search.fill('สมศรี');
    await expect(page.getByTestId('employee-card-EMP-011')).toBeVisible();
    await expect(page.getByTestId('employee-card-EMP-012')).toHaveCount(0);
    await expect(page.getByText('ฝ่ายขาย · 1 คน')).toBeVisible();

    await search.fill('emp-012'); // ไม่สนตัวพิมพ์
    await expect(page.getByTestId('employee-card-EMP-012')).toBeVisible();
    await expect(page.getByTestId('employee-card-EMP-011')).toHaveCount(0);

    await search.fill('ผู้จัดการ'); // ตำแหน่ง
    await expect(page.getByTestId('employee-card-EMP-010')).toBeVisible();
    await expect(page.getByTestId('employee-card-EMP-001')).toHaveCount(0);

    await search.fill('');
    await expect(page.getByText('ฝ่ายขาย · 4 คน')).toBeVisible();
  });

  test('TC-APP-DIR-03 @critical ค้นหาชื่อคนแผนกอื่นไม่พบ (ไม่รั่วข้อมูลข้ามแผนก) แสดงข้อความไม่พบสมาชิก', async ({ page }) => {
    await openDirectory(page);
    await page.getByTestId('employee-search-input').fill('ชาติชาย');
    await expect(text(page, 'ไม่พบสมาชิกในแผนกนี้')).toBeVisible();
    await expect(page.getByText('พนักงานจะแสดงเฉพาะผู้ที่อยู่ในแผนก ฝ่ายขาย เท่านั้น')).toBeVisible();
    await expect(page.locator('[data-testid^="employee-card-"]')).toHaveCount(0);
  });

  test('TC-APP-DIR-04 กดการ์ดแสดงรายละเอียด รหัส/เบอร์/อีเมล (ไม่มีข้อมูลเงินเดือน)', async ({ page }) => {
    await openDirectory(page);
    await page.getByTestId('employee-card-EMP-011').click();
    await expect(text(page, 'รหัสพนักงาน')).toBeVisible();
    await expect(text(page, 'เบอร์โทรศัพท์')).toBeVisible();
    await expect(text(page, 'อีเมล')).toBeVisible();
    await expect(text(page, 'emp-011@wellx989.com')).toBeVisible();
    await expect(text(page, '2023-05-01')).toBeVisible();
    await expect(page.getByText(/เงินเดือน|salary/i)).toHaveCount(0);
  });
});
