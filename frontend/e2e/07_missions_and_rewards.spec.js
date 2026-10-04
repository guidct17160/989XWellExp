import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('7. Gamification: Missions & Rewards Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('MSN-01: Should display Step Challenges & Health Missions', async ({ page }) => {
    // Open 6. Mission
    await page.locator('aside button:has-text("6. Mission"):visible').click();
    await page.locator('aside button:has-text("Step Challenges & Health Missions"):visible').click();

    await expect(page.locator('text=ระบบภารกิจและกิจกรรมสะสมก้าว').or(page.locator('text=Mission'))).toBeVisible();
    await expect(page.locator('button:has-text("สร้างภารกิจใหม่")').or(page.locator('button:has-text("เพิ่มภารกิจ")')).first()).toBeVisible();
  });

  test('MSN-02: Should open Add Mission modal', async ({ page }) => {
    await page.locator('aside button:has-text("6. Mission"):visible').click();
    await page.locator('aside button:has-text("Step Challenges & Health Missions"):visible').click();

    const addMissionBtn = page.locator('button:has-text("สร้างภารกิจใหม่"), button:has-text("เพิ่มภารกิจ")').first();
    await addMissionBtn.click();

    // Verify modal appears
    await expect(page.locator('input[placeholder*="ภารกิจ"]').or(page.locator('form input').first())).toBeVisible();

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
  });

  test('REW-01: Should display Rewards Catalog & Inventory', async ({ page }) => {
    // Open 7. Reward
    await page.locator('aside button:has-text("7. Reward"):visible').click();
    await page.locator('aside button:has-text("Rewards Catalog & Inventory"):visible').click();

    await expect(page.locator('text=ระบบจัดการของรางวัล').or(page.locator('text=Reward'))).toBeVisible();
    await expect(page.locator('button:has-text("เพิ่มของรางวัล")').or(page.locator('button:has-text("สร้างของรางวัล")')).first()).toBeVisible();
  });

  test('REW-02: Should open Add Reward modal', async ({ page }) => {
    await page.locator('aside button:has-text("7. Reward"):visible').click();
    await page.locator('aside button:has-text("Rewards Catalog & Inventory"):visible').click();

    const addRewardBtn = page.locator('button:has-text("เพิ่มของรางวัล"), button:has-text("สร้างของรางวัล")').first();
    await addRewardBtn.click();

    // Verify modal appears
    await expect(page.locator('input[placeholder*="รางวัล"]').or(page.locator('form input').first())).toBeVisible();

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
  });
});
