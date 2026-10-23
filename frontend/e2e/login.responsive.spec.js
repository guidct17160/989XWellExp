import { test, expect } from '@playwright/test';
import { expectDashboard, fillLogin, loginScreen, mockApi, mockLogin } from './helpers';

/**
 * เว็บแอดมิน - หน้า Login บนจอขนาดมือถือ (project "mobile" = Pixel 7)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ตรวจว่าไม่ล้นจอ ปุ่มจิ้มง่าย และล็อกอินด้วยการแตะได้
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High (ระดับ Medium/Low ทดสอบมือ ดูรายการใน docs/Login-TestCases.md)
 * - สั่งรันเฉพาะระดับได้ เช่น npm run test:e2e:critical
 */

test.beforeEach(async ({ page }) => {
  // ก่อนเริ่มเคส: mock API ทั้งหมดให้ตอบ success เพื่อไม่ให้เรียก server จริง
  await mockApi(page);
  await page.goto('/login');
});

// บนมือถือ การ์ด Login ต้องพอดีหน้าจอ ไม่ต้องเลื่อนซ้าย-ขวา
test('[High] TC-LOGIN-060 the whole sign-in card fits the screen without sideways scrolling', { tag: '@high' }, async ({ page }) => {
  const s = loginScreen(page);
  await expect(s.signInShown).toBeVisible();
  await expect(s.submit).toBeVisible();
  // ความกว้างของเนื้อหาต้องไม่เกินความกว้างจอ (ถ้าเกินแปลว่าต้องเลื่อนซ้าย-ขวา)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const box = await s.submit.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});


// บนมือถือ ต้องล็อกอินด้วยการแตะ (tap) แล้วเข้า Dashboard ได้
test('[High] TC-LOGIN-062 a user can sign in by tapping', { tag: '@high' }, async ({ page }) => {
  await mockLogin(page);
  const s = await fillLogin(page, 'admin@wellx989.com', 'Secret123');
  // แตะปุ่ม Login (แทนการคลิกเมาส์)
  await s.submit.tap();
  await expectDashboard(page, expect);
  expect(new URL(page.url()).pathname).toBe('/dashboard');
});

