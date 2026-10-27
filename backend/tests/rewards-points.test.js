// เทส API: แต้มและของรางวัล (แลกแบบ atomic), หมวดหมู่ของรางวัล, ประวัติแต้ม, อันดับ (leaderboard)
// รันกับ backend จริง + ฐานทดสอบ wellx989_test (ดู helpers/harness.js)
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers/harness');

describe('Rewards, points and categories', () => {
  let server, api, adminToken, dept, category;

  const mkReward = async (body = {}) => {
    const r = await api('POST', '/rewards', { token: adminToken, body: { title: `Reward ${h.uid()}`, pointsRequired: 100, stock: 5, categoryId: category.id, ...body } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.reward;
  };
  const mkUser = async (points) => {
    const u = await h.makeEmployee({ dept, points });
    return { u, token: await h.loginApp(api, u) };
  };
  const pointsOf = async (id) => (await h.sql('SELECT points FROM employees WHERE id = $1', [id]))[0].points;

  before(async () => {
    server = await h.startServer();
    api = h.client(server);
    await h.resetData();
    adminToken = await h.loginAdmin(api);
    dept = await h.makeDept('Reward Dept');
    const c = await api('POST', '/reward-categories', { token: adminToken, body: { name: 'Test Category' } });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    category = c.body.category;
  });
  after(async () => { await server.stop(); await h.closePool(); });

  describe('redeeming (transaction)', () => {
    // [Critical] แลกสำเร็จ: หักแต้ม ลดสต็อก ออกคูปอง และบันทึกประวัติแต้มติดลบ ในครั้งเดียว
    test('[Critical] TC-REDEEM-001 a redeem deducts points, reduces stock, issues a coupon and writes the ledger', async () => {
      const rw = await mkReward({ pointsRequired: 100, stock: 3 });
      const { u, token } = await mkUser(250);
      const r = await api('POST', `/rewards/${rw.id}/redeem`, { token });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.match(r.body.redemption.couponCode, /^WX-[0-9A-F]{8}$/);
      assert.equal(r.body.redemption.newTotalPoints, 150);
      assert.equal(await pointsOf(u.id), 150);
      assert.equal((await h.sql('SELECT stock FROM rewards WHERE id = $1', [rw.id]))[0].stock, 2);
      const tx = await h.sql('SELECT points, type FROM point_transactions WHERE employee_id = $1', [u.id]);
      assert.deepEqual(tx.map((t) => [t.points, t.type]), [[-100, 'spend']]);
      const coupons = await api('GET', '/rewards/my-coupons', { token });
      assert.equal(coupons.body.total, 1);
    });

    // [Critical] แต้มไม่พอ: 400 ไม่หักแต้ม ไม่ลดสต็อก ไม่ออกคูปอง
    test('[Critical] TC-REDEEM-002 not enough points is refused and nothing changes', async () => {
      const rw = await mkReward({ pointsRequired: 100, stock: 3 });
      const { u, token } = await mkUser(99);
      const r = await api('POST', `/rewards/${rw.id}/redeem`, { token });
      assert.equal(r.status, 400);
      assert.match(r.body.message, /คะแนนไม่เพียงพอ/);
      assert.equal(await pointsOf(u.id), 99);
      assert.equal((await h.sql('SELECT stock FROM rewards WHERE id = $1', [rw.id]))[0].stock, 3);
      assert.equal((await h.sql('SELECT COUNT(*)::int n FROM redemptions WHERE employee_id = $1', [u.id]))[0].n, 0);
    });

    // [Critical] ของหมด (stock 0) แลกไม่ได้ และของรางวัลที่ไม่ใช้งาน / ไม่มีอยู่ 404
    test('[Critical] TC-REDEEM-003 out-of-stock is refused, unknown or inactive rewards are 404', async () => {
      const empty = await mkReward({ stock: 0 });
      const { u, token } = await mkUser(1000);
      const r = await api('POST', `/rewards/${empty.id}/redeem`, { token });
      assert.equal(r.status, 400);
      assert.match(r.body.message, /หมด/);
      assert.equal((await api('POST', '/rewards/rew-does-not-exist/redeem', { token })).status, 404);
      const inactive = await mkReward({ stock: 5 });
      await h.sql("UPDATE rewards SET status = 'Inactive' WHERE id = $1", [inactive.id]);
      assert.equal((await api('POST', `/rewards/${inactive.id}/redeem`, { token })).status, 404);
      assert.equal(await pointsOf(u.id), 1000);
    });

    // [Critical] กดพร้อมกัน: สต็อก 1 ชิ้น แต้มพอสำหรับ 2 คน -> สำเร็จได้ 1 คน (ไม่ขายเกินสต็อก)
    test('[Critical] TC-REDEEM-004 two people redeeming the last item at once: exactly one wins, stock never negative', async () => {
      const rw = await mkReward({ pointsRequired: 50, stock: 1 });
      const a = await mkUser(500);
      const b = await mkUser(500);
      const [ra, rb] = await Promise.all([api('POST', `/rewards/${rw.id}/redeem`, { token: a.token }), api('POST', `/rewards/${rw.id}/redeem`, { token: b.token })]);
      assert.deepEqual([ra.status, rb.status].sort(), [200, 400]);
      assert.equal((await h.sql('SELECT stock FROM rewards WHERE id = $1', [rw.id]))[0].stock, 0);
      const total = (await pointsOf(a.u.id)) + (await pointsOf(b.u.id));
      assert.equal(total, 950, 'หักแต้มเฉพาะคนที่แลกได้');
    });

    // [Critical] คนเดียวกดซ้ำพร้อมกัน: แต้มพอแค่ 1 ครั้ง -> แลกได้ครั้งเดียว ไม่ติดลบ
    test('[Critical] TC-REDEEM-005 the same person double-tapping cannot spend the same points twice', async () => {
      const rw = await mkReward({ pointsRequired: 100, stock: 10 });
      const { u, token } = await mkUser(150);
      const rs = await Promise.all([1, 2, 3].map(() => api('POST', `/rewards/${rw.id}/redeem`, { token })));
      assert.equal(rs.filter((r) => r.status === 200).length, 1);
      assert.equal(await pointsOf(u.id), 50);
      assert.equal((await h.sql('SELECT COUNT(*)::int n FROM redemptions WHERE employee_id = $1', [u.id]))[0].n, 1);
    });
  });

  describe('points history and leaderboard', () => {
    // [High] ประวัติแต้มของตัวเอง และแอดมินดูของคนอื่นได้ผ่าน employeeId (Employee ใส่ employeeId ก็ยังได้แต่ของตัวเอง)
    test('[High] TC-POINT-001 point history is per account; only an admin may look at another employee', async () => {
      const a = await mkUser(0);
      const b = await mkUser(0);
      await h.sql("INSERT INTO point_transactions (id, employee_id, title, points, type, category) VALUES ('pt-t-1', $1, 'bonus', 40, 'earn', 'Test')", [a.u.id]);
      await h.sql('UPDATE employees SET points = 40 WHERE id = $1', [a.u.id]);
      const mine = await api('GET', '/points/history', { token: a.token });
      assert.equal(mine.body.currentPoints, 40);
      assert.equal(mine.body.history.length, 1);
      const spy = await api('GET', `/points/history?employeeId=${a.u.id}`, { token: b.token });
      assert.equal(spy.body.history.length, 0, 'Employee ดูของคนอื่นไม่ได้');
      const asAdmin = await api('GET', `/points/history?employeeId=${a.u.id}`, { token: adminToken });
      assert.equal(asAdmin.body.history.length, 1);
    });

    // [High] Leaderboard เรียงแต้มมากไปน้อย เริ่มอันดับ 1 และไม่มีคนที่ลาออก/ปิดใช้งาน/รอตั้งรหัสผ่าน
    test('[High] TC-POINT-002 the leaderboard is ranked by points and hides resigned, inactive and pending people', async () => {
      await h.sql('TRUNCATE employees CASCADE');
      const top = await h.makeEmployee({ dept, points: 900, name: 'Top Player' });
      await h.makeEmployee({ dept, points: 500, name: 'Mid Player' });
      await h.makeEmployee({ dept, points: 100, name: 'Low Player' });
      for (const status of ['Resign', 'Inactive', 'Pending']) await h.makeEmployee({ dept, points: 9999, status, name: `Hidden ${status}` });
      const t = await h.loginApp(api, top);
      const r = await api('GET', '/leaderboard', { token: t });
      assert.deepEqual(r.body.leaderboard.map((x) => [x.rank, x.name, x.points]), [[1, 'Top Player', 900], [2, 'Mid Player', 500], [3, 'Low Player', 100]]);
    });
  });

  describe('reward catalog (admin)', () => {
    // [Critical] จัดการของรางวัลเฉพาะแอดมิน แต่ทุกคนที่ล็อกอินดูรายการได้
    test('[Critical] TC-REWARD-001 only an admin creates or deletes rewards, any signed-in user can list them', async () => {
      const { token } = await mkUser(0);
      assert.equal((await api('POST', '/rewards', { token, body: { title: 'X', categoryId: category.id } })).status, 403);
      const rw = await mkReward({});
      assert.equal((await api('DELETE', `/rewards/${rw.id}`, { token })).status, 403);
      assert.equal((await api('GET', '/rewards', { token })).status, 200);
      assert.equal((await api('DELETE', `/rewards/${rw.id}`, { token: adminToken })).status, 200);
      assert.equal((await h.sql('SELECT 1 FROM rewards WHERE id = $1', [rw.id])).length, 0);
    });

    // [Critical] ต้องเลือกหมวดหมู่ ชื่อห้ามว่าง แต้ม/สต็อกห้ามติดลบ รหัสต้องรูปแบบถูกและไม่ซ้ำ
    test('[Critical] TC-REWARD-002 category is required, values are validated and the code is unique', async () => {
      const post = (body) => api('POST', '/rewards', { token: adminToken, body });
      assert.equal((await post({ title: 'No category' })).status, 400);
      assert.equal((await post({ categoryId: category.id })).status, 400, 'ไม่มีชื่อ');
      assert.equal((await post({ title: 'X', categoryId: category.id, pointsRequired: -1 })).status, 400);
      assert.equal((await post({ title: 'X', categoryId: category.id, stock: -5 })).status, 400);
      assert.equal((await post({ title: 'X', categoryId: category.id, code: 'bad code!' })).status, 400);
      const ok = await post({ title: 'Coded', categoryId: category.id, code: 'MY-CODE_1', pointsRequired: 10 });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.equal(ok.body.reward.id, 'MY-CODE_1');
      const dup = await post({ title: 'Coded again', categoryId: category.id, code: 'my-code_1', pointsRequired: 10 });
      assert.ok([400, 409].includes(dup.status), `รหัสซ้ำ (ไม่สนตัวพิมพ์) ต้องถูกปฏิเสธ แต่ได้ ${dup.status}`);
    });

    // [High] ไม่ใส่รหัส ระบบให้รหัสสั้นถัดไป (rew-NNN) ไม่ใช้ timestamp ยาว
    test('[High] TC-REWARD-003 a reward without a code gets a short sequential id', async () => {
      const rw = await mkReward({});
      assert.match(rw.id, /^rew-\d{3,}$/);
    });
  });

  describe('reward categories (admin)', () => {
    // [Critical] ชื่อและ code ห้ามซ้ำ (ไม่สนตัวพิมพ์), ชื่อห้ามว่าง, รูปแบบ code ต้องถูก
    test('[Critical] TC-CAT-001 category name and code are unique (case-insensitive) and validated', async () => {
      const post = (body) => api('POST', '/reward-categories', { token: adminToken, body });
      assert.equal((await post({ name: 'Snacks', code: 'SNK' })).status, 201);
      assert.equal((await post({ name: 'snacks' })).status, 409);
      assert.equal((await post({ name: 'Other Snacks', code: 'snk' })).status, 409);
      assert.equal((await post({ name: '   ' })).status, 400);
      assert.equal((await post({ name: 'Bad code', code: 'no spaces' })).status, 400);
      assert.equal((await post({ name: 'A'.repeat(101) })).status, 400);
    });

    // [Critical] เปลี่ยนชื่อหมวดแล้วชื่อในของรางวัลเปลี่ยนตาม และลบหมวดที่ยังมีของรางวัลไม่ได้ (409)
    test('[Critical] TC-CAT-002 renaming cascades to rewards and a category in use cannot be deleted', async () => {
      const cat = (await api('POST', '/reward-categories', { token: adminToken, body: { name: 'Drinks' } })).body.category;
      const rw = await mkReward({ categoryId: cat.id });
      assert.equal((await api('PUT', `/reward-categories/${cat.id}`, { token: adminToken, body: { name: 'Beverages' } })).status, 200);
      assert.equal((await h.sql('SELECT category FROM rewards WHERE id = $1', [rw.id]))[0].category, 'Beverages');
      const del = await api('DELETE', `/reward-categories/${cat.id}`, { token: adminToken });
      assert.equal(del.status, 409);
      assert.equal((await api('DELETE', `/rewards/${rw.id}`, { token: adminToken })).status, 200);
      assert.equal((await api('DELETE', `/reward-categories/${cat.id}`, { token: adminToken })).status, 200);
    });
  });
});
