import { test, expect } from '@playwright/test';
import { mockApi } from './helpers';

/**
 * เว็บแอดมิน - หน้าตั้งรหัสผ่านใหม่ (/set-password) ที่เปิดจากลิงก์ในอีเมล "ลืมรหัสผ่าน"
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High (รายการทั้งหมดดูใน docs/Login-TestCases.md)
 */

// สร้าง token จำลอง (JWT) ที่มีเวลาหมดอายุ — หน้าเว็บอ่านเฉพาะค่า exp จากส่วนกลางของ token เพื่อนับถอยหลัง
function fakeToken(secondsFromNow) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.signature`;
}

// ลิงก์เหมือนที่ระบบส่งในอีเมลของแอดมิน (WEB_URL/set-password?email=...&token=...&portal=web&type=admin)
const adminLink = (token) =>
  `/set-password?email=${encodeURIComponent('admin@wellx989.com')}&token=${encodeURIComponent(token)}&portal=web&type=admin`;

const heading = (page) => page.getByRole('heading', { name: 'Set Web Admin Password' });

// กลุ่ม: การเปิดลิงก์ตั้งรหัสผ่านจากอีเมล และการบันทึกรหัสผ่านใหม่
test.describe('Set password (from the reset email)', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
  });

  // กดลิงก์ในอีเมลแล้วต้องเห็นหน้า "Set Web Admin Password" และ URL ต้องยังมี token อยู่ (ห้ามถูกเด้งไป /login)
  test('[Critical] TC-SETPW-001 the email link opens the web set-password form and keeps its token', { tag: '@critical' }, async ({ page }) => {
    const token = fakeToken(900);
    await page.goto(adminLink(token));
    await expect(heading(page)).toBeVisible();
    await expect(page.getByPlaceholder(/^Enter new password/)).toBeVisible();
    await expect(page.getByPlaceholder('Re-enter new password')).toBeVisible();
    // URL ต้องยังเป็น /set-password และมี token เหมือนเดิม
    const url = new URL(page.url());
    expect(url.pathname).toBe('/set-password');
    expect(url.searchParams.get('token')).toBe(token);
    expect(url.searchParams.get('email')).toBe('admin@wellx989.com');
  });

  // กรอกรหัสผ่านใหม่แล้วกดบันทึก ต้องเรียก API ของ "แอดมิน" (/api/admins/set-password) พร้อม email, password, token
  test('[Critical] TC-SETPW-002 saving sends the new password to the admin endpoint and confirms success', { tag: '@critical' }, async ({ page }) => {
    const token = fakeToken(900);
    const calls = [];
    // จำลอง API ตั้งรหัสผ่านของแอดมิน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    await page.route('**/api/admins/set-password', (route) => {
      calls.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    // ถ้าหน้าเว็บเรียก endpoint ของพนักงานผิด เทสต้องล้ม
    let wrongEndpointCalled = false;
    await page.route('**/api/employees/set-password', (route) => {
      wrongEndpointCalled = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto(adminLink(token));
    await page.getByPlaceholder(/^Enter new password/).fill('NewSecret123');
    await page.getByPlaceholder('Re-enter new password').fill('NewSecret123');
    await page.getByRole('button', { name: /set|save|confirm|submit/i }).first().click();

    await expect(page.getByText(/has been set/i)).toBeVisible();
    // ต้องยิง API ครั้งเดียวและส่งข้อมูลครบ
    expect(calls).toEqual([{ email: 'admin@wellx989.com', password: 'NewSecret123', token }]);
    expect(wrongEndpointCalled).toBe(false);
  });

  // ถ้ายืนยันรหัสผ่านไม่ตรงกัน ต้องแจ้งเตือนและต้องไม่ยิง API
  test('[High] TC-SETPW-003 a mismatching confirmation is rejected without calling the API', { tag: '@high' }, async ({ page }) => {
    let called = false;
    await page.route('**/api/admins/set-password', (route) => {
      called = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto(adminLink(fakeToken(900)));
    await page.getByPlaceholder(/^Enter new password/).fill('NewSecret123');
    await page.getByPlaceholder('Re-enter new password').fill('Different456');
    await page.getByRole('button', { name: /set|save|confirm|submit/i }).first().click();
    await expect(page.getByText('Password and confirmation do not match')).toBeVisible();
    expect(called).toBe(false);
  });

  // รหัสผ่านสั้นกว่า 6 ตัวอักษร ต้องแจ้งเตือนและต้องไม่ยิง API
  test('[High] TC-SETPW-004 a password shorter than 6 characters is rejected without calling the API', { tag: '@high' }, async ({ page }) => {
    let called = false;
    await page.route('**/api/admins/set-password', (route) => {
      called = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto(adminLink(fakeToken(900)));
    await page.getByPlaceholder(/^Enter new password/).fill('abc12');
    await page.getByPlaceholder('Re-enter new password').fill('abc12');
    await page.getByRole('button', { name: /set|save|confirm|submit/i }).first().click();
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
    expect(called).toBe(false);
  });

  // ลิงก์ที่หมดอายุ (เกิน 15 นาที) ต้องแจ้งว่าหมดอายุ และต้องบันทึกรหัสผ่านไม่ได้
  test('[High] TC-SETPW-005 an expired link says so and cannot be used', { tag: '@high' }, async ({ page }) => {
    let called = false;
    await page.route('**/api/admins/set-password', (route) => {
      called = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto(adminLink(fakeToken(-60)));
    await expect(page.getByText(/this link has expired/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /expired/i })).toBeDisabled();
    expect(called).toBe(false);
  });

  // เปิด /set-password โดยไม่มี token ต้องถูกพากลับหน้า Login (ห้ามเปิดหน้าตั้งรหัสผ่านได้เอง)
  test('[High] TC-SETPW-006 /set-password without a token goes back to the sign-in page', { tag: '@high' }, async ({ page }) => {
    await page.goto('/set-password');
    await expect(page).toHaveURL(/\/login$/);
    await expect(heading(page)).toHaveCount(0);
  });
});
