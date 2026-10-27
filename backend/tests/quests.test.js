// เทส API: Quest (แอดมินสร้าง / พนักงานทำ): ตรวจข้อมูล, รหัสห้ามซ้ำ, ไม่ส่งเฉลย, ตรวจคำตอบที่ server,
// จ่ายแต้ม + คูปองครั้งเดียวต่อ Quest, ทำได้ครั้งเดียว
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

const nextYear = `${Number(h.todayBkk().slice(0, 4)) + 1}-12-31`;

const choice = (text, isCorrect = false) => ({ text, isCorrect });
// 3 ข้อ: single, single, multi (ข้อ multi ถูก 2 ตัวเลือก)
const sections = () => [{
  title: 'Safety quiz',
  description: 'Basic safety',
  timeLimitMinutes: 10,
  editType: 'can_edit',
  questions: [
    { type: 'single', title: 'Q1', choices: [choice('A', true), choice('B'), choice('C')] },
    { type: 'single', title: 'Q2', choices: [choice('Yes'), choice('No', true)] },
    { type: 'multi', title: 'Q3', choices: [choice('One', true), choice('Two', true), choice('Three')] },
  ],
}];
const questBody = (over = {}) => ({
  code: `Q-${h.uid()}`.slice(0, 30), title: 'Safety Quest', description: 'Do the quiz', sendMode: 'now',
  endDate: nextYear, endTime: '23:45', assignType: 'all', rewardPoints: 100, sections: sections(), ...over,
});

describe('Quests', () => {
  let server, api, adminToken, dept, emp, empToken;

  const create = (over) => api('POST', '/quests', { token: adminToken, body: questBody(over) });
  const mkUser = async () => {
    const u = await h.makeEmployee({ dept });
    return { u, token: await h.loginApp(api, u) };
  };
  // ตอบถูกตามเฉลยในฐานข้อมูล (answers: { [questionId]: [choiceId...] })
  const answersFor = async (questId, { wrongQuestions = [] } = {}) => {
    const rows = await h.sql(
      `SELECT q.id AS qid, q.title, c.id AS cid, c.is_correct FROM quest_questions q
       JOIN quest_choices c ON c.question_id = q.id
       JOIN quest_sections s ON s.id = q.section_id WHERE s.quest_id = $1 ORDER BY q.id, c.id`, [questId]);
    const answers = {};
    for (const r of rows) {
      const wrong = wrongQuestions.includes(r.title);
      if (r.is_correct !== wrong) (answers[r.qid] ||= []).push(r.cid);
    }
    return answers;
  };

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Quest Dept');
    ({ u: emp, token: empToken } = await mkUser());
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('admin builds a quest', () => {
    // [Critical] สร้าง Quest ได้ และ code ห้ามซ้ำ (ไม่สนตัวพิมพ์) ทั้งตอนสร้างและตอนแก้
    test('[Critical] TC-QUEST-001 a quest is created and its code must be unique (case-insensitive)', async () => {
      const r = await create({ code: 'SAFE-01' });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.quest.code, 'SAFE-01');
      assert.equal((await create({ code: 'safe-01' })).status, 409);
      const other = (await create({ code: 'SAFE-02' })).body.quest;
      const upd = await api('PUT', `/quests/${other.id}`, { token: adminToken, body: questBody({ code: 'Safe-01' }) });
      assert.equal(upd.status, 409);
    });

    // [Critical] ข้อมูลไม่ถูกต้องถูกปฏิเสธ 400: code, ชื่อ, รายละเอียด, ไม่มีเนื้อหา, ตัวเลือกไม่พอ, เฉลยผิด, วันสิ้นสุด
    test('[Critical] TC-QUEST-002 invalid quest data is rejected with 400', async () => {
      const badQ = (q) => [{ ...sections()[0], questions: [q] }];
      const cases = {
        'no code': { code: '' }, 'bad code': { code: 'has space' }, 'long code': { code: 'x'.repeat(31) },
        'no title': { title: '' }, 'no description': { description: '' },
        'no content': { sections: [] },
        'one choice': { sections: badQ({ type: 'single', title: 'Q', choices: [choice('A', true)] }) },
        'single with no correct': { sections: badQ({ type: 'single', title: 'Q', choices: [choice('A'), choice('B')] }) },
        'single with two correct': { sections: badQ({ type: 'single', title: 'Q', choices: [choice('A', true), choice('B', true)] }) },
        'multi with none': { sections: badQ({ type: 'multi', title: 'Q', choices: [choice('A'), choice('B')] }) },
        'unsupported type': { sections: badQ({ type: 'text', title: 'Q', choices: [choice('A', true), choice('B')] }) },
        'end in the past': { endDate: '2020-01-01' },
        'pass score above questions': { passCount: 4 },
        'negative points': { rewardPoints: -5 },
        'members without anyone': { assignType: 'members', memberIds: [] },
        'unknown reward': { rewardId: 'rew-none' },
      };
      for (const [name, over] of Object.entries(cases)) {
        const r = await create({ code: `T-${h.uid()}`.slice(0, 30), ...over });
        assert.equal(r.status, 400, `${name}: ${JSON.stringify(r.body)}`);
      }
    });

    // [High] ค่าเริ่มต้นผ่านเมื่อถูกครบทุกข้อ และ Auto Approve เป็นโหมดเดียว
    test('[High] TC-QUEST-003 the pass score defaults to all questions and auto approve is always on', async () => {
      const q = (await create({ code: 'DEF-1' })).body.quest;
      assert.equal(q.passCount, 3);
      assert.equal(q.autoApprove, true);
      const manual = (await create({ code: 'DEF-2', autoApprove: false })).body.quest;
      assert.equal(manual.autoApprove, true);
    });

    // [Critical] จัดการ Quest เฉพาะแอดมิน
    test('[Critical] TC-QUEST-004 employees cannot create, edit, list or delete quests', async () => {
      const q = (await create({})).body.quest;
      assert.equal((await api('POST', '/quests', { token: empToken, body: questBody() })).status, 403);
      assert.equal((await api('PUT', `/quests/${q.id}`, { token: empToken, body: questBody() })).status, 403);
      assert.equal((await api('GET', '/quests', { token: empToken })).status, 403);
      assert.equal((await api('DELETE', `/quests/${q.id}`, { token: empToken })).status, 403);
      assert.equal((await api('DELETE', `/quests/${q.id}`, { token: adminToken })).status, 200);
      assert.equal((await api('GET', `/quests/${q.id}`, { token: adminToken })).status, 404);
    });

    // [High] Quiz ที่ตั้ง "No edit allow" แก้เนื้อหาไม่ได้เมื่อ Quest เริ่มแล้ว แต่แก้ชื่อ/รางวัลอื่นได้
    test('[High] TC-QUEST-005 a started quest with a "No edit allow" quiz cannot change its quiz content', async () => {
      const secs = sections();
      secs[0].editType = 'no_edit';
      const q = (await create({ code: 'LOCK-1', sections: secs })).body.quest;
      const changed = sections();
      changed[0].editType = 'no_edit';
      changed[0].questions[0].title = 'Q1 changed';
      const r = await api('PUT', `/quests/${q.id}`, { token: adminToken, body: questBody({ code: 'LOCK-1', sections: changed }) });
      assert.equal(r.status, 409, JSON.stringify(r.body));
      const same = await api('PUT', `/quests/${q.id}`, { token: adminToken, body: questBody({ code: 'LOCK-1', title: 'New title', sections: secs }) });
      assert.equal(same.status, 200, JSON.stringify(same.body));
    });
  });

  describe('employee plays a quest', () => {
    // [Critical] พนักงานเห็น Quest ของตัวเอง แต่ข้อสอบที่ส่งให้ไม่มีเฉลย
    test('[Critical] TC-QUEST-010 the quiz sent to the app never contains the correct answers', async () => {
      const q = (await create({ code: 'PLAY-0' })).body.quest;
      const list = await api('GET', '/my-quests', { token: empToken });
      assert.ok(list.body.quests.some((x) => x.id === q.id));
      const detail = await api('GET', `/my-quests/${q.id}`, { token: empToken });
      assert.equal(detail.status, 200, JSON.stringify(detail.body));
      const text = JSON.stringify(detail.body);
      assert.ok(!/isCorrect|is_correct|correct/i.test(text), 'ต้องไม่มีฟิลด์เฉลย');
    });

    // [Critical] ตอบผ่าน: จ่ายแต้มก้อนเดียว + คูปองรางวัลฟรี ใน transaction และทำซ้ำไม่ได้ ไม่จ่ายซ้ำ
    test('[Critical] TC-QUEST-011 passing pays the points and a free reward once; a second try is 409', async () => {
      const cat = (await api('POST', '/reward-categories', { token: adminToken, body: { name: `Quest Cat ${h.uid()}` } })).body.category;
      const rw = (await api('POST', '/rewards', { token: adminToken, body: { title: 'Free prize', pointsRequired: 9999, stock: 2, categoryId: cat.id } })).body.reward;
      const q = (await create({ code: 'PLAY-1', rewardPoints: 120, passCount: 2, rewardId: rw.id })).body.quest;
      const { u, token } = await mkUser();
      const submit = async (answers) => api('POST', `/my-quests/${q.id}/submit`, { token, body: { answers } });
      const ok = await submit(await answersFor(q.id, { wrongQuestions: ['Q3'] })); // ถูก 2 จาก 3 = ผ่าน (passCount 2)
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.result.passed, true);
      assert.equal(ok.body.result.pointsAwarded, 120);
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [u.id]))[0].points, 120);
      assert.equal((await h.sql('SELECT stock FROM rewards WHERE id = $1', [rw.id]))[0].stock, 1, 'คูปองฟรีตัดสต็อก');
      assert.equal((await h.sql('SELECT points_used FROM redemptions WHERE employee_id = $1', [u.id])).length, 1);
      assert.equal((await h.sql('SELECT points_used FROM redemptions WHERE employee_id = $1', [u.id]))[0].points_used, 0, 'รางวัลฟรี ไม่หักแต้ม');
      const again = await submit(await answersFor(q.id));
      assert.equal(again.status, 409);
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [u.id]))[0].points, 120, 'ไม่จ่ายซ้ำ');
    });

    // [Critical] ตอบไม่ผ่าน: ไม่ได้แต้ม ทำซ้ำไม่ได้ (409) แต่ Quest อื่นยังทำได้
    test('[Critical] TC-QUEST-012 a failed attempt pays nothing and closes only that quest for that person', async () => {
      const q1 = (await create({ code: 'PLAY-2' })).body.quest;
      const q2 = (await create({ code: 'PLAY-3', rewardPoints: 10 })).body.quest;
      const { u, token } = await mkUser();
      const fail = await api('POST', `/my-quests/${q1.id}/submit`, { token, body: { answers: await answersFor(q1.id, { wrongQuestions: ['Q1', 'Q2'] }) } });
      assert.equal(fail.status, 200, JSON.stringify(fail.body));
      assert.equal(fail.body.result.passed, false);
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [u.id]))[0].points, 0);
      const retry = await api('POST', `/my-quests/${q1.id}/submit`, { token, body: { answers: await answersFor(q1.id) } });
      assert.equal(retry.status, 409);
      const other = await api('POST', `/my-quests/${q2.id}/submit`, { token, body: { answers: await answersFor(q2.id) } });
      assert.equal(other.status, 200);
      assert.equal(other.body.result.passed, true);
    });

    // [Critical] server ตรวจคำตอบเอง: ตอบเฉพาะบางตัวเลือกของข้อ multi ไม่นับว่าถูก, ส่งรูปแบบผิด 400
    test('[Critical] TC-QUEST-013 the server grades the answers itself and rejects a malformed body', async () => {
      const q = (await create({ code: 'PLAY-4' })).body.quest;
      const { token } = await mkUser();
      assert.equal((await api('POST', `/my-quests/${q.id}/submit`, { token, body: {} })).status, 400);
      assert.equal((await api('POST', `/my-quests/${q.id}/submit`, { token, body: { answers: [] } })).status, 400);
      assert.equal((await api('POST', `/my-quests/${q.id}/submit`, { body: { answers: {} } })).status, 401);
      const answers = await answersFor(q.id);
      const multi = Object.values(answers).find((a) => a.length === 2);
      const partialKey = Object.keys(answers).find((k) => answers[k] === multi);
      answers[partialKey] = [multi[0]]; // ตอบถูกแค่ 1 จาก 2 ตัวเลือก
      const r = await api('POST', `/my-quests/${q.id}/submit`, { token, body: { answers } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.result.passed, false, 'ข้อ multi ต้องเลือกถูกครบจึงนับ');
      assert.equal(r.body.result.correctCount, 2);
    });

    // [High] Quest แบบเลือกสมาชิก: คนที่ไม่ได้ถูกเลือกไม่เห็นและทำไม่ได้
    test('[High] TC-QUEST-014 a quest for selected members is invisible and closed to everyone else', async () => {
      const member = await mkUser();
      const outsider = await mkUser();
      const q = (await create({ code: 'MEM-1', assignType: 'members', memberIds: [member.u.id] })).body.quest;
      assert.ok((await api('GET', '/my-quests', { token: member.token })).body.quests.some((x) => x.id === q.id));
      assert.ok(!(await api('GET', '/my-quests', { token: outsider.token })).body.quests.some((x) => x.id === q.id));
      const r = await api('POST', `/my-quests/${q.id}/submit`, { token: outsider.token, body: { answers: await answersFor(q.id) } });
      assert.ok([403, 404].includes(r.status), `ได้ ${r.status}`);
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [outsider.u.id]))[0].points, 0);
    });

    // [Critical] ส่งพร้อมกันหลายครั้ง: จ่ายแต้มได้ครั้งเดียว
    test('[Critical] TC-QUEST-015 submitting the same passing answers several times at once pays only once', async () => {
      const q = (await create({ code: 'RACE-1', rewardPoints: 70 })).body.quest;
      const { u, token } = await mkUser();
      const answers = await answersFor(q.id);
      const rs = await Promise.all([1, 2, 3, 4].map(() => api('POST', `/my-quests/${q.id}/submit`, { token, body: { answers } })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1, rs.map((r) => r.status).join(','));
      assert.equal((await h.sql('SELECT points FROM employees WHERE id = $1', [u.id]))[0].points, 70);
    });
  });
});
