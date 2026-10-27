// สร้าง (ถ้าจำเป็น) แล้วเสิร์ฟเว็บของแอปพนักงานที่ export เป็น static
//   node e2e/serve.js            -> ใช้ค่าจาก env (E2E_PORT, E2E_EXPORT_DIR)
// - export ด้วย `npx expo export --platform web` (ใช้เวลาประมาณ 1 นาที) จะสร้างใหม่เมื่อ
//   ไม่มีโฟลเดอร์ export, ตั้ง E2E_REBUILD=1 หรือโค้ดใน app/ (src, App.js, index.js ...) ใหม่กว่า export
// - ตั้ง E2E_SKIP_BUILD=1 เพื่อข้ามการ build ทุกกรณี (ใช้ export เดิม)
// - ทุก path ที่ไม่ใช่ไฟล์จริงจะตอบ index.html (SPA fallback) เพื่อให้เปิด /main, /leave-request ... ตรงๆ ได้
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const APP_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.E2E_PORT || 4391);
const EXPORT_DIR = path.resolve(process.env.E2E_EXPORT_DIR || path.join(os.tmpdir(), 'wellx989-app-e2e-export'));

const newestMtime = (target) => {
  let newest = 0;
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch (e) { return; }
    if (st.isDirectory()) {
      const name = path.basename(p);
      if (name === 'node_modules' || name === 'e2e' || name === '.expo' || name.startsWith('.')) return;
      fs.readdirSync(p).forEach((f) => walk(path.join(p, f)));
    } else if (st.mtimeMs > newest) {
      newest = st.mtimeMs;
    }
  };
  walk(target);
  return newest;
};

const needsBuild = () => {
  if (process.env.E2E_SKIP_BUILD === '1') return false;
  if (process.env.E2E_REBUILD === '1') return true;
  const indexFile = path.join(EXPORT_DIR, 'index.html');
  if (!fs.existsSync(indexFile)) return true;
  const builtAt = fs.statSync(indexFile).mtimeMs;
  const sources = ['src', 'assets', 'App.js', 'index.js', 'app.json', 'babel.config.js', 'tailwind.config.js', 'package.json']
    .map((f) => newestMtime(path.join(APP_DIR, f)));
  return Math.max(...sources) > builtAt;
};

if (needsBuild()) {
  console.log(`[e2e] กำลัง export เว็บของแอป -> ${EXPORT_DIR} (ประมาณ 1 นาที)`);
  const r = spawnSync(`npx expo export --platform web --output-dir "${EXPORT_DIR}"`, {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    console.error('[e2e] expo export ไม่สำเร็จ');
    process.exit(r.status || 1);
  }
} else {
  console.log(`[e2e] ใช้ export เดิมที่ ${EXPORT_DIR}`);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

const root = EXPORT_DIR;
http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.resolve(path.join(root, url));
    const inside = file === root || file.startsWith(root + path.sep);
    if (!inside || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`[e2e] serving ${root} on http://localhost:${PORT}`));
