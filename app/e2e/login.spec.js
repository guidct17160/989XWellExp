// เทส E2E: เข้าสู่ระบบ, ตั้ง/ปลดล็อก PIN, การกู้ session
// ข้อความภาษาไทยทั้งหมดคัดลอกจาก app/src/screens/LoginScreen.js, SetPinScreen.js, PinLockScreen.js
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, alertButton, text, pressPin } = require('./helpers');

const fillLogin = async (page, username, password) => {
  await page.getByTestId('login-employee-id-input').fill(username);
  await page.getByTestId('login-password-input').fill(password);
};

test.describe('Login', () => {
  test('TC-APP-LOGIN-01 @critical เข้าสู่ระบบสำเร็จ ส่ง username/password/portal=app แล้วให้ตั้ง PIN', async ({ page }) => {
    const api = await setup(page, {
      routes: {
        'POST /auth/login': { body: { success: true, token: 'tok-1', refreshToken: 'ref-1', user: { ...USERS.employee, hasPin: false } } },
      },
    });
    await openApp(page, '/login');
    await expectScreen(page, 'login');

    await fillLogin(page, '  somchai  ', 'Pass#1234');
    await page.getByTestId('login-submit-btn').click();

    // ระบบต้องส่ง portal=app และตัดช่องว่างหน้า-หลังของชื่อผู้ใช้
    await expect(text(page, 'เข้าสู่ระบบสำเร็จ')).toBeVisible();
    const logins = api.callsTo('POST', '/auth/login');
    expect(logins).toHaveLength(1);
    expect(logins[0].body).toEqual({ username: 'somchai', password: 'Pass#1234', portal: 'app' });
    await expect(page.getByText(/ยินดีต้อนรับคุณ สมชาย ใจดี/)).toBeVisible();

    // ยังไม่มี PIN -> พาไปหน้าตั้ง PIN
    await alertButton(page, 'ตั้งรหัส PIN ทันที').click();
    await expectScreen(page, 'set-pin');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('กำหนดรหัส PIN 6 หลัก');

    // session ถูกเก็บไว้ในเครื่องพร้อม token
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('wellx989_session')));
    expect(session.loggedIn).toBe(true);
    expect(session.token).toBe('tok-1');
    expect(session.user.id).toBe('EMP-001');
  });

  test('TC-APP-LOGIN-02 @critical บัญชีที่มี PIN แล้ว เข้าสู่ระบบแล้วเข้าหน้าหลักทันที ไม่ต้องตั้ง PIN ซ้ำ', async ({ page }) => {
    await setup(page, {
      routes: {
        'POST /auth/login': { body: { success: true, token: 'tok-2', user: { ...USERS.employee, hasPin: true } } },
      },
    });
    await openApp(page, '/login');
    await fillLogin(page, 'somchai', 'Pass#1234');
    await page.getByTestId('login-submit-btn').click();

    await expectScreen(page, 'home');
    await expect(text(page, 'ตั้งรหัส PIN ทันที')).toHaveCount(0);
  });

  test('TC-APP-LOGIN-03 @critical รหัสผ่านผิด แสดงข้อความจาก server และไม่เข้าระบบ', async ({ page }) => {
    const api = await setup(page, {
      routes: {
        'POST /auth/login': { status: 401, body: { success: false, message: 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง' } },
      },
    });
    await openApp(page, '/login');
    await fillLogin(page, 'somchai', 'wrong');
    await page.getByTestId('login-submit-btn').click();

    // ทั้งแบนเนอร์ในหน้าและ popup แจ้งเตือนต้องมีข้อความจาก server
    await expect(text(page, 'เข้าสู่ระบบไม่สำเร็จ')).toBeVisible();
    await expect(page.getByText('ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง')).toHaveCount(2);
    await alertButton(page, 'ตกลง').click();

    await expectScreen(page, 'login');
    expect(api.callsTo('POST', '/auth/login')).toHaveLength(1);
    const stored = await page.evaluate(() => localStorage.getItem('wellx989_session'));
    expect(stored).toBeNull();
  });

  test('TC-APP-LOGIN-04 @critical ไม่กรอกข้อมูลครบ แจ้งเตือนและไม่ส่งคำขอไป server', async ({ page }) => {
    const api = await setup(page);
    await openApp(page, '/login');

    // ว่างทั้งคู่
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByText('กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน').first()).toBeVisible();
    await alertButton(page, 'ตกลง').click();

    // กรอกแต่ชื่อผู้ใช้
    await page.getByTestId('login-employee-id-input').fill('somchai');
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByText('กรุณากรอกรหัสผ่าน (Password)').first()).toBeVisible();
    await alertButton(page, 'ตกลง').click();

    // กรอกแต่รหัสผ่าน
    await page.getByTestId('login-employee-id-input').fill('');
    await page.getByTestId('login-password-input').fill('secret');
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByText('กรุณากรอกชื่อผู้ใช้ (Username) หรืออีเมล').first()).toBeVisible();

    expect(api.callsTo('POST', '/auth/login')).toHaveLength(0);
  });

  test('TC-APP-LOGIN-05 ต่อ server ไม่ได้ แจ้งว่าเชื่อมต่อไม่ได้ (ไม่มีการล็อกอินแบบออฟไลน์)', async ({ page }) => {
    await setup(page, { routes: { 'POST /auth/login': () => ({ abort: true }) } });
    await openApp(page, '/login');
    await fillLogin(page, 'somchai', 'Pass#1234');
    await page.getByTestId('login-submit-btn').click();

    await expect(text(page, 'เข้าสู่ระบบไม่สำเร็จ')).toBeVisible();
    await expect(page.getByText(/ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้/).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('wellx989_session'))).toBeNull();
  });

  test('TC-APP-LOGIN-06 ปุ่มแสดง/ซ่อนรหัสผ่านสลับชนิดช่องกรอก', async ({ page }) => {
    await setup(page);
    await openApp(page, '/login');
    const pwd = page.getByTestId('login-password-input');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.getByTestId('login-toggle-password-visibility-btn').click();
    await expect(pwd).not.toHaveAttribute('type', 'password');
    await page.getByTestId('login-toggle-password-visibility-btn').click();
    await expect(pwd).toHaveAttribute('type', 'password');
  });
});

test.describe('Set PIN', () => {
  test('TC-APP-PIN-01 @critical ตั้ง PIN 6 หลักสำเร็จ ส่ง PIN ไป server ครั้งเดียวแล้วเข้าหน้าหลัก', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee });
    await openApp(page, '/set-pin');
    await expectScreen(page, 'set-pin');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('กำหนดรหัส PIN 6 หลัก');

    await pressPin(page, '135790', 'keypad-btn');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('ยืนยันรหัส PIN 6 หลักอีกครั้ง');
    await pressPin(page, '135790', 'keypad-btn');

    await expect(text(page, 'ตั้งรหัส PIN สำเร็จ')).toBeVisible();
    const calls = api.callsTo('POST', '/auth/set-pin');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ pin: '135790' });
    // identity มาจาก token ใน header ไม่ใช่ใน body
    expect(calls[0].headers.authorization).toBe('Bearer e2e-access-token');

    await alertButton(page, 'ตกลง').click();
    await expectScreen(page, 'home');
    // เก็บสถานะ PIN ในเครื่องไว้เพื่อให้เปิดแอปครั้งต่อไปถาม PIN
    expect(await page.evaluate(() => localStorage.getItem('wellx989_pin_enabled_EMP-001'))).toBe('true');
  });

  test('TC-APP-PIN-02 @critical PIN ยืนยันไม่ตรงกัน แสดงข้อความผิดพลาดและไม่ส่งไป server', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee });
    await openApp(page, '/set-pin');

    await pressPin(page, '135790', 'keypad-btn');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('ยืนยันรหัส PIN 6 หลักอีกครั้ง');
    await pressPin(page, '111111', 'keypad-btn');

    await expect(page.getByTestId('txt-pin-error')).toHaveText('รหัส PIN ทั้ง 2 ครั้งไม่ตรงกัน กรุณาลองใหม่อีกครั้ง');
    expect(api.callsTo('POST', '/auth/set-pin')).toHaveLength(0);
  });

  test('TC-APP-PIN-03 server ปฏิเสธการตั้ง PIN แสดงข้อความของ server', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      routes: { 'POST /auth/set-pin': { status: 400, body: { success: false, message: 'รหัส PIN ง่ายเกินไป' } } },
    });
    await openApp(page, '/set-pin');
    await pressPin(page, '123456', 'keypad-btn');
    await expect(page.getByTestId('txt-set-pin-title')).toHaveText('ยืนยันรหัส PIN 6 หลักอีกครั้ง');
    await pressPin(page, '123456', 'keypad-btn');
    await expect(page.getByTestId('txt-pin-error')).toHaveText('รหัส PIN ง่ายเกินไป');
  });
});

test.describe('PIN lock และการกู้ session', () => {
  const pinUser = { ...USERS.employee, hasPin: true };

  test('TC-APP-PIN-04 @critical session ที่มี PIN เปิดแอปแล้วถูกล็อก ใส่ PIN ถูกต้องจึงเข้าหน้าหลัก', async ({ page }) => {
    const api = await setup(page, {
      user: pinUser,
      routes: { 'POST /auth/verify-pin': { body: { success: true, token: 'tok-pin', user: pinUser } } },
    });
    await openApp(page, '/');

    await expectScreen(page, 'pin-lock');
    await expect(page.getByTestId('txt-pin-lock-username')).toHaveText('สมชาย ใจดี');
    await pressPin(page, '246810', 'lock-keypad');

    await expectScreen(page, 'home');
    const calls = api.callsTo('POST', '/auth/verify-pin');
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ pin: '246810', username: 'somchai' });
  });

  test('TC-APP-PIN-05 @critical PIN ผิด แสดงข้อความจาก server ล้างช่อง และยังอยู่หน้าล็อก', async ({ page }) => {
    await setup(page, {
      user: pinUser,
      routes: { 'POST /auth/verify-pin': { status: 401, body: { success: false, message: 'รหัส PIN ไม่ถูกต้อง' } } },
    });
    await openApp(page, '/');
    await expectScreen(page, 'pin-lock');
    await pressPin(page, '000000', 'lock-keypad');

    await expect(page.getByTestId('txt-pin-lock-error')).toHaveText('รหัส PIN ไม่ถูกต้อง');
    await expectScreen(page, 'pin-lock');
  });

  test('TC-APP-SESSION-01 @critical session ที่ไม่มี PIN รีโหลดหน้าแล้วยังอยู่ในระบบ (ไม่เด้งกลับหน้า Login)', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/');
    await expectScreen(page, 'home');

    await page.reload();
    await expectScreen(page, 'home');
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
  });

  // ข้อสังเกตด้านความปลอดภัย (เบา): การล็อกด้วย PIN บังคับผ่านหน้า Splash เท่านั้น ถ้าเปิด/รีเฟรชที่ URL ลึกบนเว็บ (เช่น /main/profile)
  // ขณะที่ session มี PIN จะเข้าหน้านั้นได้เลยโดยไม่ถูกถาม PIN (บนมือถือเริ่มที่ Splash เสมอจึงไม่กระทบ) -> ปิดไว้เป็น fixme ให้ทีมตัดสินใจ
  test.fixme('TC-APP-SESSION-03 session ที่มี PIN เปิดที่ URL ลึก (/main/profile) ต้องถูกถาม PIN ก่อน', async ({ page }) => {
    await setup(page, { user: pinUser });
    await openApp(page, '/main/profile');
    await expectScreen(page, 'pin-lock');
  });

  test('TC-APP-SESSION-02 ออกจากระบบจากหน้าล็อก PIN ล้าง session แล้วกลับหน้า Login', async ({ page }) => {
    const api = await setup(page, { user: pinUser });
    await openApp(page, '/');
    await expectScreen(page, 'pin-lock');

    await page.getByTestId('btn-switch-to-password').click();
    await expect(text(page, 'ออกจากระบบ').first()).toBeVisible();
    await page.getByText('ออกจากระบบ', { exact: true }).last().click();

    await expectScreen(page, 'login');
    expect(await page.evaluate(() => localStorage.getItem('wellx989_session'))).toBeNull();
    await expect.poll(() => api.callsTo('POST', '/auth/logout').length).toBe(1);
  });
});
