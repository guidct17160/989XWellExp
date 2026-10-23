import { test, expect } from '@playwright/test';
import { ADMIN, expectDashboard, fillLogin, loginScreen, mockApi, mockLogin, seedSession } from './helpers';

/**
 * เว็บแอดมิน - หน้า Login (/login)
 *
 * ไฟล์นี้คือชุดเทสอัตโนมัติ (E2E) ของหน้า Login โดยใช้ Playwright เปิดเบราว์เซอร์จริงแล้วจำลองการใช้งาน
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High (ระดับ Medium/Low ทดสอบมือ ดูรายการใน docs/Login-TestCases.md)
 * - สั่งรันเฉพาะระดับได้ เช่น npm run test:e2e:critical
 * - รหัสเคส TC-LOGIN-xxx ใช้อ้างอิงในรายงานเทส
 * - รันด้วย: npm run test:e2e
 */

// กลุ่ม: หน้าตาและโครงสร้างของหน้า Login
test.describe('Login page - layout', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
    await page.goto('/login');
  });

  // ตรวจว่าหน้า Login แสดงโลโก้ ช่องกรอก 2 ช่อง ลิงก์ลืมรหัสผ่าน และปุ่ม Login ครบ
  test('[High] TC-LOGIN-001 shows the brand, both fields, forgot link and Login button', { tag: '@high' }, async ({ page }) => {
    const s = loginScreen(page);
    await expect(s.logo).toBeVisible();
        await expect(s.username).toBeVisible();
    await expect(s.password).toBeVisible();
    await expect(s.forgotLink).toBeVisible();
    await expect(s.submit).toBeVisible();
    await expect(s.submit).toBeEnabled();
  });



  // ตรวจว่ารหัสผ่านถูกซ่อน (type=password) และมี autocomplete ให้เบราว์เซอร์เติมรหัสที่บันทึกไว้ได้
  test('[High] TC-LOGIN-004 the password is masked and the browser may autofill both fields', { tag: '@high' }, async ({ page }) => {
    const s = loginScreen(page);
    await expect(s.password).toHaveAttribute('type', 'password');
    await expect(s.username).toHaveAttribute('autocomplete', 'username');
    await expect(s.password).toHaveAttribute('autocomplete', 'current-password');
  });

});

// กลุ่ม: การเปลี่ยน URL/เส้นทาง (ยังไม่ล็อกอินต้องไป /login)
test.describe('Login page - URL / routing', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
  });


  // ถ้ายังไม่ล็อกอินแล้วเข้าหน้าแรก (/) ต้องถูกพาไป /login
  test('[Critical] TC-LOGIN-011 signed-out visit to the home page is sent to /login', { tag: '@critical' }, async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginScreen(page).signInShown).toBeVisible();
  });

  // ถ้ายังไม่ล็อกอินแล้วเข้าหน้าที่ต้องล็อกอิน (/rewards) ต้องไป /login ที่สะอาด ไม่มี ?query ต่อท้าย
  test('[Critical] TC-LOGIN-012 signed-out visit to a protected page goes to a clean /login (no query string)', { tag: '@critical' }, async ({ page }) => {
    await page.goto('/rewards');
    await expect(page).toHaveURL(/\/login$/);
    expect(new URL(page.url()).search).toBe('');
  });


  // มีข้อมูลผู้ใช้ในเครื่องแต่ไม่มี token ต้องไม่นับว่าล็อกอินอยู่ (เพราะเรียก API ไม่ได้)
  test('[Critical] TC-LOGIN-014 a session without a token is not treated as signed in', { tag: '@critical' }, async ({ page }) => {
    // ตั้งให้เบราว์เซอร์เริ่มต้นในสภาพที่ล็อกอินอยู่แล้ว
    await seedSession(page, { withToken: false });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginScreen(page).signInShown).toBeVisible();
  });
});

// กลุ่ม: การตรวจข้อมูลที่กรอกก่อนส่งไป server
test.describe('Login page - validation', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
    await page.goto('/login');
  });

  // กด Login โดยไม่กรอกอะไร ต้องขึ้นข้อความให้กรอกทั้งชื่อผู้ใช้และรหัสผ่าน และต้องไม่ยิง API
  test('[High] TC-LOGIN-020 empty form asks for username and password', { tag: '@high' }, async ({ page }) => {
    // จำลอง API ล็อกอิน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    const { requests } = await mockLogin(page);
    await loginScreen(page).submit.click();
    await expect(page.getByText('Please enter your username and password')).toBeVisible();
    // ต้องไม่มีการยิง API เลย
    expect(requests).toHaveLength(0);
  });




});

// กลุ่ม: การกดส่งฟอร์มล็อกอิน (ทั้งสำเร็จและล้มเหลว)
test.describe('Login page - submitting', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
    await page.goto('/login');
  });

  // ตรวจข้อมูลที่ส่งไป API: ชื่อผู้ใช้และรหัสผ่านถูกตัดช่องว่างหน้า-หลัง และมี portal = "web"
  test('[High] TC-LOGIN-040 sends the trimmed username, the password and portal "web"', { tag: '@high' }, async ({ page }) => {
    // จำลอง API ล็อกอิน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    const { requests } = await mockLogin(page);
    await fillLogin(page, '  admin@wellx989.com  ', '  Secret123  ');
    await loginScreen(page).submit.click();
    await expectDashboard(page, expect);
    // ต้องยิง API ครั้งเดียวเท่านั้น
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({ username: 'admin@wellx989.com', password: 'Secret123', portal: 'web' });
  });


  // ระหว่างรอ server ปุ่มต้องขึ้น "Verifying credentials..." และกดซ้ำไม่ได้ (ส่ง API ครั้งเดียว)
  test('[High] TC-LOGIN-042 shows a loading state and blocks double submits while waiting', { tag: '@high' }, async ({ page }) => {
    // จำลอง API ล็อกอิน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    const { requests } = await mockLogin(page, { delayMs: 1200 });
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
    await s.submit.click();
    await expect(page.getByRole('button', { name: 'Verifying credentials...' })).toBeDisabled();
    // ลองกดซ้ำตอนปุ่มถูกล็อก (ต้องไม่ส่งซ้ำ) ถ้ากดไม่ได้ก็ไม่เป็นไร
    await s.submit.click({ force: true }).catch(() => {});
    await expectDashboard(page, expect);
    // ต้องยิง API ครั้งเดียวเท่านั้น
    expect(requests).toHaveLength(1);
  });

  // รหัสผิด ต้องแสดงข้อความจาก server อยู่หน้า /login และไม่เก็บ token
  test('[Critical] TC-LOGIN-043 wrong credentials show the server message and stay on /login', { tag: '@critical' }, async ({ page }) => {
    await mockLogin(page, { status: 401, body: { success: false, message: 'Incorrect username or password' } });
    const s = await fillLogin(page, 'admin@wellx989.com', 'WrongPass1');
    await s.submit.click();
    await expect(page.getByText('Incorrect username or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(s.submit).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('wellx989_token'))).toBeNull();
  });


  // บัญชีถูกระงับ/ไม่มีสิทธิ์ (403) ต้องแสดงข้อความจาก server และอยู่หน้า /login
  test('[High] TC-LOGIN-045 a locked / forbidden account shows the server message', { tag: '@high' }, async ({ page }) => {
    await mockLogin(page, { status: 403, body: { success: false, message: 'This account is inactive' } });
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
    await s.submit.click();
    await expect(page.getByText('This account is inactive')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  // ถ้าเชื่อมต่อ server ไม่ได้ ต้องแสดงข้อความ "Unable to connect to the server" และปุ่มกลับมากดได้
  test('[High] TC-LOGIN-046 an unreachable server shows a connection error', { tag: '@high' }, async ({ page }) => {
    await mockLogin(page, { abort: true });
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
    await s.submit.click();
    await expect(page.getByText('Unable to connect to the server')).toBeVisible();
    await expect(s.submit).toBeEnabled();
  });


});

// กลุ่ม: เหตุการณ์หลังล็อกอินสำเร็จ (เข้า Dashboard, session, ความปลอดภัย)
test.describe('Login page - after a successful login', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
  });

  // ล็อกอินสำเร็จ ต้องเข้า Dashboard ที่ "/" และเก็บ token กับข้อมูลผู้ใช้ใน localStorage
  test('[Critical] TC-LOGIN-050 lands on the Dashboard at "/" and stores the session', { tag: '@critical' }, async ({ page }) => {
    await mockLogin(page);
    await page.goto('/login');
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
    await s.submit.click();

    await expectDashboard(page, expect);
    expect(new URL(page.url()).pathname).toBe('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);

    // อ่านค่าที่เว็บเก็บไว้ใน localStorage (token, ข้อมูลผู้ใช้, สถานะล็อกอิน)
    const stored = await page.evaluate(() => ({
      token: localStorage.getItem('wellx989_token'),
      user: JSON.parse(localStorage.getItem('wellx989_user') || 'null'),
      flag: localStorage.getItem('wellx989_is_logged_in'),
    }));
    expect(stored.token).toBe('test-jwt-token');
    expect(stored.user.email).toBe(ADMIN.email);
    expect(stored.flag).toBe('true');
  });

  // ล็อกอินสำเร็จแล้ว ต้องไม่มีรหัสผ่านที่พิมพ์เก็บอยู่ใน localStorage/sessionStorage (ความปลอดภัย)
  test('[Critical] TC-LOGIN-051 the password is never written to browser storage', { tag: '@critical' }, async ({ page }) => {
    await mockLogin(page);
    await page.goto('/login');
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret-Value-123');
    await s.submit.click();
    await expectDashboard(page, expect);
    // รวมข้อมูลใน localStorage และ sessionStorage เป็นข้อความเดียว แล้วค้นหารหัสผ่านที่พิมพ์
    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(dump).not.toContain('Secret-Value-123');
  });

  // ถึงจะเคยขอเข้าหน้าอื่น (/rewards) ก่อนล็อกอิน ล็อกอินแล้วต้องเข้า Dashboard เสมอ
  test('[High] TC-LOGIN-052 always opens the Dashboard, even if a different page was requested before signing in', { tag: '@high' }, async ({ page }) => {
    await mockLogin(page);
    await page.goto('/rewards');
    await expect(page).toHaveURL(/\/login$/);
    const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
    await s.submit.click();
    await expectDashboard(page, expect);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page).not.toHaveURL(/\/rewards/);
  });


  // คนที่ล็อกอินอยู่ กด refresh แล้วต้องยังอยู่ในระบบ ไม่ถูกเด้งออก
  test('[High] TC-LOGIN-054 a signed-in user keeps the session after a refresh', { tag: '@high' }, async ({ page }) => {
    // ตั้งให้เบราว์เซอร์เริ่มต้นในสภาพที่ล็อกอินอยู่แล้ว
    await seedSession(page);
    await page.goto('/');
    await expectDashboard(page, expect);
    // รีเฟรชหน้าเว็บ
    await page.reload();
    await expectDashboard(page, expect);
    await expect(page).not.toHaveURL(/\/login/);
  });

});
