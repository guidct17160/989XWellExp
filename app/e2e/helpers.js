// ตัวช่วยที่ใช้ร่วมกันในเทส E2E ของแอปพนักงาน (Expo รันบนเว็บ)
// - mockApi: ดักทุกคำขอ /api (page.route) ตอบข้อมูลจำลอง + จดบันทึกทุกคำขอไว้ให้เทสตรวจ (ไม่มี backend/DB)
// - seedSession: ใส่ session ลง localStorage (key `wellx989_session`) ก่อนแอปโหลด
// - setup: รวมทั้งหมดให้เรียกบรรทัดเดียวต้นเทส
const { test, expect } = require('./pw');

// เก็บ api ของแต่ละเทส เพื่อเตือนเมื่อแอปเรียก endpoint ที่ยังไม่ได้ mock (ตอบ 404)
const apiByPage = new WeakMap();
test.afterEach(async ({ page }) => {
  const api = apiByPage.get(page);
  if (api && api.unhandled.length) {
    console.warn(`[e2e] ไม่ได้ mock: ${[...new Set(api.unhandled)].join(', ')} (${test.info().title})`);
  }
});

// ---------------------------------------------------------------- ผู้ใช้จำลอง
const USERS = {
  employee: {
    id: 'EMP-001',
    code: 'EMP-001',
    username: 'somchai',
    name: 'สมชาย ใจดี',
    email: 'somchai@wellx989.com',
    phone: '081-234-5678',
    gender: 'Male',
    role: 'Employee',
    department: 'ฝ่ายขาย',
    position: 'พนักงานขาย',
    status: 'Active',
    startDate: '2024-01-15',
    hasPin: false,
  },
  boss: {
    id: 'EMP-010',
    code: 'EMP-010',
    username: 'boss',
    name: 'วิชัย หัวหน้าทีม',
    email: 'wichai@wellx989.com',
    phone: '082-000-1010',
    gender: 'Male',
    role: 'Boss',
    department: 'ฝ่ายขาย',
    position: 'ผู้จัดการฝ่ายขาย',
    status: 'Active',
    startDate: '2022-03-01',
    hasPin: false,
  },
  superboss: {
    id: 'EMP-900',
    code: 'EMP-900',
    username: 'superboss',
    name: 'ประเสริฐ ผู้บริหาร',
    email: 'prasert@wellx989.com',
    phone: '083-000-9000',
    gender: 'Male',
    role: 'SuperBoss',
    department: 'ฝ่ายบริหาร',
    position: 'กรรมการผู้จัดการ',
    status: 'Active',
    startDate: '2020-01-01',
    hasPin: false,
  },
};

// ---------------------------------------------------------------- วันที่ (เวลาไทย เหมือน app/src/utils/bangkokDate.js)
const todayIsoBkk = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
/** วันที่ (YYYY-MM-DD, เวลาไทย) ย้อนหลัง n วัน */
const daysAgoIsoBkk = (n) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- ข้อมูลตั้งต้นของ mock
const defaultData = () => ({
  me: null, // ข้อมูลผู้ใช้ที่ตอบ GET /employees/:id (ค่าเริ่มต้น = ผู้ใช้ใน session)
  workRules: { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 50 },
  history: [],
  summary: { totalWorkDays: 20, onTimeDays: 18, lateDays: 2, absentDays: 0, totalHours: 160 },
  locations: { required: true, locations: [] },
  notifications: [],
  announcements: [],
  balances: [],
  policies: [],
  myLeaves: [],
  myCorrections: [],
  holidays: [],
  points: 0,
  pointHistory: [],
  quests: [],
  questDetails: {},
  rewards: [],
  coupons: [],
  leaderboard: [],
  employees: [],
  approvalsPending: [],
  approvalsHistory: [],
});

const json = (status, body) => ({
  status,
  contentType: 'application/json',
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  },
  body: JSON.stringify(body),
});

/**
 * ดักทุกคำขอ /api ของแอป
 * options.data     : ข้อมูลที่ endpoint GET ต่างๆ จะตอบ (ดู defaultData) แก้ไขระหว่างเทสได้ที่ api.data
 * options.routes   : { 'POST /attendance/clock-in': (ctx) => ({ status, body }) | body }  (ทับค่าเริ่มต้น)
 * options.user     : ผู้ใช้ใน session (ใช้ตอบ /employees/:id)
 *
 * คืนค่า api:
 *   api.data                  ข้อมูลที่ mock ใช้ตอบ (แก้ได้ตลอด)
 *   api.calls                 ทุกคำขอ { method, path, query, body, headers }
 *   api.callsTo('POST', path) คำขอที่ตรงกับ method + path (string เท่ากัน หรือ RegExp)
 *   api.on('POST', path, h)   เพิ่ม/เปลี่ยน handler ระหว่างเทส
 *   api.unhandled             คำขอที่ไม่มี handler (ตอบ 404)
 */
async function mockApi(page, options = {}) {
  // สำเนาลึก: handler แก้ข้อมูลได้ (เช่น PATCH ทำเป็นอ่านแล้ว) โดยไม่ไปเปลี่ยนค่าคงที่ที่เทสอื่นในไฟล์เดียวกันใช้ร่วมกัน
  const data = structuredClone({ ...defaultData(), ...(options.data || {}) });
  if (!data.me && options.user) data.me = options.user;
  const calls = [];
  const unhandled = [];
  const custom = []; // ใหม่สุดอยู่หน้า

  const ok = (extra = {}) => ({ body: { success: true, ...extra } });

  // ตารางคำตอบเริ่มต้น: [method, RegExp ของ path, handler]
  const defaults = [
    ['GET', /^\/settings\/work-time$/, () => ok({ rules: data.workRules })],
    ['GET', /^\/attendance\/history$/, () => ok({ history: data.history })],
    ['GET', /^\/attendance\/summary$/, () => ok({ summary: data.summary })],
    ['GET', /^\/attendance\/locations$/, () => ok(data.locations)],
    ['POST', /^\/attendance\/clock-in$/, () => ok({ attendance: {}, pointsAwarded: 0 })],
    ['POST', /^\/attendance\/clock-out$/, () => ok({ attendance: {}, pointsAwarded: 0 })],
    ['POST', /^\/attendance\/corrections$/, () => ({ status: 201, body: { success: true, correction: { id: 'tc-new', status: 'รออนุมัติระดับ 1 (Boss)' } } })],
    ['GET', /^\/attendance\/corrections\/my-requests$/, () => ok({ corrections: data.myCorrections })],
    ['GET', /^\/notifications$/, () => ok({ notifications: data.notifications })],
    // server จริงจะจดว่าอ่านแล้ว: รอบซิงก์ถัดไปต้องไม่กลับมาเป็นยังไม่อ่าน
    ['PATCH', /^\/notifications\/read-all$/, () => {
      data.notifications.forEach((n) => { n.isRead = true; });
      return ok();
    }],
    ['PATCH', /^\/notifications\/([^/]+)\/read$/, (ctx) => {
      const n = data.notifications.find((x) => x.id === decodeURIComponent(ctx.params[0]));
      if (n) n.isRead = true;
      return ok();
    }],
    ['GET', /^\/announcements$/, () => ok({ announcements: data.announcements })],
    ['GET', /^\/leaves\/balances$/, () => ok({ balances: data.balances })],
    ['GET', /^\/leave-policies$/, () => ok({ policies: data.policies })],
    ['GET', /^\/leaves\/my-requests$/, () => ok({ requests: data.myLeaves })],
    ['POST', /^\/leaves$/, () => ({ status: 201, body: { success: true, leave: { id: 'lv-new', status: 'รออนุมัติระดับ 1 (Boss)' } } })],
    ['GET', /^\/holidays$/, () => ok({ holidays: data.holidays })],
    ['GET', /^\/points\/history$/, () => ok({ currentPoints: data.points, history: data.pointHistory })],
    ['GET', /^\/my-quests$/, () => ok({ quests: data.quests })],
    ['GET', /^\/my-quests\/([^/]+)$/, (ctx) => {
      const quest = data.questDetails[decodeURIComponent(ctx.params[0])];
      return quest ? ok({ quest }) : { status: 404, body: { success: false, message: 'ไม่พบ Quest' } };
    }],
    ['GET', /^\/rewards$/, () => ok({ rewards: data.rewards })],
    ['GET', /^\/rewards\/my-coupons$/, () => ok({ coupons: data.coupons })],
    ['POST', /^\/rewards\/([^/]+)\/redeem$/, () => ok({ redemption: { couponCode: 'WX-TEST-0001' } })],
    ['GET', /^\/leaderboard$/, () => ok({ leaderboard: data.leaderboard })],
    ['GET', /^\/employees$/, () => ok({ employees: data.employees })],
    ['GET', /^\/employees\/([^/]+)$/, () => ok({ user: data.me, employee: data.me })],
    ['GET', /^\/auth\/profile$/, () => ok({ user: data.me })],
    ['GET', /^\/approvals\/pending$/, () => ok({ approvals: data.approvalsPending })],
    ['GET', /^\/approvals\/history$/, () => ok({ history: data.approvalsHistory })],
    ['PATCH', /^\/approvals\/([^/]+)\/([^/]+)$/, () => ok()],
    ['GET', /^\/auth\/pin-status$/, () => ok({ hasPin: !!(data.me && data.me.hasPin) })],
    ['POST', /^\/auth\/(set-pin|remove-pin|logout|refresh)$/, () => ok()],
    ['POST', /^\/uploads\/leave-attachment$/, (ctx) => ok({ attachment: { id: 'att-1', url: '/uploads/leave/att-1', fileName: (ctx.body && ctx.body.fileName) || 'file' } })],
  ];

  const api = {
    data,
    calls,
    unhandled,
    callsTo(method, path) {
      return calls.filter(
        (c) => c.method === method && (path instanceof RegExp ? path.test(c.path) : c.path === path)
      );
    },
    /** เพิ่ม/ทับ handler: handler เป็นฟังก์ชัน (ctx) => ({ status, body }) หรือ body ธรรมดา */
    on(method, path, handler) {
      custom.unshift([method, path, handler]);
    },
  };

  const answer = (handler, ctx) => {
    const res = typeof handler === 'function' ? handler(ctx) : handler;
    if (res && (res.body !== undefined || res.status !== undefined || res.abort)) return res;
    return { status: 200, body: res };
  };

  for (const [method, path, handler] of Object.entries(options.routes || {}).map(([k, v]) => {
    const [m, p] = k.split(' ');
    return [m, p, v];
  })) {
    custom.push([method, path, handler]);
  }

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (method === 'OPTIONS') {
      return route.fulfill({ ...json(204, {}), body: '' });
    }

    // แอปลองเรียก /api/v1 ก่อนเสมอ: ตอบ 404 เพื่อให้ไปลองต่อที่ /api (เหมือนที่ backend จริงทำ)
    if (/^\/api\/v1\//.test(url.pathname)) {
      return route.fulfill(json(404, { success: false, message: 'not found' }));
    }

    const path = url.pathname.replace(/^\/api/, '');
    let body = null;
    try {
      body = req.postDataJSON();
    } catch (e) {
      body = null;
    }
    const query = Object.fromEntries(url.searchParams.entries());
    const call = { method, path, query, body, headers: req.headers() };
    calls.push(call);

    // handler ที่เทสกำหนดเอง (ตรงตัว หรือ RegExp)
    for (const [m, p, h] of custom) {
      const hit = p instanceof RegExp ? p.exec(path) : p === path ? [] : null;
      if (m === method && hit) {
        const res = answer(h, { ...call, params: hit.slice(1), data });
        if (res.abort) return route.abort('failed');
        return route.fulfill(json(res.status || 200, res.body));
      }
    }
    for (const [m, p, h] of defaults) {
      const hit = p.exec(path);
      if (m === method && hit) {
        const res = answer(h, { ...call, params: hit.slice(1), data });
        return route.fulfill(json(res.status || 200, res.body));
      }
    }

    unhandled.push(`${method} ${path}`);
    return route.fulfill(json(404, { success: false, message: `ยังไม่ได้ mock: ${method} ${path}` }));
  });

  return api;
}

/** ภาพ 1x1 โปร่งใส แทนรูปโปรไฟล์/แผนที่จากอินเทอร์เน็ต (เทสต้องไม่พึ่งเครือข่ายภายนอก) */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function blockExternal(page) {
  await page.route(
    (url) => !['localhost', '127.0.0.1'].includes(url.hostname) && /^https?:$/.test(url.protocol),
    (route) =>
      route.request().resourceType() === 'image'
        ? route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG })
        : route.abort()
  );
  // กันไม่ให้หลุดไป backend จริงที่อาจรันอยู่ที่พอร์ต 5000 (นอกเหนือจาก /api ที่ mock ไว้แล้ว)
  await page.route(/https?:\/\/(localhost|127\.0\.0\.1):5000\/(?!api\/).*/, (route) => route.abort());
}

/**
 * ใส่ session ลง localStorage ก่อนแอปโหลด (ทำครั้งเดียวต่อแท็บ: รีโหลดหน้าแล้ว session ที่แอปจัดการเองจะอยู่ต่อ
 * และถ้าแอปลบ session (logout) จะไม่ถูกใส่กลับ)
 * extraStorage: { key: value } ที่ต้องมีใน localStorage ตั้งแต่เริ่ม
 */
async function seedSession(page, user, extraStorage = {}) {
  await page.addInitScript(
    ({ user: u, extra }) => {
      try {
        if (sessionStorage.getItem('e2e_seeded')) return;
        sessionStorage.setItem('e2e_seeded', '1');
        const now = Date.now();
        localStorage.setItem(
          'wellx989_session',
          JSON.stringify({
            loggedIn: true,
            user: u,
            token: 'e2e-access-token',
            accessToken: 'e2e-access-token',
            refreshToken: 'e2e-refresh-token',
            accessTokenIssuedAt: now,
            refreshTokenIssuedAt: now,
          })
        );
        Object.keys(extra || {}).forEach((k) => localStorage.setItem(k, extra[k]));
      } catch (e) {
        /* ไม่มี storage */
      }
    },
    { user, extra: extraStorage }
  );
}

/**
 * เริ่มเทส: mock /api + กันเครือข่ายภายนอก + (ถ้าระบุ user) ใส่ session ที่ล็อกอินแล้ว
 *   const api = await setup(page, { user: USERS.employee, data: {...}, routes: {...} });
 * ไม่ระบุ user = ยังไม่ล็อกอิน (สำหรับเทสหน้า Login)
 */
async function setup(page, { user = null, data = {}, routes = {}, storage = {} } = {}) {
  await blockExternal(page);
  const api = await mockApi(page, { data, routes, user });
  apiByPage.set(page, api);
  if (user) await seedSession(page, user, storage);
  return api;
}

/** เปิดหน้าของแอป รอจนแอปบูตเสร็จ (index.js โหลด App แบบ async) */
async function openApp(page, path = '/') {
  await page.goto(path);
}

/** ตรวจว่าอยู่หน้านั้นๆ โดยดู testID ของหน้า (data-testid) */
const screen = (page, name) => page.getByTestId(`screen-${name}`);
// หน้าที่เคยเปิดแล้วยังค้างอยู่ใน stack (กว้าง 0) จึงนับเฉพาะอันที่มองเห็น
const expectScreen = (page, name) => expect(screen(page, name).filter({ visible: true })).toBeVisible();

/** กดปุ่มใน popup แจ้งเตือนของแอป (CustomAlertModal) ด้วยข้อความบนปุ่ม */
const alertButton = (page, text) => page.getByText(text, { exact: true }).last();

/** เฉพาะ element ที่มองเห็นอยู่ (หน้าจอใน tab/stack ก่อนหน้ายังอยู่ใน DOM แต่ซ่อนอยู่ ทำให้ testID ซ้ำกันได้) */
const visible = (locator) => locator.filter({ visible: true });

/** ข้อความ/ปุ่มใดๆ บนหน้าที่ตรงตัวอักษร */
const text = (page, value) => page.getByText(value, { exact: true });

/** กด PIN 6 หลักบนปุ่มตัวเลข (prefix = ชื่อ testID ของแป้น เช่น 'keypad-btn' หรือ 'lock-keypad') */
async function pressPin(page, digits, prefix) {
  for (const d of String(digits)) {
    await page.getByTestId(`${prefix}-${d}`).click();
  }
}

/** ข้อมูลตั้งต้นของสถานที่ลงเวลา: หนึ่งที่อยู่ในรัศมี หนึ่งที่ไกลเกินรัศมี */
const LOCATIONS = {
  near: {
    id: 'loc-hq',
    name: 'สำนักงานใหญ่ (HQ)',
    latitude: 13.7563,
    longitude: 100.5018,
    radiusM: 200,
    distanceM: 35,
    inRange: true,
  },
  far: {
    id: 'loc-far',
    name: 'สาขาเชียงใหม่',
    latitude: 18.7883,
    longitude: 98.9853,
    radiusM: 150,
    distanceM: 584000,
    inRange: false,
  },
};

module.exports = {
  USERS,
  LOCATIONS,
  todayIsoBkk,
  daysAgoIsoBkk,
  setup,
  mockApi,
  seedSession,
  blockExternal,
  openApp,
  screen,
  expectScreen,
  alertButton,
  visible,
  text,
  pressPin,
  defaultData,
};
