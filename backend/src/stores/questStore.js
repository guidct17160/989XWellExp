const crypto = require('crypto');
const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');
const { bangkokParts } = require('../utils/time');

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

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

// Scheduled / Active / Expired follows Thai local time. Dates are YYYY-MM-DD and times HH:mm,
// so plain string comparison orders them correctly.
const computeStatus = (q) => {
  const now = bangkokParts();
  const nowKey = `${now.dateIso} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
  if (nowKey < `${q.startDate} ${q.startTime}`) return 'Scheduled';
  if (nowKey > `${q.endDate} ${q.endTime}`) return 'Expired';
  return 'Active';
};

const stamp = (value) => {
  if (!value) return { date: null, time: null };
  const p = bangkokParts(new Date(value));
  return { date: p.dateIso, time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` };
};

const mapQuestRow = (r) => {
  const created = stamp(r.created_at);
  const q = {
    id: r.id,
    code: r.code || '',
    title: r.title,
    description: r.description || '',
    imageUrl: r.image_url || '',
    sendMode: r.send_mode,
    startDate: r.start_date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    assignType: r.assign_type,
    autoApprove: !!r.auto_approve,
    rewardPoints: Number(r.reward_points) || 0,
    passCount: Number(r.pass_count) || 0,
    rewardId: r.reward_id || null,
    rewardTitle: r.reward_title || null,
    createdBy: r.created_by,
    createdByName: r.created_by_name || '',
    createdDate: created.date,
    createdTime: created.time,
    sectionCount: Number(r.section_count) || 0,
    questionCount: Number(r.question_count) || 0,
    totalPoints: Number(r.reward_points) || 0,
    assignedCount: Number(r.assigned_count) || 0,
    completedCount: Number(r.completed_count) || 0,
    approvedCount: Number(r.approved_count) || 0,
  };
  q.status = computeStatus(q);
  return q;
};

const SUMMARY_SQL = `
  SELECT q.*,
    (SELECT r.title FROM rewards r WHERE r.id = q.reward_id) AS reward_title,
    (SELECT COUNT(*) FROM quest_sections s WHERE s.quest_id = q.id) AS section_count,
    (SELECT COUNT(*) FROM quest_questions qq JOIN quest_sections s ON s.id = qq.section_id WHERE s.quest_id = q.id) AS question_count,
    (SELECT COALESCE(SUM(qq.points), 0) FROM quest_questions qq JOIN quest_sections s ON s.id = qq.section_id WHERE s.quest_id = q.id) AS question_points,
    CASE q.assign_type
      WHEN 'members' THEN (SELECT COUNT(*) FROM quest_members m WHERE m.quest_id = q.id)
      WHEN 'new_employee' THEN (SELECT COUNT(*) FROM employees e WHERE e.status = 'Active' AND e.start_date >= q.start_date)
      ELSE (SELECT COUNT(*) FROM employees e WHERE e.status = 'Active')
    END AS assigned_count,
    (SELECT COUNT(*) FROM quest_progress p WHERE p.quest_id = q.id AND p.completed_at IS NOT NULL) AS completed_count,
    (SELECT COUNT(*) FROM quest_progress p WHERE p.quest_id = q.id AND p.approved_at IS NOT NULL) AS approved_count
  FROM quests q`;

// Insert the sections / questions / choices / members of a quest inside an open transaction
const insertContent = async (client, questId, data) => {
  for (let si = 0; si < data.sections.length; si++) {
    const s = data.sections[si];
    const sectionId = newId('qs');
    await client.query(
      `INSERT INTO quest_sections (id, quest_id, position, type, title, description, time_limit_minutes, edit_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sectionId, questId, si, s.type, s.title, s.description, s.timeLimitMinutes, s.editType]
    );
    for (let qi = 0; qi < s.questions.length; qi++) {
      const q = s.questions[qi];
      const questionId = newId('qq');
      await client.query(
        `INSERT INTO quest_questions (id, section_id, position, type, title, description, image_url, points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [questionId, sectionId, qi, q.type, q.title, q.description, q.imageUrl, q.points]
      );
      for (let ci = 0; ci < q.choices.length; ci++) {
        await client.query(
          'INSERT INTO quest_choices (id, question_id, position, text, is_correct) VALUES ($1, $2, $3, $4, $5)',
          [newId('qc'), questionId, ci, q.choices[ci].text, q.choices[ci].isCorrect]
        );
      }
    }
  }
  for (const employeeId of data.memberIds) {
    await client.query('INSERT INTO quest_members (quest_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [questId, employeeId]);
  }
};

const friendlyFkError = (e) => {
  if (e && e.code === '23503') return httpError(400, 'Some selected employees no longer exist');
  return e;
};

module.exports = function createQuestStore() {
  const store = {
    getQuests: async () => {
      if (db.isPgConnected()) {
        const res = await db.query(`${SUMMARY_SQL} ORDER BY q.created_at DESC`);
        return res.rows.map(mapQuestRow);
      }
      return memoryStore.memoryQuests.map((q) => ({ ...store._memorySummary(q) })).reverse();
    },

    getQuestById: async (id) => {
      if (db.isPgConnected()) {
        const head = await db.query(`${SUMMARY_SQL} WHERE q.id = $1`, [id]);
        if (!head.rows.length) return null;
        const quest = mapQuestRow(head.rows[0]);

        const sections = (await db.query('SELECT * FROM quest_sections WHERE quest_id = $1 ORDER BY position', [id])).rows;
        const sectionIds = sections.map((s) => s.id);
        const questions = sectionIds.length
          ? (await db.query('SELECT * FROM quest_questions WHERE section_id = ANY($1) ORDER BY position', [sectionIds])).rows
          : [];
        const questionIds = questions.map((q) => q.id);
        const choices = questionIds.length
          ? (await db.query('SELECT * FROM quest_choices WHERE question_id = ANY($1) ORDER BY position', [questionIds])).rows
          : [];
        const members = (await db.query(
          `SELECT e.id, e.code, e.name, e.email FROM quest_members m JOIN employees e ON e.id = m.employee_id
           WHERE m.quest_id = $1 ORDER BY e.code`, [id]
        )).rows;

        quest.sections = sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          description: s.description || '',
          timeLimitMinutes: s.time_limit_minutes,
          editType: s.edit_type,
          questions: questions.filter((q) => q.section_id === s.id).map((q) => ({
            id: q.id,
            type: q.type,
            title: q.title,
            description: q.description || '',
            imageUrl: q.image_url || '',
            points: Number(q.points) || 0,
            choices: choices.filter((c) => c.question_id === q.id).map((c) => ({ id: c.id, text: c.text, isCorrect: !!c.is_correct })),
          })),
        }));
        quest.members = members.map((m) => ({ id: m.id, code: m.code, name: m.name, email: m.email }));
        return quest;
      }
      const q = memoryStore.memoryQuests.find((x) => x.id === id);
      return q ? { ...store._memorySummary(q), sections: q.sections, members: q.members } : null;
    },

    addQuest: async (data, admin) => {
      const id = newId('QST');
      if (db.isPgConnected()) {
        try {
          await withTx(async (client) => {
            await client.query(
              `INSERT INTO quests (id, code, title, description, image_url, send_mode, start_date, start_time, end_date, end_time,
                                   assign_type, auto_approve, reward_points, pass_count, reward_id, created_by, created_by_name)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
              [id, data.code, data.title, data.description, data.imageUrl, data.sendMode, data.startDate, data.startTime, data.endDate,
                data.endTime, data.assignType, data.autoApprove, data.rewardPoints, data.passCount, data.rewardId, admin.id, admin.name]
            );
            await insertContent(client, id, data);
          });
        } catch (e) {
          throw friendlyFkError(e);
        }
        return store.getQuestById(id);
      }
      const members = data.memberIds.map((mid) => {
        const emp = memoryStore.memoryEmployees.find((e) => e.id === mid);
        if (!emp) throw httpError(400, 'Some selected employees no longer exist');
        return { id: emp.id, code: emp.code, name: emp.name, email: emp.email };
      });
      memoryStore.memoryQuests.push({
        ...data, id, members, createdBy: admin.id, createdByName: admin.name, createdAt: new Date().toISOString(),
        sections: data.sections.map((s) => ({ ...s, id: newId('qs'), questions: s.questions.map((q) => ({ ...q, id: newId('qq') })) })),
      });
      return store.getQuestById(id);
    },

    updateQuest: async (id, data) => {
      if (db.isPgConnected()) {
        try {
          const found = await withTx(async (client) => {
            const upd = await client.query(
              `UPDATE quests SET code=$15, title=$2, description=$3, image_url=$4, send_mode=$5, start_date=$6, start_time=$7, end_date=$8,
                      end_time=$9, assign_type=$10, auto_approve=$11, reward_points=$12, pass_count=$13, reward_id=$14,
                      updated_at=CURRENT_TIMESTAMP
               WHERE id=$1`,
              [id, data.title, data.description, data.imageUrl, data.sendMode, data.startDate, data.startTime, data.endDate,
                data.endTime, data.assignType, data.autoApprove, data.rewardPoints, data.passCount, data.rewardId, data.code]
            );
            if (!upd.rowCount) return false;
            await client.query('DELETE FROM quest_sections WHERE quest_id = $1', [id]); // cascades to questions + choices
            await client.query('DELETE FROM quest_members WHERE quest_id = $1', [id]);
            await insertContent(client, id, data);
            return true;
          });
          if (!found) return null;
        } catch (e) {
          throw friendlyFkError(e);
        }
        return store.getQuestById(id);
      }
      const idx = memoryStore.memoryQuests.findIndex((x) => x.id === id);
      if (idx === -1) return null;
      const members = data.memberIds.map((mid) => {
        const emp = memoryStore.memoryEmployees.find((e) => e.id === mid);
        if (!emp) throw httpError(400, 'Some selected employees no longer exist');
        return { id: emp.id, code: emp.code, name: emp.name, email: emp.email };
      });
      const old = memoryStore.memoryQuests[idx];
      memoryStore.memoryQuests[idx] = {
        ...old, ...data, id, members,
        sections: data.sections.map((s) => ({ ...s, id: newId('qs'), questions: s.questions.map((q) => ({ ...q, id: newId('qq') })) })),
      };
      return store.getQuestById(id);
    },

    deleteQuest: async (id) => {
      if (db.isPgConnected()) {
        const res = await db.query('DELETE FROM quests WHERE id = $1', [id]);
        return res.rowCount > 0;
      }
      const before = memoryStore.memoryQuests.length;
      memoryStore.memoryQuests = memoryStore.memoryQuests.filter((x) => x.id !== id);
      return memoryStore.memoryQuests.length < before;
    },

    // Summary fields for an in-memory quest (used only when PostgreSQL is not connected)
    _memorySummary: (q) => {
      const created = stamp(q.createdAt);
      const questions = q.sections.flatMap((s) => s.questions);
      const active = memoryStore.memoryEmployees.filter((e) => e.status === 'Active');
      const assigned = q.assignType === 'members' ? q.members.length
        : q.assignType === 'new_employee' ? active.filter((e) => String(e.startDate || '') >= q.startDate).length
          : active.length;
      const out = {
        id: q.id, code: q.code || '', title: q.title, description: q.description, imageUrl: q.imageUrl, sendMode: q.sendMode,
        startDate: q.startDate, startTime: q.startTime, endDate: q.endDate, endTime: q.endTime,
        assignType: q.assignType, autoApprove: !!q.autoApprove, rewardPoints: q.rewardPoints,
        createdBy: q.createdBy, createdByName: q.createdByName, createdDate: created.date, createdTime: created.time,
        sectionCount: q.sections.length, questionCount: questions.length,
        totalPoints: q.rewardPoints,
        assignedCount: assigned, completedCount: 0, approvedCount: 0,
      };
      out.status = computeStatus(out);
      return out;
    },
  };
  return store;
};
module.exports.computeStatus = computeStatus;
