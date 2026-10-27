// ตั้งค่า Playwright สำหรับเทส E2E ของ "แอปพนักงาน" (Expo รันบนเว็บ)
// - สั่ง export เว็บของแอปเป็น static แล้วเสิร์ฟที่พอร์ต E2E_PORT (ค่าเริ่มต้น 4391) ผ่าน e2e/serve.js
// - เทสทุกตัว mock การเรียก /api ทั้งหมด (ไม่ต้องเปิด backend หรือฐานข้อมูล)
// - รันใน Google Chrome ที่ติดตั้งในเครื่อง (channel: 'chrome') จึงไม่ต้องโหลดเบราว์เซอร์เพิ่ม
const { defineConfig, devices } = require('./pw');

const PORT = Number(process.env.E2E_PORT || 4391);
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  // ครั้งแรกอาจต้อง export เว็บ (~1 นาที) แต่เวลานั้นอยู่ใน webServer ไม่นับรวมในเวลาของแต่ละเคส
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: BASE_URL,
    // จอขนาดมือถือ (แอปแสดงเลย์เอาต์มือถือเมื่อกว้างไม่เกิน 550px)
    viewport: { width: 412, height: 860 },
    // วัน/เวลาทั้งหมดของแอปอิงเวลาไทย
    timezoneId: 'Asia/Bangkok',
    locale: 'th-TH',
    permissions: ['geolocation'],
    geolocation: { latitude: 13.7563, longitude: 100.5018 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'app-web' }],
  webServer: {
    command: 'node serve.js',
    cwd: __dirname,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { E2E_PORT: String(PORT) },
  },
});
