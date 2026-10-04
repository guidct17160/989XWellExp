import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('5. Organization & Role Permission Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('ROLE-01: Should display Administrators & Roles directory', async ({ page }) => {
    // Open Role & Permission accordion
    await page.locator('aside button:has-text("1. Role & Permission"):visible').click();
    await page.locator('aside button:has-text("Administrators & Roles"):visible').click();

    await expect(page.locator('main').locator('table')).toBeVisible();
    // Default admin account ADM-001 should be visible
    await expect(page.locator('main').locator('text=admin').first()).toBeVisible();
  });

  test('ROLE-02: Should display Security & Audit Trail Logs (PDPA)', async ({ page }) => {
    await page.locator('aside button:has-text("1. Role & Permission"):visible').click();
    await page.locator('aside button:has-text("Security & Audit Logs (PDPA)"):visible').click();

    await expect(page.locator('main').locator('text=Audit Trail').first()).toBeVisible();
    await expect(page.locator('main').locator('input[placeholder*="ค้นหา"]').first()).toBeVisible();
    await expect(page.locator('main').locator('table')).toBeVisible();
  });

  test('ORG-01: Should display Main Departments management page', async ({ page }) => {
    await page.locator('aside button:has-text("2. Organization"):visible').click();
    await page.locator('aside button:has-text("Main Departments"):visible').click();

    // Verify departments view
    await expect(page.locator('main').locator('text=ฝ่าย').or(page.locator('main').locator('text=Department')).first()).toBeVisible();
    await expect(page.locator('main').locator('button:has-text("เพิ่มฝ่าย")').or(page.locator('main').locator('button:has-text("เพิ่ม")')).first()).toBeVisible();
  });

  test('ORG-02: Should display Job Positions management page', async ({ page }) => {
    await page.locator('aside button:has-text("2. Organization"):visible').click();
    await page.locator('aside button:has-text("Job Positions"):visible').click();

    await expect(page.locator('main').locator('text=ตำแหน่ง').or(page.locator('main').locator('text=Position')).first()).toBeVisible();
  });

  test('ORG-03: Should display Sections and Employee Groups pages', async ({ page }) => {
    await page.locator('aside button:has-text("2. Organization"):visible').click();
    await page.locator('aside button:has-text("Sections (แผนกย่อย)"):visible').click();
    await expect(page.locator('main').locator('text=แผนกย่อย').or(page.locator('main').locator('text=Section')).first()).toBeVisible();

    await page.locator('aside button:has-text("Employee Groups (กลุ่มพนักงาน)"):visible').click();
    await expect(page.locator('main').locator('text=กลุ่มพนักงาน').or(page.locator('main').locator('text=Group')).first()).toBeVisible();
  });
});
