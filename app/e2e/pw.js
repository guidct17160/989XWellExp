// ตัวเชื่อมไปยัง @playwright/test ที่ติดตั้งไว้แล้วในโปรเจกต์ frontend
// (ไม่เพิ่ม dependency ใหม่ใน app/package.json) ทุกไฟล์เทสและ config ต้อง import จากไฟล์นี้
// เพื่อให้ตัวรันเทสกับไฟล์เทสใช้ Playwright สำเนาเดียวกัน
const path = require('path');

const FRONTEND_PW = path.resolve(__dirname, '..', '..', 'frontend', 'node_modules', '@playwright', 'test');

module.exports = require(process.env.PW_TEST_PATH || FRONTEND_PW);
module.exports.PW_CLI = path.join(process.env.PW_TEST_PATH || FRONTEND_PW, 'cli.js');
