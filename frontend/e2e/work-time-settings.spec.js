import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู Attendance > Work Time Settings (/settings/work-time)
 * ตั้งเวลาเริ่มงาน, ชั่วโมงทำงานต่อวัน และแต้มสำหรับคนเข้างานตรงเวลา
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const RULES = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 0 };

async function openSettings(page) {
  await seedSession(page);
  await mockApi(page);
  await page.route('**/api/settings/work-time', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, rules: RULES }) });
  });
  await page.goto('/settings/work-time');
  await expect(page.getByRole('heading', { name: /work time settings/i })).toBeVisible();
}

const hoursInput = (page) => page.locator('input[type="number"]').nth(0);
const pointsInput = (page) => page.locator('input[type="number"]').nth(1);

test.describe('Work Time Settings - admin page', () => {
  // หน้านี้แสดงค่าปัจจุบันที่ server เก็บไว้
  test('[Critical] TC-WT-001 the page shows the current rules from the server', { tag: '@critical' }, async ({ page }) => {
    await openSettings(page);
    await expect(hoursInput(page)).toHaveValue('9');
    await expect(pointsInput(page)).toHaveValue('0');
    await expect(page.getByText('Work starts at').locator('..')).toContainText('08:00');
    await expect(page.getByText('Late after').first().locator('..')).toContainText('09:00');
    await expect(page.getByText('On-time + full hours points').locator('..')).toContainText('Off');
  });

  // แก้ชั่วโมงและแต้มแล้วบันทึก ต้องส่งค่าที่ถูกต้องไป PUT /api/settings/work-time
  test('[Critical] TC-WT-002 saving sends the new hours and on-time points to the server', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    await openSettings(page);
    await page.route('**/api/settings/work-time', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      const body = route.request().postDataJSON();
      bodies.push(body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, rules: body }),
      });
    });
    await hoursInput(page).fill('8');
    await pointsInput(page).fill('20');
    await page.getByRole('button', { name: /save settings/i }).click();
    await expect(page.getByText('Work time settings saved')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({ workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 8, onTimePoints: 20 });
  });

  // ค่าที่ไม่ถูกต้อง (ชั่วโมง 0) ต้องกดบันทึกไม่ได้ และบอกเหตุผล
  test('[High] TC-WT-003 an invalid value blocks Save and says why', { tag: '@high' }, async ({ page }) => {
    let put = false;
    await openSettings(page);
    await page.route('**/api/settings/work-time', (route) => {
      if (route.request().method() === 'PUT') put = true;
      return route.fallback();
    });
    await hoursInput(page).fill('0');
    await expect(page.getByText(/Required work hours must be between 1 and 16/)).toBeVisible();
    await expect(page.getByRole('button', { name: /save settings/i })).toBeDisabled();
    expect(put).toBe(false);
  });

  // ถ้า server ปฏิเสธ ต้องแสดงข้อความให้แอดมินเห็น
  test('[High] TC-WT-004 a server error is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openSettings(page);
    await page.route('**/api/settings/work-time', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Work start time cannot be later than the late time' }) });
    });
    await pointsInput(page).fill('5');
    await page.getByRole('button', { name: /save settings/i }).click();
    await expect(page.getByText('Work start time cannot be later than the late time')).toBeVisible();
  });

  // เมนู Settings มีรายการ Work Time Settings และพาไป path /settings/work-time
  test('[High] TC-WT-005 the Settings menu opens Work Time Settings at /settings/work-time', { tag: '@high' }, async ({ page }) => {
    await seedSession(page);
    await mockApi(page);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /^Settings$/ }).first().click();
    await page.getByRole('button', { name: 'Work Time Settings' }).first().click();
    await expect(page).toHaveURL(/\/settings\/work-time$/);
  });
});
