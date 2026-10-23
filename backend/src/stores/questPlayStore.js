const crypto = require('crypto');
const db = require('../config/database');
const httpError = require('../utils/httpError');
const { todayIso } = require('../utils/time');
const { computeStatus } = require('./questStore');

const need = () => {
  if (!db.isPgConnected()) throw httpError(503, 'ต้องเชื่อมต่อฐานข้อมูลเพื่อทำ Quest');
};

// Run fn inside a PostgreSQL transaction (rolls back on any thrown error)
const withTx = async (fn) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
};

const ASSIGNED_SQL = `(q.assign_type = 'all'
  OR (q.assign_type = 'members' AND EXISTS (SELECT 1 FROM quest_members m WHERE m.quest_id = q.id AND m.employee_id = $1))
  OR (q.assign_type = 'new_employee' AND $2 >= q.start_date))`;

const statusOf = (r) => computeStatus({ startDate: r.start_date, startTime: r.start_time, endDate: r.end_date, endTime: r.end_time });

const summaryOf = (r) => {
  const questionCount = Number(r.question_count) || 0;
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    imageUrl: r.image_url || '',
    startDate: r.start_date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    status: statusOf(r),
    questionCount,
    passCount: Number(r.pass_count) > 0 ? Number(r.pass_count) : questionCount,
    totalPoints: Number(r.reward_points) || 0,
    rewardTitle: r.reward_title || null,
    passed: !!r.passed,
    attempts: Number(r.attempts) || 0,
    // a quest can be taken once: after a failed attempt it is closed for this employee
    failed: !r.passed && (Number(r.attempts) || 0) > 0,
    score: Number(r.score) || 0,
    pointsAwarded: Number(r.points_awarded) || 0,
  };
};

const SUMMARY_SQL = `
  SELECT q.*,
    (SELECT r.title FROM rewards r WHERE r.id = q.reward_id) AS reward_title,
    (SELECT COUNT(*) FROM quest_questions qq JOIN quest_sections s ON s.id = qq.section_id WHERE s.quest_id = q.id) AS question_count,
    (SELECT COALESCE(SUM(qq.points), 0) FROM quest_questions qq JOIN quest_sections s ON s.id = qq.section_id WHERE s.quest_id = q.id) AS question_points,
    p.passed, p.score, p.attempts, p.points_awarded
  FROM quests q
  LEFT JOIN quest_progress p ON p.quest_id = q.id AND p.employee_id = $1`;

// The employee row for the token user (id or code)
const findEmployee = async (executor, employeeId) => {
  const res = await executor.query('SELECT id, start_date, status FROM employees WHERE id = $1 OR code = $1 LIMIT 1', [employeeId]);
  if (!res.rows[0]) throw httpError(404, 'ไม่พบบัญชีพนักงาน');
  return res.rows[0];
};

module.exports = function createQuestPlayStore() {
  const store = {
    // Quests assigned to this employee that are open now, plus the ones already passed
    getMyQuests: async (employeeId) => {
      need();
      const emp = await findEmployee(db, employeeId);
      const res = await db.query(
        `${SUMMARY_SQL} WHERE ${ASSIGNED_SQL} ORDER BY q.created_at DESC`,
        [emp.id, String(emp.start_date || '')]
      );
      return res.rows.map(summaryOf).filter((q) => q.passed || q.failed || q.status === 'Active');
    },

    // The quiz an assigned employee may take — correct answers are NEVER sent
    getMyQuest: async (questId, employeeId) => {
      need();
      const emp = await findEmployee(db, employeeId);
      const head = await db.query(
        `${SUMMARY_SQL} WHERE q.id = $3 AND ${ASSIGNED_SQL}`,
        [emp.id, String(emp.start_date || ''), questId]
      );
      if (!head.rows[0]) throw httpError(404, 'ไม่พบ Quest นี้ หรือคุณไม่ได้รับมอบหมาย');
      const quest = summaryOf(head.rows[0]);

      const sections = (await db.query('SELECT * FROM quest_sections WHERE quest_id = $1 ORDER BY position', [questId])).rows;
      const ids = sections.map((s) => s.id);
      const questions = ids.length ? (await db.query('SELECT * FROM quest_questions WHERE section_id = ANY($1) ORDER BY position', [ids])).rows : [];
      const qids = questions.map((q) => q.id);
      const choices = qids.length ? (await db.query('SELECT id, question_id, text FROM quest_choices WHERE question_id = ANY($1) ORDER BY position', [qids])).rows : [];

      quest.sections = sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        timeLimitMinutes: s.time_limit_minutes,
        questions: questions.filter((q) => q.section_id === s.id).map((q) => ({
          id: q.id,
          type: q.type,
          title: q.title,
          description: q.description || '',
          imageUrl: q.image_url || '',
          points: Number(q.points) || 0,
          choices: choices.filter((c) => c.question_id === q.id).map((c) => ({ id: c.id, text: c.text })),
        })),
      }));
      return quest;
    },

    /**
     * Grade the answers and, when the employee passes inside the open window, approve automatically:
     * points are added and the optional reward is handed out free (no points spent). One transaction, so a
     * double tap can never pay twice.
     * answers: { [questionId]: [choiceId, ...] }
     */
    submitMyQuest: async (questId, employeeId, answers = {}) => {
      need();
      return withTx(async (client) => {
        const emp = await findEmployee(client, employeeId);

        const head = await client.query(
          `SELECT q.* FROM quests q WHERE q.id = $3 AND ${ASSIGNED_SQL} FOR UPDATE`,
          [emp.id, String(emp.start_date || ''), questId]
        );
        const quest = head.rows[0];
        if (!quest) throw httpError(404, 'ไม่พบ Quest นี้ หรือคุณไม่ได้รับมอบหมาย');
        if (statusOf(quest) !== 'Active') throw httpError(400, 'Quest นี้ไม่อยู่ในช่วงเวลาที่เปิดให้ทำ');

        await client.query('INSERT INTO quest_progress (quest_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [questId, emp.id]);
        const prog = (await client.query('SELECT * FROM quest_progress WHERE quest_id = $1 AND employee_id = $2 FOR UPDATE', [questId, emp.id])).rows[0];
        if (prog.passed) throw httpError(409, 'คุณทำ Quest นี้ผ่านและรับรางวัลไปแล้ว');
        if (Number(prog.attempts) > 0) throw httpError(409, 'คุณทำ Quest นี้แล้วแต่ไม่ผ่าน ไม่สามารถทำซ้ำได้');

        // grade
        const qs = (await client.query(
          `SELECT qq.id, qq.type, qq.points FROM quest_questions qq JOIN quest_sections s ON s.id = qq.section_id WHERE s.quest_id = $1`,
          [questId]
        )).rows;
        const cs = qs.length
          ? (await client.query('SELECT id, question_id, is_correct FROM quest_choices WHERE question_id = ANY($1)', [qs.map((q) => q.id)])).rows
          : [];
        let correctCount = 0;
        qs.forEach((q) => {
          const mine = cs.filter((c) => c.question_id === q.id);
          const picked = new Set((Array.isArray(answers[q.id]) ? answers[q.id] : []).map(String));
          if (picked.size === 0 || [...picked].some((id) => !mine.some((c) => c.id === id))) return; // unanswered / foreign choice
          const correctIds = mine.filter((c) => c.is_correct).map((c) => c.id);
          const exact = picked.size === correctIds.length && correctIds.every((id) => picked.has(id));
          if (exact) correctCount += 1;
        });
        const total = qs.length;
        const needed = Number(quest.pass_count) > 0 ? Math.min(Number(quest.pass_count), total) : total;
        const passed = correctCount >= needed;

        const result = { passed, correctCount, totalQuestions: total, passCount: needed, pointsAwarded: 0, reward: null };

        if (!passed) {
          await client.query(
            'UPDATE quest_progress SET attempts = COALESCE(attempts, 0) + 1, score = GREATEST(COALESCE(score, 0), $3) WHERE quest_id = $1 AND employee_id = $2',
            [questId, emp.id, correctCount]
          );
          return result;
        }

        // passed -> auto approve: points
        // one fixed amount for the whole quest, paid to everyone who reaches the pass score
        const points = Number(quest.reward_points) || 0;
        result.pointsAwarded = points;
        const em = await client.query('UPDATE employees SET points = COALESCE(points, 0) + $1 WHERE id = $2 RETURNING points', [points, emp.id]);
        result.newTotalPoints = Number(em.rows[0].points) || 0;
        if (points > 0) {
          await client.query(
            'INSERT INTO point_transactions (id, employee_id, title, points, type, category) VALUES ($1, $2, $3, $4, $5, $6)',
            [`pt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, emp.id, `ผ่าน Quest: ${quest.title}`, points, 'earn', 'Quest']
          );
        }

        // passed -> auto approve: free reward (stock is locked; an empty stock does not cancel the pass)
        let redemptionId = null;
        if (quest.reward_id) {
          const rw = await client.query("SELECT * FROM rewards WHERE id = $1 AND status = 'Active' FOR UPDATE", [quest.reward_id]);
          const reward = rw.rows[0];
          if (reward && (Number(reward.stock) || 0) > 0) {
            await client.query('UPDATE rewards SET stock = stock - 1 WHERE id = $1', [reward.id]);
            const couponCode = `WX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            redemptionId = `red-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            await client.query(
              'INSERT INTO redemptions (id, employee_id, reward_id, coupon_code, points_used, status) VALUES ($1, $2, $3, $4, 0, $5)',
              [redemptionId, emp.id, reward.id, couponCode, 'Active']
            );
            result.reward = { title: reward.title, imageUrl: reward.image_url || '', couponCode };
          } else {
            result.rewardSkipped = true; // out of stock / inactive: points are still paid
          }
        }

        await client.query(
          `UPDATE quest_progress SET passed = TRUE, attempts = COALESCE(attempts, 0) + 1, score = $3, points_awarded = $4,
                  reward_redemption_id = $5, completed_at = CURRENT_TIMESTAMP, approved_at = CURRENT_TIMESTAMP
           WHERE quest_id = $1 AND employee_id = $2`,
          [questId, emp.id, correctCount, points, redemptionId]
        );
        return result;
      });
    },
  };
  return store;
};
