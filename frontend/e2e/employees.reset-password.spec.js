import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * เว็บแอดมิน - เมนู All Employees: ปุ่ม Reset password
 *
 * นโยบาย: พนักงานรีเซ็ตรหัสผ่านเองไม่ได้ ต้องแจ้ง Admin ซึ่งกดรีเซ็ตให้จากหน้านี้
 * ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของพนักงาน (เปิดในแอป)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High (รายการทั้งหมดดูใน docs/Login-TestCases.md)
 */

// พนักงานจำลอง 2 คน: คนที่ทำงานอยู่ และคนที่ลาออกแล้ว
const EMPLOYEES = [
  { id: 'EMP-001', code: 'EMP-001', name: 'Somchai Jaidee', firstName: 'Somchai', lastName: 'Jaidee', email: 'somchai@wellx989.com', department: 'IT', gender: 'Male', role: 'Employee', status: 'Active', startDate: '2026-01-05' },
  { id: 'EMP-002', code: 'EMP-002', name: 'Malee Resigned', firstName: 'Malee', lastName: 'Resigned', email: 'malee@wellx989.com', department: 'IT', gender: 'Female', role: 'Employee', status: 'Resign', startDate: '2025-02-01' },
];

// เปิดหน้า All Employees ในสภาพที่ล็อกอินแล้ว โดย mock รายชื่อพนักงานและแผนก
async function openAllEmployees(page) {
  await seedSession(page);
  await mockApi(page);
  // รายชื่อพนักงาน (ลงทะเบียนทีหลัง = มีลำดับก่อน mockApi ทั่วไป)
  await page.route('**/api/employees', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, employees: EMPLOYEES }) });
  });
  await page.route('**/api/departments', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, departments: [{ id: 'DEP-01', name: 'IT' }] }) })
  );
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: /all employees/i })).toBeVisible();
}

const resetButton = (page, name) => page.getByRole('button', { name: `Reset password for ${name}` });

// กลุ่ม: Admin กดรีเซ็ตรหัสผ่านให้พนักงานจากเมนู All Employees
test.describe('All Employees - reset an employee password', () => {
  // กดไอคอนกุญแจ → ยืนยัน → ต้องเรียก POST /api/employees/EMP-001/reset-password และแจ้งว่าส่งลิงก์ไปที่อีเมลที่ปิดบางส่วน
  test('[Critical] TC-RESET-001 an admin resets an employee password and sees the confirmation', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    await openAllEmployees(page);
    // จำลอง API รีเซ็ตรหัสผ่าน และเก็บคำขอไว้ตรวจสอบ
    await page.route('**/api/employees/*/reset-password', (route) => {
      calls.push({ method: route.request().method(), url: route.request().url() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, maskedEmail: 's***i@wellx989.com' }) });
    });

    await resetButton(page, 'Somchai Jaidee').click();
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText(/Password reset link sent to s\*\*\*i@wellx989\.com/)).toBeVisible();
    // ต้องยิง API ครั้งเดียว ด้วยเมธอด POST ไปที่พนักงานคนนั้น
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toMatch(/\/api\/employees\/EMP-001\/reset-password$/);
    // กล่องยืนยันต้องปิดลง
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toHaveCount(0);
  });

  // กดยกเลิกในกล่องยืนยัน ต้องไม่ยิง API
  test('[High] TC-RESET-002 cancelling the confirmation does not send anything', { tag: '@high' }, async ({ page }) => {
    let called = false;
    await openAllEmployees(page);
    await page.route('**/api/employees/*/reset-password', (route) => {
      called = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await resetButton(page, 'Somchai Jaidee').click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toHaveCount(0);
    expect(called).toBe(false);
  });

  // พนักงานที่ลาออกแล้ว ต้องไม่มีปุ่มรีเซ็ตรหัสผ่าน
  test('[High] TC-RESET-003 a resigned employee has no Reset password button', { tag: '@high' }, async ({ page }) => {
    await openAllEmployees(page);
    await expect(resetButton(page, 'Somchai Jaidee')).toBeVisible();
    await expect(resetButton(page, 'Malee Resigned')).toHaveCount(0);
  });

  // ถ้า server ตอบ error ต้องแสดงข้อความผิดพลาดให้ Admin เห็น
  test('[High] TC-RESET-004 a server error is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openAllEmployees(page);
    await page.route('**/api/employees/*/reset-password', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Mail server unavailable' }) })
    );
    await resetButton(page, 'Somchai Jaidee').click();
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Mail server unavailable')).toBeVisible();
  });
});
