import { test, expect } from '@playwright/test';
import { clearSession, loginAsAdmin } from './helpers/auth';

test.describe('1. Authentication & Security Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('UI-01: Should display login page with branding and input elements', async ({ page }) => {
    // Check Title & Branding
    await expect(page.locator('text=War Command Portal')).toBeVisible();
    await expect(page.locator('img[alt="WellX989"]')).toBeVisible();
    await expect(page.locator('label[for="username"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();

    // Check Inputs
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In to Command Suite');
  });

  test('VAL-01: Should show error when submitting empty fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')).toBeVisible();
  });

  test('VAL-02: Should show error when password is empty', async ({ page }) => {
    await page.locator('#username').fill('admin');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=กรุณากรอกรหัสผ่าน (Password)')).toBeVisible();
  });

  test('VAL-03: Should show error when username is empty', async ({ page }) => {
    await page.locator('#password').fill('1234');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=กรุณากรอกชื่อผู้ใช้ (Username)')).toBeVisible();
  });

  test('UI-02: Should toggle password visibility', async ({ page }) => {
    const passwordInput = page.locator('#password');
    const toggleButton = page.locator('button[aria-label="Show password"], button[aria-label="Hide password"]');

    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click hide password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('SEC-01: Should reject invalid credentials', async ({ page }) => {
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('wrong_password_9999');
    await page.locator('button[type="submit"]').click();

    // Should display invalid error notice from backend
    await expect(page.locator('text=รหัสผ่าน (Password) ไม่ถูกต้อง')).toBeVisible();
  });

  test('SEC-02: Should block mobile demo account from Web Admin portal', async ({ page }) => {
    await page.locator('#username').fill('demo');
    await page.locator('#password').fill('demo');
    await page.locator('button[type="submit"]').click();

    // Portal separation check
    await expect(page.locator('text=บัญชีนี้เป็นพนักงานทดสอบ (Demo) สามารถเข้าใช้งานได้เฉพาะบน Mobile App เท่านั้น')).toBeVisible();
  });

  test('AUTH-01: Should log in successfully with valid admin credentials', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify Dashboard is visible
    await expect(page.locator('text=War Command Suite')).toBeVisible();
    await expect(page.locator('aside button:has-text("Dashboard Overview"):visible')).toBeVisible();

    // Verify localStorage has token and user
    const token = await page.evaluate(() => localStorage.getItem('wellx989_token'));
    const isLoggedIn = await page.evaluate(() => localStorage.getItem('wellx989_is_logged_in'));
    expect(token).toBeTruthy();
    expect(isLoggedIn).toBe('true');
  });

  test('AUTH-02: Should maintain session after browser reload', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('text=War Command Suite')).toBeVisible();

    // Reload page
    await page.reload();
    await expect(page.locator('text=War Command Suite')).toBeVisible();
  });

  test('AUTH-03: Should log out and clear session tokens', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('text=War Command Suite')).toBeVisible();

    // Click Logout button in visible sidebar
    const logoutBtn = page.locator('button:has-text("ออกจากระบบ (Logout)"):visible');
    await logoutBtn.click();

    // Verify redirected back to Login Page
    await expect(page.locator('text=War Command Portal')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();

    // Verify localStorage cleaned
    const token = await page.evaluate(() => localStorage.getItem('wellx989_token'));
    const user = await page.evaluate(() => localStorage.getItem('wellx989_user'));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });
});
