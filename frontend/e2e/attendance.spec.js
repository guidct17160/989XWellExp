import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockApi, seedSession } from './helpers';
import { jsonRes, routeMethod, todayLocal } from './helpers.batch1';

/**
 * เว็บแอดมิน - เมนู Attendance (/attendance) รายงานการลงเวลาของพนักงานรายวัน
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - กฎสาย / ชั่วโมงไม่ครบ ใช้ค่าจาก GET /api/settings/work-time (ไม่ฮาร์ดโค้ด)
 * - SuperBoss ไม่ถูกจำกัดเวลา: ไม่เป็น Late และไม่เป็น Incomplete Hours (รายงานส่ง role มาให้)
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const RULES = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 0 };

// แถวรายงานจำลอง: ปกติ / สาย / แถวเก่า (ไม่มีพิกัดออกงาน) / กะที่ยังไม่ออกงาน / ทำงานไม่ครบชั่วโมง / SuperBoss ที่มาสายและทำงานสั้น
const LOGS = [
  { id: 'a1', employeeId: 'EMP-001', employeeCode: 'EMP-001', firstName: 'Somchai', lastName: 'Jaidee', department: 'IT', role: 'Employee', checkIn: '08:50', checkOut: '18:00', status: 'On Time', locationName: 'Head Office', checkOutLocationName: 'Head Office Gate' },
  { id: 'a2', employeeId: 'EMP-002', employeeCode: 'EMP-002', firstName: 'Malee', lastName: 'Latecomer', department: 'HR', role: 'Employee', checkIn: '09:30', checkOut: '18:30', status: 'สาย', locationName: 'Branch A', checkOutLocationName: 'Branch A' },
  { id: 'a3', employeeId: 'EMP-003', employeeCode: 'EMP-003', firstName: 'Oldrow', lastName: 'Nogps', department: 'IT', role: 'Employee', checkIn: '08:00', checkOut: '17:30', status: 'ปกติ', locationName: 'Head Office' },
  { id: 'a4', employeeId: 'EMP-004', employeeCode: 'EMP-004', firstName: 'Openshift', lastName: 'Working', department: 'IT', role: 'Employee', checkIn: '08:30', status: 'ปกติ', locationName: 'Head Office' },
  { id: 'a5', employeeId: 'EMP-005', employeeCode: 'EMP-005', firstName: 'Shorty', lastName: 'Hours', department: 'Sales', role: 'Employee', checkIn: '08:00', checkOut: '15:00', status: 'On Time', locationName: 'Head Office', checkOutLocationName: 'Head Office' },
  { id: 'a6', employeeId: 'EMP-006', employeeCode: 'EMP-006', firstName: 'Big', lastName: 'Boss', department: 'Executive', role: 'SuperBoss', checkIn: '11:00', checkOut: '12:00', status: 'สาย', locationName: 'Head Office', checkOutLocationName: 'Head Office' },
];

/**
 * เปิดหน้า Attendance ในสภาพที่ล็อกอินแล้ว
 * คืนค่า { dates } = รายการ date ที่หน้าเว็บส่งไป GET /api/hr/reports/attendance
 */
async function openAttendance(page, { logs = LOGS, rules = RULES, report } = {}) {
  const dates = [];
  await seedSession(page);
  await mockApi(page);
  await routeMethod(page, '**/api/settings/work-time', 'GET', (route) => route.fulfill(jsonRes(200, { success: true, rules })));
  await routeMethod(page, '**/api/hr/reports/attendance*', 'GET', (route, req) => {
    dates.push(new URL(req.url()).searchParams.get('date'));
    if (report) return route.fulfill(report);
    return route.fulfill(jsonRes(200, { success: true, report: logs }));
  });
  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: /attendance management/i })).toBeVisible();
  return { dates };
}

const rowOf = (page, name) => page.getByRole('row', { name });

test.describe('Attendance - admin report', () => {
  // ตารางต้องมีคอลัมน์ครบ รวม GPS Clock In / GPS Clock Out และแสดงข้อมูลของแต่ละคนถูกช่อง
  test('[Critical] TC-ATT-001 the table shows every column with the right data per employee', { tag: '@critical' }, async ({ page }) => {
    await openAttendance(page);
    await expect(page.getByRole('columnheader')).toHaveText([
      'ID', 'First Name', 'Last Name', 'Department', 'Clock In', 'Clock Out', 'Status', 'GPS Clock In', 'GPS Clock Out',
    ]);
    await expect(page.getByRole('heading', { name: 'Attendance Records (6)' })).toBeVisible();
    const cells = rowOf(page, /Somchai/).getByRole('cell');
    await expect(cells.nth(0)).toHaveText('EMP-001');
    await expect(cells.nth(1)).toHaveText('Somchai');
    await expect(cells.nth(2)).toHaveText('Jaidee');
    await expect(cells.nth(3)).toHaveText('IT');
    await expect(cells.nth(4)).toHaveText('08:50');
    await expect(cells.nth(5)).toHaveText('18:00');
    await expect(cells.nth(6)).toContainText('On Time');
    await expect(cells.nth(7)).toHaveText('Head Office');
    await expect(cells.nth(8)).toHaveText('Head Office Gate');
  });

  // แถวเก่าที่ไม่มีพิกัดออกงาน และกะที่ยังไม่ออกงาน ต้องแสดง "-" ในช่อง GPS Clock Out
  test('[High] TC-ATT-002 old rows and open shifts show "-" in GPS Clock Out', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page);
    await expect(rowOf(page, /Oldrow/).getByTestId('gps-clock-out')).toHaveText('-');
    const open = rowOf(page, /Openshift/);
    await expect(open.getByRole('cell').nth(5)).toHaveText('-');
    await expect(open.getByTestId('gps-clock-out')).toHaveText('-');
    // GPS Clock In ของกะที่เปิดอยู่ยังแสดงสถานที่เข้างานตามปกติ
    await expect(open.getByRole('cell').nth(7)).toHaveText('Head Office');
  });

  // สถานะ: สาย = ป้ายสีแดง (danger), ปกติ = เขียว, ทำงานไม่ครบ = เหลือง และการ์ดสรุปนับถูก
  test('[Critical] TC-ATT-003 Late is red, Incomplete Hours is amber, and the summary cards add up', { tag: '@critical' }, async ({ page }) => {
    await openAttendance(page);
    const late = rowOf(page, /Latecomer/).getByText('● Late');
    await expect(late).toBeVisible();
    await expect(late).toHaveClass(/danger/);
    const short = rowOf(page, /Shorty/).getByText('● Incomplete Hours');
    await expect(short).toBeVisible();
    await expect(short).toHaveClass(/amber/);
    const ok = rowOf(page, /Somchai/).getByText('● On Time');
    await expect(ok).toHaveClass(/emerald/);
    // On Time 4 (Somchai, Oldrow, Openshift, Big Boss) / Late 1 / Incomplete Hours 1
    await expect(page.locator('h3', { hasText: /staff$/ })).toHaveText(['4 staff', '1 staff', '1 staff']);
    await expect(page.getByText('Late (After 09:00)')).toBeVisible();
  });

  // SuperBoss ไม่ถูกจำกัดเวลา: แม้เข้างาน 11:00 (บันทึกว่า สาย) และทำงานแค่ 1 ชม. ก็ต้องเป็น On Time
  test('[Critical] TC-ATT-004 a SuperBoss is never shown as Late or Incomplete Hours', { tag: '@critical' }, async ({ page }) => {
    await openAttendance(page);
    const row = rowOf(page, /Big/);
    await expect(row.getByText('● On Time')).toBeVisible();
    await expect(row.getByText(/Late|Incomplete/)).toHaveCount(0);
    // ตัวกรอง Late / Incomplete Hours ต้องไม่รวม SuperBoss
    const status = page.getByText('Status:', { exact: true }).locator('..').locator('select');
    await status.selectOption('LATE');
    await expect(rowOf(page, /Big/)).toHaveCount(0);
    await expect(rowOf(page, /Latecomer/)).toBeVisible();
    await status.selectOption('INCOMPLETE');
    await expect(rowOf(page, /Big/)).toHaveCount(0);
    await expect(rowOf(page, /Shorty/)).toBeVisible();
  });

  // เวลาสายอ่านจากการตั้งค่า Work Time Settings: ถ้าตั้งสายหลัง 10:00 แถวที่ไม่มีสถานะชัดเจนและเข้า 09:30 ต้องไม่สาย
  test('[High] TC-ATT-005 the late time comes from Work Time Settings, not a fixed 09:00', { tag: '@high' }, async ({ page }) => {
    const logs = [{ id: 'b1', employeeId: 'EMP-010', employeeCode: 'EMP-010', firstName: 'Auto', lastName: 'Closed', department: 'IT', role: 'Employee', checkIn: '09:30', checkOut: '19:00', status: 'Auto-closed', locationName: 'Head Office' }];
    await openAttendance(page, { logs, rules: { ...RULES, lateAfterTime: '10:00' } });
    await expect(page.getByText('Late (After 10:00)')).toBeVisible();
    await expect(rowOf(page, /Auto/).getByText('● On Time')).toBeVisible();
  });

  // ค้นหาด้วย ID / ชื่อ / นามสกุล / แผนก และกรองตามสถานะ
  test('[High] TC-ATT-006 search and the status filter narrow the table', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page);
    const search = page.getByPlaceholder('Search ID, name, department...');
    await search.fill('emp-002');
    await expect(page.getByRole('heading', { name: 'Attendance Records (1)' })).toBeVisible();
    await expect(rowOf(page, /Latecomer/)).toBeVisible();
    await search.fill('jaidee');
    await expect(rowOf(page, /Somchai/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance Records (1)' })).toBeVisible();
    await search.fill('sales');
    await expect(rowOf(page, /Shorty/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance Records (1)' })).toBeVisible();
    await search.fill('nobody-here');
    await expect(page.getByText('No attendance records found for the selected date')).toBeVisible();
    await search.fill('');
    await page.getByText('Status:', { exact: true }).locator('..').locator('select').selectOption('ON_TIME');
    await expect(page.getByRole('heading', { name: 'Attendance Records (4)' })).toBeVisible();
    await expect(rowOf(page, /Latecomer/)).toHaveCount(0);
    await expect(rowOf(page, /Shorty/)).toHaveCount(0);
  });

  // เปิดหน้าครั้งแรกขอรายงานของวันนี้ และเปลี่ยนวันที่แล้วต้องขอรายงานของวันนั้น
  test('[High] TC-ATT-007 the report is requested for today and re-requested when the date changes', { tag: '@high' }, async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 1000 }); // จอแคบ เพื่อให้ปฏิทินเปิดเต็มใบไม่ถูกแถบหัวเว็บบัง (ดู TC-ATT-014)
    const { dates } = await openAttendance(page);
    // dev server (React StrictMode) อาจยิงซ้ำตอนโหลดครั้งแรก จึงตรวจว่าทุกคำขอแรกเป็นของวันนี้ แล้วนับต่อจากนั้น
    await expect(rowOf(page, /Somchai/)).toBeVisible();
    expect(dates.length).toBeGreaterThanOrEqual(1);
    expect(new Set(dates)).toEqual(new Set([todayLocal()]));
    const base = dates.length;
    // เลือกวันที่ 15 ของเดือนถัดไป (ปฏิทินเปิดในเดือนปัจจุบัน)
    await page.getByText(todayLocal(), { exact: true }).click();
    await page.getByTitle('Next month').click();
    await page.getByRole('button', { name: '15', exact: true }).click();
    await expect.poll(() => dates.length).toBeGreaterThan(base);
    const picked = dates[dates.length - 1];
    expect(picked).toMatch(/^\d{4}-\d{2}-15$/);
    expect(picked > todayLocal()).toBe(true);
    // ปุ่ม Refresh ขอรายงานซ้ำด้วยวันเดิม
    const afterPick = dates.length;
    await page.getByTitle('Refresh data').click();
    await expect.poll(() => dates.length).toBeGreaterThan(afterPick);
    expect(dates[dates.length - 1]).toBe(picked);
  });

  // server ปฏิเสธ หรือเชื่อมต่อไม่ได้ ต้องแจ้งแอดมินและไม่แสดงข้อมูลเก่าค้าง
  test('[High] TC-ATT-008 a server error or lost connection is shown to the admin', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page, { report: jsonRes(500, { success: false, message: 'Attendance service is down' }) });
    await expect(page.getByText('Attendance service is down')).toBeVisible();
    await expect(page.getByText('No attendance records found for the selected date')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance Records (0)' })).toBeVisible();
  });

  test('[High] TC-ATT-009 an unreachable server shows a connection message', { tag: '@high' }, async ({ page }) => {
    await seedSession(page);
    await mockApi(page);
    await routeMethod(page, '**/api/hr/reports/attendance*', 'GET', (route) => route.abort('failed'));
    await page.goto('/attendance');
    await expect(page.getByText('Unable to connect to the server to load attendance data')).toBeVisible();
  });

  // ปุ่ม Export สร้างไฟล์ CSV ชื่อ Attendance_Report_<วันที่>.csv ที่มี GPS ทั้งเข้าและออก และตรงกับสถานะบนหน้าจอ
  test('[High] TC-ATT-010 Export downloads a CSV that matches the table', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(`Attendance_Report_${todayLocal()}.csv`);
    const csv = readFileSync(await download.path(), 'utf8');
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('No.,ID,First Name,Last Name,Department,Clock In,Clock Out,Status,GPS Clock In,GPS Clock Out');
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe('1,EMP-001,"Somchai","Jaidee","IT",08:50,18:00,On Time,"Head Office","Head Office Gate"');
    expect(lines[2]).toContain(',Late,"Branch A","Branch A"');
    // แถวเก่าไม่มีพิกัดออกงาน => "-" และ SuperBoss ที่สายต้องออกเป็น On Time
    expect(lines[3]).toContain('"Head Office","-"');
    expect(lines[6]).toContain('"Big","Boss"');
    expect(lines[6]).toContain(',On Time,');
  });

  // ไม่มีข้อมูลให้ Export ต้องแจ้งเตือนและไม่สร้างไฟล์
  test('[High] TC-ATT-011 Export with no data tells the admin instead of downloading', { tag: '@high' }, async ({ page }) => {
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await openAttendance(page, { logs: [] });
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByText('No data available to export')).toBeVisible();
    expect(downloaded).toBe(false);
  });

  // ปฏิทินของหน้านี้ต้องเลือกวันที่ผ่านมาได้ (disablePast={false}) เพื่อย้อนดูรายงาน
  test('[High] TC-ATT-012 a past date can be picked to review an earlier day', { tag: '@high' }, async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 1000 }); // จอแคบ เพื่อให้ปฏิทินไม่ถูกแถบหัวเว็บบัง
    const { dates } = await openAttendance(page);
    await expect(rowOf(page, /Somchai/)).toBeVisible();
    const base = dates.length;
    await page.getByText(todayLocal(), { exact: true }).click();
    await expect(page.getByTitle('Previous month')).toBeEnabled();
    await page.getByTitle('Previous month').click();
    await page.getByRole('button', { name: '10', exact: true }).click();
    await expect.poll(() => dates.length).toBeGreaterThan(base);
    expect(dates[dates.length - 1] < todayLocal()).toBe(true);
  });

  // บนจอ 1280x720 ปุ่ม Next/Previous month ต้องไม่ถูกแถบหัวเว็บบัง (ปฏิทินเปิดลงด้านล่าง)
  test('[High] TC-ATT-014 the calendar month buttons are not covered by the top bar', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page);
    await page.getByText(todayLocal(), { exact: true }).click();
    await page.getByTitle('Next month').click({ trial: true, timeout: 3000 });
  });

  // ป้ายการ์ด Incomplete Hours ต้องใช้ requiredHours จาก Work Time Settings (ห้ามฮาร์ดโค้ด 9 ชม.)
  test('[High] TC-ATT-013 the Incomplete Hours card shows the configured required hours', { tag: '@high' }, async ({ page }) => {
    await openAttendance(page, { rules: { ...RULES, requiredHours: 8 } });
    await expect(page.getByText('Incomplete Hours (under 8 hrs)')).toBeVisible();
  });
});
