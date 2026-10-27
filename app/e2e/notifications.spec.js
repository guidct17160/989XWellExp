// เทส E2E: กระดิ่งแจ้งเตือน / ประกาศ / แบนเนอร์ / สวิตช์การแจ้งเตือนใน Settings
// กฎจาก CLAUDE.md: Home ไม่แสดงประกาศ ประกาศที่ Active อยู่ในกระดิ่ง (id `anno-<id>`), เด้งแบนเนอร์เมื่อมีประกาศใหม่ระหว่างใช้งาน,
// สถานะอ่านเก็บในเครื่อง, สวิตช์ `general`/`news` เก็บต่อผู้ใช้ที่ `notification_prefs_<user>` — ปิดแล้วรายการยังอยู่
// แต่ไม่เด้งแบนเนอร์และไม่นับในเลขกระดิ่ง
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, text, visible } = require('./helpers');

const ANNOUNCEMENT = {
  id: 'a-1',
  title: 'ประกาศวันหยุดชดเชย',
  desc: 'บริษัทหยุดทำการวันจันทร์ที่ 3 พฤศจิกายน 2569',
  author: 'ฝ่ายทรัพยากรบุคคล',
  startDate: '2026-10-26',
  startTime: '09:00',
  endDate: null,
  endTime: null,
  imageUrl: null,
};
const NEW_ANNOUNCEMENT = { ...ANNOUNCEMENT, id: 'a-2', title: 'ประกาศตรวจสุขภาพประจำปี', desc: 'ตรวจสุขภาพวันที่ 10 พฤศจิกายน ที่ห้องประชุมใหญ่' };

const SERVER_NOTIF = {
  id: 'n-1',
  title: 'คำขอลาของคุณได้รับการอนุมัติแล้ว',
  message: 'คำขอลาป่วยวันที่ 27 ต.ค. ได้รับการอนุมัติแล้วโดย วิชัย หัวหน้าทีม',
  type: 'success',
  isRead: false,
  createdAt: '2026-10-26T10:00:00+07:00',
};

const SERVER_NOTIF_2 = { ...SERVER_NOTIF, id: 'n-2', title: 'คำขอปรับปรุงเวลาของคุณไม่ได้รับการอนุมัติ', message: 'เหตุผล: ข้อมูลไม่ครบ', type: 'error' };

// องค์ประกอบของแถบบน (TopNavbar) มีในทุกหน้า: จำกัดเฉพาะใน Home
// (บนเว็บ การกลับด้วย navigate ทำให้มี Home ซ้อนหลายชั้น จึงเลือกเฉพาะอันที่มองเห็น)
const inHome = (page, id) => visible(page.getByTestId('screen-home')).getByTestId(id);
const badge = (page) => inHome(page, 'top-navbar-notification-badge');
const bell = (page) => inHome(page, 'top-navbar-notification-btn');
const banner = (page) => inHome(page, 'top-navbar-banner-notification');
const onNotifications = (page, id) => visible(page.getByTestId(id));
const prefsKey = 'notification_prefs_EMP-001';
const readPrefs = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), prefsKey);

test.describe('กระดิ่งแจ้งเตือนและประกาศ', () => {
  test('TC-APP-NOTIF-01 @critical ประกาศที่ Active อยู่ในกระดิ่ง (ไม่แสดงบน Home) นับเป็นยังไม่อ่าน กดเปิดดูรายละเอียดแล้วอ่านแล้ว', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { announcements: [ANNOUNCEMENT] } });
    await openApp(page, '/main');
    await expectScreen(page, 'home');

    // Home ไม่แสดงประกาศ แต่เลขกระดิ่ง = 1
    await expect(badge(page)).toHaveText('1');
    await expect(page.getByText(ANNOUNCEMENT.title)).toHaveCount(0);

    await bell(page).click();
    await expectScreen(page, 'notifications');
    const item = onNotifications(page, 'notifications-item-anno-a-1');
    await expect(item).toBeVisible();
    await expect(item).toContainText(ANNOUNCEMENT.title);
    await expect(item).toContainText(ANNOUNCEMENT.desc);
    await expect(item).toContainText('ไปยังหน้า ประกาศ');
    await expect(text(page, 'อ่านทั้งหมด (1)')).toBeVisible();

    // เปิดรายละเอียดประกาศ
    await item.click();
    await expectScreen(page, 'announcement-detail');
    const detail = page.getByTestId('screen-announcement-detail');
    await expect(detail.getByText(ANNOUNCEMENT.title, { exact: true })).toBeVisible();
    await expect(detail.getByText(ANNOUNCEMENT.desc, { exact: true })).toBeVisible();
    await expect(detail.getByText('ฝ่ายทรัพยากรบุคคล', { exact: true })).toBeVisible();

    // รับทราบ -> กลับหน้าแจ้งเตือน และอ่านแล้ว (ไม่มีปุ่ม "อ่านทั้งหมด")
    await page.getByTestId('announcement-detail-close-btn').click();
    await expectScreen(page, 'notifications');
    await expect(onNotifications(page, 'notifications-mark-all-read-btn')).toHaveCount(0);
    await expect(item).toBeVisible();
    // ปุ่มกลับในแถบหัวกลับไปหน้าหลัก เลขกระดิ่งหาย
    await visible(page.getByTestId('top-navbar-back-btn')).click();
    await expectScreen(page, 'home');
    await expect(badge(page)).toHaveCount(0);
  });

  test('TC-APP-NOTIF-02 @critical นับแจ้งเตือนจาก server + ประกาศรวมกัน และ "อ่านทั้งหมด" เรียก server และล้างเลข', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.employee,
      data: { announcements: [ANNOUNCEMENT], notifications: [SERVER_NOTIF] },
    });
    await openApp(page, '/main');
    await expect(badge(page)).toHaveText('2');

    await bell(page).click();
    await expect(onNotifications(page, 'notifications-item-n-1')).toContainText(SERVER_NOTIF.title);
    await expect(onNotifications(page, 'notifications-item-anno-a-1')).toBeVisible();

    // รอให้การซิงก์ตอนเข้าหน้านี้เสร็จก่อน (ไม่งั้นคำตอบเก่าที่ยังไม่อ่านอาจมาทับหลังกด "อ่านทั้งหมด")
    await page.waitForLoadState('networkidle');
    await onNotifications(page, 'notifications-mark-all-read-btn').click();
    await expect(onNotifications(page, 'notifications-mark-all-read-btn')).toHaveCount(0);
    await expect.poll(() => api.callsTo('PATCH', '/notifications/read-all').length).toBe(1);
    await visible(page.getByTestId('top-navbar-back-btn')).click();
    await expect(badge(page)).toHaveCount(0);
  });

  test('TC-APP-NOTIF-03 กดแจ้งเตือนผลคำขอ ("ได้รับการอนุมัติแล้ว") ไปหน้าสถานะคำขอ และแจ้ง server ว่าอ่านแล้ว', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee, data: { notifications: [SERVER_NOTIF] } });
    await openApp(page, '/main');
    await expectScreen(page, 'home');
    await expect(badge(page)).toHaveText('1'); // โหลดรายการจาก server เข้าเครื่องแล้ว
    await bell(page).click();
    await expectScreen(page, 'notifications');
    await onNotifications(page, 'notifications-item-n-1').click();
    await expectScreen(page, 'request-status');
    await expect.poll(() => api.callsTo('PATCH', '/notifications/n-1/read').length).toBe(1);
  });

  // เปิด /notifications ตรงๆ (รีเฟรชเว็บ) ต้องเห็นรายการที่ server ส่งมา: notificationStorage ต้องส่งสำเนา state ให้ listener
  test('TC-APP-NOTIF-03b เปิด /notifications ตรงๆ แล้วต้องเห็นรายการแจ้งเตือนที่ server ส่งมา', async ({ page }) => {
    await setup(page, { user: USERS.employee, data: { notifications: [SERVER_NOTIF] } });
    await openApp(page, '/notifications');
    await expectScreen(page, 'notifications');
    await expect(onNotifications(page, 'notifications-item-n-1')).toBeVisible();
  });

  test('TC-APP-NOTIF-04 ไม่มีแจ้งเตือน แสดงข้อความว่าง', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/notifications');
    await expect(text(page, 'ยังไม่มีการแจ้งเตือน')).toBeVisible();
  });

  test('TC-APP-NOTIF-05 เปิดหน้ารายละเอียดประกาศโดยไม่มีประกาศ (เช่น รีเฟรชเว็บ) เด้งไปหน้าแจ้งเตือน', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/announcements');
    await expectScreen(page, 'notifications');
  });
});

test.describe('แบนเนอร์ประกาศใหม่', () => {
  /** เปิด Home รอให้การซิงก์รอบแรกเสร็จ (เครื่องนี้ "เคยเห็นประกาศแล้ว") แล้วค่อยมีประกาศใหม่เข้ามา */
  const openHomeSeeded = async (page, api) => {
    await openApp(page, '/main');
    await expectScreen(page, 'home');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('announcement_seeded_EMP-001'))).toBe('1');
    await expect.poll(() => api.callsTo('GET', '/announcements').length).toBeGreaterThan(1);
    await page.waitForTimeout(300);
  };
  /** สลับแท็บไปโปรไฟล์แล้วกลับ Home เพื่อให้ Home โฟกัสใหม่ (แอปซิงก์ทุกครั้งที่โฟกัส และทุก 1 นาที) */
  const refocusHome = async (page) => {
    await page.getByTestId('tab-profile').click();
    await expectScreen(page, 'profile');
    await page.getByTestId('tab-home').click();
    await expectScreen(page, 'home');
  };

  test('TC-APP-NOTIF-06 @critical ประกาศใหม่เข้ามาระหว่างใช้งาน: เด้งแบนเนอร์ เลขกระดิ่งเพิ่ม กดแบนเนอร์เปิดรายละเอียด', async ({ page }) => {
    const api = await setup(page, { user: USERS.employee });
    await openHomeSeeded(page, api);
    await expect(banner(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);

    api.data.announcements = [NEW_ANNOUNCEMENT];
    await refocusHome(page);

    await expect(banner(page)).toBeVisible();
    await expect(inHome(page, 'top-navbar-banner-title')).toHaveText(NEW_ANNOUNCEMENT.title);
    await expect(inHome(page, 'top-navbar-banner-message')).toContainText('ตรวจสุขภาพวันที่ 10 พฤศจิกายน');
    await expect(badge(page)).toHaveText('1');

    await inHome(page, 'top-navbar-banner-card').click();
    await expectScreen(page, 'announcement-detail');
    await expect(page.getByTestId('screen-announcement-detail').getByText(NEW_ANNOUNCEMENT.title, { exact: true })).toBeVisible();
  });

  test('TC-APP-NOTIF-07 @critical ปิดสวิตช์ "ข่าวสาร" แล้วประกาศใหม่ไม่เด้งแบนเนอร์และไม่นับในเลขกระดิ่ง แต่ยังอยู่ในรายการ', async ({ page }) => {
    const api = await setup(page, {
      user: USERS.employee,
      storage: { [prefsKey]: JSON.stringify({ general: true, news: false }) },
    });
    await openHomeSeeded(page, api);

    api.data.announcements = [NEW_ANNOUNCEMENT];
    await refocusHome(page);
    // รอให้ซิงก์รอบใหม่เสร็จ (ประกาศเข้ามาอยู่ในเครื่องแล้ว)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('notification_state_EMP-001') || ''))
      .toContain('anno-a-2');

    await expect(banner(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);

    await bell(page).click();
    await expect(onNotifications(page, 'notifications-item-anno-a-2')).toContainText(NEW_ANNOUNCEMENT.title);
  });
});

test.describe('ตั้งค่าการแจ้งเตือน', () => {
  const openSettings = async (page) => {
    await openApp(page, '/main/profile');
    await expectScreen(page, 'profile');
    await page.getByTestId('screen-profile').getByText('การตั้งค่า', { exact: true }).click();
    await expectScreen(page, 'settings');
  };

  test('TC-APP-NOTIF-08 @critical สวิตช์ general/news เก็บต่อผู้ใช้ในเครื่อง และไม่กระทบผู้ใช้คนอื่น', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      storage: { 'notification_prefs_EMP-777': JSON.stringify({ general: false, news: false }) },
    });
    await openSettings(page);

    // ค่าเริ่มต้น: เปิดทั้งสองสวิตช์ (ไม่รับค่าของผู้ใช้อื่นมา)
    await expect(text(page, 'การแจ้งเตือนทั่วไป')).toBeVisible();
    await expect(text(page, 'แจ้งเตือนข้อความและข่าวสาร')).toBeVisible();
    await expect(page.locator('[data-testid="settings-toggle-general"] input, input[data-testid="settings-toggle-general"]').first()).toBeChecked();
    await expect(page.locator('[data-testid="settings-toggle-news"] input, input[data-testid="settings-toggle-news"]').first()).toBeChecked();

    await page.getByTestId('settings-item-1-1').click(); // ข่าวสาร -> ปิด
    await expect.poll(() => readPrefs(page)).toEqual({ general: true, news: false });
    await page.getByTestId('settings-item-1-0').click(); // ทั่วไป -> ปิด
    await expect.poll(() => readPrefs(page)).toEqual({ general: false, news: false });
    await page.getByTestId('settings-item-1-1').click(); // ข่าวสาร -> เปิดกลับ
    await expect.poll(() => readPrefs(page)).toEqual({ general: false, news: true });

    // ผู้ใช้อื่นไม่ถูกแตะต้อง
    const other = await page.evaluate(() => JSON.parse(localStorage.getItem('notification_prefs_EMP-777')));
    expect(other).toEqual({ general: false, news: false });

    // ค่าที่ตั้งไว้คงอยู่หลังรีโหลด
    await page.reload();
    await expect.poll(() => readPrefs(page)).toEqual({ general: false, news: true });
  });

  test('TC-APP-NOTIF-09 @critical ปิดสวิตช์แล้วรายการยังอยู่ในหน้าแจ้งเตือน แต่ไม่นับในเลขกระดิ่ง (ปิดข่าว=ไม่นับประกาศ, ปิดทั่วไป=ไม่นับงาน)', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      data: { announcements: [ANNOUNCEMENT], notifications: [SERVER_NOTIF, SERVER_NOTIF_2] },
      storage: { [prefsKey]: JSON.stringify({ general: true, news: false }) },
    });
    await openApp(page, '/main');
    // นับเฉพาะแจ้งเตือนงาน 2 รายการ (ประกาศถูกปิด)
    await expect(badge(page)).toHaveText('2');
    await bell(page).click();
    await expect(onNotifications(page, 'notifications-item-n-1')).toBeVisible();
    await expect(onNotifications(page, 'notifications-item-anno-a-1')).toBeVisible();
  });

  test('TC-APP-NOTIF-10 ปิดสวิตช์ "ทั่วไป": แจ้งเตือนงานไม่นับ แต่ประกาศยังนับ', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      data: { announcements: [ANNOUNCEMENT], notifications: [SERVER_NOTIF, SERVER_NOTIF_2] },
      storage: { [prefsKey]: JSON.stringify({ general: false, news: true }) },
    });
    await openApp(page, '/main');
    // นับเฉพาะประกาศ 1 รายการ (แจ้งเตือนงาน 2 รายการถูกปิด)
    await expect(badge(page)).toHaveText('1');
    await bell(page).click();
    await expect(onNotifications(page, 'notifications-item-n-1')).toBeVisible();
    await expect(onNotifications(page, 'notifications-item-anno-a-1')).toBeVisible();
  });
});
