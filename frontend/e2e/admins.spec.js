import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { routeJson, seedSessionAs } from './helpers.batch2';

/**
 * เว็บแอดมิน - เมนู Role & Permission > Administrators & Roles (/admins) เฉพาะ Super Admin
 * รายการแอดมิน, สร้าง (ส่งอีเมลเชิญ), แก้ไข, เปลี่ยนสถานะ, ลบ, ส่งลิงก์ตั้งรหัสผ่านซ้ำ และการซ่อนเมนูสำหรับ role อื่น
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const ADMINS = [
  { id: 'ADM-001', code: 'ADM-001', name: 'Super Admin', email: 'admin@wellx989.com', phone: '', role: 'Super Admin', status: 'Active' },
  { id: 'ADM-002', code: 'ADM-002', name: 'Somchai Jaidee', email: 'somchai@wellx989.com', phone: '081-234-5678', role: 'HR Admin', status: 'Active' },
  { id: 'ADM-003', code: 'ADM-003', name: 'Mali Rakdee', email: 'mali@wellx989.com', phone: '', role: 'HR Admin', status: 'Pending Password' },
];

async function openAdmins(page, { admins = ADMINS } = {}) {
  await seedSession(page);
  await mockApi(page);
  const state = { admins: [...admins] };
  await routeJson(page, '**/api/admins', 'GET', () => ({ body: { success: true, admins: state.admins } }));
  await page.goto('/admins');
  await expect(page.getByRole('heading', { name: 'Admin Management' })).toBeVisible();
  return state;
}

// กล่องโต้ตอบ (modal) ที่เปิดอยู่ ส่วน toast ใช้ fixed top-5 จึงไม่ปนกัน
const modalOf = (page) => page.locator('div.fixed.inset-0');
const jsonBody = (body) => ({ status: 200, body });

test.describe('Admin Management - Super Admin page', () => {
  // ตารางแสดง ID ชื่อ-นามสกุล (แยกคอลัมน์) อีเมล role และสถานะ รวมการ์ดสรุป
  test('[Critical] TC-ADM-001 the list shows id, first/last name, email, role and status from the server', { tag: '@critical' }, async ({ page }) => {
    await openAdmins(page);
    const row = page.getByRole('row', { name: /Somchai/ });
    await expect(row.getByRole('cell').nth(0)).toHaveText('ADM-002');
    await expect(row.getByRole('cell').nth(1)).toHaveText('Somchai');
    await expect(row.getByRole('cell').nth(2)).toHaveText('Jaidee');
    await expect(row).toContainText('somchai@wellx989.com');
    await expect(row).toContainText('081-234-5678');
    await expect(row).toContainText('HR Admin');
    await expect(row).toContainText('Active');
    await expect(page.getByRole('row', { name: /ADM-001/ })).toContainText('Super Admin');
    // บัญชีที่ยังไม่ตั้งรหัสผ่านมีสถานะ Pending Password และปุ่ม Resend
    const pending = page.getByRole('row', { name: /Mali/ });
    await expect(pending).toContainText('Pending Password');
    await expect(pending.getByRole('button', { name: 'Resend' })).toBeVisible();
    await expect(page.getByText('3 accounts', { exact: false }).first()).toBeVisible();
  });

  // กรอง Role / Status และค้นหา ต้องเหลือเฉพาะรายการที่ตรง และบอกเมื่อไม่พบ
  test('[High] TC-ADM-002 role and status filters and search narrow the list', { tag: '@high' }, async ({ page }) => {
    await openAdmins(page);
    // ตัวกรองแรก = Role, ตัวที่สอง = Status
    await page.locator('select').nth(0).selectOption('Super Admin');
    await expect(page.getByRole('row', { name: /ADM-001/ })).toBeVisible();
    await expect(page.getByText('Somchai')).toHaveCount(0);
    await page.locator('select').nth(0).selectOption('');
    await page.locator('select').nth(1).selectOption('Pending');
    await expect(page.getByRole('row', { name: /Mali/ })).toBeVisible();
    await expect(page.getByText('Somchai')).toHaveCount(0);
    await page.locator('select').nth(1).selectOption('');
    await page.getByPlaceholder('Search ID, name, email, phone...').fill('somchai@');
    await expect(page.getByRole('row', { name: /Somchai/ })).toBeVisible();
    await expect(page.getByText('Mali')).toHaveCount(0);
    await page.getByPlaceholder('Search ID, name, email, phone...').fill('nobody-here');
    await expect(page.getByText('No Admin records match the criteria')).toBeVisible();
  });

  // สร้างแอดมิน: ต้องส่ง POST /api/admins (ชื่อ-นามสกุลรวมเป็น name, ไม่มีรหัสผ่าน) และแจ้งว่าส่งอีเมลเชิญแล้ว
  test('[Critical] TC-ADM-003 creating an admin sends the invite request with the right values', { tag: '@critical' }, async ({ page }) => {
    const state = await openAdmins(page);
    const posted = await routeJson(page, '**/api/admins', 'POST', () => {
      state.admins = [...state.admins, { id: 'ADM-004', code: 'ADM-004', name: 'Wanchai Suksan', email: 'wanchai@wellx989.com', phone: '089-111-2222', role: 'HR Admin', status: 'Pending Password' }];
      return { status: 201, body: { success: true } };
    });
    await page.getByRole('button', { name: 'Create New Admin Account' }).click();
    const modal = modalOf(page);
    await expect(modal.getByText('A link to set the Web Admin password will be sent to the email')).toBeVisible();
    // ฟอร์มสร้างไม่มีช่องรหัสผ่าน
    await expect(modal.locator('input[type=password]')).toHaveCount(0);
    await modal.getByPlaceholder('e.g. John').fill('Wanchai');
    await modal.getByPlaceholder('e.g. Smith').fill('Suksan');
    await modal.getByPlaceholder('e.g. admin@wellx989.com').fill('wanchai@wellx989.com');
    await modal.getByPlaceholder('081-234-5678').fill('089-111-2222');
    await modal.getByRole('button', { name: /Save and send ADMIN invitation email/ }).click();
    await expect(page.getByText('Admin account "Wanchai Suksan" created and password setup email sent to wanchai@wellx989.com')).toBeVisible();
    await expect(modalOf(page)).toHaveCount(0);
    expect(posted).toHaveLength(1);
    expect(posted[0].body).toMatchObject({
      name: 'Wanchai Suksan', email: 'wanchai@wellx989.com', phone: '089-111-2222', role: 'HR Admin', status: 'Pending Password',
    });
    expect(posted[0].body).not.toHaveProperty('password');
    expect(posted[0].body).not.toHaveProperty('firstName');
    await expect(page.getByRole('row', { name: /Wanchai/ })).toContainText('Pending Password');
  });

  // ชื่อ นามสกุล อีเมลเป็นช่องบังคับ ถ้าว่าง/อีเมลผิดรูปแบบ ฟอร์มส่งไม่ได้ (ไม่มีคำขอไป server)
  test('[High] TC-ADM-004 first name, last name and a valid email are required', { tag: '@high' }, async ({ page }) => {
    await openAdmins(page);
    const posted = await routeJson(page, '**/api/admins', 'POST', { status: 201, body: { success: true } });
    await page.getByRole('button', { name: 'Create New Admin Account' }).click();
    const modal = modalOf(page);
    const submit = modal.getByRole('button', { name: /Save and send ADMIN invitation email/ });
    await submit.click();
    expect(await modal.getByPlaceholder('e.g. John').evaluate((el) => el.validity.valueMissing)).toBe(true);
    await modal.getByPlaceholder('e.g. John').fill('Wanchai');
    await modal.getByPlaceholder('e.g. Smith').fill('Suksan');
    await modal.getByPlaceholder('e.g. admin@wellx989.com').fill('not-an-email');
    await submit.click();
    expect(await modal.getByPlaceholder('e.g. admin@wellx989.com').evaluate((el) => el.validity.typeMismatch)).toBe(true);
    expect(posted).toHaveLength(0);
    await expect(modal).toBeVisible();
  });

  // server ปฏิเสธ (อีเมลซ้ำ 409) ต้องเห็นข้อความของ server และฟอร์มยังเปิดอยู่ ไม่หายไป
  test('[High] TC-ADM-005 a server error on create (duplicate email) is shown and the form stays open', { tag: '@high' }, async ({ page }) => {
    await openAdmins(page);
    await routeJson(page, '**/api/admins', 'POST', { status: 409, body: { success: false, message: 'This email is already used by another admin' } });
    await page.getByRole('button', { name: 'Create New Admin Account' }).click();
    const modal = modalOf(page);
    await modal.getByPlaceholder('e.g. John').fill('Somchai');
    await modal.getByPlaceholder('e.g. Smith').fill('Jaidee');
    await modal.getByPlaceholder('e.g. admin@wellx989.com').fill('somchai@wellx989.com');
    await modal.getByRole('button', { name: /Save and send ADMIN invitation email/ }).click();
    await expect(page.getByText('This email is already used by another admin')).toBeVisible();
    await expect(modal).toBeVisible();
  });

  // แก้ไข: ฟอร์มต้องโหลดชื่อ/นามสกุลจากรายการ และบันทึกด้วย PUT /api/admins/<id>
  test('[Critical] TC-ADM-006 editing an admin loads the values and saves with PUT', { tag: '@critical' }, async ({ page }) => {
    await openAdmins(page);
    const put = await routeJson(page, '**/api/admins/*', 'PUT', { body: { success: true } });
    await page.getByRole('row', { name: /Somchai/ }).getByTitle('Edit Admin').click();
    const modal = modalOf(page);
    await expect(modal.getByRole('heading', { name: 'Edit Admin' })).toBeVisible();
    await expect(modal.locator('input[name=firstName]')).toHaveValue('Somchai');
    await expect(modal.locator('input[name=lastName]')).toHaveValue('Jaidee');
    await expect(modal.locator('input[name=email]')).toHaveValue('somchai@wellx989.com');
    await modal.locator('input[name=lastName]').fill('Wongsa');
    await modal.locator('select[name=role]').selectOption('Super Admin');
    await modal.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Admin "Somchai Wongsa" updated')).toBeVisible();
    expect(put).toHaveLength(1);
    expect(put[0].url).toContain('/api/admins/ADM-002');
    expect(put[0].body).toMatchObject({
      name: 'Somchai Wongsa', email: 'somchai@wellx989.com', phone: '081-234-5678', role: 'Super Admin', status: 'Active',
    });
  });

  // กดสถานะเพื่อสลับ Active / Inactive ต้องมี popup ยืนยัน ยกเลิกแล้วไม่ส่ง และยืนยันแล้วส่ง PUT เฉพาะ status
  test('[High] TC-ADM-007 toggling the status asks for confirmation and sends only the new status', { tag: '@high' }, async ({ page }) => {
    await openAdmins(page);
    const put = await routeJson(page, '**/api/admins/*', 'PUT', { body: { success: true } });
    const row = page.getByRole('row', { name: /Somchai/ });
    await row.getByRole('button', { name: /^Active/ }).click();
    await expect(page.getByText('Confirm suspending Admin access (Inactive)?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(put).toHaveLength(0);
    await row.getByRole('button', { name: /^Active/ }).click();
    await page.getByRole('button', { name: 'Confirm change to Inactive' }).click();
    await expect(page.getByText('Status of Somchai Jaidee changed to "Inactive"')).toBeVisible();
    expect(put).toHaveLength(1);
    expect(put[0].url).toContain('/api/admins/ADM-002');
    expect(put[0].body).toEqual({ status: 'Inactive' });
    await expect(row).toContainText('Inactive');
    // บัญชีที่รอตั้งรหัสผ่านสลับสถานะไม่ได้
    await expect(page.getByRole('row', { name: /Mali/ }).getByRole('button', { name: /Pending Password/ })).toBeDisabled();
  });

  // ลบต้องมี popup ยืนยัน ยกเลิกแล้วไม่ลบ ยืนยันแล้วเรียก DELETE /api/admins/<id> และรายการโหลดใหม่
  test('[Critical] TC-ADM-008 delete asks for confirmation, then calls DELETE and refreshes the list', { tag: '@critical' }, async ({ page }) => {
    const state = await openAdmins(page);
    const deleted = await routeJson(page, '**/api/admins/*', 'DELETE', () => {
      state.admins = state.admins.filter((a) => a.id !== 'ADM-002');
      return { body: { success: true } };
    });
    const row = page.getByRole('row', { name: /Somchai/ });
    await row.getByTitle('Delete Admin account').click();
    await expect(page.getByText('Confirm deleting the administrator account (Somchai Jaidee)?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(deleted).toHaveLength(0);
    await row.getByTitle('Delete Admin account').click();
    await page.getByRole('button', { name: /Confirm Delete/ }).click();
    await expect(page.getByText('Admin account "Somchai Jaidee" deleted')).toBeVisible();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].url).toContain('/api/admins/ADM-002');
    await expect(page.getByText('Somchai')).toHaveCount(0);
  });

  // ส่งลิงก์ตั้งรหัสผ่านซ้ำ: ปุ่ม Resend ของบัญชี Pending และปุ่มกุญแจ (Reset password) เรียก POST resend-invite; server ผิดพลาดต้องเห็นข้อความ
  test('[High] TC-ADM-009 resend invite and reset-password link call the server and show the result', { tag: '@high' }, async ({ page }) => {
    await openAdmins(page);
    const sent = await routeJson(page, '**/api/admins/*/resend-invite', 'POST', (call) =>
      call.url.includes('ADM-003')
        ? jsonBody({ success: true })
        : { status: 500, body: { success: false, message: 'SMTP is not configured' } });
    // Resend ของบัญชีที่ยังไม่ตั้งรหัสผ่าน
    await page.getByRole('row', { name: /Mali/ }).getByRole('button', { name: 'Resend' }).click();
    await expect(page.getByText('Password setup email sent to mali@wellx989.com')).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain('/api/admins/ADM-003/resend-invite');
    // ปุ่มกุญแจ: popup อธิบายแล้วส่ง และ server ตอบ error ต้องเห็นข้อความ
    await page.getByRole('row', { name: /Somchai/ }).getByTitle('Send password reset link by email').click();
    const modal = modalOf(page);
    await expect(modal.getByText('Reset Password (sent by email)')).toBeVisible();
    await expect(modal).toContainText('somchai@wellx989.com');
    await modal.getByRole('button', { name: 'Send password reset link by email' }).click();
    await expect(page.getByText('SMTP is not configured')).toBeVisible();
    expect(sent).toHaveLength(2);
    expect(sent[1].url).toContain('/api/admins/ADM-002/resend-invite');
  });
});

test.describe('Role & Permission - access by role', () => {
  // Super Admin เห็นเมนู Role & Permission และเปิดไปหน้า Administrators & Roles / Audit Logs ได้
  test('[Critical] TC-ADM-010 a Super Admin sees the Role & Permission menu with both pages', { tag: '@critical' }, async ({ page }) => {
    await openAdmins(page);
    const menu = page.getByRole('button', { name: 'Role & Permission' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('button', { name: 'Administrators & Roles' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Security & Audit Logs (PDPA)' })).toBeVisible();
  });

  // role อื่น (HR Admin) ต้องไม่เห็นเมนู และพิมพ์ URL /admins หรือ /audit-logs ตรงๆ ต้องถูกพากลับ Dashboard
  test('[Critical] TC-ADM-011 a non Super Admin has no Role & Permission menu and /admins, /audit-logs redirect to the Dashboard', { tag: '@critical' }, async ({ page }) => {
    await seedSessionAs(page, { id: 'ADM-009', role: 'HR Admin', name: 'HR User', username: 'hr' });
    await mockApi(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Role & Permission' })).toHaveCount(0);
    await page.goto('/admins');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Admin Management' })).toHaveCount(0);
    await page.goto('/audit-logs');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();
  });
});
