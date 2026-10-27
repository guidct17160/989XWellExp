import { test, expect } from '@playwright/test';
import { mockApi, seedSession } from './helpers';
import { routeJson, fieldAfterLabel } from './helpers.batch2';

/**
 * เว็บแอดมิน - เมนู Mission > Quest Management (/missions, /missions/new, /missions/<code>)
 * รายการ Quest, วิซาร์ด 4 ขั้น (Settings > Content > Reward > Summary), แก้ไข, ลบ
 *
 * - API ทุกเส้นถูก mock ไว้ (ดู helpers.js) จึงไม่ต้องเปิด backend หรือฐานข้อมูล
 * - ทำเทสอัตโนมัติเฉพาะเคสระดับ Critical และ High
 */

const QUESTS = [
  {
    id: 'q-1', code: 'SAFETY-01', title: 'Safety basics', description: 'Basic safety quiz', status: 'Active',
    sectionCount: 1, questionCount: 3, passCount: 2, totalPoints: 100, completedCount: 3, assignedCount: 10,
    createdByName: 'Super Admin', createdDate: '2026-10-20', createdTime: '09:00',
    startDate: '2026-10-20', startTime: '09:00', endDate: '2099-12-31', endTime: '23:59', rewardTitle: 'Starbucks Voucher',
  },
  {
    id: 'q-2', code: 'ONBOARD-02', title: 'Onboarding quiz', description: 'For new staff', status: 'Scheduled',
    sectionCount: 1, questionCount: 5, passCount: 0, totalPoints: 50, completedCount: 0, assignedCount: 5,
    createdByName: 'Somchai Jaidee', createdDate: '2026-10-22', createdTime: '10:30',
    startDate: '2099-01-01', startTime: '09:00', endDate: '2099-02-01', endTime: '18:00', rewardTitle: null,
  },
  {
    id: 'q-3', code: 'OLD-03', title: 'Old campaign', description: 'Finished', status: 'Expired',
    sectionCount: 1, questionCount: 2, passCount: 1, totalPoints: 20, completedCount: 4, assignedCount: 4,
    createdByName: 'Super Admin', createdDate: '2026-09-01', createdTime: '09:00',
    startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-10', endTime: '18:00', rewardTitle: null,
  },
];

// รางวัลที่ Admin เลือกแจกฟรีได้ (rew-002 หมดสต็อก)
const REWARDS = [
  { id: 'rew-001', title: 'Starbucks Voucher', stock: 50, pointsRequired: 500, imageUrl: '' },
  { id: 'rew-002', title: 'Coffee Mug', stock: 0, pointsRequired: 300, imageUrl: '' },
];

// รายละเอียด Quest สำหรับหน้าแก้ไข (GET /api/quests/q-1)
const QUEST_DETAIL = {
  id: 'q-1', code: 'SAFETY-01', title: 'Safety basics', description: 'Basic safety quiz', imageUrl: '',
  startDate: '2026-10-20', startTime: '09:00', endDate: '2099-12-31', endTime: '23:59',
  assignType: 'all', members: [], rewardPoints: 100, passCount: 1, rewardId: 'rew-001',
  sections: [{
    title: 'Basics', description: 'Basic questions', timeLimitMinutes: 10, editType: 'can_edit',
    questions: [{
      type: 'single', title: 'Which PPE protects your head?', description: '', imageUrl: '', points: 0,
      choices: [{ text: 'Helmet', isCorrect: true }, { text: 'Sandals', isCorrect: false }],
    }],
  }],
};

async function openQuests(page, { quests = QUESTS, path = '/missions' } = {}) {
  await seedSession(page);
  await mockApi(page);
  const state = { quests: [...quests] };
  await routeJson(page, '**/api/quests', 'GET', () => ({ body: { success: true, quests: state.quests } }));
  await routeJson(page, '**/api/rewards', 'GET', { body: { success: true, rewards: REWARDS } });
  await page.goto(path);
  return state;
}

const dateText = /^\d{4}-\d{2}-\d{2}$/;

// เลือกวันสิ้นสุดเป็นวันที่ 15 ของเดือนหน้า (ค่าเริ่มต้นคือ "ตอนนี้" ซึ่งจะกลายเป็นอดีตถ้าค้างไว้เกิน 1 นาที)
async function pickFutureEndDate(page) {
  const endRow = page.locator('span', { hasText: /^End Date \/ Time/ }).locator('xpath=following-sibling::div[1]');
  await endRow.getByText(dateText).click();
  await page.getByTitle('Next month').click();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(endRow.getByText(/^\d{4}-\d{2}-15$/)).toBeVisible();
}

async function fillSettings(page, { code = 'SAFETY-01', title = 'Safety basics', description = 'Learn basic safety rules.' } = {}) {
  await page.getByPlaceholder('e.g. SAFETY-01').fill(code);
  await fieldAfterLabel(page, 'Title').fill(title);
  await fieldAfterLabel(page, 'Description', 'textarea').fill(description);
  await pickFutureEndDate(page);
}

async function addQuiz(page, { title = 'Basics', description = 'Basic questions', minutes, noEdit = false } = {}) {
  await page.getByRole('button', { name: 'Quiz', exact: true }).click();
  const modal = page.locator('div.fixed.inset-0');
  await fieldAfterLabel(modal, 'Quiz Title').fill(title);
  await fieldAfterLabel(modal, 'Description', 'textarea').fill(description);
  if (minutes) await modal.locator('input[type=number]').fill(String(minutes));
  if (noEdit) await modal.getByLabel('No edit allow').check();
  await modal.getByRole('button', { name: 'Confirm' }).click();
  await expect(modal).toHaveCount(0);
}

const continueBtn = (page) => page.getByRole('button', { name: 'Continue' });
const stepHeading = (page, label) => page.getByRole('heading', { name: new RegExp(`New Quest — ${label}`) });

// ทำวิซาร์ดจนถึงขั้น Summary (Quiz เดียว คำถามเดียว Single Choice)
async function walkToSummary(page, { code = 'SAFETY-01', title = 'Safety basics' } = {}) {
  await page.getByRole('button', { name: 'Create New Quest' }).click();
  await expect(page).toHaveURL(/\/missions\/new$/);
  await fillSettings(page, { code, title });
  await continueBtn(page).click();
  await expect(stepHeading(page, 'Quest Content')).toBeVisible();
  await addQuiz(page);
  await fieldAfterLabel(page, 'Title').fill('Which PPE protects your head?');
  await page.getByPlaceholder('Choice text').nth(0).fill('Helmet');
  await page.getByPlaceholder('Choice text').nth(1).fill('Sandals');
  await continueBtn(page).click();
  await expect(stepHeading(page, 'Reward')).toBeVisible();
  await continueBtn(page).click();
  await expect(stepHeading(page, 'Summary')).toBeVisible();
}

test.describe('Quest Management - list', () => {
  // รายการต้องแสดง Code ชื่อ สถานะ ความคืบหน้า Approved=Auto approve แต้ม ผู้สร้าง และรางวัลฟรี
  test('[Critical] TC-QST-001 the list shows code, status, progress, points and free reward from the server', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page);
    await expect(page.getByRole('heading', { name: 'Quest Management' })).toBeVisible();
    await expect(page.getByText('3 Total')).toBeVisible();
    const active = page.getByRole('row', { name: /SAFETY-01/ });
    await expect(active).toContainText('Safety basics');
    await expect(active).toContainText('Active');
    await expect(active).toContainText('Incomplete 3/10');
    await expect(active).toContainText('Auto approve');
    await expect(active).toContainText('100');
    await expect(active).toContainText('Super Admin');
    await expect(active).toContainText('Starbucks Voucher');
    await expect(page.getByRole('row', { name: /ONBOARD-02/ })).toContainText('Scheduled');
    await expect(page.getByRole('row', { name: /OLD-03/ })).toContainText('Completed 4/4');
  });

  // กรองสถานะ / ผู้สร้าง / ค้นหาด้วย code หรือชื่อ ต้องเหลือเฉพาะรายการที่ตรง และบอกเมื่อไม่พบ
  test('[High] TC-QST-002 status, creator filters and search narrow the list', { tag: '@high' }, async ({ page }) => {
    await openQuests(page);
    // ตัวกรองแรก = Status, ตัวที่สอง = Created by (FilterBar ไม่ได้ผูก label กับ select)
    await page.locator('select').nth(0).selectOption('Expired');
    await expect(page.getByRole('row', { name: /OLD-03/ })).toBeVisible();
    await expect(page.getByText('Safety basics')).toHaveCount(0);
    await page.locator('select').nth(0).selectOption('');
    await page.locator('select').nth(1).selectOption('Somchai Jaidee');
    await expect(page.getByRole('row', { name: /ONBOARD-02/ })).toBeVisible();
    await expect(page.getByText('Old campaign')).toHaveCount(0);
    await page.locator('select').nth(1).selectOption('');
    await page.getByPlaceholder('Search by code or quest name...').fill('safety-01');
    await expect(page.getByRole('row', { name: /SAFETY-01/ })).toBeVisible();
    await expect(page.getByText('Onboarding quiz')).toHaveCount(0);
    await page.getByPlaceholder('Search by code or quest name...').fill('zzz-none');
    await expect(page.getByText('No quests match the filters')).toBeVisible();
  });

  // ยังไม่มี Quest ต้องบอกให้สร้าง (ไม่มีข้อมูลจำลอง) และถ้าโหลดไม่สำเร็จต้องแสดงข้อความจาก server
  test('[High] TC-QST-003 an empty list says so and a server error on load is shown', { tag: '@high' }, async ({ page }) => {
    await seedSession(page);
    await mockApi(page);
    await routeJson(page, '**/api/quests', 'GET', { status: 500, body: { success: false, message: 'Quest table is unavailable' } });
    await page.goto('/missions');
    await expect(page.getByText('Quest table is unavailable')).toBeVisible();
    await expect(page.getByText(/No quests yet/)).toBeVisible();
  });

  // ลบต้องมี popup ยืนยัน ยกเลิกแล้วไม่ลบ ยืนยันแล้วเรียก DELETE และรายการโหลดใหม่
  test('[High] TC-QST-004 delete asks for confirmation, then calls DELETE and refreshes the list', { tag: '@high' }, async ({ page }) => {
    const state = await openQuests(page);
    const deleted = await routeJson(page, '**/api/quests/*', 'DELETE', () => {
      state.quests = state.quests.filter((q) => q.id !== 'q-3');
      return { body: { success: true } };
    });
    const row = page.getByRole('row', { name: /OLD-03/ });
    await row.getByTitle('Delete quest').click();
    await expect(page.getByText('Delete quest?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(deleted).toHaveLength(0);
    await row.getByTitle('Delete quest').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Quest "Old campaign" deleted')).toBeVisible();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].url).toContain('/api/quests/q-3');
    await expect(page.getByText('Old campaign')).toHaveCount(0);
  });

  // server ปฏิเสธการลบ (เช่น 409) ต้องเห็นข้อความของ server และ Quest ยังอยู่
  test('[High] TC-QST-005 a server error on delete is shown and the quest stays', { tag: '@high' }, async ({ page }) => {
    await openQuests(page);
    await routeJson(page, '**/api/quests/*', 'DELETE', { status: 409, body: { success: false, message: 'This quest cannot be deleted' } });
    await page.getByRole('row', { name: /SAFETY-01/ }).getByTitle('Delete quest').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('This quest cannot be deleted')).toBeVisible();
    await expect(page.getByRole('row', { name: /SAFETY-01/ })).toBeVisible();
  });
});

test.describe('Quest Management - wizard', () => {
  // ขั้น Settings: ต้องกรอก Code, Title, Description; Code รับเฉพาะ ตัวอักษร/ตัวเลข/-/_ ไม่เกิน 30; ต้องมีวันเริ่มเมื่อเลือก Select Date
  test('[Critical] TC-QST-006 step 1 blocks Continue until code, title and description are valid', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/new' });
    const code = page.getByPlaceholder('e.g. SAFETY-01');
    await continueBtn(page).click();
    await expect(page.getByText('Quest code is required')).toBeVisible();
    // ตัวอักษรที่ไม่อนุญาตถูกตัดทิ้งทันที และพิมพ์เกิน 30 ตัวไม่ได้
    await code.fill('bad code!');
    await expect(code).toHaveValue('badcode');
    await code.clear();
    await code.pressSequentially('A'.repeat(40));
    await expect(code).toHaveValue('A'.repeat(30));
    await code.fill('SAFETY-01');
    await continueBtn(page).click();
    await expect(page.getByText('Title is required')).toBeVisible();
    await fieldAfterLabel(page, 'Title').fill('Safety basics');
    await continueBtn(page).click();
    await expect(page.getByText('Description is required')).toBeVisible();
    await fieldAfterLabel(page, 'Description', 'textarea').fill('Learn basic safety rules.');
    await pickFutureEndDate(page);
    // เลือก Select Date แล้วยังไม่ใส่วันเริ่ม ต้องไปต่อไม่ได้
    await page.getByLabel('Select Date').check();
    await continueBtn(page).click();
    await expect(page.getByText('Start date / time is required')).toBeVisible();
    await page.getByLabel('Send Now').check();
    // Assign To = Members ต้องเลือกพนักงานอย่างน้อย 1 คน
    await page.getByLabel('Members').check();
    await continueBtn(page).click();
    await expect(page.getByText('Select at least one employee for "Members"')).toBeVisible();
    await expect(stepHeading(page, 'Quest Settings')).toBeVisible();
    await page.getByLabel('Send to all').check();
    await continueBtn(page).click();
    await expect(stepHeading(page, 'Quest Content')).toBeVisible();
  });

  // ขั้น Content: ต้องมี Quiz, คำถามมีชื่อ, ตัวเลือกมีข้อความ, Single = ถูก 1 ข้อพอดี, Multi = ถูกอย่างน้อย 1 ข้อ
  test('[Critical] TC-QST-007 step 2 blocks Continue until every quiz question is complete', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/new' });
    await fillSettings(page);
    await continueBtn(page).click();
    await continueBtn(page).click();
    await expect(page.getByText('Add at least one quiz')).toBeVisible();
    await addQuiz(page);
    await continueBtn(page).click();
    await expect(page.getByText('Section 1, question 1: title is required')).toBeVisible();
    await fieldAfterLabel(page, 'Title').fill('Which PPE protects your head?');
    await continueBtn(page).click();
    await expect(page.getByText('Section 1, question 1: every choice needs a text')).toBeVisible();
    await page.getByPlaceholder('Choice text').nth(0).fill('Helmet');
    await page.getByPlaceholder('Choice text').nth(1).fill('Sandals');
    // Multi Choice แต่ไม่ติ๊กข้อถูกเลย
    await page.getByLabel('Multi Choice').check();
    await page.getByTitle('Correct answer').nth(0).uncheck();
    await continueBtn(page).click();
    await expect(page.getByText('Section 1, question 1: mark at least one correct choice')).toBeVisible();
    await expect(stepHeading(page, 'Quest Content')).toBeVisible();
    // กลับเป็น Single Choice จะเหลือข้อถูกข้อเดียวเอง แล้วไปต่อได้
    await page.getByLabel('Single Choice').check();
    await continueBtn(page).click();
    await expect(stepHeading(page, 'Reward')).toBeVisible();
  });

  // ฟอร์ม Quiz: ต้องมีชื่อ รายละเอียด และเวลา 1 - 600 นาที
  test('[High] TC-QST-008 the quiz dialog validates title, description and time limit', { tag: '@high' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/new' });
    await fillSettings(page);
    await continueBtn(page).click();
    await page.getByRole('button', { name: 'Quiz', exact: true }).click();
    const modal = page.locator('div.fixed.inset-0');
    await modal.getByRole('button', { name: 'Confirm' }).click();
    await expect(modal.getByText('Quiz title is required')).toBeVisible();
    await fieldAfterLabel(modal, 'Quiz Title').fill('Basics');
    await modal.getByRole('button', { name: 'Confirm' }).click();
    await expect(modal.getByText('Description is required')).toBeVisible();
    await fieldAfterLabel(modal, 'Description', 'textarea').fill('Basic questions');
    await modal.locator('input[type=number]').fill('0');
    await modal.getByRole('button', { name: 'Confirm' }).click();
    await expect(modal.getByText('Time limit must be 1 - 600 minutes')).toBeVisible();
    await modal.locator('input[type=number]').fill('601');
    await modal.getByRole('button', { name: 'Confirm' }).click();
    await expect(modal.getByText('Time limit must be 1 - 600 minutes')).toBeVisible();
  });

  // มีให้เลือกแค่ Single / Multi Choice และอนุมัติแบบ Auto Approve อย่างเดียว (ไม่มี Manual)
  test('[High] TC-QST-009 only Single / Multi Choice and Auto Approve are offered', { tag: '@high' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/new' });
    await expect(page.getByText('Auto Approve', { exact: true })).toBeVisible();
    await expect(page.getByText(/manual/i)).toHaveCount(0);
    await fillSettings(page);
    await continueBtn(page).click();
    await addQuiz(page);
    const types = fieldAfterLabel(page, 'Question type', 'div').getByRole('radio');
    await expect(types).toHaveCount(2);
    await expect(page.getByLabel('Single Choice')).toBeChecked();
    await expect(page.getByLabel('Multi Choice')).not.toBeChecked();
  });

  // ขั้น Reward: Pass score ต้องเป็นจำนวนเต็ม 1..จำนวนข้อ, Points ต้องเป็นจำนวนเต็ม >= 0, รางวัลหมดสต็อกเลือกไม่ได้
  test('[High] TC-QST-010 step 3 validates pass score and points, and out-of-stock rewards cannot be chosen', { tag: '@high' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/new' });
    await fillSettings(page);
    await continueBtn(page).click();
    await addQuiz(page);
    await fieldAfterLabel(page, 'Title').fill('Which PPE protects your head?');
    await page.getByPlaceholder('Choice text').nth(0).fill('Helmet');
    await page.getByPlaceholder('Choice text').nth(1).fill('Sandals');
    await continueBtn(page).click();
    await expect(stepHeading(page, 'Reward')).toBeVisible();
    const passScore = fieldAfterLabel(page, 'Pass score', 'div').locator('input');
    const points = fieldAfterLabel(page, /^Points/);
    await passScore.fill('2');
    await continueBtn(page).click();
    await expect(page.getByText('Pass score must be a whole number between 1 and 1 (the number of questions)')).toBeVisible();
    await passScore.fill('');
    await points.fill('1.5');
    await continueBtn(page).click();
    await expect(page.getByText('Points must be a whole number (0 or more)')).toBeVisible();
    await expect(page.getByRole('option', { name: /Coffee Mug \(out of stock\)/ })).toBeDisabled();
    await expect(page.getByRole('option', { name: /Starbucks Voucher \(stock 50\)/ })).toBeEnabled();
    await points.fill('100');
    await continueBtn(page).click();
    await expect(stepHeading(page, 'Summary')).toBeVisible();
  });

  // กรอกครบ 4 ขั้นแล้วกด Create Quest ต้องส่ง POST /api/quests ด้วยค่าที่ถูกต้อง และกลับมาหน้ารายการ
  test('[Critical] TC-QST-011 a complete quest is sent to the server with the right values', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page);
    const posted = await routeJson(page, '**/api/quests', 'POST', (call) => ({
      status: 201, body: { success: true, quest: { ...QUESTS[0], title: call.body.title } },
    }));
    await page.getByRole('button', { name: 'Create New Quest' }).click();
    await fillSettings(page, { description: 'Learn basic safety rules.' });
    await continueBtn(page).click();

    // Quiz ที่ตั้ง 15 นาที และ No edit allow; คำถาม Multi Choice 3 ตัวเลือก ถูก 2 ข้อ
    await addQuiz(page, { minutes: 15, noEdit: true });
    await expect(page.getByText('15 minutes • 1 Questions')).toBeVisible();
    await expect(page.getByText('• No edit allow')).toBeVisible();
    await fieldAfterLabel(page, 'Title').fill('Which PPE is required?');
    await page.getByLabel('Multi Choice').check();
    await page.getByPlaceholder('Choice text').nth(0).fill('Helmet');
    await page.getByPlaceholder('Choice text').nth(1).fill('Gloves');
    await page.getByTitle('Correct answer').nth(1).check();
    await page.getByRole('button', { name: 'Add choice' }).click();
    await page.getByPlaceholder('Choice text').nth(2).fill('Sandals');
    await continueBtn(page).click();

    // Reward: ต้องตอบถูก 1 ข้อ ได้ 100 แต้ม และแจกรางวัลฟรี
    await expect(stepHeading(page, 'Reward')).toBeVisible();
    await fieldAfterLabel(page, 'Pass score', 'div').locator('input').fill('1');
    await fieldAfterLabel(page, /^Points/).fill('100');
    await fieldAfterLabel(page, /^Reward/, 'select').selectOption('rew-001');
    await continueBtn(page).click();

    // Summary สรุปค่าที่ตั้งไว้
    await expect(stepHeading(page, 'Summary')).toBeVisible();
    await expect(page.getByText('Auto approve points')).toBeVisible();
    await expect(page.getByText('1 correct answer(s) or more')).toBeVisible();
    await expect(page.getByText('Free reward for everyone who passes')).toBeVisible();
    await expect(page.getByText(/Section 1: Basics — 1 questions, 15 min/)).toBeVisible();
    await page.getByRole('button', { name: 'Create Quest' }).click();

    await expect(page.getByText('Quest "Safety basics" created')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quest Management' })).toBeVisible();
    expect(posted).toHaveLength(1);
    const body = posted[0].body;
    expect(body).toMatchObject({
      code: 'SAFETY-01', title: 'Safety basics', description: 'Learn basic safety rules.',
      sendMode: 'now', assignType: 'all', memberIds: [], autoApprove: true,
      rewardPoints: 100, passCount: 1, rewardId: 'rew-001',
      sections: [{
        type: 'quiz', title: 'Basics', description: 'Basic questions', timeLimitMinutes: 15, editType: 'no_edit',
        questions: [{
          type: 'multi', title: 'Which PPE is required?', points: 0,
          choices: [
            { text: 'Helmet', isCorrect: true },
            { text: 'Gloves', isCorrect: true },
            { text: 'Sandals', isCorrect: false },
          ],
        }],
      }],
    });
    expect(body.endDate).toMatch(/^\d{4}-\d{2}-15$/);
    // ไม่มีคำถามประเภทอื่น/ไม่มี manual approve ใน payload
    expect(body.autoApprove).toBe(true);
  });

  // รหัส Quest ซ้ำ: server ตอบ 409 ต้องเห็นข้อความของ server ในวิซาร์ด ไม่ออกจากหน้า และกดบันทึกใหม่ได้
  test('[Critical] TC-QST-012 a duplicate code (409) is shown and the wizard stays open', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page);
    const posted = await routeJson(page, '**/api/quests', 'POST', {
      status: 409, body: { success: false, message: 'Quest code "SAFETY-01" is already in use' },
    });
    await walkToSummary(page);
    await page.getByRole('button', { name: 'Create Quest' }).click();
    await expect(page.getByText('Quest code "SAFETY-01" is already in use')).toBeVisible();
    await expect(page).toHaveURL(/\/missions\/new$/);
    await expect(page.getByRole('button', { name: 'Create Quest' })).toBeEnabled();
    expect(posted).toHaveLength(1);
  });

  // แก้ไข Quest เดิม: โหลดค่าจาก server, ข้ามไปขั้น Summary ได้ทันที, บันทึกด้วย PUT /api/quests/<id>
  test('[Critical] TC-QST-013 editing an existing quest loads it and saves with PUT', { tag: '@critical' }, async ({ page }) => {
    await openQuests(page, { path: '/missions/SAFETY-01' });
    await routeJson(page, '**/api/quests/q-1', 'GET', { body: { success: true, quest: QUEST_DETAIL } });
    const put = await routeJson(page, '**/api/quests/q-1', 'PUT', (call) => ({
      body: { success: true, quest: { ...QUEST_DETAIL, title: call.body.title } },
    }));
    // รีโหลดเพื่อให้ route ใหม่ทำงานตั้งแต่ตอนเปิดหน้า
    await page.reload();
    await expect(page.getByRole('heading', { name: /Edit Quest — Quest Settings/ })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. SAFETY-01')).toHaveValue('SAFETY-01');
    await expect(fieldAfterLabel(page, 'Title')).toHaveValue('Safety basics');
    await fieldAfterLabel(page, 'Title').fill('Safety basics v2');
    // Quest เดิมกดข้ามไปขั้น Summary ได้เลย
    await page.getByRole('button', { name: /Summary/ }).click();
    await expect(page.getByText('Safety basics v2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Quest "Safety basics v2" updated')).toBeVisible();
    expect(put).toHaveLength(1);
    expect(put[0].url).toContain('/api/quests/q-1');
    expect(put[0].body).toMatchObject({
      code: 'SAFETY-01', title: 'Safety basics v2', sendMode: 'date',
      startDate: '2026-10-20', startTime: '09:00', endDate: '2099-12-31', endTime: '23:59',
      passCount: 1, rewardPoints: 100, rewardId: 'rew-001', autoApprove: true,
    });
    expect(put[0].body.sections).toHaveLength(1);
    await expect(page).not.toHaveURL(/SAFETY-01/);
  });
});
