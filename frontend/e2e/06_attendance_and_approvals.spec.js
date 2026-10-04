import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('6. Attendance & Approvals Workflow Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ATT-01: Should display Daily Attendance and GPS Logs', async ({ page }) => {
    // Open 4. Attendance
    await page.locator('aside button:has-text("4. Attendance"):visible').click();
    await page.locator('aside button:has-text("Daily Attendance & GPS Logs"):visible').click();

    await expect(page.locator('text=บันทึกเวลาการเข้า-ออกงาน').or(page.locator('text=Attendance'))).toBeVisible();
    await expect(page.locator('input[type="date"]').or(page.locator('input[placeholder*="ค้นหา"]')).first()).toBeVisible();
  });

  test('ATT-02: Should display Overtime (OT) records', async ({ page }) => {
    await page.locator('aside button:has-text("4. Attendance"):visible').click();
    await page.locator('aside button:has-text("Overtime (OT) Records"):visible').click();

    await expect(page.locator('text=บันทึกการทำงานล่วงเวลา (OT)').or(page.locator('text=Overtime'))).toBeVisible();
  });

  test('ATT-03: Should display Time Correction Requests', async ({ page }) => {
    await page.locator('aside button:has-text("4. Attendance"):visible').click();
    await page.locator('aside button:has-text("Time Correction Requests"):visible').click();

    await expect(page.locator('text=คำขอแก้ไขเวลา').or(page.locator('text=Correction'))).toBeVisible();
  });

  test('APPR-01: Should display Approvals Workflow Center with role simulation', async ({ page }) => {
    // Open 5. Leave & Policies
    await page.locator('aside button:has-text("5. Leave & Policies"):visible').click();
    await page.locator('aside button:has-text("Approvals Workflow Center"):visible').click();

    await expect(page.locator('text=ศูนย์พิจารณาอนุมัติคำขอ').or(page.locator('text=Approval'))).toBeVisible();
    // Role switcher / selector should exist
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('LEAVE-01: Should display Leave Quotas & Policies Management', async ({ page }) => {
    await page.locator('aside button:has-text("5. Leave & Policies"):visible').click();
    await page.locator('aside button:has-text("Leave Quotas & Policies"):visible').click();

    await expect(page.locator('text=นโยบายวันลา').or(page.locator('text=Leave Policies'))).toBeVisible();
    // Check seeded leave policies exist (e.g. ลาป่วย or ลาพักร้อน)
    await expect(page.locator('text=ลาป่วย').or(page.locator('text=Sick Leave')).or(page.locator('table'))).toBeVisible();
  });
});
