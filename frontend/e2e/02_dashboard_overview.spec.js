import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('2. Dashboard Overview & Analytics Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('DASH-01: Should render executive header and branding suite', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=War Command Suite')).toBeVisible();
    await expect(page.locator('aside.lg\\:flex').locator('text=WellX989 HR Solution + 989Velaa Plus(Full)')).toBeVisible();
  });

  test('DASH-02: Should render 4 real-time KPI stat cards', async ({ page }) => {
    // Stat Card 1: Active Employees
    await expect(page.locator('text=Active Employees')).toBeVisible();
    await expect(page.locator('text=LIVE BACKEND API SYNC').first()).toBeVisible();

    // Stat Card 2: New Hires
    await expect(page.locator('text=พนักงานเข้าใหม่').first()).toBeVisible();

    // Stat Card 3: Resigned
    await expect(page.locator('text=พนักงานออกภายในเดือน').first()).toBeVisible();

    // Stat Card 4: Passed Probation
    await expect(page.locator('text=ผ่านทดลองงานภายในเดือน').first()).toBeVisible();
  });

  test('DASH-03: Should have Year selection dropdown for trend analytics', async ({ page }) => {
    const yearSelect = page.locator('select').first();
    await expect(yearSelect).toBeVisible();
    await yearSelect.selectOption('2025');
    await expect(yearSelect).toHaveValue('2025');
    await yearSelect.selectOption('2026');
    await expect(yearSelect).toHaveValue('2026');
  });

  test('DASH-04: Should navigate to Employee Directory from dashboard quick action', async ({ page }) => {
    const quickCreateBtn = page.locator('button:has-text("สร้าง/สมัครพนักงานใหม่")');
    await expect(quickCreateBtn).toBeVisible();
    await quickCreateBtn.click();

    // Should switch activeMenu to all-employee and show employee management header
    await expect(page.locator('h1:has-text("การจัดการรายชื่อพนักงาน")')).toBeVisible();
  });

  test('DASH-05: Should open and toggle User Profile dropdown in topbar', async ({ page }) => {
    // The user avatar / dropdown button in header
    const profileBtn = page.locator('header button:has-text("Admin"), header button:has-text("สมชาย")').first();
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();
    await expect(page.locator('header button:has-text("ออกจากระบบ")').first()).toBeVisible();
  });
});
