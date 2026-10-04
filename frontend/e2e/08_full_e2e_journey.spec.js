import { test, expect } from '@playwright/test';
import { clearSession, loginAsAdmin } from './helpers/auth';

test.describe('8. Full Enterprise E2E User Journey & Smoke Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('E2E-SMOKE: Complete Web Admin Command Suite Flow', async ({ page }) => {
    // 1. Visit Portal & Perform Authenticated Login
    await expect(page.locator('text=War Command Portal')).toBeVisible();

    await loginAsAdmin(page);
    await expect(page.locator('text=War Command Suite')).toBeVisible();

    // 2. Inspect Executive Dashboard
    await expect(page.locator('text=Active Employees')).toBeVisible();
    await expect(page.locator('text=รายงานข้อมูลพนักงานเดือนนี้')).toBeVisible();

    // 3. Navigate into Employee Directory & Verify Directory Table
    const empAccordion = page.locator('aside button:has-text("3. Employee & Point"):visible');
    await empAccordion.click();
    await page.locator('aside button:has-text("All Employees Directory"):visible').click();
    await expect(page.locator('h1:has-text("การจัดการรายชื่อพนักงาน")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    // 4. Navigate into Approvals Workflow Center
    const leaveAccordion = page.locator('aside button:has-text("5. Leave & Policies"):visible');
    await leaveAccordion.click();
    await page.locator('aside button:has-text("Approvals Workflow Center"):visible').click();
    await expect(page.locator('text=ศูนย์พิจารณาอนุมัติคำขอ').or(page.locator('text=Approval'))).toBeVisible();

    // 5. Navigate into Security Audit Logs (PDPA)
    const roleAccordion = page.locator('aside button:has-text("1. Role & Permission"):visible');
    await roleAccordion.click();
    await page.locator('aside button:has-text("Security & Audit Logs (PDPA)"):visible').click();
    await expect(page.locator('text=Audit Trail').first()).toBeVisible();

    // 6. Graceful Logout
    const logoutBtn = page.locator('button:has-text("ออกจากระบบ (Logout)"):visible');
    await logoutBtn.click();

    // 7. Verify Successfully Returned to Login Gateway
    await expect(page.locator('text=War Command Portal')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
  });
});
