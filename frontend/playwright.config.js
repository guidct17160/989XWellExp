import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for WellX989 Enterprise E2E Test Suite
 * Designed by Senior Software QA & Senior Developer
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 7000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential execution for predictable database & test state
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:3008',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cmd.exe /c npm start',
      cwd: '../backend',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'cmd.exe /c npm run dev',
      url: 'http://localhost:3008',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
