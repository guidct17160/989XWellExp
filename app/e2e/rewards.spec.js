// เทส E2E: แลกของรางวัล (RewardsScreen) และ Leaderboard
// กฎจาก CLAUDE.md: แลกของรางวัลที่ server ก่อน (ตัดแต้ม/ออกคูปองที่ server เท่านั้น), ใช้แต้มเกินไม่ได้,
// Leaderboard แสดงอันดับ 1-3 เป็นโพเดียม และ 4-10 เป็นรายการ
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, text } = require('./helpers');

const REWARDS = [
  { id: 'rew-001', title: 'บัตรกำนัลกาแฟ 100 บาท', description: 'ใช้ได้ทุกสาขา', pointsRequired: 300, category: 'Food', stock: 10 },
  { id: 'rew-002', title: 'ตั๋วภาพยนตร์ 2 ที่นั่ง', description: 'ใช้ได้ทุกโรง', pointsRequired: 1000, category: 'Lifestyle', stock: 3 },
];

/** mock การแลก: server ตัดแต้มและออกคูปองให้ (เหมือนของจริง) */
const redeemOk = (ctx) => {
  const reward = REWARDS.find((r) => ctx.path.includes(r.id));
  ctx.data.points -= reward.pointsRequired;
  ctx.data.coupons.unshift({ id: 'cp-1', title: reward.title, couponCode: 'WX-COFFEE-0001', pointsUsed: reward.pointsRequired, status: 'Active', createdAt: 'วันนี้' });
  ctx.data.pointHistory.unshift({ id: 'pt-1', title: `แลก ${reward.title}`, points: -reward.pointsRequired, type: 'spend', category: 'แลกของรางวัล', date: '2026-10-27' });
  return { body: { success: true, redemption: { couponCode: 'WX-COFFEE-0001' } } };
};

const rewardsSetup = (page, { points = 500, routes = {}, data = {} } = {}) =>
  setup(page, {
    user: USERS.employee,
    data: { rewards: REWARDS, points, ...data },
    routes: { 'POST /rewards/rew-001/redeem': redeemOk, ...routes },
  });

const openRewards = async (page, points) => {
  await openApp(page, '/main/rewards');
  // รอให้แต้มจาก server ถูกโหลดก่อน (ปุ่มแลกตัดสินจากแต้มที่โหลดมา)
  await expect(page.getByTestId('top-navbar-points-text')).toHaveText(String(points));
  await expect(page.getByTestId('rewards-item-card-rew-001')).toBeVisible();
};

test.describe('แลกของรางวัล', () => {
  test('TC-APP-REWARD-01 @critical แลกสำเร็จ: ยืนยันก่อน แล้วส่ง POST ครั้งเดียว server ตัดแต้ม รหัสคูปองไม่โชว์ในป๊อปอัป', async ({ page }) => {
    const api = await rewardsSetup(page);
    await openRewards(page, 500);
    await expect(page.getByTestId('rewards-item-card-rew-001')).toContainText('บัตรกำนัลกาแฟ 100 บาท');
    await expect(page.getByTestId('rewards-item-card-rew-001')).toContainText('300 คะแนน');

    await page.getByTestId('rewards-item-card-rew-001').click();
    await expect(text(page, 'รายละเอียดสิทธิพิเศษ')).toBeVisible();
    await expect(page.getByTestId('reward-detail-submit-btn')).toContainText('แลกสิทธิพิเศษ');
    await page.getByTestId('reward-detail-submit-btn').click();

    // ป๊อปอัปยืนยัน: ยังไม่เรียก server
    await expect(text(page, 'ยืนยันการแลกสิทธิพิเศษ')).toBeVisible();
    await expect(text(page, 'ใช้คะแนน -300 คะแนน')).toBeVisible();
    await expect(text(page, 'คะแนนคงเหลือของคุณ: 500 คะแนน')).toBeVisible();
    expect(api.callsTo('POST', /\/redeem$/)).toHaveLength(0);

    await text(page, '✅ ยืนยันแลกรับ').click();

    await expect(text(page, '🎉 แลกของรางวัลสำเร็จ!')).toBeVisible();
    await expect(text(page, 'ใช้คะแนนไป -300 คะแนน')).toBeVisible();
    // รหัสเต็มไม่โชว์ในป๊อปอัป (ดูได้ที่ประวัติแลกรางวัล)
    await expect(text(page, 'WX-COFFEE-0001')).toHaveCount(0);

    const posts = api.callsTo('POST', /\/redeem$/);
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('/rewards/rew-001/redeem');
    expect(posts[0].headers.authorization).toBe('Bearer e2e-access-token');
    // แต้มคงเหลือมาจาก server (500 - 300 = 200)
    await text(page, 'ปิดหน้าต่าง').click();
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('200');
  });

  test('TC-APP-REWARD-02 @critical แต้มไม่พอ: ปุ่มบอกว่าขาดกี่คะแนน กดแล้วไม่ส่ง POST และไม่ถามยืนยัน แต้มไม่เปลี่ยน', async ({ page }) => {
    const api = await rewardsSetup(page, { points: 100 });
    await openRewards(page, 100);
    await page.getByTestId('rewards-item-card-rew-001').click();

    await expect(page.getByTestId('reward-detail-submit-btn')).toContainText('คะแนนไม่เพียงพอ (ขาด 200 คะแนน)');
    await page.getByTestId('reward-detail-submit-btn').click();

    await expect(text(page, 'ยืนยันการแลกสิทธิพิเศษ')).toHaveCount(0);
    expect(api.callsTo('POST', /\/redeem$/)).toHaveLength(0);
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('100');
  });

  // ป๊อปอัป "คะแนนสะสมไม่เพียงพอ" ต้องวาดในหรือหลังปิด Modal รายละเอียดรางวัล ไม่งั้นถูก Modal บังและกด "ตกลง" ไม่ได้
  test('TC-APP-REWARD-02b @critical แต้มไม่พอ: ป๊อปอัป "คะแนนสะสมไม่เพียงพอ" ต้องอยู่หน้าสุดและกด "ตกลง" ได้', async ({ page }) => {
    await rewardsSetup(page, { points: 100 });
    await openRewards(page, 100);
    await page.getByTestId('rewards-item-card-rew-001').click();
    await page.getByTestId('reward-detail-submit-btn').click();
    await expect(text(page, 'คะแนนสะสมไม่เพียงพอ')).toBeVisible();
    await expect(page.getByText('คุณต้องใช้ 300 คะแนนเพื่อแลก "บัตรกำนัลกาแฟ 100 บาท" (ปัจจุบันมี 100 คะแนน)')).toBeVisible();
    await text(page, 'ตกลง').click({ timeout: 3000 }); // ตอนนี้ถูก Modal รายละเอียดบังไว้ -> คลิกไม่ได้
    await expect(text(page, 'คะแนนสะสมไม่เพียงพอ')).toHaveCount(0);
  });

  test('TC-APP-REWARD-03 @critical กดยกเลิกในป๊อปอัปยืนยัน ไม่ส่ง POST และแต้มไม่เปลี่ยน', async ({ page }) => {
    const api = await rewardsSetup(page);
    await openRewards(page, 500);
    await page.getByTestId('rewards-item-card-rew-001').click();
    await page.getByTestId('reward-detail-submit-btn').click();
    await expect(text(page, 'ยืนยันการแลกสิทธิพิเศษ')).toBeVisible();
    await text(page, 'ยกเลิก').click();
    await expect(text(page, 'ยืนยันการแลกสิทธิพิเศษ')).toHaveCount(0);
    expect(api.callsTo('POST', /\/redeem$/)).toHaveLength(0);
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('500');
  });

  test('TC-APP-REWARD-04 @critical server ปฏิเสธการแลก (เช่น ของหมด): แสดงข้อความของ server ไม่แสดงว่าสำเร็จ และแต้มไม่ถูกหัก', async ({ page }) => {
    const api = await rewardsSetup(page, {
      routes: { 'POST /rewards/rew-001/redeem': { status: 409, body: { success: false, message: 'ของรางวัลนี้หมดแล้ว' } } },
    });
    await openRewards(page, 500);
    await page.getByTestId('rewards-item-card-rew-001').click();
    await page.getByTestId('reward-detail-submit-btn').click();
    await text(page, '✅ ยืนยันแลกรับ').click();

    await expect(text(page, 'แลกของรางวัลไม่สำเร็จ')).toBeVisible();
    await expect(text(page, 'ของรางวัลนี้หมดแล้ว')).toBeVisible();
    await expect(text(page, '🎉 แลกของรางวัลสำเร็จ!')).toHaveCount(0);
    expect(api.callsTo('POST', /\/redeem$/)).toHaveLength(1);
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('500');
  });

  test('TC-APP-REWARD-05 ต่อ server ไม่ได้ขณะแลก: แจ้งว่ายังไม่มีการตัดแต้ม', async ({ page }) => {
    await rewardsSetup(page, { routes: { 'POST /rewards/rew-001/redeem': () => ({ abort: true }) } });
    await openRewards(page, 500);
    await page.getByTestId('rewards-item-card-rew-001').click();
    await page.getByTestId('reward-detail-submit-btn').click();
    await text(page, '✅ ยืนยันแลกรับ').click();
    await expect(text(page, 'แลกของรางวัลไม่สำเร็จ')).toBeVisible();
    await expect(page.getByText(/ยังไม่มีการตัดแต้ม/)).toBeVisible();
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('500');
  });

  test('TC-APP-REWARD-06 แลกจากหน้า "ดูทั้งหมด" (แคตตาล็อก) ใช้ได้เหมือนกัน: ส่ง POST ครั้งเดียว', async ({ page }) => {
    const api = await rewardsSetup(page);
    await openRewards(page, 500);
    await page.getByTestId('rewards-see-all-catalog-btn').click();
    await expect(text(page, 'แลกสิทธิพิเศษ').first()).toBeVisible();
    await expect(page.getByText('ตั๋วภาพยนตร์ 2 ที่นั่ง').last()).toBeVisible();

    await page.getByText('บัตรกำนัลกาแฟ 100 บาท').last().click();
    await page.getByTestId('reward-detail-submit-btn-catalog').click();
    await text(page, '✅ ยืนยันแลกรับ').click();
    await expect(text(page, '🎉 แลกของรางวัลสำเร็จ!')).toBeVisible();
    expect(api.callsTo('POST', /\/redeem$/)).toHaveLength(1);
  });
});

test.describe('Leaderboard', () => {
  // 12 คน เรียงแต้มมาก -> น้อย (คนที่ 5 คือผู้ใช้เอง)
  const board = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const me = n === 5;
    return {
      id: me ? 'EMP-001' : `EMP-${100 + n}`,
      code: me ? 'EMP-001' : `EMP-${100 + n}`,
      name: me ? 'สมชาย ใจดี' : `นักขาย ${String(n).padStart(2, '0')}`,
      points: 1300 - n * 100,
      avatarUrl: null,
    };
  });

  test('TC-APP-LEADER-01 @critical หน้ารางวัลแสดง Top 3 (#1-#3) เท่านั้น', async ({ page }) => {
    await rewardsSetup(page, { points: 0, data: { leaderboard: board } });
    await openApp(page, '/main/rewards');
    await expect(text(page, '#1')).toBeVisible();
    await expect(text(page, '#2')).toBeVisible();
    await expect(text(page, '#3')).toBeVisible();
    await expect(text(page, '#4')).toHaveCount(0);
    await expect(page.getByText('นักขาย 01')).toBeVisible();
    await expect(page.getByText('นักขาย 03')).toBeVisible();
    await expect(page.getByText('นักขาย 04')).toHaveCount(0);
  });

  test('TC-APP-LEADER-02 @critical ลีดเดอร์บอร์ดเต็ม: โพเดียมอันดับ 1-3 และรายการอันดับ 4-10 (ไม่แสดงอันดับ 11 ขึ้นไป) พร้อมการ์ดอันดับของตัวเอง', async ({ page }) => {
    await rewardsSetup(page, { points: 800, data: { leaderboard: board } });
    await openApp(page, '/main/rewards');
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('800');
    await text(page, 'ดูอันดับทั้งหมด').click();
    await expect(text(page, 'ลีดเดอร์บอร์ด')).toBeVisible();

    // โพเดียม 1-3
    for (const n of ['01', '02', '03']) await expect(text(page, `นักขาย ${n}`).last()).toBeVisible();
    // รายการอันดับ 4-10 (อันดับ 5 คือผู้ใช้เอง)
    for (const n of ['04', '06', '07', '08', '09', '10']) await expect(text(page, `นักขาย ${n}`)).toBeVisible();
    // อันดับ 11-12 ไม่แสดง
    await expect(text(page, 'นักขาย 11')).toHaveCount(0);
    await expect(text(page, 'นักขาย 12')).toHaveCount(0);
    // ตัวเอง (อันดับ 5, 800 แต้ม) ปรากฏ 3 ที่: ชื่อบนแถบบนสุด + การ์ดอันดับของตัวเอง + แถวในรายการ
    await expect(text(page, 'สมชาย ใจดี')).toHaveCount(3);
    await expect(text(page, '800')).toHaveCount(3);

    // สลับช่วงเวลา สัปดาห์/เดือน/ปี แล้วยังเรียงถูกต้อง
    await text(page, 'สัปดาห์').click();
    await expect(text(page, 'นักขาย 10')).toBeVisible();
    await text(page, 'ปี').click();
    await expect(text(page, 'นักขาย 10')).toBeVisible();
    await expect(text(page, 'นักขาย 11')).toHaveCount(0);
  });

  test('TC-APP-LEADER-03 ไม่มีข้อมูลลีดเดอร์บอร์ดจาก server: แสดงเฉพาะตัวเอง (ไม่แต่งรายชื่อ)', async ({ page }) => {
    await rewardsSetup(page, { points: 250, data: { leaderboard: [] } });
    await openApp(page, '/main/rewards');
    await expect(page.getByTestId('top-navbar-points-text')).toHaveText('250');
    await expect(text(page, '#1')).toBeVisible();
    await expect(page.getByText(/สมชาย ใจดี/).first()).toBeVisible();
    await expect(text(page, '#2')).toHaveCount(0);
  });
});
