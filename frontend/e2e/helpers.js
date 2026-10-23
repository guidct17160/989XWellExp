// ตัวช่วยที่ใช้ร่วมกันในเทส E2E ของเว็บแอดมิน
// ทุกการเรียก /api ถูก mock ไว้ จึงรันได้โดยไม่ต้องมี backend หรือฐานข้อมูล

// ข้อมูลแอดมินจำลองที่ใช้เป็นผู้ล็อกอินในเทส
export const ADMIN = {
  id: 'ADM-001',
  code: 'ADM-001',
  username: 'admin',
  name: 'Super Admin',
  email: 'admin@wellx989.com',
  role: 'Super Admin',
  status: 'Active',
};

// สร้างข้อมูลตอบกลับแบบ JSON ให้ route.fulfill
const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** ตอบทุก API ว่า success เปล่าๆ เพื่อให้หน้า Dashboard แสดงผลได้โดยไม่ต้องมี backend */
export async function mockApi(page) {
  // ดักทุกคำขอที่ขึ้นต้นด้วย /api แล้วตอบ success ทันที (ไม่ส่งไป server จริง)
  await page.route('**/api/**', (route) => route.fulfill(json(200, { success: true })));
}

/**
 * จำลอง POST /api/auth/login
 * คืนค่า { requests } = รายการ body ที่หน้าเว็บส่งมา (ใช้ตรวจว่าส่งข้อมูลถูกต้อง)
 * ตัวเลือก: status = รหัสตอบกลับ, body = เนื้อหาตอบกลับ, delayMs = หน่วงเวลา, abort = จำลองเชื่อมต่อไม่ได้
 */
export async function mockLogin(page, { status = 200, body, delayMs = 0, abort = false } = {}) {
  const requests = [];
  await page.route('**/api/auth/login', async (route) => {
    // เก็บ body ที่หน้าเว็บส่งมา เพื่อให้เทสตรวจได้ภายหลังว่าส่งข้อมูลถูกต้อง
    requests.push(route.request().postDataJSON());
    // จำลองเครือข่ายล่ม / เชื่อมต่อ server ไม่ได้
    if (abort) return route.abort('failed');
    // หน่วงเวลาก่อนตอบ เพื่อให้เห็นสถานะกำลังโหลด
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill(
      json(status, body ?? { success: true, token: 'test-jwt-token', user: ADMIN })
    );
  });
  return { requests };
}

/** จำลอง POST /api/auth/forgot-password คืนค่า { requests } เหมือน mockLogin */
export async function mockForgotPassword(page, { status = 200, body, abort = false } = {}) {
  const requests = [];
  await page.route('**/api/auth/forgot-password', (route) => {
    // เก็บ body ที่หน้าเว็บส่งมา เพื่อให้เทสตรวจได้ภายหลังว่าส่งข้อมูลถูกต้อง
    requests.push(route.request().postDataJSON());
    // จำลองเครือข่ายล่ม / เชื่อมต่อ server ไม่ได้
    if (abort) return route.abort('failed');
    return route.fulfill(
      json(status, body ?? { success: true, message: 'sent', maskedEmail: 'a***n@wellx989.com' })
    );
  });
  return { requests };
}

/** เปิดเบราว์เซอร์ในสภาพที่ล็อกอินอยู่แล้ว (ใส่ token และข้อมูลผู้ใช้ใน localStorage เหมือนที่เว็บเก็บจริง) */
export async function seedSession(page, { withToken = true } = {}) {
  // สคริปต์นี้รันก่อนโค้ดของเว็บทุกครั้งที่โหลดหน้า ใช้ใส่ session ลง localStorage
  await page.addInitScript(
    ({ user, withToken: tokenFlag }) => {
      const now = String(Date.now());
      localStorage.setItem('wellx989_user', JSON.stringify(user));
      localStorage.setItem('wellx989_is_logged_in', 'true');
      localStorage.setItem('wellx989_login_time', now);
      localStorage.setItem('wellx989_last_activity', now);
      // ถ้าไม่ใส่ token = จำลอง session ที่ใช้งานไม่ได้
      if (tokenFlag) localStorage.setItem('wellx989_token', 'seeded-test-token');
    },
    { user: ADMIN, withToken }
  );
}

/** ตัวหา element ต่างๆ บนหน้า Login (ชื่อผู้ใช้ รหัสผ่าน ปุ่ม ลิงก์ ฯลฯ) */
export function loginScreen(page) {
  return {
    // ฟอร์มล็อกอินแสดงอยู่หรือไม่ (หน้านี้ไม่มีหัวข้อแล้ว จึงใช้ช่องชื่อผู้ใช้เป็นตัวบอก)
    signInShown: page.locator('#username'),
    username: page.locator('#username'),
    password: page.locator('#password'),
    toggle: page.getByRole('button', { name: /show password|hide password/i }),
    forgotLink: page.getByRole('button', { name: 'Forgot Password?' }),
    submit: page.getByRole('button', { name: /^(login|verifying credentials\.\.\.)$/i }),
    // กล่องข้อความผิดพลาดสีแดงของหน้า Login
    errorBanner: page.locator('div.bg-red-950\\/80'),
    logo: page.getByRole('img', { name: 'WellX989' }),
  };
}

/** ตรวจว่าอยู่หน้า Dashboard แล้ว โดยดูหัวข้อ "Dashboard Overview" (ข้อความในแถบข้างมีซ้ำสำหรับมือถือ จึงใช้หัวข้อของหน้าแทน) */
export const expectDashboard = (page, expect) => expect(page.getByRole('heading', { name: /dashboard overview/i })).toBeVisible();

/** กรอกชื่อผู้ใช้และรหัสผ่านในหน้า Login แล้วคืนตัวหา element เพื่อใช้ต่อ */
export async function fillLogin(page, username, password) {
  const s = loginScreen(page);
  await s.username.fill(username);
  await s.password.fill(password);
  return s;
}
