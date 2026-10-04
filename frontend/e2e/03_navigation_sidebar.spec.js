import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('3. Navigation & Responsive Sidebar Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('NAV-01: Should expand 1. Role & Permission accordion and navigate', async ({ page }) => {
    // Click Role & Permission Accordion in visible sidebar
    const roleAccordion = page.locator('aside button:has-text("1. Role & Permission"):visible');
    await roleAccordion.click();

    // Click Administrators & Roles
    const adminLink = page.locator('aside button:has-text("Administrators & Roles"):visible');
    await expect(adminLink).toBeVisible();
    await adminLink.click();

    // Verify Active View changes
    await expect(page.locator('text=ผู้ดูแลระบบ').first()).toBeVisible();
    expect(page.url()).toContain('tab=admin');

    // Click Security & Audit Logs (PDPA)
    const auditLogsLink = page.locator('aside button:has-text("Security & Audit Logs (PDPA)"):visible');
    await auditLogsLink.click();
    await expect(page.locator('text=Audit Trail').first()).toBeVisible();
    expect(page.url()).toContain('tab=audit-logs');
  });

  test('NAV-02: Should expand 2. Organization accordion and navigate', async ({ page }) => {
    const orgAccordion = page.locator('aside button:has-text("2. Organization"):visible');
    await orgAccordion.click();

    // Main Departments
    const deptLink = page.locator('aside button:has-text("Main Departments"):visible');
    await expect(deptLink).toBeVisible();
    await deptLink.click();
    expect(page.url()).toContain('tab=department');

    // Job Positions
    const posLink = page.locator('aside button:has-text("Job Positions"):visible');
    await posLink.click();
    expect(page.url()).toContain('tab=position');
  });

  test('NAV-03: Should expand 3. Employee & Point accordion and navigate', async ({ page }) => {
    const empAccordion = page.locator('aside button:has-text("3. Employee & Point"):visible');
    await empAccordion.click();

    // All Employees Directory
    const allEmpLink = page.locator('aside button:has-text("All Employees Directory"):visible');
    await expect(allEmpLink).toBeVisible();
    await allEmpLink.click();
    expect(page.url()).toContain('tab=all-employee');

    // Points Balance & History
    const pointsLink = page.locator('aside button:has-text("Points Balance & History"):visible');
    await pointsLink.click();
    expect(page.url()).toContain('tab=points');
  });

  test('NAV-04: Should expand 4. Attendance accordion and navigate', async ({ page }) => {
    const attAccordion = page.locator('aside button:has-text("4. Attendance"):visible');
    await attAccordion.click();

    // Daily Attendance
    const attLink = page.locator('aside button:has-text("Daily Attendance & GPS Logs"):visible');
    await expect(attLink).toBeVisible();
    await attLink.click();
    expect(page.url()).toContain('tab=attendance');

    // Overtime
    const otLink = page.locator('aside button:has-text("Overtime (OT) Records"):visible');
    await otLink.click();
    expect(page.url()).toContain('tab=overtime');
  });

  test('NAV-05: Should expand 5. Leave & Policies accordion and navigate', async ({ page }) => {
    const leaveAccordion = page.locator('aside button:has-text("5. Leave & Policies"):visible');
    await leaveAccordion.click();

    // Leave Quotas & Policies
    const policyLink = page.locator('aside button:has-text("Leave Quotas & Policies"):visible');
    await expect(policyLink).toBeVisible();
    await policyLink.click();
    expect(page.url()).toContain('tab=leave-policy');

    // Approvals Workflow Center
    const approvalLink = page.locator('aside button:has-text("Approvals Workflow Center"):visible');
    await approvalLink.click();
    expect(page.url()).toContain('tab=approvals');
  });

  test('NAV-06: Should expand 6. Mission & 7. Reward and navigate', async ({ page }) => {
    // 6. Mission
    const missionAccordion = page.locator('aside button:has-text("6. Mission"):visible');
    await missionAccordion.click();
    const missionLink = page.locator('aside button:has-text("Step Challenges & Health Missions"):visible');
    await expect(missionLink).toBeVisible();
    await missionLink.click();
    expect(page.url()).toContain('tab=mission');

    // 7. Reward
    const rewardAccordion = page.locator('aside button:has-text("7. Reward"):visible');
    await rewardAccordion.click();
    const rewardLink = page.locator('aside button:has-text("Rewards Catalog & Inventory"):visible');
    await expect(rewardLink).toBeVisible();
    await rewardLink.click();
    expect(page.url()).toContain('tab=reward');
  });

  test('NAV-07: Responsive Mobile Drawer behaves properly on mobile screen', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Hamburger button should be visible
    const hamburgerBtn = page.locator('header button[title="Open Menu"]');
    await expect(hamburgerBtn).toBeVisible();

    // Click hamburger to open drawer
    await hamburgerBtn.click();

    // Mobile sidebar drawer should now be visible
    const mobileDrawer = page.locator('aside.fixed.top-0');
    await expect(mobileDrawer).toBeVisible();
    await expect(mobileDrawer).toHaveClass(/translate-x-0/);

    // Close button should close drawer
    const closeBtn = mobileDrawer.locator('button:has(svg)').first();
    await closeBtn.click();
    await expect(mobileDrawer).toHaveClass(/-translate-x-full/);
  });
});
