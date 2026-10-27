import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { routeJson } from './helpers.batch2';

/**
 * เว็บแอดมิน - เมนู Role & Permission > Security & Audit Logs (/audit-logs) เฉพาะ Super Admin
 * รายการ audit log จากฐานข้อมูลจริง, ค้นหา, กรองประเภท Action, แบ่งหน้า, Export CSV, ข้อความผิดพลาดจาก server
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const LOGS = [
  {
    id: 'log-1', createdAt: '2026-10-20T08:15:00.000Z', actorId: 'ADM-001', actorName: 'Super Admin', actorRole: 'Super Admin',
    action: 'LOGIN_SUCCESS', resourceType: 'admin', resourceId: 'ADM-001', details: { portal: 'web' }, ipAddress: '203.0.113.10',
  },
  {
    id: 'log-2', createdAt: '2026-10-20T09:30:00.000Z', actorId: 'ADM-002', actorName: 'Somchai Jaidee', actorRole: 'HR Admin',
    action: 'CREATE_EMPLOYEE', resourceType: 'employee', resourceId: 'EMP-050', details: 'Created employee Wanchai', ipAddress: '203.0.113.20',
  },
  {
    id: 'log-3', createdAt: '2026-10-20T10:45:00.000Z', actorId: 'ADM-001', actorName: 'Super Admin', actorRole: 'Super Admin',
    action: 'DELETE_ADMIN', resourceType: 'admin', resourceId: 'ADM-007', details: { reason: 'left company' }, ipAddress: '203.0.113.10',
  },
  {
    id: 'log-4', createdAt: '2026-10-21T01:00:00.000Z', actorId: 'ADM-002', actorName: 'Somchai Jaidee', actorRole: 'HR Admin',
    action: 'UPDATE_ANNOUNCEMENT', resourceType: 'announcement', resourceId: null, details: 'Edited announcement', ipAddress: '203.0.113.20',
  },
];

// log จำนวนมากเพื่อทดสอบแบ่งหน้า (หน้าละ 10 รายการ)
const manyLogs = (n) => Array.from({ length: n }, (_, i) => ({
  id: `bulk-${i + 1}`, createdAt: '2026-10-22T03:00:00.000Z', actorId: 'ADM-001', actorName: `Actor ${i + 1}`, actorRole: 'Super Admin',
  action: 'UPDATE_SETTINGS', resourceType: 'settings', resourceId: `S-${i + 1}`, details: `change ${i + 1}`, ipAddress: '203.0.113.99',
}));

async function openAuditLogs(page, { logs = LOGS, status = 200, body } = {}) {
  await seedSession(page);
  await mockApi(page);
  const calls = await routeJson(page, /\/api\/audit-logs(\?|$)/, 'GET', () => ({
    status,
    body: body ?? { success: true, data: logs },
  }));
  await page.goto('/audit-logs');
  await expect(page.getByRole('heading', { name: /Enterprise Audit Trail/ })).toBeVisible();
  return calls;
}

test.describe('Audit Logs - Super Admin page', () => {
  // ตารางต้องแสดงผู้กระทำ (ชื่อ/ID/role) Action ทรัพยากร รายละเอียด และ IP และเรียก API ด้วย token + limit
  test('[Critical] TC-AUD-001 the list shows actor, action, resource, details and IP, loaded with the admin token', { tag: '@critical' }, async ({ page }) => {
    const calls = await openAuditLogs(page);
    const row = page.getByRole('row', { name: /CREATE_EMPLOYEE/ });
    await expect(row).toContainText('Somchai Jaidee');
    await expect(row).toContainText('ID: ADM-002');
    await expect(row).toContainText('Role: HR Admin');
    await expect(row).toContainText('employee: EMP-050');
    await expect(row).toContainText('Created employee Wanchai');
    await expect(row).toContainText('203.0.113.20');
    // details แบบ object แสดงเป็น JSON, ไม่มี resource id แสดงเป็น ALL
    await expect(page.getByRole('row', { name: /DELETE_ADMIN/ })).toContainText('left company');
    await expect(page.getByRole('row', { name: /UPDATE_ANNOUNCEMENT/ })).toContainText('announcement: ALL');
    await expect(page.getByText(/of 4 records/)).toBeVisible();
    // โหมด dev (React StrictMode) เรียก effect สองรอบ จึงตรวจแค่ว่ามีการเรียกอย่างน้อย 1 ครั้ง
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].url).toContain('limit=500');
    expect(calls[0].headers.authorization).toBe('Bearer seeded-test-token');
  });

  // ค้นหาจากชื่อ / IP / action / รายละเอียด ต้องเหลือเฉพาะรายการที่ตรง และบอกเมื่อไม่พบ
  test('[High] TC-AUD-002 search matches actor, details and action and reports when nothing matches', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page);
    const search = page.getByPlaceholder('Search actor, IP, action or details...');
    await search.fill('somchai');
    await expect(page.getByRole('row', { name: /CREATE_EMPLOYEE/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /LOGIN_SUCCESS/ })).toHaveCount(0);
    await search.fill('left company');
    await expect(page.getByRole('row', { name: /DELETE_ADMIN/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /CREATE_EMPLOYEE/ })).toHaveCount(0);
    await search.fill('no-such-record');
    await expect(page.getByText('No audit records match your search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  // ช่องค้นหามี placeholder ว่า "Search actor, IP, action or details..." จึงควรค้นด้วย IP ได้
  // BUG ของสินค้า: AuditTrailLogsPage.jsx กรองจาก actor / action / details / resource เท่านั้น ไม่รวม ipAddress
  test.fixme('[High] TC-AUD-009 search by IP address finds the matching rows', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page);
    await page.getByPlaceholder('Search actor, IP, action or details...').fill('203.0.113.20');
    await expect(page.getByRole('row', { name: /CREATE_EMPLOYEE/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /LOGIN_SUCCESS/ })).toHaveCount(0);
  });

  // ตัวกรอง Action จับตามคำหลัก (DELETE ครอบ DELETE_ADMIN, LOGIN ครอบ LOGIN_SUCCESS ฯลฯ)
  test('[High] TC-AUD-003 the Action filter matches by keyword', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page);
    const filter = page.locator('select');
    await filter.selectOption('DELETE');
    await expect(page.getByRole('row', { name: /DELETE_ADMIN/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /LOGIN_SUCCESS/ })).toHaveCount(0);
    await filter.selectOption('UPDATE');
    await expect(page.getByRole('row', { name: /UPDATE_ANNOUNCEMENT/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /DELETE_ADMIN/ })).toHaveCount(0);
    await filter.selectOption('APPROVE');
    await expect(page.getByText('No audit records match your search')).toBeVisible();
    await filter.selectOption('ALL');
    await expect(page.getByText(/of 4 records/)).toBeVisible();
  });

  // มากกว่า 10 รายการต้องแบ่งหน้า หน้าละ 10 พร้อมข้อความบอกช่วงรายการ
  test('[High] TC-AUD-004 more than 10 records are paged, 10 per page', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page, { logs: manyLogs(25) });
    await expect(page.getByText(/Showing\s*1\s*-\s*10\s*of\s*25\s*records \(page 1 \/ 3\)/)).toBeVisible();
    await expect(page.getByRole('row', { name: /Actor 1 / })).toBeVisible();
    await expect(page.getByTitle('Previous page')).toBeDisabled();
    await page.getByTitle('Next page').click();
    await expect(page.getByText(/Showing\s*11\s*-\s*20\s*of\s*25/)).toBeVisible();
    await expect(page.getByRole('row', { name: /Actor 11 / })).toBeVisible();
    await expect(page.getByRole('row', { name: /Actor 1 / })).toHaveCount(0);
    await page.getByTitle('Last page').click();
    await expect(page.getByText(/Showing\s*21\s*-\s*25\s*of\s*25\s*records \(page 3 \/ 3\)/)).toBeVisible();
    await expect(page.getByTitle('Next page')).toBeDisabled();
    // เปลี่ยนคำค้นต้องกลับไปหน้า 1
    await page.getByPlaceholder('Search actor, IP, action or details...').fill('Actor 2');
    await expect(page.getByText(/page 1 \/ 1/)).toBeVisible();
  });

  // ยังไม่มี log เลย ต้องบอกว่าไม่มีรายการ (ไม่มีข้อมูลจำลอง) และปุ่ม Export ปิดอยู่
  test('[High] TC-AUD-005 with no logs the page says so and Export is disabled', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page, { logs: [] });
    await expect(page.getByText('No audit records match your search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  // server ตอบผิดพลาดต้องเห็นข้อความของ server และถ้าเชื่อมต่อไม่ได้ต้องเห็นข้อความเชื่อมต่อ ไม่ใช่ตารางว่างเฉยๆ
  test('[Critical] TC-AUD-006 a server error or a connection failure is shown instead of an empty table', { tag: '@critical' }, async ({ page }) => {
    await openAuditLogs(page, { status: 500, body: { success: false, message: 'Audit log storage is unavailable' } });
    await expect(page.getByText('Audit log storage is unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeDisabled();

    // เครือข่ายล่ม: ผูก route ใหม่ให้ abort แล้วกด Refresh
    await page.route(/\/api\/audit-logs(\?|$)/, (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Unable to connect to the server to load audit logs')).toBeVisible();
  });

  // Refresh ต้องโหลดข้อมูลใหม่จาก server
  test('[High] TC-AUD-007 Refresh loads the logs again from the server', { tag: '@high' }, async ({ page }) => {
    const calls = await openAuditLogs(page);
    const before = calls.length;
    expect(before).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => calls.length).toBe(before + 1);
    await expect(page.getByText(/of 4 records/)).toBeVisible();
  });

  // Export ต้องดาวน์โหลดไฟล์ CSV ที่มีหัวคอลัมน์และข้อมูลของรายการที่กรองอยู่
  test('[High] TC-AUD-008 Export downloads a CSV of the filtered logs', { tag: '@high' }, async ({ page }) => {
    await openAuditLogs(page);
    await page.locator('select').selectOption('DELETE');
    await expect(page.getByText(/of 1 records/)).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^PDPA_Audit_Logs_\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    let text = '';
    for await (const chunk of stream) text += chunk.toString('utf8');
    expect(text).toContain('No.,Timestamp,Actor,Role,Action,Resource,Resource ID,Details,IP Address');
    expect(text).toContain('DELETE_ADMIN');
    // รายการที่ถูกกรองออกต้องไม่อยู่ในไฟล์
    expect(text).not.toContain('LOGIN_SUCCESS');
  });
});
