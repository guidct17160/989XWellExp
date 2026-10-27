// ตัวช่วยสำหรับเทส API ของ backend (node:test + fetch ไม่ต้องลง package เพิ่ม)
//
// - เปิด backend จริง (src/server.js) บนพอร์ตว่างและ **ฐานข้อมูลทดสอบแยก `wellx989_test`** เท่านั้น
//   ไม่แตะฐานข้อมูลจริง (ถ้าชื่อฐานไม่ใช่ wellx989_test ตัวช่วยนี้ปฏิเสธทุกคำสั่ง SQL)
// - โครงสร้างตาราง backend สร้างให้เองตอนเริ่ม (config/database.js) เหมือนใช้งานจริง
// - อีเมลถูกบังคับให้ส่งไม่ออก (SMTP ชี้ไปพอร์ตปิด) เทสจึงไม่ส่งอีเมลจริงถึงใคร
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const BACKEND = path.resolve(__dirname, '..', '..');
const requireBackend = (name) => require(path.join(BACKEND, 'node_modules', name));
requireBackend('dotenv').config({ path: path.join(BACKEND, '.env') }); // ใช้แค่ host/port/user/password ของ PostgreSQL
const { Pool } = requireBackend('pg');
const bcrypt = requireBackend('bcryptjs');

const TEST_DB = 'wellx989_test';
const PASSWORD = 'Passw0rd!';
const ADMIN = { username: 'admin', password: '1234' }; // Super Admin ที่ backend สร้างให้เองในฐานว่าง

// env ของ process ลูก: บังคับฐานทดสอบ ไม่ใช้ DATABASE_URL และไม่ส่งอีเมลจริง
const childEnv = (port) => {
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(port), PGDATABASE: TEST_DB, JWT_SECRET: 'wellx989-test-secret', JWT_REFRESH_SECRET: 'wellx989-test-refresh' };
  // .env อาจมี DATABASE_URL ของฐานจริง (dotenv ไม่ทับค่าที่ตั้งไว้แล้ว) จึงต้องตั้งเป็นฐานทดสอบให้ชัดเจน
  env.DATABASE_URL = `postgresql://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(String(process.env.PGPASSWORD || ''))}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${TEST_DB}`;
  Object.assign(env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: '', SMTP_PASS: '' });
  return env;
};

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

let pool = null;
const getPool = () => {
  if (!pool) pool = new Pool({ database: TEST_DB, password: String(process.env.PGPASSWORD || '') });
  return pool;
};
// ทุกคำสั่ง SQL ของเทสผ่านตรงนี้ และต้องเป็นฐานทดสอบเท่านั้น
const sql = async (text, params) => {
  const { rows } = await getPool().query(text, params);
  return rows;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ตารางที่ไม่ล้างระหว่างเทส (Super Admin ตั้งต้นและวันหยุด) ตารางอื่นล้างทั้งหมด backend จะสร้างของรางวัล/หมวดตั้งต้นใหม่เองตอนเริ่มครั้งถัดไป
const KEEP = ['admins', 'company_holidays'];

// ล้างข้อมูลทุกตารางของฐานทดสอบ ยกเว้นข้อมูลตั้งต้น
async function resetData() {
  const tables = (await sql("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).map((r) => r.tablename).filter((t) => !KEEP.includes(t));
  if (tables.length) await sql(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY`);
  // เหลือแอดมินตั้งต้นคนเดียว (admin / 1234) แม้เทสก่อนหน้าจะแก้หรือลบไว้
  await sql("DELETE FROM admins WHERE id <> 'ADM-001'");
  await sql(
    `INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date)
     VALUES ('ADM-001', 'ADM-001', 'admin', $1, 'ผู้ดูแลระบบ (Web Admin)', 'admin@wellx989.com', '081-234-5678', '-', 'Super Admin', 'Active', '2026-01-01')
     ON CONFLICT (id) DO UPDATE SET username = 'admin', password = $1, role = 'Super Admin', status = 'Active', pin_hash = NULL`,
    [bcrypt.hashSync(ADMIN.password, 4)]
  );
}

// เปิด backend และรอจนสร้างตารางและข้อมูลตั้งต้นเสร็จ
async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(BACKEND, 'src', 'server.js')], { cwd: BACKEND, env: childEnv(port), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  let exited = false;
  child.on('exit', () => { exited = true; });

  const base = `http://127.0.0.1:${port}/api`;
  const fetchJson = async (url, opts) => { const r = await fetch(`${base}${url}`, opts); return { status: r.status, body: await r.json().catch(() => null) }; };
  // พร้อมใช้งานเมื่อ backend ต่อ PostgreSQL ได้แล้วจริง (ไม่ใช่โหมดสำรองในหน่วยความจำ): ใส่แผนกหลอกลงฐานทดสอบแล้วรอให้ API อ่านเห็น
  const probeId = `DEP-PROBE-${process.pid}-${Date.now()}`;
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    if (exited) throw new Error(`backend ปิดตัวเองตอนเริ่ม:
${log}`);
    try {
      await sql("INSERT INTO departments (id, code, name, status) VALUES ($1, $1, 'probe', 'Active') ON CONFLICT DO NOTHING", [probeId]);
      const login = await fetchJson('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: ADMIN.username, password: ADMIN.password, portal: 'web' }) });
      if (login.status === 200) {
        const deps = await fetchJson('/departments', { headers: { Authorization: `Bearer ${login.body.token}` } });
        ready = !!(deps.body && (deps.body.departments || []).some((d) => d.id === probeId));
      }
    } catch (e) { /* ยังไม่พร้อม ลองใหม่ */ }
    if (!ready) await sleep(500);
  }
  if (!ready) throw new Error(`backend ไม่พร้อมใน 60 วินาที:
${log}`);
  await sql('DELETE FROM departments WHERE id = $1', [probeId]).catch(() => {});
  // รอให้ขั้นตอนเริ่มระบบ (migration / seed) เงียบลงก่อน
  for (let quiet = 0, last = log.length, t = 0; quiet < 700 && t < 8000; t += 100) {
    await sleep(100);
    if (log.length === last) quiet += 100; else { quiet = 0; last = log.length; }
  }
  return {
    port,
    base,
    log: () => log,
    stop: async () => {
      if (exited) return;
      child.kill();
      for (let i = 0; i < 40 && !exited; i++) await sleep(100);
    },
  };
}

// เรียก API ด้วย token (ไม่ส่ง token = ไม่ได้ล็อกอิน) คืน { status, body }
const client = (server) => async (method, url, { token, body, headers } = {}) => {
  const res = await fetch(`${server.base}${url}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers || {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* ไม่ใช่ JSON */ }
  return { status: res.status, body: data };
};

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---- ข้อมูลตัวอย่าง (เขียนลงฐานทดสอบตรงๆ) -------------------------------------------------
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

async function makeDept(name) {
  const id = `DEP-${uid()}`;
  await sql('INSERT INTO departments (id, code, name, manager, status) VALUES ($1, $1, $2, NULL, $3)', [id, name || `Dept ${id}`, 'Active']);
  return { id, name: name || `Dept ${id}` };
}

// สร้างพนักงานที่ใช้งานได้ทันที (รหัสผ่านคือ PASSWORD) role: Employee | Boss | SuperBoss | HR Admin ...
async function makeEmployee({ role = 'Employee', dept, name, gender = 'Male', points = 0, status = 'Active' } = {}) {
  const d = dept || (await makeDept());
  const id = `E${uid()}`.toUpperCase();
  const empName = name || `${role} ${id}`;
  await sql(
    `INSERT INTO employees (id, code, username, password, name, first_name, last_name, email, department, department_id, role, status, start_date, gender, points)
     VALUES ($1, $1, $2, $3, $4, $5, $13, $6, $7, $8, $9, $10, '2024-01-01', $11, $12)`,
    [id, id.toLowerCase(), passwordHash, empName, empName.split(' ')[0], `${id.toLowerCase()}@test.local`, d.name, d.id, role, status, gender, points, empName.split(' ').slice(1).join(' ') || 'Test']
  );
  return { id, username: id.toLowerCase(), name: empName, role, dept: d, password: PASSWORD };
}

async function loginApp(api, user) {
  const r = await api('POST', '/auth/login', { body: { username: user.username, password: user.password || PASSWORD, portal: 'app' } });
  if (r.status !== 200) throw new Error(`login app ล้มเหลว (${r.status}): ${JSON.stringify(r.body)}`);
  return r.body.token;
}
async function loginAdmin(api, creds = ADMIN) {
  const r = await api('POST', '/auth/login', { body: { username: creds.username, password: creds.password, portal: 'web' } });
  if (r.status !== 200) throw new Error(`login web ล้มเหลว (${r.status}): ${JSON.stringify(r.body)}`);
  return r.body.token;
}

// สร้างสถานที่ลงเวลาที่ lat/lng แล้วคืน location
async function makeLocation(api, adminToken, body = {}) {
  const r = await api('POST', '/work-locations', { token: adminToken, body: { name: `Office ${uid()}`, type: 'Office', latitude: 13.7563, longitude: 100.5018, radiusM: 100, scope: 'all', ...body } });
  if (r.status !== 201) throw new Error(`สร้าง location ล้มเหลว (${r.status}): ${JSON.stringify(r.body)}`);
  return r.body.location;
}

const todayBkk = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
const bkkSeconds = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
};

async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

module.exports = { TEST_DB, PASSWORD, ADMIN, sql, sleep, resetData, startServer, client, uid, makeDept, makeEmployee, loginApp, loginAdmin, makeLocation, todayBkk, bkkSeconds, closePool };
