import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { jsonRes, routeMethod } from './helpers.batch1';

/**
 * เว็บแอดมิน - เมนู Settings > Leave Policies (/settings/leave-policies, หัวข้อหน้า "Leave Quotas")
 * HR ตั้งโควตา เพศที่ใช้ได้ และบังคับแนบเอกสาร (server เป็นผู้บังคับตามนโยบายนี้)
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const POLICIES = [
  { id: 'LP-01', typeName: 'Annual Leave', defaultQuota: 10, isPaid: true, applicableGender: 'all', requireAttachment: false, description: '', status: 'Active' },
  { id: 'LP-02', typeName: 'Maternity Leave', defaultQuota: 98, isPaid: true, applicableGender: 'female', requireAttachment: true, description: 'Medical certificate', status: 'Active' },
  { id: 'LP-03', typeName: 'Ordination Leave', defaultQuota: 15, isPaid: false, applicableGender: 'male', requireAttachment: true, description: '', status: 'Inactive' },
];

/**
 * เปิดหน้า Leave Policies ในสภาพที่ล็อกอินแล้ว
 * คืนค่า { state } = state.policies คือรายการที่ GET ตอบ, state.gets = จำนวนครั้งที่โหลดรายการ
 */
async function openPolicies(page, { listResponse, policies = POLICIES } = {}) {
  const state = { policies: policies.map((p) => ({ ...p })), gets: 0 };
  await seedSession(page);
  await mockApi(page);
  await routeMethod(page, '**/api/leave-policies', 'GET', (route) => {
    state.gets += 1;
    if (listResponse) return route.fulfill(listResponse);
    return route.fulfill(jsonRes(200, { success: true, policies: state.policies }));
  });
  await page.goto('/settings/leave-policies');
  await expect(page.getByRole('heading', { name: 'Leave Quotas' })).toBeVisible();
  return { state };
}

const rowOf = (page, name) => page.getByRole('row', { name });
const filterSelect = (page, label) => page.getByText(`${label}:`, { exact: true }).locator('..').locator('select');

// กล่องฟอร์มสร้าง/แก้ไข (ลอยบน body) ช่องต่างๆ อ้างตามลำดับ: select[0]=Pay Type, select[1]=Gender, select[2]=Status
const modal = (page) => page.locator('form').filter({ hasText: 'Save Settings' });
const typeName = (page) => page.getByPlaceholder('e.g. Annual Leave');
const quota = (page) => modal(page).getByRole('spinbutton');
const payType = (page) => modal(page).locator('select').nth(0);
const gender = (page) => modal(page).locator('select').nth(1);
const status = (page) => modal(page).locator('select').nth(2);
const attachment = (page) => modal(page).getByRole('checkbox');
const saveBtn = (page) => page.getByRole('button', { name: 'Save Settings' });

test.describe('Leave Policies - admin page', () => {
  // รายการมีคอลัมน์ครบ แสดงโควตาเป็นตัวเลขล้วน (ไม่มีข้อความ "days/yr") และการ์ดสรุปนับถูก
  test('[Critical] TC-LP-001 the list shows each policy and the counters add up', { tag: '@critical' }, async ({ page }) => {
    await openPolicies(page);
    await expect(page.getByRole('columnheader')).toHaveText(['Code', 'Leave Type', 'Quota', 'Pay Type', 'Gender', 'Document', 'Status', 'Actions']);
    const cells = rowOf(page, /Maternity Leave/).getByRole('cell');
    await expect(cells.nth(0)).toHaveText('LP-02');
    await expect(cells.nth(1)).toContainText('Maternity Leave');
    await expect(cells.nth(2)).toHaveText('98');
    await expect(cells.nth(3)).toHaveText('Paid');
    await expect(cells.nth(4)).toHaveText('Female only');
    await expect(cells.nth(5)).toHaveText('Required');
    await expect(cells.nth(6)).toHaveText('Active');
    const other = rowOf(page, /Ordination Leave/).getByRole('cell');
    await expect(other.nth(3)).toHaveText('Unpaid');
    await expect(other.nth(4)).toHaveText('Male only');
    await expect(other.nth(6)).toHaveText('Inactive');
    await expect(rowOf(page, /Annual Leave/).getByRole('cell').nth(4)).toHaveText('All genders');
    await expect(rowOf(page, /Annual Leave/).getByRole('cell').nth(5)).toHaveText('Not required');
    // ในตารางไม่มีคำว่า days/yr
    await expect(page.locator('table')).not.toContainText(/days\s*\/\s*yr/i);
    // การ์ดสรุป: ทั้งหมด 3 / Active 2 / Paid 2 / Unpaid 1
    await expect(page.locator('div.text-2xl')).toHaveText(['3 types', '2 types', '2 types', '1 types']);
  });

  // ค้นหา และกรองตามเพศ / ประเภทจ่ายเงิน
  test('[High] TC-LP-002 search and the Gender / Payment filters narrow the list', { tag: '@high' }, async ({ page }) => {
    await openPolicies(page);
    const search = page.getByPlaceholder('Search by leave type or policy ID...');
    await search.fill('lp-03');
    await expect(rowOf(page, /Ordination/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('annual');
    await expect(rowOf(page, /Annual/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await search.fill('nothing-like-this');
    await expect(page.getByText('No leave policies match your search')).toBeVisible();
    await search.fill('');
    await filterSelect(page, 'Gender').selectOption('female');
    await expect(rowOf(page, /Maternity/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await filterSelect(page, 'Gender').selectOption('all');
    await filterSelect(page, 'Payment').selectOption('unpaid');
    await expect(rowOf(page, /Ordination/)).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
  });

  // สร้างนโยบายใหม่: รหัสถัดไปถูกเติมให้ แล้วส่ง POST ด้วยค่าที่กรอก (โควตา เพศ ต้องแนบเอกสาร)
  test('[Critical] TC-LP-003 creating a policy sends quota, gender and attachment rule to the server', { tag: '@critical' }, async ({ page }) => {
    const bodies = [];
    const { state } = await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies', 'POST', (route, req) => {
      const body = req.postDataJSON();
      bodies.push(body);
      state.policies.push(body);
      return route.fulfill(jsonRes(201, { success: true, policy: body }));
    });
    await page.getByRole('button', { name: 'Add Leave Policy' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toBeVisible();
    // ค่าเริ่มต้น: รหัสถัดไป โควตา 10 จ่ายเงิน ทุกเพศ ต้องแนบเอกสาร สถานะ Active
    await expect(modal(page).locator('input[type="text"]').first()).toHaveValue('LP-04');
    await expect(quota(page)).toHaveValue('10');
    await expect(payType(page)).toHaveValue('true');
    await expect(gender(page)).toHaveValue('all');
    await expect(attachment(page)).toBeChecked();
    await expect(status(page)).toHaveValue('Active');

    await typeName(page).fill('  Study Leave  ');
    await quota(page).fill('7');
    await payType(page).selectOption('false');
    await gender(page).selectOption('female');
    await attachment(page).setChecked(false, { force: true });
    await modal(page).locator('textarea').fill('Exam leave');
    await saveBtn(page).click();

    await expect(page.getByText('Leave policy added successfully')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      id: 'LP-04', typeName: 'Study Leave', defaultQuota: 7, isPaid: false, applicableGender: 'female',
      requireAttachment: false, description: 'Exam leave', status: 'Active',
    });
    // ฟอร์มปิด และรายการโหลดใหม่เห็นนโยบายใหม่
    await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toHaveCount(0);
    await expect(rowOf(page, /Study Leave/)).toBeVisible();
  });

  // ชื่อว่าง / มีแต่ช่องว่าง ต้องไม่ยิง API
  test('[High] TC-LP-004 a blank leave type name is blocked and nothing is sent', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    await page.getByRole('button', { name: 'Add Leave Policy' }).click();
    // ว่างเปล่า: browser ไม่ให้ส่งฟอร์ม
    await saveBtn(page).click();
    await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toBeVisible();
    // มีแต่ช่องว่าง: ผ่าน required ของ browser แต่หน้าเว็บต้องกันเอง
    await typeName(page).fill('   ');
    await saveBtn(page).click();
    await expect(page.getByText('Please enter a leave type name')).toBeVisible();
    expect(posted).toBe(false);
    await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toBeVisible();
  });

  // โควตาที่ไม่ถูกต้อง (ว่าง, ติดลบ, เกิน 365 วัน) ต้องไม่ยิง API
  test('[High] TC-LP-005 an invalid quota (empty, negative or over 365) is blocked', { tag: '@high' }, async ({ page }) => {
    let posted = false;
    await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies', 'POST', (route) => { posted = true; return route.fulfill(jsonRes(201, { success: true })); });
    await page.getByRole('button', { name: 'Add Leave Policy' }).click();
    await typeName(page).fill('Test Leave');
    for (const bad of ['', '-1', '366']) {
      await quota(page).fill(bad);
      await saveBtn(page).click();
      await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toBeVisible();
    }
    expect(posted).toBe(false);
    // ค่าขอบ 365 ผ่าน
    await quota(page).fill('365');
    await routeMethod(page, '**/api/leave-policies', 'POST', (route, req) => {
      posted = req.postDataJSON().defaultQuota;
      return route.fulfill(jsonRes(201, { success: true }));
    });
    await saveBtn(page).click();
    await expect.poll(() => posted).toBe(365);
  });

  // แก้ไข: ฟอร์มมีค่าเดิม รหัสแก้ไม่ได้ แก้โควตา/เพศ/เอกสารแล้ว PUT /api/leave-policies/<id>
  test('[Critical] TC-LP-006 editing a policy shows its values and sends the changes to PUT /leave-policies/:id', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies/*', 'PUT', (route, req) => {
      calls.push({ url: req.url(), body: req.postDataJSON() });
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await rowOf(page, /Ordination Leave/).getByTitle('Configure / Edit').click();
    await expect(page.getByRole('heading', { name: 'Policy Settings: Ordination Leave' })).toBeVisible();
    await expect(modal(page).locator('input[type="text"]').first()).toBeDisabled();
    await expect(modal(page).locator('input[type="text"]').first()).toHaveValue('LP-03');
    await expect(typeName(page)).toHaveValue('Ordination Leave');
    await expect(quota(page)).toHaveValue('15');
    await expect(payType(page)).toHaveValue('false');
    await expect(gender(page)).toHaveValue('male');
    await expect(attachment(page)).toBeChecked();
    await expect(status(page)).toHaveValue('Inactive');

    await quota(page).fill('20');
    await gender(page).selectOption('all');
    await attachment(page).setChecked(false, { force: true });
    await status(page).selectOption('Active');
    await saveBtn(page).click();

    await expect(page.getByText('Leave policy settings saved successfully')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/leave-policies\/LP-03$/);
    expect(calls[0].body).toEqual({
      id: 'LP-03', typeName: 'Ordination Leave', defaultQuota: 20, isPaid: false, applicableGender: 'all',
      requireAttachment: false, description: '', status: 'Active',
    });
    await expect(page.getByRole('heading', { name: /Policy Settings/ })).toHaveCount(0);
  });

  // server ปฏิเสธการบันทึก (เช่นรหัสซ้ำ) ต้องแสดงข้อความและไม่ปิดฟอร์ม
  test('[High] TC-LP-007 a server error on save is shown and the form stays open', { tag: '@high' }, async ({ page }) => {
    await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies', 'POST', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'A leave type with this name already exists' }))
    );
    await page.getByRole('button', { name: 'Add Leave Policy' }).click();
    await typeName(page).fill('Annual Leave');
    await saveBtn(page).click();
    await expect(page.getByText('A leave type with this name already exists')).toBeVisible();
    await expect(page.getByText(/added successfully/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Add New Leave Policy' })).toBeVisible();
  });

  // ลบ: ต้องมีกล่องยืนยัน ยกเลิกไม่ยิง API ยืนยันแล้ว DELETE ไปที่นโยบายนั้น
  test('[Critical] TC-LP-008 deleting needs a confirmation and sends DELETE for that policy only', { tag: '@critical' }, async ({ page }) => {
    const calls = [];
    const { state } = await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies/*', 'DELETE', (route, req) => {
      calls.push(req.url());
      state.policies = state.policies.filter((p) => p.id !== 'LP-03');
      return route.fulfill(jsonRes(200, { success: true }));
    });
    await rowOf(page, /Ordination Leave/).getByTitle('Delete policy').click();
    await expect(page.getByRole('heading', { name: 'Confirm Leave Policy Deletion' })).toBeVisible();
    await expect(page.getByText('"Ordination Leave"')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Leave Policy Deletion' })).toHaveCount(0);
    expect(calls).toHaveLength(0);

    await rowOf(page, /Ordination Leave/).getByTitle('Delete policy').click();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('Leave policy Ordination Leave deleted successfully')).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/api\/leave-policies\/LP-03$/);
    await expect(rowOf(page, /Ordination/)).toHaveCount(0);
    await expect(rowOf(page, /Annual/)).toBeVisible();
  });

  // server ไม่ให้ลบ ต้องแสดงข้อความและนโยบายยังอยู่
  test('[High] TC-LP-009 a refused delete shows the server message and keeps the policy', { tag: '@high' }, async ({ page }) => {
    await openPolicies(page);
    await routeMethod(page, '**/api/leave-policies/*', 'DELETE', (route) =>
      route.fulfill(jsonRes(409, { success: false, message: 'This leave policy is already used by leave requests' }))
    );
    await rowOf(page, /Annual Leave/).getByTitle('Delete policy').click();
    await page.getByRole('button', { name: 'Confirm Delete' }).click();
    await expect(page.getByText('This leave policy is already used by leave requests')).toBeVisible();
    await expect(page.getByText(/deleted successfully/)).toHaveCount(0);
    await expect(rowOf(page, /Annual Leave/)).toBeVisible();
  });

  // โหลดรายการไม่สำเร็จ ต้องแสดงข้อความจาก server
  test('[High] TC-LP-010 a failed load shows the server message', { tag: '@high' }, async ({ page }) => {
    await openPolicies(page, { listResponse: jsonRes(500, { success: false, message: 'Leave policy store is unavailable' }) });
    await expect(page.getByText('Leave policy store is unavailable')).toBeVisible();
    await expect(page.getByText('No leave policies match your search')).toBeVisible();
  });

  // path เก่า /leave-policies ต้องถูกพาไป path ใหม่ /settings/leave-policies เอง
  test('[High] TC-LP-011 the old /leave-policies address redirects to /settings/leave-policies', { tag: '@high' }, async ({ page }) => {
    await seedSession(page);
    await mockApi(page);
    await routeMethod(page, '**/api/leave-policies', 'GET', (route) => route.fulfill(jsonRes(200, { success: true, policies: POLICIES })));
    await page.goto('/leave-policies');
    await expect(page).toHaveURL(/\/settings\/leave-policies$/);
    await expect(page.getByRole('heading', { name: 'Leave Quotas' })).toBeVisible();
  });
});
