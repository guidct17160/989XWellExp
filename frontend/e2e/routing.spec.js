import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เส้นทาง (URL) ของแต่ละเมนู ใช้ react-router
 *
 * - /dashboard, /employees, /rewards/categories, /rewards/categories/CAT-002 ฯลฯ (ดู src/routes.js)
 * - ลิงก์เก่า /?tab=<เมนู>&id=<รหัส> ต้องพาไปเส้นทางใหม่
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 */

async function signedIn(page) {
  await seedSession(page);
  await mockApi(page);
}

test.describe('Web admin routing', () => {
  // เข้า / ตอนล็อกอินอยู่ ต้องไปที่ /dashboard
  test('[Critical] TC-ROUTE-001 / opens the Dashboard at /dashboard', { tag: '@critical' }, async ({ page }) => {
    await signedIn(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  });

  // กดเมนูใน sidebar แล้ว URL เป็น path ที่อ่านง่าย และปุ่ม Back กลับมาที่หน้าก่อนหน้า
  test('[Critical] TC-ROUTE-002 sidebar menus change the path and Back returns to the previous page', { tag: '@critical' }, async ({ page }) => {
    await signedIn(page);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /^Reward$/ }).first().click();
    await page.getByRole('button', { name: 'Reward Categories' }).first().click();
    await expect(page).toHaveURL(/\/rewards\/categories$/);
    await expect(page.getByRole('heading', { name: /reward categories/i })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  // ลิงก์เก่าแบบ ?tab= ต้องถูกแปลงเป็นเส้นทางใหม่ (รวมรหัสรายละเอียด)
  test('[High] TC-ROUTE-003 an old /?tab=...&id=... bookmark opens the new path', { tag: '@high' }, async ({ page }) => {
    await signedIn(page);
    await page.goto('/?tab=reward-categories&id=CAT-002');
    await expect(page).toHaveURL(/\/rewards\/categories\/CAT-002$/);
    await page.goto('/?tab=all-employee');
    await expect(page).toHaveURL(/\/employees$/);
  });

  // เส้นทางที่ไม่มีอยู่ ต้องพากลับ Dashboard ไม่ใช่หน้าว่าง
  test('[High] TC-ROUTE-004 an unknown path falls back to the Dashboard', { tag: '@high' }, async ({ page }) => {
    await signedIn(page);
    await page.goto('/no-such-page');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  // รีเฟรชในหน้ารายละเอียด (path ลึก) ต้องอยู่หน้าเดิม
  test('[High] TC-ROUTE-005 refreshing a detail page keeps the same path', { tag: '@high' }, async ({ page }) => {
    await signedIn(page);
    await page.goto('/rewards/categories/CAT-002');
    await page.reload();
    await expect(page).toHaveURL(/\/rewards\/categories\/CAT-002$/);
  });
});
