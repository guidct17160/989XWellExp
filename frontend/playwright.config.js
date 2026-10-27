import { defineConfig, devices } from '@playwright/test';

// ไฟล์ตั้งค่า Playwright สำหรับเทส E2E ของเว็บแอดมิน
// - เว็บรันด้วย Vite พอร์ต 3008 (กำหนดไว้ใน vite.config.js แบบ strictPort)
// - เทสรันใน Google Chrome ที่ติดตั้งในเครื่อง (channel: 'chrome') จึงไม่ต้องโหลดเบราว์เซอร์เพิ่ม
// - เทสทุกตัว mock การเรียก /api ทั้งหมด จึงไม่ต้องเปิด backend หรือฐานข้อมูล
const PORT = 3008;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  // โฟลเดอร์ที่เก็บไฟล์เทส
  testDir: './e2e',
  // เวลาสูงสุดต่อ 1 เคส (30 วินาที) และเวลารอสูงสุดของแต่ละ expect (7 วินาที)
  timeout: 30_000,
  expect: { timeout: 7_000 },
  // รันเคสต่างๆ พร้อมกันเพื่อให้เร็วขึ้น
  fullyParallel: true,
  // ใช้ 2 worker: เว็บทดสอบรันบน Vite dev server ตัวเดียว ถ้าขนานมากกว่านี้ page.goto จะช้าจนหมดเวลา (เคสสุ่มล้ม)
  workers: 2,
  // บน CI: ห้ามเหลือ test.only ค้างไว้ และให้ลองใหม่ 1 ครั้งถ้าล้มเหลว
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // รายงานผล: แสดงรายการในเทอร์มินัล + สร้างรายงาน HTML (เปิดดูด้วย npm run test:e2e:report)
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // ใช้ path สั้นๆ ใน page.goto('/login') ได้
    baseURL: BASE_URL,
    // เก็บ trace และภาพหน้าจอเฉพาะเคสที่ล้มเหลว เพื่อใช้ไล่หาสาเหตุ
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // จอคอมพิวเตอร์ (ทุกไฟล์ ยกเว้นไฟล์ responsive)
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' }, testIgnore: /responsive/ },
    // จอมือถือ Pixel 7 (เฉพาะไฟล์ login.responsive.spec.js)
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: /login\.responsive\.spec\.js/ },
  ],
  // ถ้ายังไม่มีเว็บรันอยู่ที่พอร์ต 3008 ให้เปิดให้เอง (ถ้ามีอยู่แล้วจะใช้ตัวเดิม)
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
