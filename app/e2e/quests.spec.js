// เทส E2E: ภารกิจ Quest (QuestsScreen / QuestPlayScreen / ส่วนภารกิจบน Home)
// กฎจาก CLAUDE.md: ทำได้ครั้งเดียวต่อ Quest, server ตรวจคำตอบเอง (แอปไม่เห็นเฉลย), มีหน้ายืนยันก่อนส่ง,
// ผ่านแล้วได้แต้มก้อนเดียว + คูปองรางวัลฟรี, ส่งซ้ำตอบ 409
const { test, expect } = require('./pw');
const { USERS, setup, openApp, expectScreen, alertButton, text } = require('./helpers');

const OPEN_QUEST = {
  id: 'q-1',
  title: 'แบบทดสอบความปลอดภัยในที่ทำงาน',
  description: 'ทดสอบความรู้ก่อนเริ่มงานหน้างาน',
  questionCount: 3,
  passCount: 2,
  totalPoints: 100,
  endDate: '2026-12-31',
  endTime: '23:59',
  passed: false,
  failed: false,
  pointsAwarded: 0,
  rewardTitle: 'คูปองกาแฟ',
};
const PASSED_QUEST = { ...OPEN_QUEST, id: 'q-2', title: 'อบรมจรรยาบรรณ', passed: true, pointsAwarded: 100, rewardTitle: null };
const FAILED_QUEST = { ...OPEN_QUEST, id: 'q-3', title: 'แบบทดสอบนโยบายบริษัท', failed: true, rewardTitle: null };

// รายละเอียดที่ server ส่งให้แอป (ไม่มีเฉลย)
const QUEST_DETAIL = {
  ...OPEN_QUEST,
  sections: [
    {
      id: 's-1',
      questions: [
        { id: 'qq-1', title: 'ก่อนเข้าพื้นที่ผลิตต้องทำอย่างไร', type: 'single', choices: [{ id: 'c-1', text: 'เดินเข้าไปได้เลย' }, { id: 'c-2', text: 'สวมอุปกรณ์ป้องกันส่วนบุคคล' }] },
        { id: 'qq-2', title: 'ข้อใดคือสัญญาณอันตรายบ้าง', type: 'multi', choices: [{ id: 'c-4', text: 'เสียงดังผิดปกติ' }, { id: 'c-5', text: 'มีควัน' }, { id: 'c-6', text: 'พื้นแห้ง' }] },
        { id: 'qq-3', title: 'เมื่อพบอุบัติเหตุควรแจ้งใคร', type: 'single', choices: [{ id: 'c-7', text: 'หัวหน้างาน' }, { id: 'c-8', text: 'ไม่ต้องแจ้ง' }] },
      ],
    },
  ],
};

const questSetup = (page, extra = {}) =>
  setup(page, {
    user: USERS.employee,
    data: {
      quests: [OPEN_QUEST, PASSED_QUEST, FAILED_QUEST],
      questDetails: {
        'q-1': QUEST_DETAIL,
        'q-2': { ...PASSED_QUEST, sections: [] },
        'q-3': { ...FAILED_QUEST, sections: [] },
      },
      ...extra.data,
    },
    routes: extra.routes,
  });

/** เปิดหน้าทำ Quest จากรายการ (Home -> ดูทั้งหมด -> การ์ด) */
const openQuestPlay = async (page, id = 'q-1') => {
  await openApp(page, '/main');
  await expectScreen(page, 'home');
  await page.getByTestId('home-quests-see-all-btn').click();
  await expectScreen(page, 'quests');
  await page.getByTestId(`quest-card-${id}`).click();
  await expectScreen(page, 'quest-play');
};

const answerAllCorrectly = async (page) => {
  await page.getByTestId('quest-choice-c-2').click();
  await page.getByTestId('quest-choice-c-4').click();
  await page.getByTestId('quest-choice-c-5').click();
  await page.getByTestId('quest-choice-c-7').click();
};

test.describe('รายการ Quest', () => {
  test('TC-APP-QUEST-01 @critical Home แสดงเฉพาะ Quest ที่ยังทำได้ ส่วนหน้ารายการแสดงสถานะ ทำเลย/ผ่านแล้ว/ไม่ผ่าน', async ({ page }) => {
    await questSetup(page);
    await openApp(page, '/main');
    await expectScreen(page, 'home');

    // Home: เฉพาะที่ยังไม่ผ่าน/ไม่ล้มเหลว
    await expect(page.getByTestId('home-quest-item-q-1')).toBeVisible();
    await expect(page.getByTestId('home-quest-item-q-1')).toContainText('ต้องตอบถูก 2/3 ข้อ');
    await expect(page.getByTestId('home-quest-item-q-2')).toHaveCount(0);
    await expect(page.getByTestId('home-quest-item-q-3')).toHaveCount(0);

    await page.getByTestId('home-quests-see-all-btn').click();
    await expectScreen(page, 'quests');
    const open = page.getByTestId('quest-card-q-1');
    await expect(open).toContainText('แบบทดสอบความปลอดภัยในที่ทำงาน');
    await expect(open).toContainText('ทำเลย');
    await expect(open).toContainText('100 แต้ม');
    await expect(open).toContainText('รางวัลฟรี: คูปองกาแฟ');
    await expect(open).toContainText('หมดเขต 2026-12-31 23:59');

    const passed = page.getByTestId('quest-card-q-2');
    await expect(passed).toContainText('ผ่านแล้ว');
    await expect(passed).toContainText('ได้รับ 100 แต้ม');

    const failed = page.getByTestId('quest-card-q-3');
    await expect(failed).toContainText('ไม่ผ่าน');
    await expect(failed).toContainText('ทำไม่ผ่านแล้ว ทำซ้ำไม่ได้');
  });

  test('TC-APP-QUEST-02 ยังไม่มี Quest แสดงข้อความว่าง', async ({ page }) => {
    await setup(page, { user: USERS.employee });
    await openApp(page, '/main');
    await expect(text(page, 'ยังไม่มีภารกิจที่เปิดให้ทำในขณะนี้')).toBeVisible();
    await page.getByTestId('home-quests-see-all-btn').click();
    await expect(text(page, 'ยังไม่มี Quest ที่เปิดให้คุณทำ')).toBeVisible();
  });

  test('TC-APP-QUEST-03 โหลดรายการ Quest ไม่สำเร็จ แสดงข้อความผิดพลาดและปุ่มลองอีกครั้ง', async ({ page }) => {
    await setup(page, {
      user: USERS.employee,
      routes: { 'GET /my-quests': { status: 500, body: { success: false, message: 'ระบบขัดข้องชั่วคราว' } } },
    });
    await openApp(page, '/main');
    await page.getByTestId('home-quests-see-all-btn').click();
    await expect(text(page, 'ระบบขัดข้องชั่วคราว')).toBeVisible();
    await expect(text(page, 'ลองอีกครั้ง')).toBeVisible();
  });
});

test.describe('ทำ Quest', () => {
  test('TC-APP-QUEST-04 @critical ตอบไม่ครบทุกข้อ ส่งไม่ได้ และไม่เรียก server', async ({ page }) => {
    const api = await questSetup(page);
    await openQuestPlay(page);

    await expect(text(page, 'ตอบแล้ว 0/3')).toBeVisible();
    await expect(page.getByText('เลือกได้ 1 ข้อ').first()).toBeVisible();
    await expect(text(page, 'เลือกได้หลายข้อ (เลือกให้ครบทุกข้อที่ถูก)')).toBeVisible();

    await page.getByTestId('quest-submit-btn').click();
    await expect(text(page, 'ตอบไม่ครบ')).toBeVisible();
    await expect(page.getByText('คุณตอบแล้ว 0/3 ข้อ กรุณาตอบให้ครบทุกข้อก่อนส่ง')).toBeVisible();
    await alertButton(page, 'ตกลง').click();

    await page.getByTestId('quest-choice-c-2').click();
    await expect(text(page, 'ตอบแล้ว 1/3')).toBeVisible();
    await page.getByTestId('quest-submit-btn').click();
    await expect(page.getByText('คุณตอบแล้ว 1/3 ข้อ กรุณาตอบให้ครบทุกข้อก่อนส่ง')).toBeVisible();
    expect(api.callsTo('POST', /^\/my-quests\//)).toHaveLength(0);
  });

  test('TC-APP-QUEST-05 @critical ผ่าน: มีหน้ายืนยันก่อนส่ง (ยกเลิกได้) ส่งคำตอบครั้งเดียว แล้วแสดงแต้ม+คูปอง', async ({ page }) => {
    const api = await questSetup(page, {
      routes: {
        'POST /my-quests/q-1/submit': {
          body: {
            success: true,
            result: { passed: true, correctCount: 3, totalQuestions: 3, passCount: 2, pointsAwarded: 100, reward: { title: 'คูปองกาแฟ', couponCode: 'COFFEE-1234' } },
          },
        },
      },
    });
    await openQuestPlay(page);
    await answerAllCorrectly(page);
    await expect(text(page, 'ตอบแล้ว 3/3')).toBeVisible();

    // หน้ายืนยัน: เลือก "ตรวจสอบก่อน" -> ยังไม่ส่ง
    await page.getByTestId('quest-submit-btn').click();
    await expect(text(page, 'ยืนยันส่งคำตอบ')).toBeVisible();
    await expect(page.getByText('Quest นี้ทำได้ครั้งเดียว ถ้าไม่ผ่านจะทำซ้ำไม่ได้ ต้องการส่งคำตอบใช่ไหม')).toBeVisible();
    await alertButton(page, 'ตรวจสอบก่อน').click();
    await expect(text(page, 'ยืนยันส่งคำตอบ')).toHaveCount(0);
    expect(api.callsTo('POST', /^\/my-quests\//)).toHaveLength(0);
    const pointsCallsBefore = api.callsTo('GET', '/points/history').length;

    // ส่งจริง
    await page.getByTestId('quest-submit-btn').click();
    await alertButton(page, 'ส่งคำตอบ').click();

    await expect(text(page, 'ยินดีด้วย คุณผ่าน!')).toBeVisible();
    await expect(text(page, 'ตอบถูก 3/3 ข้อ (ต้องถูกอย่างน้อย 2 ข้อ)')).toBeVisible();
    await expect(text(page, '+100 แต้ม')).toBeVisible();
    await expect(text(page, 'ได้รับรางวัลฟรี: คูปองกาแฟ')).toBeVisible();
    await expect(text(page, 'โค้ดคูปอง COFFEE-1234')).toBeVisible();

    const posts = api.callsTo('POST', /^\/my-quests\//);
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('/my-quests/q-1/submit');
    // ส่งเฉพาะคำตอบ (id ของข้อและตัวเลือก) ไม่ส่งคะแนน/ผลตรวจจากแอป
    expect(posts[0].body).toEqual({ answers: { 'qq-1': ['c-2'], 'qq-2': ['c-4', 'c-5'], 'qq-3': ['c-7'] } });
    expect(posts[0].headers.authorization).toBe('Bearer e2e-access-token');
    // แต้มใหม่ถูกดึงจาก server
    await expect.poll(() => api.callsTo('GET', '/points/history').length).toBeGreaterThan(pointsCallsBefore);

    await text(page, 'เสร็จสิ้น').click();
    await expectScreen(page, 'quests');
  });

  test('TC-APP-QUEST-06 @critical ไม่ผ่าน: แสดงผล ไม่มีแต้ม บอกว่าทำซ้ำไม่ได้ และตัวเลือกสลับ/ยกเลิกได้ถูกต้อง', async ({ page }) => {
    const api = await questSetup(page, {
      routes: {
        'POST /my-quests/q-1/submit': {
          body: { success: true, result: { passed: false, correctCount: 1, totalQuestions: 3, passCount: 2, pointsAwarded: 0 } },
        },
      },
    });
    await openQuestPlay(page);
    // ข้อ 1 (เลือก 1 ข้อ): เปลี่ยนคำตอบ c-1 -> c-2 ; ข้อ 2 (หลายข้อ): เลือก c-4,c-5 แล้วยกเลิก c-4
    await page.getByTestId('quest-choice-c-1').click();
    await page.getByTestId('quest-choice-c-2').click();
    await page.getByTestId('quest-choice-c-4').click();
    await page.getByTestId('quest-choice-c-5').click();
    await page.getByTestId('quest-choice-c-4').click();
    await page.getByTestId('quest-choice-c-8').click();

    await page.getByTestId('quest-submit-btn').click();
    await alertButton(page, 'ส่งคำตอบ').click();

    await expect(text(page, 'ยังไม่ผ่าน')).toBeVisible();
    await expect(text(page, 'ตอบถูก 1/3 ข้อ (ต้องถูกอย่างน้อย 2 ข้อ)')).toBeVisible();
    await expect(text(page, 'Quest นี้ทำได้ครั้งเดียว จึงไม่สามารถทำซ้ำได้')).toBeVisible();
    await expect(page.getByText(/\+\d+ แต้ม/)).toHaveCount(0);
    await expect(page.getByText(/ได้รับรางวัลฟรี/)).toHaveCount(0);

    const posts = api.callsTo('POST', /^\/my-quests\//);
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ answers: { 'qq-1': ['c-2'], 'qq-2': ['c-5'], 'qq-3': ['c-8'] } });

    await text(page, 'ปิด').click();
    await expectScreen(page, 'quests');
  });

  test('TC-APP-QUEST-07 @critical Quest ที่ทำไปแล้ว (server ตอบ 409) แสดงข้อความของ server และไม่แสดงผลสอบ', async ({ page }) => {
    const api = await questSetup(page, {
      routes: { 'POST /my-quests/q-1/submit': { status: 409, body: { success: false, message: 'คุณทำ Quest นี้ไปแล้ว ทำซ้ำไม่ได้' } } },
    });
    await openQuestPlay(page);
    await answerAllCorrectly(page);
    await page.getByTestId('quest-submit-btn').click();
    await alertButton(page, 'ส่งคำตอบ').click();

    await expect(text(page, 'ส่งคำตอบไม่สำเร็จ')).toBeVisible();
    await expect(text(page, 'คุณทำ Quest นี้ไปแล้ว ทำซ้ำไม่ได้')).toBeVisible();
    await expect(text(page, 'ยินดีด้วย คุณผ่าน!')).toHaveCount(0);
    expect(api.callsTo('POST', /^\/my-quests\//)).toHaveLength(1);
  });

  test('TC-APP-QUEST-08 @critical Quest ที่ทำไม่ผ่านไปแล้ว เปิดดูได้แต่ทำซ้ำไม่ได้ (ไม่มีปุ่มส่ง)', async ({ page }) => {
    await questSetup(page);
    await openQuestPlay(page, 'q-3');
    await expect(text(page, 'คุณทำ Quest นี้ไม่ผ่าน')).toBeVisible();
    await expect(text(page, 'Quest นี้ทำได้ครั้งเดียว จึงไม่สามารถทำซ้ำได้')).toBeVisible();
    await expect(page.getByTestId('quest-submit-btn')).toHaveCount(0);
  });

  test('TC-APP-QUEST-09 Quest ที่ผ่านไปแล้ว แสดงว่าได้รับแต้มแล้วและทำซ้ำไม่ได้', async ({ page }) => {
    await questSetup(page);
    await openQuestPlay(page, 'q-2');
    await expect(text(page, 'คุณผ่าน Quest นี้แล้ว')).toBeVisible();
    await expect(text(page, 'ได้รับ 100 แต้มเรียบร้อยแล้ว')).toBeVisible();
    await expect(page.getByTestId('quest-submit-btn')).toHaveCount(0);
  });

  test('TC-APP-QUEST-10 ส่งคำตอบแล้วต่อ server ไม่ได้: แจ้งว่าคำตอบยังไม่ถูกส่ง (ไม่แสดงผลสอบ)', async ({ page }) => {
    await questSetup(page, { routes: { 'POST /my-quests/q-1/submit': () => ({ abort: true }) } });
    await openQuestPlay(page);
    await answerAllCorrectly(page);
    await page.getByTestId('quest-submit-btn').click();
    await alertButton(page, 'ส่งคำตอบ').click();
    await expect(text(page, 'ส่งคำตอบไม่สำเร็จ')).toBeVisible();
    await expect(page.getByText(/ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ คำตอบยังไม่ถูกส่ง/)).toBeVisible();
    await expect(text(page, 'ยินดีด้วย คุณผ่าน!')).toHaveCount(0);
  });
});
