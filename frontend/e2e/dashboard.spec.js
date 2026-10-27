import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { routeJson } from './helpers.batch2';

/**
 * เว็บแอดมิน - Dashboard Overview (/dashboard) และแถบเมนูด้านซ้าย
 * การ์ดสรุปพนักงานจาก /api/employees, กราฟเข้า-ออกรายเดือน, ลำดับเมนู, สีแถบเมนู, ออกจากระบบ
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ล็อกเวลาเป็น 15 ต.ค. 2026 เพื่อให้ตัวเลข "เดือนนี้" คงที่
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

// พนักงานจำลอง (เวลาล็อกที่ 2026-10-15): ทำงานอยู่ 3 คน, เข้าใหม่เดือนนี้ 1 คน, ลาออก 2 คนที่นับเป็น "เดือนนี้"
const EMPLOYEES = [
  { id: 'E1', name: 'Active Old', status: 'Active', startDate: '2024-01-10' },
  { id: 'E2', name: 'New Hire', status: 'Active', startDate: '2026-10-05' },
  { id: 'E3', name: 'Active 2025', status: 'Active', startDate: '2025-06-01' },
  { id: 'E4', name: 'Resigned This Month', status: 'Resign', resignDate: '2026-10-03' },
  { id: 'E5', name: 'Resigned Last Year', status: 'Resign', resignDate: '2025-05-01' },
  { id: 'E6', name: 'Inactive No Date', status: 'Inactive' },
];

async function openDashboard(page, { employees = EMPLOYEES, employeesResponse } = {}) {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00+07:00'));
  await seedSession(page);
  await mockApi(page);
  const calls = await routeJson(page, '**/api/employees', 'GET', employeesResponse || { body: { success: true, employees } });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  return calls;
}

// ตัวเลขในการ์ด: ป้ายกำกับเป็น <span> และค่าอยู่ใน <div> ถัดไป
const cardValue = (page, label) => page.getByText(label, { exact: true }).locator('xpath=following-sibling::div[1]');
// แถบเมนูฝั่งเดสก์ท็อป (ตัวสำหรับมือถือถูกซ่อนที่จอใหญ่)
const sidebar = (page) => page.locator('aside:visible');

test.describe('Dashboard Overview', () => {
  // การ์ดต้องคำนวณจากข้อมูลพนักงานที่ server ส่งมา: Active / เข้าใหม่เดือนนี้ / ลาออก
  test('[Critical] TC-DASH-001 the stat cards are computed from the employees returned by the server', { tag: '@critical' }, async ({ page }) => {
    const calls = await openDashboard(page);
    await expect(cardValue(page, 'Active Employees')).toHaveText(/^3\s*people$/);
    await expect(cardValue(page, 'New Employee')).toHaveText(/^1\s*people$/);
    await expect(cardValue(page, 'Employee leaves')).toHaveText(/^2\s*people$/);
    expect(calls.length).toBeGreaterThan(0);
    // เรียก API ด้วย token ของแอดมิน
    expect(calls[0].headers.authorization).toBe('Bearer seeded-test-token');
    // ชื่อผู้ใช้ที่ล็อกอินอยู่แสดงที่มุมขวาบน
    await expect(page.locator('header').getByText('Super Admin')).toBeVisible();
  });

  // ไม่มีพนักงานเลย การ์ดต้องเป็น 0 (ไม่มีตัวเลขจำลองค้างอยู่)
  test('[High] TC-DASH-002 with no employees every card shows 0', { tag: '@high' }, async ({ page }) => {
    await openDashboard(page, { employees: [] });
    await expect(cardValue(page, 'Active Employees')).toHaveText(/^0\s*people$/);
    await expect(cardValue(page, 'New Employee')).toHaveText(/^0\s*people$/);
    await expect(cardValue(page, 'Employee leaves')).toHaveText(/^0\s*people$/);
    await expect(page.locator('[title^="New hires:"]')).toHaveCount(0);
    await expect(page.locator('[title^="Exits:"]')).toHaveCount(0);
  });

  // กราฟเข้า-ออกรายเดือนนับจากวันเริ่มงาน/วันลาออกจริง และเปลี่ยนปีแล้วกราฟเปลี่ยนตาม
  test('[High] TC-DASH-003 the hires and exits chart follows the selected year', { tag: '@high' }, async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByRole('heading', { name: 'Employee Hires and Exits Report' })).toBeVisible();
    // 2026: เข้าใหม่ 1 คน (ต.ค.) ลาออก 2 คน (E4 + E6 ที่ไม่มีวันลาออกนับเป็นเดือนปัจจุบัน)
    await expect(page.getByTitle('New hires: 1')).toHaveCount(1);
    await expect(page.getByTitle('Exits: 2')).toHaveCount(1);
    await page.getByRole('combobox').selectOption('2025');
    // 2025: เข้าใหม่ 1 คน (มิ.ย.) ลาออก 1 คน (พ.ค.)
    await expect(page.getByTitle('Exits: 2')).toHaveCount(0);
    await expect(page.getByTitle('Exits: 1')).toHaveCount(1);
    await expect(page.getByTitle('New hires: 1')).toHaveCount(1);
  });

  // ถ้าโหลดข้อมูลพนักงานไม่สำเร็จ ควรบอกผู้ใช้ ไม่ใช่แสดง 0 เหมือนไม่มีพนักงาน
  // BUG ของสินค้า: DashboardPage.jsx จับ error แล้วแค่ console.log จึงไม่มีข้อความผิดพลาดบนหน้า (ขัดกับกฎ "แสดงความล้มเหลวให้ผู้ใช้เห็น")
  test.fixme('[High] TC-DASH-004 a failed employees request shows an error instead of zeros', { tag: '@high' }, async ({ page }) => {
    await openDashboard(page, { employeesResponse: { status: 500, body: { success: false, message: 'Employee data is unavailable' } } });
    await expect(page.getByText(/unable to load|employee data is unavailable/i)).toBeVisible();
  });
});

test.describe('Dashboard sidebar', () => {
  // ลำดับเมนู: Dashboard, Employee & Point, Attendance, Mission, Reward, Announcements, Organization, Settings, Role & Permission
  test('[Critical] TC-DASH-005 the sidebar menus are in the agreed order for a Super Admin', { tag: '@critical' }, async ({ page }) => {
    await openDashboard(page);
    const tops = sidebar(page).locator('nav').locator(':scope > button, :scope > div > button');
    await expect(tops).toHaveText([
      'Dashboard Overview',
      'Employee & Point',
      'Attendance',
      'Mission',
      'Reward',
      'Announcements',
      'Organization',
      'Settings',
      'Role & Permission',
    ]);
    // เมนูย่อยของกลุ่มที่เปิดดู
    await sidebar(page).getByRole('button', { name: 'Reward', exact: true }).click();
    await expect(sidebar(page).getByRole('button', { name: 'Rewards Catalog & Inventory' })).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Reward Categories' })).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(sidebar(page).getByRole('button', { name: 'Work Time Settings' })).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Work Locations' })).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: 'Leave Quotas & Policies' })).toBeVisible();
  });

  // ธีม: แถบเมนูสีฟ้า #3B82F6 ตัวอักษรขาว หน้าที่เปิดอยู่เป็นแคปซูลขาวตัวอักษรน้ำเงิน
  test('[High] TC-DASH-006 the sidebar is blue #3B82F6 and the open page is a white capsule', { tag: '@high' }, async ({ page }) => {
    await openDashboard(page);
    await expect(sidebar(page)).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await expect(sidebar(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
    const active = sidebar(page).getByRole('button', { name: 'Dashboard Overview' });
    await expect(active).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(active).toHaveCSS('color', 'rgb(37, 99, 235)');
    // เมนูที่ไม่ได้เปิดอยู่เป็นตัวอักษรขาวบนพื้นฟ้า (พื้นโปร่งใส)
    await expect(sidebar(page).getByRole('button', { name: 'Attendance' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  // กดเมนูแล้ว URL เปลี่ยนเป็น path ของเมนูนั้น และเมนูที่เปิดอยู่ถูกไฮไลต์
  test('[High] TC-DASH-007 clicking menus changes the path and highlights the open menu', { tag: '@high' }, async ({ page }) => {
    await openDashboard(page);
    await sidebar(page).getByRole('button', { name: 'Announcements' }).click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(sidebar(page).getByRole('button', { name: 'Announcements' })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await sidebar(page).getByRole('button', { name: 'Mission', exact: true }).click();
    await sidebar(page).getByRole('button', { name: 'Quest Management' }).click();
    await expect(page).toHaveURL(/\/missions$/);
    await sidebar(page).getByRole('button', { name: 'Dashboard Overview' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  });

  // ปุ่ม Logout (ทั้งที่แถบเมนูและเมนูโปรไฟล์) ต้องล้าง session และกลับหน้า /login
  test('[Critical] TC-DASH-008 Logout clears the session and returns to the login page', { tag: '@critical' }, async ({ page }) => {
    await openDashboard(page);
    await sidebar(page).getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#username')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('wellx989_token'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('wellx989_user'))).toBeNull();

    // เข้าสู่ระบบใหม่ (seedSession) แล้วออกจากระบบผ่านเมนูโปรไฟล์มุมขวาบน
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
    await page.locator('header').getByRole('button', { name: /Super Admin/ }).click();
    await page.locator('header').getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('wellx989_token'))).toBeNull();
  });
});
