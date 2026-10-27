// สร้างฐานข้อมูลทดสอบ `wellx989_test` (ว่างๆ ถ้ายังไม่มี) ด้วยผู้ใช้/รหัสผ่านของ PostgreSQL เดียวกับ backend/.env
// ใช้ครั้งเดียวก่อนรัน `npm test` ครั้งแรก:  npm run test:db
// ไม่แตะฐานข้อมูลจริง ตารางทั้งหมดถูกสร้างโดย backend เองตอนเริ่ม
const path = require('path');
const BACKEND = path.resolve(__dirname, '..', '..');
const requireBackend = (name) => require(path.join(BACKEND, 'node_modules', name));
requireBackend('dotenv').config({ path: path.join(BACKEND, '.env') });
const { Client } = requireBackend('pg');
const { TEST_DB } = require('./harness');

(async () => {
  const c = new Client({ database: 'postgres', password: String(process.env.PGPASSWORD || '') });
  await c.connect();
  const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
  if (exists.rowCount) console.log(`ฐานข้อมูล ${TEST_DB} มีอยู่แล้ว`);
  else { await c.query(`CREATE DATABASE ${TEST_DB}`); console.log(`สร้างฐานข้อมูล ${TEST_DB} แล้ว`); }
  await c.end();
  process.exit(0);
})().catch((e) => { console.error('สร้างฐานข้อมูลทดสอบไม่สำเร็จ:', e.message); process.exit(1); });
