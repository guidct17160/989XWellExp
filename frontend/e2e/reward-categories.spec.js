import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู Reward > Reward Categories (หมวดหมู่ของรางวัล)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const CATEGORIES = [
  { id: 'rcat-1', code: 'CAT-001', name: 'General', rewardCount: 0 },
  { id: 'rcat-2', code: 'CAT-002', name: 'Food & Drink', rewardCount: 1 },
];
const REWARDS = [
  { id: 'rew-001', title: 'Starbucks Voucher', description: 'Coffee', pointsRequired: 500, stock: 50, category: 'Food & Drink', categoryId: 'rcat-2', imageUrl: '' },
];

async function openCategories(page) {
  await seedSession(page);
  await mockApi(page);
  const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/reward-categories', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(json({ success: true, categories: CATEGORIES }));
  });
  await page.route('**/api/rewards', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill(json({ success: true, rewards: REWARDS }));
  });
  await page.goto('/rewards/categories');
  await expect(page.getByRole('heading', { name: /reward categories/i })).toBeVisible();
}

test.describe('Reward Categories - admin page', () => {
  // ตารางต้องมีคอลัมน์ Code และจำนวน Reward ของแต่ละหมวด
  test('[Critical] TC-RCAT-001 the list shows code, name and reward count', { tag: '@critical' }, async ({ page }) => {
    await openCategories(page);
    const row = page.getByRole('row', { name: /Food & Drink/ });
    await expect(row).toContainText('CAT-002');
    await expect(row).toContainText('1 items');
  });

  // กดที่ไหนก็ได้ของแถว → เปิดเป็นหน้าใหม่ (URL เปลี่ยน มี id) และเห็น Reward ในหมวด
  test('[Critical] TC-RCAT-002 clicking a row opens the category as its own page with the category code in the URL', { tag: '@critical' }, async ({ page }) => {
    await openCategories(page);
    await page.getByRole('row', { name: /Food & Drink/ }).getByText('CAT-002').click();
    await expect(page).toHaveURL(/\/rewards\/categories\/CAT-002$/);
    await expect(page.getByTestId('category-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Food & Drink' })).toBeVisible();
    await expect(page.getByText('Starbucks Voucher')).toBeVisible();
  });

  // หมวดที่ไม่มี Reward ต้องบอกว่าว่าง และปุ่มย้อนกลับต้องกลับไปที่รายการ
  test('[High] TC-RCAT-003 an empty category says so and Back returns to the list', { tag: '@high' }, async ({ page }) => {
    await openCategories(page);
    await page.getByRole('row', { name: /General/ }).click();
    await expect(page.getByText('No rewards in this category yet')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: /reward categories/i })).toBeVisible();
    await expect(page).not.toHaveURL(/id=/);
  });
});
