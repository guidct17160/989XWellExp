import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู Attendance > Work Locations (สถานที่ทำงานที่พนักงานลงเวลาได้)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ไทล์แผนที่ (OpenStreetMap) ถูกบล็อกไว้ เพื่อให้เทสไม่ต้องใช้อินเทอร์เน็ต
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const LOCATIONS = [
  {
    id: 'loc-1', name: 'Head Office', type: 'Office', address: 'Rajapruek', latitude: 13.8268, longitude: 100.539,
    radiusM: 100, status: 'Active', scope: 'all', departmentIds: [], members: [], assignedCount: 12,
  },
];

// เปิดหน้า Work Locations ในสภาพที่ล็อกอินแล้ว โดย mock รายการสถานที่
async function openWorkLocations(page, locations = LOCATIONS) {
  await seedSession(page);
  await mockApi(page);
  await page.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/work-locations', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, locations }) });
  });
  await page.goto('/attendance/work-locations');
  await expect(page.getByRole('heading', { name: /work locations/i })).toBeVisible();
}

test.describe('Work Locations - admin page', () => {
  // แสดงรายการสถานที่ พร้อมรัศมีและกลุ่มผู้ที่ใช้ได้
  test('[Critical] TC-LOC-001 the list shows each location with radius and who can use it', { tag: '@critical' }, async ({ page }) => {
    await openWorkLocations(page);
    const row = page.getByRole('row', { name: /Head Office/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('100 m');
    await expect(row).toContainText('All employees');
    await expect(row).toContainText('Active');
  });

  // ยังไม่มีสถานที่เลย ต้องเตือนแอดมินว่าพนักงานลงเวลาจากที่ไหนก็ได้
  test('[High] TC-LOC-002 with no location the admin is warned that employees can punch anywhere', { tag: '@high' }, async ({ page }) => {
    await openWorkLocations(page, []);
    await expect(page.getByText(/can currently clock in \/ out from anywhere/i)).toBeVisible();
  });

  // บันทึกโดยไม่ปักหมุด ต้องไม่ยิง API และแสดงข้อความให้ปักหมุดก่อน
  test('[High] TC-LOC-003 saving without a pinned position is blocked', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openWorkLocations(page, []);
    await page.route('**/api/work-locations', (route) => {
      if (route.request().method() === 'POST') posted = true;
      return route.fallback();
    });
    await page.getByRole('button', { name: /add location/i }).click();
    await page.getByPlaceholder('e.g. Head Office').fill('Branch A');
    await page.getByRole('button', { name: /save location/i }).click();
    await expect(page.getByText(/pin the location on the map/i)).toBeVisible();
    expect(posted).toBe(false);
  });

  // กรอกพิกัดและรัศมีครบ → ต้องยิง POST ด้วยข้อมูลที่ถูกต้อง
  test('[Critical] TC-LOC-004 a valid location is sent to the server with the right values', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    await openWorkLocations(page, []);
    await page.route('**/api/work-locations', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, location: {} }) });
    });
    await page.getByRole('button', { name: /add location/i }).click();
    await page.getByPlaceholder('e.g. Head Office').fill('Branch A');
    await page.getByPlaceholder('13.756300').fill('13.7563');
    await page.getByPlaceholder('100.501800').fill('100.5018');
    await page.getByRole('spinbutton').fill('150');
    await page.getByRole('button', { name: /save location/i }).click();
    await expect(page.getByText('Work location created')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ name: 'Branch A', latitude: 13.7563, longitude: 100.5018, radiusM: 150, scope: 'all', status: 'Active' });
  });

  // ถ้า server ตอบ error ต้องแสดงข้อความให้แอดมินเห็น
  test('[High] TC-LOC-005 a server error is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openWorkLocations(page, []);
    await page.route('**/api/work-locations', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Radius must be between 20 and 5,000 metres' }) });
    });
    await page.getByRole('button', { name: /add location/i }).click();
    await page.getByPlaceholder('e.g. Head Office').fill('Branch A');
    await page.getByPlaceholder('13.756300').fill('13.7563');
    await page.getByPlaceholder('100.501800').fill('100.5018');
    await page.getByRole('button', { name: /save location/i }).click();
    await expect(page.getByText('Radius must be between 20 and 5,000 metres')).toBeVisible();
  });
});
