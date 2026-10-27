import { test, expect } from '@playwright/test';
import { seedSession } from './helpers';

/**
 * เว็บแอดมิน - session หมดอายุ
 * แจ้งเป็น popup บนหน้าที่แอดมินใช้งานอยู่ (ไม่ใช่ข้อความในหน้า Login) กด OK แล้วออกจากระบบและไปหน้า /login
 *
 * - API ถูก mock ไว้ทั้งหมด ไม่ต้องเปิด backend
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

test.describe('Session expired - web admin', () => {
  // server ตอบ 401 → ต้องขึ้น popup บนหน้าเดิม ยังไม่เด้งไปหน้า Login จนกว่าจะกด OK
  test('[Critical] TC-SESSION-001 a 401 shows a popup, OK signs out and opens the login page', { tag: '@critical' }, async ({ page }) => {
    await seedSession(page);
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthorized' }) }));
    await page.goto('/dashboard');

    const popup = page.getByTestId('session-expired-popup');
    await expect(popup).toBeVisible();
    await expect(popup.getByText('Session expired')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);

    await popup.getByRole('button', { name: 'OK' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(popup).toHaveCount(0);
    // the login page itself carries no expiry banner and the stored session is gone
    await expect(page.getByText(/session expired/i)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('wellx989_token'))).toBeNull();
  });
});
