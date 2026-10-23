import { test, expect } from '@playwright/test';
import { loginScreen, mockApi, mockForgotPassword } from './helpers';

/**
 * เว็บแอดมิน - หน้าลืมรหัสผ่าน (/forgot-password) ที่เปิดจากหน้า Login
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High (ระดับ Medium/Low ทดสอบมือ ดูรายการใน docs/Login-TestCases.md)
 * - สั่งรันเฉพาะระดับได้ เช่น npm run test:e2e:critical
 * - รหัสเคส TC-FORGOT-xxx ใช้อ้างอิงในรายงานเทส
 */

const resetHeading = (page) => page.getByRole('heading', { name: 'Reset your password' });
const idInput = (page) => page.locator('#forgot-id');
const sendButton = (page) => page.getByRole('button', { name: /send reset link|sending\.\.\./i });

// กลุ่ม: การเปิด/ปิด/สลับหน้าลืมรหัสผ่าน (/forgot-password)
test.describe('Forgot password - navigation', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
  });

  // กด "Forgot Password?" ต้องไปที่ /forgot-password และแสดงฟอร์มรีเซ็ตรหัสผ่าน
  test('[High] TC-FORGOT-001 "Forgot Password?" opens /forgot-password with the reset form', { tag: '@high' }, async ({ page }) => {
    await page.goto('/login');
    await loginScreen(page).forgotLink.click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(resetHeading(page)).toBeVisible();
    await expect(idInput(page)).toBeVisible();
    await expect(sendButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to sign in' })).toBeVisible();
  });






});

// กลุ่ม: การส่งลิงก์รีเซ็ตรหัสผ่านทางอีเมล และผลลัพธ์แต่ละกรณี
test.describe('Forgot password - sending the reset link', () => {
  test.beforeEach(async ({ page }) => {
    // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
    await mockApi(page);
    await page.goto('/forgot-password');
  });

  // กดส่งโดยไม่กรอกอะไร ต้องขึ้นข้อความเตือน และต้องไม่ยิง API
  test('[High] TC-FORGOT-010 an empty form is rejected without calling the API', { tag: '@high' }, async ({ page }) => {
    // จำลอง API ลืมรหัสผ่าน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    const { requests } = await mockForgotPassword(page);
    await sendButton(page).click();
    await expect(page.getByText('Please enter your email, username or employee ID')).toBeVisible();
    // ต้องไม่มีการยิง API เลย
    expect(requests).toHaveLength(0);
  });


  // ส่งสำเร็จ ต้องขึ้นข้อความพร้อมอีเมลที่ปิดบางส่วน ส่งค่าที่ตัดช่องว่างแล้วไป API และซ่อนช่องกรอก
  test('[Critical] TC-FORGOT-012 success shows the masked email and sends the trimmed identifier', { tag: '@critical' }, async ({ page }) => {
    // จำลอง API ลืมรหัสผ่าน และเก็บคำขอที่ส่งมาไว้ตรวจสอบ
    const { requests } = await mockForgotPassword(page, {
      body: { success: true, message: 'sent', maskedEmail: 'a***n@wellx989.com' },
    });
    await idInput(page).fill('  admin@wellx989.com  ');
    await sendButton(page).click();

    await expect(page.getByText(/password reset link has been sent/i)).toBeVisible();
    await expect(page.getByText(/a\*\*\*n@wellx989\.com/)).toBeVisible();
    // ต้องส่ง portal = 'web' ไปด้วย เพื่อให้ลิงก์ในอีเมลเปิดหน้าตั้งรหัสผ่านบนเว็บ ไม่ใช่แอป
    expect(requests).toEqual([{ email: 'admin@wellx989.com', portal: 'web' }]);
    // the input and the send button are gone once the link has been sent
    await expect(idInput(page)).toHaveCount(0);
  });



  // ไม่พบบัญชี (404) ต้องแสดงข้อความช่วยเหลือ และยังกรอกใหม่ได้
  test('[High] TC-FORGOT-015 an unknown account shows a helpful message', { tag: '@high' }, async ({ page }) => {
    await mockForgotPassword(page, { status: 404, body: { success: false, message: 'not found' } });
    await idInput(page).fill('nobody@example.com');
    await sendButton(page).click();
    await expect(page.getByText(/No account matches that email, username or ID/)).toBeVisible();
    await expect(idInput(page)).toBeVisible(); // can try again
  });

  // ส่งถี่เกินกำหนด (429) ต้องแจ้งให้รอ 15 นาที
  test('[High] TC-FORGOT-016 the rate limit (HTTP 429) tells the user to wait', { tag: '@high' }, async ({ page }) => {
    await mockForgotPassword(page, { status: 429, body: { success: false, message: 'too many' } });
    await idInput(page).fill('admin@wellx989.com');
    await sendButton(page).click();
    await expect(page.getByText(/Too many attempts\. Please wait 15 minutes/)).toBeVisible();
  });





  // ถ้า API ไม่ส่งลิงก์กลับมา (โหมดจริง) ต้องไม่แสดงลิงก์ — ห้ามเปิดเผยลิงก์รีเซ็ตบนหน้าเว็บ
  test('[Critical] TC-FORGOT-021 no development link is shown when the API does not return one', { tag: '@critical' }, async ({ page }) => {
    await mockForgotPassword(page);
    await idInput(page).fill('admin@wellx989.com');
    await sendButton(page).click();
    await expect(page.getByText(/password reset link has been sent/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /development only/i })).toHaveCount(0);
  });


});
