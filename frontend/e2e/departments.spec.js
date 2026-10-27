import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { jsonRes, routeMethod } from './helpers.batch1';

/**
 * เว็บแอดมิน - เมนู Organization > Department (/departments และหน้ารายละเอียด /departments/<code>)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ลบแผนกที่ยังมีสมาชิกไม่ได้: server ตอบ 409 พร้อมข้อความ และหน้าเว็บต้องแสดงข้อความนั้น
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const DEPARTMENTS = [
  { id: 'DEP-01', code: 'IT', name: 'Information Technology', employeeCount: 3 },
  { id: 'DEP-02', code: 'HR', name: 'Human Resources', employeeCount: 0 },
];
// สมาชิกของแผนก IT (เรียงตามระดับ: SuperBoss -> Boss -> Employee) และมีคนที่ลาออกแล้ว 1 คน
const EMPLOYEES = [
  { id: 'EMP-010', code: 'EMP-010', name: 'Chai Staff', firstName: 'Chai', lastName: 'Staff', email: 'chai@wellx989.com', phone: '081-111-1111', department: 'Information Technology', role: 'Employee', status: 'Resign', startDate: '2025-01-01', resignDate: '2026-03-31' },
  { id: 'EMP-011', code: 'EMP-011', name: 'Bee Manager', firstName: 'Bee', lastName: 'Manager', email: 'bee@wellx989.com', department: 'Information Technology', role: 'Boss', status: 'Active', startDate: '2024-06-01' },
  { id: 'EMP-012', code: 'EMP-012', name: 'Anan Chief', firstName: 'Anan', lastName: 'Chief', email: 'anan@wellx989.com', department: 'information technology', role: 'SuperBoss', status: 'Active', startDate: '2023-01-15' },
  { id: 'EMP-013', code: 'EMP-013', name: 'Other Dept', firstName: 'Other', lastName: 'Dept', email: 'other@wellx989.com', department: 'Sales', role: 'Employee', status: 'Active', startDate: '2025-05-05' },
];

/**
 * เปิดหน้า Department ที่ path ที่ระบุ ในสภาพที่ล็อกอินแล้ว
 * คืนค่า { state } = state.departments คือรายการที่ GET ตอบ (แก้ไขได้ระหว่างเทส)
 */
async function openDepartments(page, { path = '/departments', listResponse } = {}) {
  const state = { departments: DEPARTMENTS.map((d) => ({ ...d })), gets: 0 };
  await seedSession(page);
  await mockApi(page);
  await routeMethod(page, '**/api/departments', 'GET', (route) => {
    state.gets += 1;
    if (listResponse) return route.fulfill(listResponse);
    return route.fulfill(jsonRes(200, { success: true, departments: state.departments }));
  });
  await routeMethod(page, '**/api/employees', 'GET', (route) => route.fulfill(jsonRes(200, { success: true, employees: EMPLOYEES })));
  await page.goto(path);
  return { state };
}

const listHeading = (page) => page.getByRole('heading', { name: 'Department', exact: true });
const rowOf = (page, name) => page.getByRole('row', { name });
// ฟอร์มใน popup: ช่องแรก = Code ช่องที่สอง = Name
const editForm = (page) => page.locator('form').filter({ has: page.getByRole('button', { name: 'Save Changes' }) });

test.describe('Departments - admin page', () => {
  // รายการแผนก: คอลัมน์ Code / Name / Member / Action และจำนวนสมาชิกจาก server
  test('[Critical] TC-DEP-001 the list shows code, name and member count of each department', { tag: '@critical' }, async ({ page }) => {
    await openDepartments(page);
    await expect(listHeading(page)).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveText(['Code', 'Name', 'Member', 'Action']);
    const it = rowOf(page, /Information Technology/).getByRole('cell');
    await expect(it.nth(0)).toHaveText('IT');
    await expect(it.nth(1)).toHaveText('Information Technology');
    await expect(it.nth(2)).toHaveText('3');
    const hr = rowOf(page, /Human Resources/).getByRole('cell');
    await expect(hr.nth(0)).toHaveText('HR');
    await expect(hr.nth(2)).toHaveText('0');
  });

  // ค้นหาด้วย code / ชื่อ และกรองตามมีสมาชิก / ไม่มีสมาชิก
  test('[High] TC-DEP-002 search and the Members filter narrow the list', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page);
    await expect(listHeading(page)).toBeVisible();
    const search = page.getByPlaceholder('Search code or name...');
    await search.fill('hr');
    await expect(rowOf(page, /Human Resources/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('technology');
    await expect(rowOf(page, /Information Technology/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('zzz');
    await expect(page.getByText('No items yet')).toBeVisible();
    await search.fill('');
    const members = page.getByText('Members:', { exact: true }).locator('..').locator('select');
    await members.selectOption('empty');
    await expect(rowOf(page, /Human Resources/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await members.selectOption('has');
    await expect(rowOf(page, /Information Technology/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
  });

  // กดแถวแผนก -> ไปที่ /departments/<code> แสดงสมาชิกของแผนกนั้นเท่านั้น เรียง SuperBoss -> Boss -> Employee
  test('[Critical] TC-DEP-003 opening a department goes to /departments/<code> and lists only its members', { tag: '@critical' }, async ({ page }) => {
    await openDepartments(page);
    await rowOf(page, /Information Technology/).click();
    await expect(page).toHaveURL(/\/departments\/IT$/);
    await expect(page.getByRole('heading', { name: 'Information Technology' })).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveText(['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Start Date', 'Status']);
    await expect(page.getByText('3 members')).toBeVisible();
    // ข้อมูลแถวหัวตาราง + 3 สมาชิก (ไม่มีคนแผนก Sales) เรียงตามระดับ
    const rows = page.getByRole('row');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(1)).toContainText('Anan');
    await expect(rows.nth(1)).toContainText('SuperBoss (Level 3)');
    await expect(rows.nth(2)).toContainText('Bee');
    await expect(rows.nth(2)).toContainText('Boss (Level 2)');
    await expect(rows.nth(3)).toContainText('Chai');
    await expect(rows.nth(3)).toContainText('Employee (Level 1)');
    // คนที่ลาออกแสดงวันที่ลาออก ส่วนเบอร์ที่ไม่มีแสดง -
    await expect(rows.nth(3)).toContainText('Resigned: 2026-03-31');
    await expect(rows.nth(2).getByRole('cell').nth(4)).toHaveText('-');
    await expect(page.getByText('Other')).toHaveCount(0);
    // ค้นหาสมาชิก
    await page.getByPlaceholder('Search name, employee ID, or email...').fill('bee@');
    await expect(rows).toHaveCount(2);
    await page.getByPlaceholder('Search name, employee ID, or email...').fill('nobody');
    await expect(page.getByText('No employees found in this department')).toBeVisible();
  });

  // path รายละเอียดเปิดตรงๆ และรีเฟรชแล้วยังอยู่หน้าเดิม; ปุ่ม Back ของเบราว์เซอร์กลับไปรายการ
  test('[High] TC-DEP-004 the detail path survives a direct open, a refresh and the Back button', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page, { path: '/departments/IT' });
    await expect(page.getByText('3 members')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/departments\/IT$/);
    await expect(page.getByText('3 members')).toBeVisible();
    // เปิดจากรายการ แล้วกด Back
    await page.goto('/departments');
    await expect(listHeading(page)).toBeVisible();
    await rowOf(page, /Information Technology/).click();
    await expect(page.getByText('3 members')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/departments$/);
    await expect(listHeading(page)).toBeVisible();
  });

  // รหัสแผนกที่ไม่มีอยู่จริง และแผนกที่ไม่มีสมาชิก
  test('[High] TC-DEP-005 an unknown code falls back to the list and an empty department says so', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page, { path: '/departments/NOPE' });
    await expect(listHeading(page)).toBeVisible();
    await expect(rowOf(page, /Human Resources/)).toBeVisible();
    await page.goto('/departments/HR');
    await expect(page.getByText('0 members')).toBeVisible();
    await expect(page.getByText('No employees found in this department')).toBeVisible();
  });

  // สร้างแผนก: ส่ง POST พร้อมชื่อ (ตัดช่องว่าง) และ code ที่กรอก
  test('[Critical] TC-DEP-006 creating a department sends the trimmed name and the typed code', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    const { state } = await openDepartments(page);
    await routeMethod(page, '**/api/departments', 'POST', (route, req) => {
      const body = req.postDataJSON();
      bodies.push(body);
      state.departments.push({ id: 'DEP-03', code: body.code, name: body.name, employeeCount: 0 });
      return route.fulfill(jsonRes(201, { success: true, department: { id: 'DEP-03' } }));
    });
    await expect(listHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'Add New Department' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Department' })).toBeVisible();
    await page.getByPlaceholder('Leave blank to auto-generate a code').fill(' FIN ');
    await page.getByPlaceholder('e.g. Information Technology (IT)').fill('  Finance  ');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Finance added successfully')).toBeVisible();
    expect(bodies).toEqual([{ name: 'Finance', code: 'FIN' }]);
    await expect(page.getByRole('heading', { name: 'Add New Department' })).toHaveCount(0);
    await expect(rowOf(page, /Finance/)).toBeVisible();
  });

  // เว้น code ว่าง -> ไม่ส่ง code ไปเลย เพื่อให้ server สร้างรหัสให้เอง
  test('[High] TC-DEP-007 leaving the code blank sends no code so the server generates one', { tag: '@high' }, async ({ page }) => {
    const bodies = [];
    await openDepartments(page);
    await routeMethod(page, '**/api/departments', 'POST', (route, req) => {
      bodies.push(req.postDataJSON());
      return route.fulfill(jsonRes(201, { success: true }));
    });
    await expect(listHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'Add New Department' }).click();
    await page.getByPlaceholder('e.g. Information Technology (IT)').fill('Marketing');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Marketing added successfully')).toBeVisible();
    expect(bodies).toEqual([{ name: 'Marketing' }]);
  });

  // ไม่กรอกชื่อ: แจ้งให้กรอก ไม่ยิง API และฟอร์มยังเปิดอยู่
  test('[High] TC-DEP-008 saving without a name is blocked and nothing is sent', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openDepartments(page);
    await routeMethod(page, '**/api/departments', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    await expect(listHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'Add New Department' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please enter a name')).toBeVisible();
    expect(posted).toBe(false);
    await expect(page.getByRole('heading', { name: 'Add New Department' })).toBeVisible();
  });

  // server ปฏิเสธ (เช่นรหัสซ้ำ) ต้องแสดงข้อความ และไม่หลอกว่าเพิ่มสำเร็จ
  test('[High] TC-DEP-009 a server error on create is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page);
    await routeMethod(page, '**/api/departments', 'POST', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'Department code IT is already in use' }))
    );
    await expect(listHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'Add New Department' }).click();
    await page.getByPlaceholder('Leave blank to auto-generate a code').fill('IT');
    await page.getByPlaceholder('e.g. Information Technology (IT)').fill('Another IT');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Department code IT is already in use')).toBeVisible();
    await expect(page.getByText(/added successfully/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Add New Department' })).toBeVisible();
  });

  // แก้ไขแผนก: ฟอร์มมีค่าเดิม แล้ว PUT /api/departments/<id> หนึ่งครั้ง และกดแก้ไขไม่ทำให้เปิดหน้ารายละเอียด
  test('[Critical] TC-DEP-010 editing a department sends one PUT with the new name and keeps the list open', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    await openDepartments(page);
    await routeMethod(page, '**/api/departments/*', 'PUT', (route, req) => {
      calls.push({ url: req.url(), body: req.postDataJSON() });
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await expect(listHeading(page)).toBeVisible();
    await rowOf(page, /Information Technology/).getByTitle('Edit', { exact: true }).click();
    await expect(page).toHaveURL(/\/departments$/);
    await expect(page.getByRole('heading', { name: 'Edit Department (IT)' })).toBeVisible();
    const inputs = editForm(page).locator('input[type="text"]');
    await expect(inputs.nth(0)).toHaveValue('IT');
    await expect(inputs.nth(1)).toHaveValue('Information Technology');
    await inputs.nth(1).fill('  IT Services ');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('IT Services updated successfully')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/departments\/DEP-01$/);
    expect(calls[0].body).toEqual({ id: 'DEP-01', name: 'IT Services', code: 'IT' });
    await expect(page.getByRole('heading', { name: 'Edit Department (IT)' })).toHaveCount(0);
  });

  // server ปฏิเสธการแก้ไข ต้องแสดงข้อความและไม่ปิดฟอร์ม
  test('[High] TC-DEP-011 a server error on edit is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page);
    await routeMethod(page, '**/api/departments/*', 'PUT', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'A department with this name already exists' }))
    );
    await expect(listHeading(page)).toBeVisible();
    await rowOf(page, /Human Resources/).getByTitle('Edit', { exact: true }).click();
    await editForm(page).locator('input[type="text"]').nth(1).fill('Information Technology');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('A department with this name already exists')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Department (HR)' })).toBeVisible();
  });

  // ลบแผนกที่ยังมีสมาชิก: server ตอบ 409 -> ต้องแสดงข้อความของ server และแผนกยังอยู่
  test('[Critical] TC-DEP-012 deleting a department that still has members is refused with the server message', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    await openDepartments(page);
    await routeMethod(page, '**/api/departments/*', 'DELETE', (route, req) => {
      calls.push(req.url());
      return route.fulfill(jsonRes(409, { success: false, message: 'Cannot delete a department that still has members' }));
    });
    await expect(listHeading(page)).toBeVisible();
    await rowOf(page, /Information Technology/).getByTitle('Delete', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirm deletion of Department (Information Technology)?' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('Cannot delete a department that still has members')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/api\/departments\/DEP-01$/);
    await expect(page.getByText('Deleted successfully')).toHaveCount(0);
    await expect(rowOf(page, /Information Technology/)).toBeVisible();
  });

  // ลบแผนกที่ว่าง: ต้องมีกล่องยืนยัน ยกเลิกไม่ยิง API ยืนยันแล้ว DELETE และแผนกหายจากรายการ
  test('[Critical] TC-DEP-013 deleting an empty department needs confirmation and removes it', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    const { state } = await openDepartments(page);
    await routeMethod(page, '**/api/departments/*', 'DELETE', (route, req) => {
      calls.push(req.url());
      state.departments = state.departments.filter((d) => d.id !== 'DEP-02');
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await expect(listHeading(page)).toBeVisible();
    await rowOf(page, /Human Resources/).getByTitle('Delete', { exact: true }).click();
    await expect(page.getByText('This data cannot be recovered.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: /Confirm deletion/ })).toHaveCount(0);
    expect(calls).toHaveLength(0);

    await rowOf(page, /Human Resources/).getByTitle('Delete', { exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('Deleted successfully')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/api\/departments\/DEP-02$/);
    await expect(rowOf(page, /Human Resources/)).toHaveCount(0);
    await expect(rowOf(page, /Information Technology/)).toBeVisible();
  });

  // โหลดรายการไม่สำเร็จ ต้องแสดงข้อความจาก server
  test('[High] TC-DEP-014 a failed load shows the server message', { tag: '@high' }, async ({ page }) => {
    await openDepartments(page, { listResponse: jsonRes(500, { success: false, message: 'Organization data is unavailable' }) });
    await expect(page.getByText('Organization data is unavailable')).toBeVisible();
    await expect(page.getByText('No items yet')).toBeVisible();
  });
});
