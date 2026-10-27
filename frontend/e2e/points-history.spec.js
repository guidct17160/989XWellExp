import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู Employee & Point > Points Balance & History
 * กด View History แล้วเปิดเป็นหน้าใหม่ /points/<รหัสพนักงาน> พร้อมสรุป ทั้งหมด / เข้า / ออก
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const EMPLOYEES = [
  { id: 'EMP-002', code: 'EMP-002', name: 'Somchai Jaidee', department: 'IT', points: 700 },
];
const HISTORY = [
  { id: 'pt-1', title: 'Quest passed: Safety quiz', points: 1000, type: 'earn', category: 'Quest', date: '2026-10-23' },
  { id: 'pt-2', title: 'Redeemed: Starbucks Voucher', points: -300, type: 'spend', category: 'Reward', date: '2026-10-24' },
];

async function openPoints(page) {
  await seedSession(page);
  await mockApi(page);
  const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/employees', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(json({ success: true, employees: EMPLOYEES }));
  });
  await page.route('**/api/points/history**', (route) => route.fulfill(json({ success: true, currentPoints: 700, history: HISTORY })));
  await page.goto('/points');
  await expect(page.getByRole('heading', { name: /points balance & history/i })).toBeVisible();
}

test.describe('Points history - employee page', () => {
  // กด View History → หน้าใหม่ที่ path ใช้รหัสพนักงาน ไม่ใช่ popup
  test('[Critical] TC-POINT-001 View History opens a full page at /points/<employee code>', { tag: '@critical' }, async ({ page }) => {
    await openPoints(page);
    await page.getByRole('row', { name: /EMP-002/ }).getByRole('button', { name: /view history/i }).click();
    await expect(page).toHaveURL(/\/points\/EMP-002$/);
    await expect(page.getByTestId('points-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Somchai Jaidee' })).toBeVisible();
  });

  // การ์ดสรุปต้องแยก ทั้งหมด / เข้า / ออก ให้ตรงกับรายการ
  test('[Critical] TC-POINT-002 the page splits all / in / out transactions with the right totals', { tag: '@critical' }, async ({ page }) => {
    await openPoints(page);
    await page.goto('/points/EMP-002');
    const detail = page.getByTestId('points-detail');
    await expect(detail.getByText('All transactions').locator('..')).toContainText('2 items');
    await expect(detail.getByText('Points in (earned)').locator('..')).toContainText('1 items');
    await expect(detail.getByText('Points in (earned)').locator('..')).toContainText('+1,000 PTS');
    await expect(detail.getByText('Points out (spent)').locator('..')).toContainText('1 items');
    await expect(detail.getByText('Points out (spent)').locator('..')).toContainText('-300 PTS');
  });

  // เลือก Out แล้วต้องเหลือเฉพาะรายการที่ใช้แต้ม
  test('[High] TC-POINT-003 the Type filter shows only the chosen direction', { tag: '@high' }, async ({ page }) => {
    await openPoints(page);
    await page.goto('/points/EMP-002');
    await page.getByRole('combobox').selectOption('OUT');
    await expect(page.getByText('Redeemed: Starbucks Voucher')).toBeVisible();
    await expect(page.getByText('Quest passed: Safety quiz')).toHaveCount(0);
  });

  // ปุ่มย้อนกลับกลับไปรายการพนักงาน
  test('[High] TC-POINT-004 Back returns to the employee list', { tag: '@high' }, async ({ page }) => {
    await openPoints(page);
    await page.getByRole('row', { name: /EMP-002/ }).getByRole('button', { name: /view history/i }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/points$/);
    await expect(page.getByRole('heading', { name: /points balance & history/i })).toBeVisible();
  });
});
