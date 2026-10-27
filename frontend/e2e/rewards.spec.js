import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { routeJson } from './helpers.batch2';

/**
 * เว็บแอดมิน - เมนู Reward > Rewards Catalog & Inventory (/rewards)
 * รายการของรางวัล, สร้าง (ต้องเลือกหมวดหมู่, รหัสกำหนดเองได้), ลบ, ตัวกรอง, ข้อความผิดพลาดจาก server
 * (หน้า Reward Categories ทดสอบแยกใน reward-categories.spec.js)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const CATEGORIES = [
  { id: 'rcat-1', code: 'CAT-001', name: 'General', rewardCount: 1 },
  { id: 'rcat-2', code: 'CAT-002', name: 'Food & Drink', rewardCount: 2 },
];
const REWARDS = [
  { id: 'rew-001', title: 'Starbucks Voucher', description: 'Coffee voucher', pointsRequired: 500, stock: 50, category: 'Food & Drink', categoryId: 'rcat-2', imageUrl: '' },
  { id: 'rew-002', title: 'Lunch Box', description: 'Almost gone', pointsRequired: 300, stock: 4, category: 'Food & Drink', categoryId: 'rcat-2', imageUrl: '' },
  { id: 'rew-003', title: 'Company Mug', description: 'Sold out', pointsRequired: 200, stock: 0, category: 'General', categoryId: 'rcat-1', imageUrl: '' },
];

async function openRewards(page, { rewards = REWARDS, categories = CATEGORIES } = {}) {
  await seedSession(page);
  await mockApi(page);
  const state = { rewards: [...rewards] };
  await routeJson(page, '**/api/rewards', 'GET', () => ({ body: { success: true, rewards: state.rewards } }));
  await routeJson(page, '**/api/reward-categories', 'GET', { body: { success: true, categories } });
  await routeJson(page, '**/api/rewards/my-coupons', 'GET', { body: { success: true, coupons: [{ id: 'c1' }, { id: 'c2' }] } });
  await page.goto('/rewards');
  await expect(page.getByRole('heading', { name: /reward management/i })).toBeVisible();
  return state;
}

// ฟอร์ม Add New Reward (label ไม่ได้ผูกกับ input จึงหาจาก placeholder / ชนิดของช่อง)
function rewardForm(page) {
  const form = page.locator('form');
  return {
    form,
    code: form.getByPlaceholder(/Leave blank to auto-generate/),
    title: form.getByPlaceholder(/Starbucks gift card/),
    category: form.locator('select'),
    description: form.getByPlaceholder(/Reward details and terms/),
    points: form.locator('input[type=number]').nth(0),
    stock: form.locator('input[type=number]').nth(1),
    save: form.getByRole('button', { name: 'Save Reward' }),
  };
}

test.describe('Rewards Catalog - admin page', () => {
  // ตารางต้องแสดงรหัส ชื่อ หมวด คำอธิบาย แต้มที่ใช้แลก และสต็อก พร้อมการ์ดสรุปจากข้อมูล server
  test('[Critical] TC-RWD-001 the catalog shows code, category, points and stock with totals from the server', { tag: '@critical' }, async ({ page }) => {
    await openRewards(page);
    const row = page.getByRole('row', { name: /Starbucks Voucher/ });
    await expect(row).toContainText('rew-001');
    await expect(row).toContainText('Food & Drink');
    await expect(row).toContainText('Coffee voucher');
    await expect(row).toContainText('500 Points');
    await expect(row).toContainText('50 pcs');
    await expect(page.getByText('3 items', { exact: true })).toBeVisible();
    await expect(page.getByText('54 pcs', { exact: true })).toBeVisible();
    await expect(page.getByText('2 items', { exact: true })).toBeVisible();
  });

  // กรองหมวดหมู่ / สต็อก / ค้นหา ต้องเหลือเฉพาะรายการที่ตรง
  test('[High] TC-RWD-002 category, stock filters and search narrow the catalog', { tag: '@high' }, async ({ page }) => {
    await openRewards(page);
    // ตัวกรองแรก = Category, ตัวที่สอง = Stock (FilterBar ไม่ได้ผูก label กับ select)
    await page.locator('select').nth(0).selectOption('rcat-1');
    await expect(page.getByRole('row', { name: /Company Mug/ })).toBeVisible();
    await expect(page.getByText('Starbucks Voucher')).toHaveCount(0);
    await page.locator('select').nth(0).selectOption('ALL');
    await page.locator('select').nth(1).selectOption('LOW');
    await expect(page.getByRole('row', { name: /Lunch Box/ })).toBeVisible();
    await expect(page.getByText('Company Mug')).toHaveCount(0);
    await page.locator('select').nth(1).selectOption('OUT');
    await expect(page.getByRole('row', { name: /Company Mug/ })).toBeVisible();
    await expect(page.getByText('Lunch Box')).toHaveCount(0);
    await page.locator('select').nth(1).selectOption('ALL');
    await page.getByPlaceholder(/Search by code, title/).fill('rew-001');
    await expect(page.getByRole('row', { name: /Starbucks Voucher/ })).toBeVisible();
    await expect(page.getByText('Lunch Box')).toHaveCount(0);
  });

  // ไม่มีของรางวัลเลย ต้องบอกว่าว่าง และถ้าโหลดไม่สำเร็จต้องเห็นข้อความจาก server (ไม่แสดงข้อมูลจำลอง)
  test('[High] TC-RWD-003 an empty catalog says so and a server error on load is shown', { tag: '@high' }, async ({ page }) => {
    await seedSession(page);
    await mockApi(page);
    await routeJson(page, '**/api/rewards', 'GET', { status: 500, body: { success: false, message: 'Reward table is unavailable' } });
    await routeJson(page, '**/api/reward-categories', 'GET', { body: { success: true, categories: CATEGORIES } });
    await page.goto('/rewards');
    await expect(page.getByText('Reward table is unavailable')).toBeVisible();
    await expect(page.getByText('No rewards yet')).toBeVisible();
  });

  // สร้างของรางวัล: เลือกหมวด กรอกรหัสเอง (ตัวอักษรแปลกถูกตัดทิ้ง) แล้วต้องส่ง POST /api/rewards ด้วยค่าที่ถูกต้อง
  test('[Critical] TC-RWD-004 a new reward is sent to the server with category, custom code, points and stock', { tag: '@critical' }, async ({ page }) => {
    const state = await openRewards(page);
    const posted = await routeJson(page, '**/api/rewards', 'POST', () => {
      state.rewards = [...state.rewards, { id: 'gift_01', title: 'Movie Ticket', description: 'x', pointsRequired: 800, stock: 15, category: 'General', categoryId: 'rcat-1', imageUrl: '' }];
      return { status: 201, body: { success: true } };
    });
    await page.getByRole('button', { name: 'Add New Reward' }).click();
    const f = rewardForm(page);
    // ช่องรหัสรับเฉพาะ ตัวอักษร/ตัวเลข/-/_
    await f.code.fill('gift_01 !');
    await expect(f.code).toHaveValue('gift_01');
    await f.title.fill('Movie Ticket');
    await f.category.selectOption('rcat-1');
    await f.points.fill('800');
    await f.stock.fill('15');
    await f.save.click();
    await expect(page.getByText('Reward "Movie Ticket" added successfully')).toBeVisible();
    await expect(f.form).toHaveCount(0);
    expect(posted).toHaveLength(1);
    expect(posted[0].body).toMatchObject({
      code: 'gift_01', title: 'Movie Ticket', categoryId: 'rcat-1', pointsRequired: 800, stock: 15,
      description: 'Employee appreciation reward',
    });
    // รายการโหลดใหม่และเห็นรางวัลที่เพิ่ม
    await expect(page.getByRole('row', { name: /Movie Ticket/ })).toContainText('gift_01');
  });

  // เว้นรหัสว่าง = ให้ระบบออกรหัสเอง (ส่ง code ว่างไปให้ server)
  test('[High] TC-RWD-005 leaving the code blank lets the server generate it', { tag: '@high' }, async ({ page }) => {
    await openRewards(page);
    const posted = await routeJson(page, '**/api/rewards', 'POST', { status: 201, body: { success: true } });
    await page.getByRole('button', { name: 'Add New Reward' }).click();
    const f = rewardForm(page);
    await f.title.fill('Gift Card');
    await f.category.selectOption('rcat-2');
    await f.save.click();
    await expect(page.getByText('Reward "Gift Card" added successfully')).toBeVisible();
    expect(posted[0].body.code).toBe('');
    // ค่าเริ่มต้นของแต้มและสต็อก
    expect(posted[0].body).toMatchObject({ pointsRequired: 500, stock: 20, categoryId: 'rcat-2' });
  });

  // ต้องเลือกหมวดหมู่ ไม่งั้นฟอร์มส่งไม่ได้ (ไม่มีคำขอไป server) และถ้ายังไม่มีหมวดเลยต้องบอกให้ไปสร้างก่อน
  test('[Critical] TC-RWD-006 category is required: saving without one sends nothing', { tag: '@critical' }, async ({ page }) => {
    await openRewards(page);
    const posted = await routeJson(page, '**/api/rewards', 'POST', { status: 201, body: { success: true } });
    await page.getByRole('button', { name: 'Add New Reward' }).click();
    const f = rewardForm(page);
    await f.title.fill('No Category Reward');
    await f.save.click();
    // เบราว์เซอร์ตรวจ required ของช่อง Category และหยุดการส่ง
    expect(await f.category.evaluate((el) => el.validity.valueMissing)).toBe(true);
    expect(posted).toHaveLength(0);
    await expect(f.form).toBeVisible();
  });

  test('[High] TC-RWD-007 with no categories the form tells the admin to create one first', { tag: '@high' }, async ({ page }) => {
    await openRewards(page, { categories: [] });
    await page.getByRole('button', { name: 'Add New Reward' }).click();
    await expect(page.getByText(/No categories yet\. Create one first in Reward/)).toBeVisible();
  });

  // server ปฏิเสธ (เช่น รหัสซ้ำ 409) ต้องเห็นข้อความของ server และฟอร์มยังเปิดอยู่ให้แก้ไข
  test('[High] TC-RWD-008 a server error on create (duplicate code) is shown and the form stays open', { tag: '@high' }, async ({ page }) => {
    await openRewards(page);
    await routeJson(page, '**/api/rewards', 'POST', { status: 409, body: { success: false, message: 'Reward code "rew-001" is already in use' } });
    await page.getByRole('button', { name: 'Add New Reward' }).click();
    const f = rewardForm(page);
    await f.code.fill('rew-001');
    await f.title.fill('Duplicate');
    await f.category.selectOption('rcat-2');
    await f.save.click();
    await expect(page.getByText('Reward code "rew-001" is already in use')).toBeVisible();
    await expect(f.form).toBeVisible();
    await expect(f.title).toHaveValue('Duplicate');
  });

  // ลบต้องมี popup ยืนยัน ยกเลิกแล้วไม่ลบ ยืนยันแล้วเรียก DELETE /api/rewards/<id>
  test('[High] TC-RWD-009 delete asks for confirmation first, then calls DELETE', { tag: '@high' }, async ({ page }) => {
    const state = await openRewards(page);
    const deleted = await routeJson(page, '**/api/rewards/*', 'DELETE', () => {
      state.rewards = state.rewards.filter((r) => r.id !== 'rew-003');
      return { body: { success: true } };
    });
    const row = page.getByRole('row', { name: /Company Mug/ });
    await row.getByTitle('Delete').click();
    await expect(page.getByTestId('delete-reward-confirm')).toContainText('Delete "Company Mug"?');
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(deleted).toHaveLength(0);
    await row.getByTitle('Delete').click();
    await page.getByTestId('delete-reward-confirm').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Reward deleted successfully')).toBeVisible();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].url).toContain('/api/rewards/rew-003');
    await expect(page.getByText('Company Mug')).toHaveCount(0);
  });

  // รางวัลที่พนักงานแลกไปแล้วลบไม่ได้: server ตอบ 409 ต้องเห็นข้อความและรางวัลยังอยู่
  test('[High] TC-RWD-010 a reward that was already redeemed cannot be deleted and the server message is shown', { tag: '@high' }, async ({ page }) => {
    await openRewards(page);
    await routeJson(page, '**/api/rewards/*', 'DELETE', { status: 409, body: { success: false, message: 'This reward has already been redeemed' } });
    await page.getByRole('row', { name: /Starbucks Voucher/ }).getByTitle('Delete').click();
    await page.getByTestId('delete-reward-confirm').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('This reward has already been redeemed')).toBeVisible();
    await expect(page.getByRole('row', { name: /Starbucks Voucher/ })).toBeVisible();
  });
});
