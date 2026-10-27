import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู Announcements (/announcements)
 * รายการประกาศจากฐานข้อมูลจริง, สร้าง/แก้ไข/ลบ, รูป PNG / GIF ขนาดเท่าไหร่ก็ได้
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const ITEMS = [
  {
    id: 'anno-a1', title: 'Office closed on 13 October', description: 'The office is closed.',
    startDate: '2026-10-20', startTime: '08:00', endDate: '2099-12-31', endTime: '23:59', noEndDate: false,
    status: 'Active', hasImage: false, createdDate: '2026-10-20', createdTime: '08:00',
  },
  {
    id: 'anno-b2', title: 'Team building day', description: 'Join us.',
    startDate: '2099-01-01', startTime: '09:00', endDate: null, endTime: null, noEndDate: true,
    status: 'Scheduled', hasImage: false, createdDate: '2026-10-22', createdTime: '10:30',
  },
  {
    id: 'anno-c3', title: 'Old system notice', description: 'Done.',
    startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-10', endTime: '18:00', noEndDate: false,
    status: 'Expired', hasImage: false, createdDate: '2026-09-01', createdTime: '09:00',
  },
];

// a valid 1 x 1 PNG: pictures of any size are accepted
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function openAnnouncements(page, items = ITEMS) {
  await seedSession(page);
  await mockApi(page);
  await page.route('**/api/announcements/all', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, announcements: items }) })
  );
  await page.goto('/announcements');
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
}

test.describe('Announcements - admin page', () => {
  // รายการต้องแสดงชื่อ วันเริ่ม/จบ (ไม่มีวันจบ = No end date) และสถานะ
  test('[Critical] TC-ANN-001 the list shows title, dates and status from the server', { tag: '@critical' }, async ({ page }) => {
    await openAnnouncements(page);
    const active = page.getByRole('row', { name: /Office closed on 13 October/ });
    await expect(active).toContainText('2026-10-20 08:00');
    await expect(active).toContainText('Active');
    await expect(page.getByRole('row', { name: /Team building day/ })).toContainText('No end date');
    await expect(page.getByRole('row', { name: /Team building day/ })).toContainText('Scheduled');
    await expect(page.getByRole('row', { name: /Old system notice/ })).toContainText('Expired');
  });

  // เลือกสถานะแล้วต้องเหลือเฉพาะรายการนั้น
  test('[High] TC-ANN-002 the Status filter keeps only the chosen status', { tag: '@high' }, async ({ page }) => {
    await openAnnouncements(page);
    await page.getByRole('combobox').selectOption('Expired');
    await expect(page.getByText('Old system notice')).toBeVisible();
    await expect(page.getByText('Office closed on 13 October')).toHaveCount(0);
  });

  // ยังไม่มีประกาศเลย ต้องบอกให้สร้าง (ไม่มีข้อมูลจำลองค้างอยู่)
  test('[High] TC-ANN-003 with no announcements the page says so instead of showing sample data', { tag: '@high' }, async ({ page }) => {
    await openAnnouncements(page, []);
    await expect(page.getByText(/No announcements yet/)).toBeVisible();
  });

  // กรอกชื่อ/รายละเอียด ติ๊ก No end date แล้ว Submit ต้องส่งข้อมูลถูกต้องไป POST /api/announcements
  test('[Critical] TC-ANN-004 a new announcement is sent to the server with the right values', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    await openAnnouncements(page);
    await page.route('**/api/announcements', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, announcement: ITEMS[0] }) });
    });
    await page.getByRole('button', { name: /add new announcement/i }).click();
    const form = page.getByTestId('announcement-form');
    await form.getByPlaceholder('Enter title').fill('Safety week');
    await form.getByPlaceholder('Enter description').fill('Wear your helmet.');
    await form.getByLabel('No end date').check();
    await form.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Announcement created')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ title: 'Safety week', description: 'Wear your helmet.', noEndDate: true, endDate: null, endTime: null });
    expect(bodies[0]).not.toHaveProperty('category');
    expect(bodies[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ต้องกรอกชื่อและรายละเอียด ไม่งั้นไม่ส่งไป server
  test('[High] TC-ANN-005 title and description are required', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openAnnouncements(page);
    await page.route('**/api/announcements', (route) => {
      if (route.request().method() === 'POST') posted = true;
      return route.fallback();
    });
    await page.getByRole('button', { name: /add new announcement/i }).click();
    await page.getByTestId('announcement-form').getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Title is required')).toBeVisible();
    expect(posted).toBe(false);
  });

  // รูปขนาดเท่าไหร่ก็แนบได้ (เล็ก 1 x 1 ก็ได้) และขึ้นรูปตัวอย่าง ส่วนไฟล์ที่ไม่ใช่ PNG / GIF ถูกปฏิเสธ
  test('[High] TC-ANN-006 a picture of any size is accepted, other file types are not', { tag: '@high' }, async ({ page }) => {
    await openAnnouncements(page);
    await page.getByRole('button', { name: /add new announcement/i }).click();
    const form = page.getByTestId('announcement-form');
    await page.getByTestId('announcement-image-input').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(form.getByRole('img', { name: 'Announcement' })).toBeVisible();
    await expect(form.getByText(/must be exactly/)).toHaveCount(0);
    await form.getByRole('button', { name: 'Remove image' }).click();
    await page.getByTestId('announcement-image-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(form.getByText('The image must be a PNG or GIF file')).toBeVisible();
  });

  // ฟอร์มไม่มีช่อง Category แล้ว
  test('[High] TC-ANN-008 the form has no Category field', { tag: '@high' }, async ({ page }) => {
    await openAnnouncements(page);
    await page.getByRole('button', { name: /add new announcement/i }).click();
    await expect(page.getByTestId('announcement-form').getByText('Category')).toHaveCount(0);
  });

  // ลบต้องมี popup ยืนยัน ยกเลิกแล้วไม่ลบ ยืนยันแล้วเรียก DELETE
  test('[High] TC-ANN-007 delete asks for confirmation first', { tag: '@high' }, async ({ page }) => {
    const deleted = [];
    await openAnnouncements(page);
    await page.route('**/api/announcements/*', (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      deleted.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    const row = page.getByRole('row', { name: /Old system notice/ });
    await row.getByTitle('Delete announcement').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(deleted).toHaveLength(0);
    await row.getByTitle('Delete announcement').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('"Old system notice" deleted')).toBeVisible();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain('/api/announcements/anno-c3');
  });
});
