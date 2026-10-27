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
  await page.goto('/settings/work-locations');
  await expect(page.getByRole('heading', { name: /work locations/i })).toBeVisible();
}

test.describe('Work Locations - admin page', () => {
  // แสดงรายการสถานที่ พร้อมรัศมีและกลุ่มผู้ที่ใช้ได้
  test('[Critical] TC-LOC-001 the list shows each location with who can use it', { tag: '@critical' }, async ({ page }) => {
    await openWorkLocations(page);
    const row = page.getByRole('row', { name: /Head Office/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('All employees');
    await expect(row).toContainText('Active');
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

  // วางลิงก์ Google Maps (มีพิกัดอยู่ในลิงก์) หรือพิกัดตรงๆ แล้วกด Search หมุดต้องไปอยู่ที่นั่นทันที โดยไม่ต้องเรียกบริการค้นหา
  test('[High] TC-LOC-007 pasting coordinates or a Google Maps link fills latitude and longitude', { tag: '@high' }, async ({ page }) => {
    let searched = false;
    await openWorkLocations(page, []);
    await page.route('**/nominatim.openstreetmap.org/**', (route) => { searched = true; return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
    await page.getByRole('button', { name: /add location/i }).click();
    const box = page.getByLabel('Search place');
    await box.fill('13.8268, 100.5390');
    await box.press('Enter');
    await expect(page.getByPlaceholder('13.756300')).toHaveValue('13.826800');
    await expect(page.getByPlaceholder('100.501800')).toHaveValue('100.539000');
    await box.fill('https://www.google.com/maps/place/Office/@13.9,100.6,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d13.7467!4d100.5349');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    // the place pin (!3d/!4d) wins over the map centre (@)
    await expect(page.getByPlaceholder('13.756300')).toHaveValue('13.746700');
    await expect(page.getByPlaceholder('100.501800')).toHaveValue('100.534900');
    expect(searched).toBe(false);
  });

  // พิมพ์ที่อยู่ → ได้รายการผลลัพธ์ เลือกอันไหนหมุดย้ายไปที่นั่น และเติมที่อยู่ให้ถ้ายังว่าง
  test('[High] TC-LOC-008 searching an address lists places and picking one moves the pin', { tag: '@high' }, async ({ page }) => {
    await openWorkLocations(page, []);
    await page.route('**/nominatim.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { display_name: 'Siam Paragon, Rama I Road, Bangkok', lat: '13.746', lon: '100.535' },
          { display_name: 'Siam Square, Bangkok', lat: '13.745', lon: '100.534' },
        ]),
      })
    );
    await page.getByRole('button', { name: /add location/i }).click();
    await page.getByLabel('Search place').fill('Siam Paragon');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByTestId('place-results').getByRole('button')).toHaveCount(2);
    await page.getByTestId('place-results').getByRole('button', { name: /Siam Paragon/ }).click();
    await expect(page.getByPlaceholder('13.756300')).toHaveValue('13.746000');
    await expect(page.getByPlaceholder('100.501800')).toHaveValue('100.535000');
    await expect(page.getByPlaceholder('Building, street, district')).toHaveValue('Siam Paragon, Rama I Road, Bangkok');
    await expect(page.getByTestId('place-results')).toHaveCount(0);
  });

  // เลือกพนักงานแล้ว ชื่อต้องไปอยู่ในช่องค้นหาเลย (เป็น chip ในช่อง) ไม่ใช่อยู่ใต้ช่อง
  test('[High] TC-LOC-006 a picked employee appears as a chip inside the search field', { tag: '@high' }, async ({ page }) => {
    await openWorkLocations(page, []);
    await page.route('**/api/employees', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, employees: [{ id: 'EMP-002', code: 'EMP-002', name: 'Somchai Jaidee', department: 'IT', status: 'Active' }] }),
      });
    });
    await page.getByRole('button', { name: /add location/i }).click();
    await page.getByLabel('Specific employees').check();
    const input = page.getByPlaceholder(/click and type a name/i);
    await input.click();
    await page.getByRole('button', { name: /Somchai Jaidee/ }).click();
    // ชื่ออยู่ในกรอบเดียวกับช่องพิมพ์ และช่องเปลี่ยนเป็นข้อความ "Add more employees..."
    const field = page.getByTestId('member-field');
    await expect(page.getByPlaceholder('Add more employees...')).toBeVisible();
    await expect(field).toContainText('Somchai Jaidee');
    // กด X ที่ chip แล้วชื่อหายไป
    await field.getByTitle('Remove').click();
    await expect(field).not.toContainText('Somchai Jaidee');
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
