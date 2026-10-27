// ตัวช่วยเพิ่มเติมของเทสชุดที่ 2 (Quest, Rewards, Admins, Audit Logs, Dashboard)
// ใช้ร่วมกับ helpers.js (mockApi / seedSession) โดยไม่แก้ไฟล์นั้น
import { ADMIN } from './helpers';

/** สร้างข้อมูลตอบกลับแบบ JSON ให้ route.fulfill */
export const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * ผูก mock ให้ URL + HTTP method หนึ่งๆ แล้วคืนรายการคำขอที่หน้าเว็บส่งมา (url, body, headers)
 * - url เป็น glob หรือ RegExp, method เช่น 'GET' / 'POST' (method อื่นถูกส่งต่อให้ route ตัวถัดไป)
 * - respond เป็น { status, body } หรือฟังก์ชัน (call) => { status, body } เพื่อตอบตามคำขอ
 * - ต้องเรียกหลัง mockApi() เพราะ route ที่ผูกทีหลังได้สิทธิ์ก่อน
 */
export async function routeJson(page, url, method, respond) {
  const calls = [];
  await page.route(url, (route) => {
    const req = route.request();
    if (req.method() !== method) return route.fallback();
    let body = null;
    try { body = req.postDataJSON(); } catch (e) { body = null; }
    const call = { url: req.url(), body, headers: req.headers() };
    calls.push(call);
    const r = typeof respond === 'function' ? respond(call) : respond;
    return route.fulfill(json(r.status ?? 200, r.body));
  });
  return calls;
}

/** เหมือน seedSession แต่กำหนดข้อมูลผู้ใช้เองได้ เช่น role: 'HR Admin' เพื่อทดสอบการซ่อนเมนู */
export async function seedSessionAs(page, overrides = {}) {
  await page.addInitScript(
    ({ user }) => {
      const now = String(Date.now());
      localStorage.setItem('wellx989_user', JSON.stringify(user));
      localStorage.setItem('wellx989_is_logged_in', 'true');
      localStorage.setItem('wellx989_login_time', now);
      localStorage.setItem('wellx989_last_activity', now);
      localStorage.setItem('wellx989_token', 'seeded-test-token');
    },
    { user: { ...ADMIN, ...overrides } }
  );
}

/** ตัวหา input / textarea / select ที่อยู่ถัดจาก <label> ที่ข้อความขึ้นต้นด้วย labelText (label ของเว็บไม่ได้ผูกกับ input) */
export function fieldAfterLabel(scope, labelText, tag = 'input') {
  return scope.locator('label', { hasText: labelText }).locator(`xpath=following-sibling::${tag}[1]`);
}
