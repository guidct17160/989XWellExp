/**
 * Test Helpers & Utility Functions for WellX989 E2E Testing
 */

export const DEFAULT_ADMIN = {
  username: 'admin',
  password: '1234',
  name: 'สมชาย ใจดี (Web Admin)',
  role: 'Super Admin',
  department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
};

/**
 * Perform full UI login via the Web Admin Login Page
 */
export async function loginAsAdmin(page, credentials = DEFAULT_ADMIN) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // If already logged in, skip login flow
  const isDashboard = await page.locator('text=War Command Suite').isVisible().catch(() => false);
  if (isDashboard) {
    return;
  }

  // Fill credentials
  await page.locator('#username').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);

  // Click Submit
  await page.locator('button[type="submit"]').click();

  // Wait for Dashboard header or navigation
  await page.waitForSelector('text=War Command Suite', { timeout: 10000 });
}

/**
 * Fast session injection via localStorage to bypass UI login for fast navigation tests
 */
export async function injectAdminSession(page, user = DEFAULT_ADMIN) {
  await page.goto('/');
  await page.evaluate((userData) => {
    const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_test_token_wellx989';
    const now = Date.now();
    localStorage.setItem('wellx989_token', dummyToken);
    localStorage.setItem('wellx989_user', JSON.stringify({
      id: 'ADM-001',
      code: 'ADM-001',
      username: userData.username,
      name: userData.name,
      role: userData.role,
      department: userData.department,
    }));
    localStorage.setItem('wellx989_is_logged_in', 'true');
    localStorage.setItem('wellx989_login_time', String(now));
    localStorage.setItem('wellx989_last_activity', String(now));
  }, user);
  await page.reload();
  await page.waitForSelector('text=War Command Suite', { timeout: 10000 });
}

/**
 * Clean up test session
 */
export async function clearSession(page) {
  try {
    if (page.url() !== 'about:blank') {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {}
      });
    }
  } catch (e) {
    // ignore if on about:blank
  }
}
