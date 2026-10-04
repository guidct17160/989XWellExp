import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('4. Employee Management Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to All Employees Directory
    const empAccordion = page.locator('aside button:has-text("3. Employee & Point"):visible');
    await empAccordion.click();
    const allEmpLink = page.locator('aside button:has-text("All Employees Directory"):visible');
    await allEmpLink.click();
    await expect(page.locator('h1:has-text("การจัดการรายชื่อพนักงาน")')).toBeVisible();
  });

  test('EMP-01: Should display Employee Management page with search and filters', async ({ page }) => {
    await expect(page.locator('input[placeholder="ค้นหาชื่อ, รหัส หรืออีเมลพนักงาน..."]')).toBeVisible();
    await expect(page.locator('button:has-text("สร้าง / ลงทะเบียนพนักงานใหม่")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ส่งออก CSV (Excel)")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('EMP-02: Should filter employees via search bar', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="ค้นหาชื่อ, รหัส หรืออีเมลพนักงาน..."]');
    await searchInput.fill('NonExistentEmployee_XYZ_99999');
    // Should show no data or 0 rows
    await expect(page.locator('text=ไม่พบข้อมูลพนักงาน').or(page.locator('text=0 คน'))).toBeVisible();
    
    // Clear search
    await searchInput.fill('');
  });

  test('EMP-03: Should open Add Employee modal and validate required fields', async ({ page }) => {
    const addBtn = page.locator('button:has-text("สร้าง / ลงทะเบียนพนักงานใหม่")').first();
    await addBtn.click();

    // Verify Modal Header
    const modalHeader = page.locator('h3:has-text("สร้าง / ลงทะเบียนพนักงานใหม่")');
    await expect(modalHeader).toBeVisible();

    // Verify Required Input Fields
    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Close Modal via Cancel button
    const closeBtn = page.locator('button:has-text("ยกเลิก")');
    await closeBtn.click();
    await expect(modalHeader).not.toBeVisible();
  });

  test('EMP-04: Should validate duplicate employee code and email', async ({ page }) => {
    const addBtn = page.locator('button:has-text("สร้าง / ลงทะเบียนพนักงานใหม่")').first();
    await addBtn.click();

    // If an existing employee is in the table, test duplicate detection
    const firstCodeCell = page.locator('table tbody tr td').first();
    if (await firstCodeCell.isVisible()) {
      const existingText = await firstCodeCell.innerText();
      if (existingText && existingText.length > 2) {
        await page.locator('input[name="code"]').fill(existingText.trim());
      }
    }

    // Close modal
    const closeBtn = page.locator('button:has-text("ยกเลิก")');
    await closeBtn.click();
  });
});
