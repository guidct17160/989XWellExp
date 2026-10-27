import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockApi, seedSession } from './helpers';
import { jsonRes, routeMethod } from './helpers.batch1';

/**
 * เว็บแอดมิน - เมนู All Employees (/employees): รายการ ค้นหา/กรอง สร้าง แก้ไข ลบ และเปลี่ยนสถานะ
 * (ปุ่ม Reset password มีเทสแยกอยู่ที่ employees.reset-password.spec.js จึงไม่ทำซ้ำที่นี่)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const EMPLOYEES = [
  { id: 'EMP-001', code: 'EMP-001', name: 'Somchai Jaidee', firstName: 'Somchai', lastName: 'Jaidee', email: 'somchai@wellx989.com', department: 'IT', gender: 'Male', role: 'Employee', status: 'Active', startDate: '2026-01-05' },
  { id: 'EMP-002', code: 'EMP-002', name: 'Malee Rungrueang', firstName: 'Malee', lastName: 'Rungrueang', email: 'malee@wellx989.com', department: 'HR', gender: 'Female', role: 'Boss', status: 'Active', startDate: '2025-03-10' },
  { id: 'EMP-003', code: 'EMP-003', name: 'Resigned Person', firstName: 'Resigned', lastName: 'Person', email: 'gone@wellx989.com', department: 'IT', gender: 'Male', role: 'Employee', status: 'Resign', startDate: '2024-02-01', resignDate: '2026-02-01' },
];
const DEPARTMENTS = [{ id: 'DEP-01', name: 'IT' }, { id: 'DEP-02', name: 'HR' }];

/**
 * เปิดหน้า All Employees ในสภาพที่ล็อกอินแล้ว
 * คืนค่า { state } = state.employees คือรายชื่อที่ GET /api/employees ตอบ (แก้ไขได้ระหว่างเทส), state.gets = จำนวนครั้งที่โหลดรายชื่อ
 */
async function openEmployees(page, { listResponse } = {}) {
  const state = { employees: EMPLOYEES.map((e) => ({ ...e })), gets: 0 };
  await seedSession(page);
  await mockApi(page);
  await routeMethod(page, '**/api/employees', 'GET', (route) => {
    state.gets += 1;
    if (listResponse) return route.fulfill(listResponse);
    return route.fulfill(jsonRes(200, { success: true, employees: state.employees }));
  });
  await routeMethod(page, '**/api/departments', 'GET', (route) => route.fulfill(jsonRes(200, { success: true, departments: DEPARTMENTS })));
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'All Employees' })).toBeVisible();
  return { state };
}

const rowOf = (page, name) => page.getByRole('row', { name });

// เปิดฟอร์มสร้างพนักงานแล้วกรอกข้อมูลที่จำเป็น (ช่องในฟอร์มไม่ผูก label จึงอ้างด้วย placeholder / name)
async function fillCreateForm(page, { first = 'Tester', last = 'One', email = 'tester.one@wellx989.com', department = 'IT' } = {}) {
  await page.getByRole('button', { name: 'Create / Register New Employee' }).click();
  await expect(page.getByRole('heading', { name: 'Create / Register New Employee' })).toBeVisible();
  await page.getByPlaceholder('e.g. Somchai').fill(first);
  await page.getByPlaceholder('e.g. Jaidee').fill(last);
  await page.getByPlaceholder('somchai@wellx989.com').fill(email);
  if (department) await page.locator('select[name="department"]').selectOption(department);
}

const saveCreate = (page) => page.getByRole('button', { name: 'Save and Create Employee' });

test.describe('All Employees - list, create, edit, delete', () => {
  // รายการต้องมีคอลัมน์ครบ (รวม Email) และแสดงข้อมูลของแต่ละคนถูกช่อง
  test('[Critical] TC-EMP-001 the list shows every column including Email', { tag: '@critical' }, async ({ page }) => {
    await openEmployees(page);
    await expect(page.getByRole('columnheader')).toHaveText([
      'ID', 'First Name', 'Last Name', 'Email', 'Department', 'Gender', 'Role', 'Start Date', 'Status', 'Actions',
    ]);
    const cells = rowOf(page, /Malee/).getByRole('cell');
    await expect(cells.nth(0)).toHaveText('EMP-002');
    await expect(cells.nth(1)).toHaveText('Malee');
    await expect(cells.nth(2)).toHaveText('Rungrueang');
    await expect(cells.nth(3)).toHaveText('malee@wellx989.com');
    await expect(cells.nth(4)).toHaveText('HR');
    await expect(cells.nth(5)).toContainText('Female');
    await expect(cells.nth(6)).toContainText('Boss');
    await expect(cells.nth(7)).toHaveText('2025-03-10');
    await expect(cells.nth(8)).toContainText('Active');
    await expect(page.getByRole('row')).toHaveCount(4); // หัวตาราง + 3 พนักงาน
  });

  // ค้นหาด้วยชื่อ / อีเมล / รหัส / แผนก และกรองตาม Status, Gender, Department
  test('[High] TC-EMP-002 search and the Status / Gender / Department filters narrow the list', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page);
    const search = page.getByPlaceholder('Search ID, name, email, department...');
    await search.fill('malee@');
    await expect(rowOf(page, /Malee/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('emp-003');
    await expect(rowOf(page, /Resigned/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('somchai');
    await expect(rowOf(page, /Somchai/)).toBeVisible();
    await search.fill('zzz-no-match');
    await expect(page.getByText('No employees match the filters')).toBeVisible();
    await search.fill('');

    const filter = (label) => page.getByText(`${label}:`, { exact: true }).locator('..').locator('select');
    await filter('Status').selectOption('Resign');
    await expect(rowOf(page, /Resigned/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await filter('Status').selectOption('');
    await filter('Gender').selectOption('Female');
    await expect(rowOf(page, /Malee/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await filter('Gender').selectOption('');
    await filter('Department').selectOption('IT');
    await expect(page.getByRole('row')).toHaveCount(3);
    await expect(rowOf(page, /Malee/)).toHaveCount(0);
  });

  // สร้างพนักงาน: กรอกฟอร์ม -> กล่องยืนยัน -> POST /api/employees ด้วยข้อมูลที่ถูกต้อง แล้วโหลดรายชื่อใหม่
  test('[Critical] TC-EMP-003 creating an employee sends the right body after the confirmation step', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    const { state } = await openEmployees(page);
    await routeMethod(page, '**/api/employees', 'POST', (route, req) => {
      const body = req.postDataJSON();
      bodies.push(body);
      state.employees.push({ id: 'EMP-004', code: body.code, name: body.name, firstName: body.firstName, lastName: body.lastName, email: body.email, department: body.department, gender: body.gender, role: body.role, status: 'Pending', startDate: body.startDate });
      return route.fulfill(jsonRes(201, { success: true, employee: { id: 'EMP-004' } }));
    });
    await fillCreateForm(page, { first: 'Tester', last: 'One', email: 'Tester.One@wellx989.com', department: 'HR' });
    await page.locator('select[name="gender"]').selectOption('Female');
    await page.locator('select[name="role"]').selectOption('Boss');
    await saveCreate(page).click();

    // ต้องยังไม่ยิง API จนกว่าจะกดยืนยัน และกล่องยืนยันสรุปข้อมูลให้ตรวจ
    await expect(page.getByRole('heading', { name: 'Confirm Employee Creation' })).toBeVisible();
    expect(bodies).toHaveLength(0);
    await expect(page.getByText('Tester One', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm and Send Email' }).click();

    await expect(page.getByText(/Employee Tester One created successfully/)).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      code: 'EMP-004', firstName: 'Tester', lastName: 'One', name: 'Tester One', email: 'Tester.One@wellx989.com',
      gender: 'Female', department: 'HR', role: 'Boss', status: 'Pending',
    });
    expect(bodies[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // ฟอร์มปิดลง และรายชื่อถูกโหลดใหม่ เห็นพนักงานใหม่ในตาราง
    await expect(page.getByRole('heading', { name: 'Create / Register New Employee' })).toHaveCount(0);
    await expect(rowOf(page, /Tester/)).toBeVisible();
    expect(state.gets).toBeGreaterThanOrEqual(2);
  });

  // ฟอร์มสร้างที่กรอกไม่ครบ (ไม่มีชื่อ/นามสกุล/แผนก) ต้องไม่ไปถึงกล่องยืนยันและไม่ยิง API
  test('[High] TC-EMP-004 an incomplete create form is blocked before any request', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openEmployees(page);
    await routeMethod(page, '**/api/employees', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    // ไม่กรอกชื่อ
    await fillCreateForm(page, { first: '', last: '', email: 'x@wellx989.com', department: 'IT' });
    await saveCreate(page).click();
    await expect(page.getByRole('heading', { name: 'Confirm Employee Creation' })).toHaveCount(0);
    // กรอกชื่อแล้วแต่ยังไม่เลือกแผนก
    await page.getByPlaceholder('e.g. Somchai').fill('Tester');
    await page.getByPlaceholder('e.g. Jaidee').fill('One');
    await page.locator('select[name="department"]').selectOption('');
    await saveCreate(page).click();
    await expect(page.getByRole('heading', { name: 'Confirm Employee Creation' })).toHaveCount(0);
    // รูปแบบอีเมลผิด
    await page.locator('select[name="department"]').selectOption('IT');
    await page.getByPlaceholder('somchai@wellx989.com').fill('not-an-email');
    await saveCreate(page).click();
    await expect(page.getByRole('heading', { name: 'Confirm Employee Creation' })).toHaveCount(0);
    expect(posted).toBe(false);
    // ฟอร์มยังเปิดอยู่ให้แก้ต่อ
    await expect(page.getByRole('heading', { name: 'Create / Register New Employee' })).toBeVisible();
  });

  // อีเมลที่มีอยู่แล้ว: ขึ้นเตือนในฟอร์ม และตอนกดบันทึกขึ้นกล่อง Duplicate Email! โดยไม่ยิง API
  test('[High] TC-EMP-005 a duplicate email is rejected before any request', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openEmployees(page);
    await routeMethod(page, '**/api/employees', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    await fillCreateForm(page, { email: 'SOMCHAI@wellx989.com' }); // ไม่สนตัวพิมพ์
    await expect(page.getByText('This email is already in use')).toBeVisible();
    await saveCreate(page).click();
    await expect(page.getByRole('heading', { name: 'Duplicate Email!' })).toBeVisible();
    expect(posted).toBe(false);
    await page.getByRole('button', { name: 'OK, Got It' }).click();
    await expect(page.getByRole('heading', { name: 'Duplicate Email!' })).toHaveCount(0);
  });

  // รหัสพนักงานที่ซ้ำ: ขึ้นกล่อง Duplicate Employee ID! โดยไม่ยิง API
  test('[High] TC-EMP-006 a duplicate employee ID is rejected before any request', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openEmployees(page);
    await routeMethod(page, '**/api/employees', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    await fillCreateForm(page);
    await page.locator('input[name="code"]').fill('emp-001');
    await expect(page.getByText('This employee ID is already in use')).toBeVisible();
    await saveCreate(page).click();
    await expect(page.getByRole('heading', { name: 'Duplicate Employee ID!' })).toBeVisible();
    expect(posted).toBe(false);
  });

  // server ปฏิเสธการสร้าง ต้องแสดงข้อความจาก server และไม่ปิดฟอร์ม (ไม่หลอกว่าสำเร็จ)
  test('[High] TC-EMP-007 a server error on create is shown and nothing is reported as created', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page);
    await routeMethod(page, '**/api/employees', 'POST', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'Mail server unavailable, employee was not created' }))
    );
    await fillCreateForm(page);
    await saveCreate(page).click();
    await page.getByRole('button', { name: 'Confirm and Send Email' }).click();
    await expect(page.getByText('Mail server unavailable, employee was not created')).toBeVisible();
    await expect(page.getByText(/created successfully/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Create / Register New Employee' })).toBeVisible();
  });

  // แก้ไขพนักงาน: ฟอร์มมีค่าเดิม แก้ชื่อ/แผนก/Role แล้วกดบันทึก ต้องส่ง PUT /api/employees/<id> ด้วยค่าใหม่
  test('[Critical] TC-EMP-008 editing an employee sends the changed fields to PUT /employees/:id', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'PUT', (route, req) => {
      calls.push({ url: req.url(), body: req.postDataJSON() });
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await rowOf(page, /Somchai/).getByTitle('Edit employee').click();
    await expect(page.getByRole('heading', { name: 'Edit Employee' })).toBeVisible();
    // ฟอร์มต้องมีค่าเดิมของพนักงาน
    await expect(page.locator('input[name="firstName"]')).toHaveValue('Somchai');
    await expect(page.locator('input[name="lastName"]')).toHaveValue('Jaidee');
    await expect(page.locator('input[name="email"]')).toHaveValue('somchai@wellx989.com');
    await expect(page.locator('select[name="department"]')).toHaveValue('IT');
    await expect(page.locator('select[name="status"]')).toHaveValue('Active');

    await page.locator('input[name="firstName"]').fill('Somsak');
    await page.locator('select[name="department"]').selectOption('HR');
    await page.locator('select[name="role"]').selectOption('Boss');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText(/updated successfully/)).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/employees\/EMP-001$/);
    expect(calls[0].body).toMatchObject({
      code: 'EMP-001', firstName: 'Somsak', lastName: 'Jaidee', email: 'somchai@wellx989.com',
      gender: 'Male', department: 'HR', role: 'Boss', status: 'Active', resignDate: null,
    });
    await expect(page.getByRole('heading', { name: 'Edit Employee' })).toHaveCount(0);
  });

  // ตั้งสถานะเป็น Resign ต้องมีวันลาออกส่งไปด้วย
  test('[High] TC-EMP-009 marking an employee as Resign sends the resignation date', { tag: '@high' }, async ({ page }) => {
    const bodies = [];
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'PUT', (route, req) => {
      bodies.push(req.postDataJSON());
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await rowOf(page, /Somchai/).getByTitle('Edit employee').click();
    await page.locator('select[name="status"]').selectOption('Resign');
    await expect(page.getByText('Resignation Date *')).toBeVisible();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/has been marked as Resign with resignation date/)).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].status).toBe('Resign');
    expect(bodies[0].resignDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // server ปฏิเสธการแก้ไข ต้องแสดงข้อความและไม่ปิดฟอร์ม
  test('[High] TC-EMP-010 a server error on edit is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'PUT', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'Email is already used by another employee' }))
    );
    await rowOf(page, /Somchai/).getByTitle('Edit employee').click();
    await page.locator('input[name="email"]').fill('malee@wellx989.com');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Email is already used by another employee')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Employee' })).toBeVisible();
  });

  // พนักงานที่ลาออกแล้วแก้ไขไม่ได้ และเปลี่ยนสถานะไม่ได้
  test('[High] TC-EMP-011 a resigned employee cannot be edited or have the status changed', { tag: '@high' }, async ({ page }) => {
    let put = false;
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'PUT', (route) => { put = true; return route.fulfill(jsonRes(200, { success: true })); });
    const row = rowOf(page, /Resigned/);
    await expect(row.getByTitle('Edit employee')).toHaveCount(0);
    await row.getByRole('button', { name: 'Resign', exact: true }).click();
    await expect(page.getByText('Employees with Resign status cannot have their status changed')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Confirm (deactivation|account activation)/ })).toHaveCount(0);
    expect(put).toBe(false);
  });

  // ลบพนักงาน: ต้องมีกล่องยืนยัน กดยกเลิกไม่ยิง API กดยืนยันยิง DELETE ไปที่พนักงานคนนั้นแล้วโหลดรายชื่อใหม่
  test('[Critical] TC-EMP-012 deleting needs a confirmation and sends DELETE for that employee only', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    const { state } = await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'DELETE', (route, req) => {
      calls.push(req.url());
      state.employees = state.employees.filter((e) => e.id !== 'EMP-001');
      return route.fulfill(jsonRes(200, { success: true }));
    });
    // ยกเลิก: ไม่ยิง API
    await rowOf(page, /Somchai/).getByTitle('Delete employee').click();
    await expect(page.getByRole('heading', { name: 'Confirm Employee Deletion' })).toBeVisible();
    await expect(page.getByText('Warning: once confirmed')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Employee Deletion' })).toHaveCount(0);
    expect(calls).toHaveLength(0);
    // ยืนยัน
    await rowOf(page, /Somchai/).getByTitle('Delete employee').click();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('Employee Somchai Jaidee has been deleted')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/api\/employees\/EMP-001$/);
    await expect(rowOf(page, /Somchai/)).toHaveCount(0);
    await expect(rowOf(page, /Malee/)).toBeVisible();
  });

  // server ไม่ให้ลบ (เช่นยังมีข้อมูลผูกอยู่) ต้องแสดงข้อความ และพนักงานยังอยู่ในตาราง
  test('[High] TC-EMP-013 a refused delete shows the server message and keeps the employee', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'DELETE', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'Cannot delete an employee who still has pending approvals' }))
    );
    await rowOf(page, /Malee/).getByTitle('Delete employee').click();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('Cannot delete an employee who still has pending approvals')).toBeVisible();
    await expect(page.getByText(/has been deleted/)).toHaveCount(0);
    await expect(rowOf(page, /Malee/)).toBeVisible();
  });

  // กดป้ายสถานะ Active -> กล่องยืนยัน -> PUT {status:'Inactive'} แล้วป้ายเปลี่ยนเป็น Inactive
  test('[High] TC-EMP-014 toggling Active to Inactive asks for confirmation and sends only the status', { tag: '@high' }, async ({ page }) => {
    const bodies = [];
    await openEmployees(page);
    await routeMethod(page, '**/api/employees/*', 'PUT', (route, req) => {
      bodies.push({ url: req.url(), body: req.postDataJSON() });
      return route.fulfill(jsonRes(200, { success: true }));
    });
    const row = rowOf(page, /Somchai/);
    await row.getByRole('button', { name: 'Active', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirm deactivation (Inactive)?' })).toBeVisible();
    expect(bodies).toHaveLength(0);
    await page.getByRole('button', { name: 'Confirm change to Inactive' }).click();
    await expect(page.getByText('Status of Somchai Jaidee changed to "Inactive"')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].url).toMatch(/\/api\/employees\/EMP-001$/);
    expect(bodies[0].body).toEqual({ status: 'Inactive' });
    await expect(row.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible();
  });

  // โหลดรายชื่อไม่สำเร็จ (เช่น token หมดอายุ) ต้องแสดงข้อความจาก server ไม่ใช่ตารางว่างเงียบๆ
  test('[High] TC-EMP-015 a failed load shows the server message', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page, { listResponse: jsonRes(500, { success: false, message: 'Database is unavailable' }) });
    await expect(page.getByText('Database is unavailable')).toBeVisible();
    await expect(page.getByText('No employees match the filters')).toBeVisible();
  });

  // Export ได้ไฟล์ CSV ที่มีคอลัมน์ Email และตรงกับรายการที่กรองอยู่
  test('[High] TC-EMP-016 Export downloads a CSV of the filtered list including Email', { tag: '@high' }, async ({ page }) => {
    await openEmployees(page);
    await page.getByPlaceholder('Search ID, name, email, department...').fill('malee');
    await expect(page.getByRole('row')).toHaveCount(2);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^Export_\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('ID,First Name,Last Name,Email,Department,Gender,Role,Start Date,Status');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"EMP-002","Malee","Rungrueang","malee@wellx989.com","HR","Female","Boss","2025-03-10","Active"');
  });
});
