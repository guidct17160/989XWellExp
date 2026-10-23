const dbStore = require('../services/dbStore');
const httpError = require('../utils/httpError');
const { send: sendError } = httpError;
const { bangkokParts } = require('../utils/time');
const { logAudit } = require('../utils/auditLogger');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEND_MODES = ['now', 'date'];
const ASSIGN_TYPES = ['all', 'new_employee', 'members'];
// Only single choice and multi choice questions are supported for now
const QUESTION_TYPES = ['single', 'multi'];
const EDIT_TYPES = ['can_edit', 'no_edit'];

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const wholeNumber = (v, label, { min = 0, max = 1000000 } = {}) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw httpError(400, `${label} must be a whole number between ${min} and ${max}`);
  return n;
};

// Validates the request body and returns a clean, normalised quest (never trusts client shape)
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,30}$/;

const cleanQuest = (body = {}) => {
  const code = text(body.code);
  if (!code) throw httpError(400, 'Quest code is required');
  if (!CODE_PATTERN.test(code)) throw httpError(400, 'Quest code can only contain letters, numbers, - and _ (up to 30 characters)');
  const title = text(body.title);
  if (!title) throw httpError(400, 'Title is required');
  if (title.length > 255) throw httpError(400, 'Title must not exceed 255 characters');
  const description = text(body.description);
  if (!description) throw httpError(400, 'Description is required');
  if (description.length > 2000) throw httpError(400, 'Description must not exceed 2,000 characters');

  const sendMode = SEND_MODES.includes(body.sendMode) ? body.sendMode : 'now';
  let startDate = text(body.startDate);
  let startTime = text(body.startTime);
  if (sendMode === 'now') {
    // "Send now" starts at the current Thai time, whatever the client sent
    const now = bangkokParts();
    startDate = now.dateIso;
    startTime = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
  }
  const endDate = text(body.endDate);
  const endTime = text(body.endTime) || '23:45';
  if (!ISO_DATE.test(startDate) || !TIME.test(startTime)) throw httpError(400, 'Start date / time is required');
  if (!ISO_DATE.test(endDate) || !TIME.test(endTime)) throw httpError(400, 'End date / time is required');
  if (`${endDate} ${endTime}` <= `${startDate} ${startTime}`) throw httpError(400, 'End date / time must be after the start date / time');

  const assignType = ASSIGN_TYPES.includes(body.assignType) ? body.assignType : 'all';
  const memberIds = assignType === 'members'
    ? [...new Set((Array.isArray(body.memberIds) ? body.memberIds : []).map(text).filter(Boolean))]
    : [];
  if (assignType === 'members' && memberIds.length === 0) throw httpError(400, 'Select at least one employee for "Members"');

  const rewardPoints = wholeNumber(body.rewardPoints ?? 0, 'Points');

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  if (rawSections.length === 0) throw httpError(400, 'Add at least one quiz to the quest content');
  const sections = rawSections.map((s, si) => {
    const label = `Section ${si + 1}`;
    const sTitle = text(s.title);
    if (!sTitle) throw httpError(400, `${label}: quiz title is required`);
    if (!text(s.description)) throw httpError(400, `${label}: description is required`);
    const rawQuestions = Array.isArray(s.questions) ? s.questions : [];
    if (rawQuestions.length === 0) throw httpError(400, `${label}: add at least one question`);
    const questions = rawQuestions.map((q, qi) => {
      const qLabel = `${label}, question ${qi + 1}`;
      if (!QUESTION_TYPES.includes(q.type)) throw httpError(400, `${qLabel}: invalid question type`);
      const qTitle = text(q.title);
      if (!qTitle) throw httpError(400, `${qLabel}: title is required`);
      const points = 0; // points are set once for the whole quest (rewardPoints)
      const choices = (Array.isArray(q.choices) ? q.choices : []).map((c) => ({ text: text(c.text), isCorrect: !!c.isCorrect }));
      if (choices.length < 2) throw httpError(400, `${qLabel}: add at least 2 choices`);
      if (choices.some((c) => !c.text)) throw httpError(400, `${qLabel}: every choice needs a text`);
      const correct = choices.filter((c) => c.isCorrect).length;
      if (q.type === 'multi' ? correct < 1 : correct !== 1) {
        throw httpError(400, `${qLabel}: mark ${q.type === 'multi' ? 'at least one' : 'exactly one'} correct choice`);
      }
      return { type: q.type, title: qTitle, description: text(q.description), imageUrl: text(q.imageUrl), points, choices };
    });
    return {
      type: 'quiz',
      title: sTitle,
      description: text(s.description),
      timeLimitMinutes: wholeNumber(s.timeLimitMinutes ?? 10, `${label}: time limit`, { min: 1, max: 600 }),
      editType: EDIT_TYPES.includes(s.editType) ? s.editType : 'can_edit',
      questions,
    };
  });

  // How many questions must be answered correctly to pass (default: all of them)
  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);
  const passCount = body.passCount === undefined || body.passCount === null || body.passCount === ''
    ? totalQuestions
    : wholeNumber(body.passCount, 'Pass score', { min: 1, max: totalQuestions });

  // Optional reward given free (no points spent) to everyone who passes
  const rewardId = text(body.rewardId) || null;

  // Auto approve is the only mode for now: passing the quiz in time approves it and pays the points at once
  return {
    code, title, description, imageUrl: text(body.imageUrl), sendMode, startDate, startTime, endDate, endTime,
    assignType, memberIds, autoApprove: true, rewardPoints, passCount, rewardId, sections,
  };
};

// The end date / time cannot be in the past (Thai local time)
const assertEndInFuture = (data) => {
  const now = bangkokParts();
  const nowKey = `${now.dateIso} ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
  if (`${data.endDate} ${data.endTime}` < nowKey) throw httpError(400, 'End date / time cannot be earlier than the current time');
};

// Comparable fingerprint of quiz content (ignores ids so stored and submitted content line up)
const contentKey = (sections) => JSON.stringify(sections.map((s) => ({
  title: s.title, description: s.description, timeLimitMinutes: Number(s.timeLimitMinutes), editType: s.editType,
  questions: s.questions.map((q) => ({
    type: q.type, title: q.title, description: q.description || '', imageUrl: q.imageUrl || '', points: Number(q.points) || 0,
    choices: (q.choices || []).map((c) => ({ text: c.text, isCorrect: !!c.isCorrect })),
  })),
})));

// The quest code must be unique (case-insensitive); `selfId` is the quest being edited
const assertCodeFree = async (code, selfId) => {
  const all = await dbStore.getQuests();
  if (all.some((q) => q.id !== selfId && String(q.code || '').toLowerCase() === code.toLowerCase())) {
    throw httpError(409, `Quest code "${code}" is already used, please choose another code`);
  }
};

// A selected reward must exist and be active
const assertRewardExists = async (rewardId) => {
  if (!rewardId) return;
  const reward = await dbStore.getRewardById(rewardId);
  if (!reward) throw httpError(400, 'The selected reward no longer exists');
};

const actor = (req) => ({ id: req.user.id, name: req.user.name || req.user.username || req.user.id });

// GET /api/quests
exports.getQuests = async (req, res) => {
  try {
    const quests = await dbStore.getQuests();
    res.json({ success: true, total: quests.length, quests });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/quests/:id
exports.getQuestById = async (req, res) => {
  try {
    const quest = await dbStore.getQuestById(req.params.id);
    if (!quest) return res.status(404).json({ success: false, message: 'Quest not found' });
    res.json({ success: true, quest });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/quests
exports.createQuest = async (req, res) => {
  try {
    const data = cleanQuest(req.body);
    assertEndInFuture(data);
    await assertCodeFree(data.code, null);
    await assertRewardExists(data.rewardId);
    const quest = await dbStore.addQuest(data, actor(req));
    logAudit(req, { action: 'CREATE_QUEST', resourceType: 'quest', resourceId: quest.id, details: { title: quest.title } }).catch(() => {});
    res.status(201).json({ success: true, quest });
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /api/quests/:id
exports.updateQuest = async (req, res) => {
  try {
    const data = cleanQuest(req.body);
    await assertCodeFree(data.code, req.params.id);
    await assertRewardExists(data.rewardId);
    const existing = await dbStore.getQuestById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Quest not found' });
    // an old quest can still be saved as is; only a NEW end date / time must be in the future
    if (`${data.endDate} ${data.endTime}` !== `${existing.endDate} ${existing.endTime}`) assertEndInFuture(data);
    // A quiz marked "No edit allow" is frozen once the quest has started
    if (existing.status !== 'Scheduled' && existing.sections.some((s) => s.editType === 'no_edit')
      && contentKey(existing.sections) !== contentKey(data.sections)) {
      throw httpError(409, 'This quest has already started and contains a quiz marked "No edit allow", so its quiz content can no longer be changed');
    }
    const quest = await dbStore.updateQuest(req.params.id, data);
    if (!quest) return res.status(404).json({ success: false, message: 'Quest not found' });
    logAudit(req, { action: 'UPDATE_QUEST', resourceType: 'quest', resourceId: quest.id, details: { title: quest.title } }).catch(() => {});
    res.json({ success: true, quest });
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /api/quests/:id
exports.deleteQuest = async (req, res) => {
  try {
    const removed = await dbStore.deleteQuest(req.params.id);
    if (!removed) return res.status(404).json({ success: false, message: 'Quest not found' });
    logAudit(req, { action: 'DELETE_QUEST', resourceType: 'quest', resourceId: req.params.id }).catch(() => {});
    res.json({ success: true, message: 'Quest deleted' });
  } catch (error) {
    sendError(res, error);
  }
};

// ---- Employee (app) ------------------------------------------------------

// GET /api/my-quests
exports.getMyQuests = async (req, res) => {
  try {
    const quests = await dbStore.getMyQuests(req.user.id);
    res.json({ success: true, quests });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /api/my-quests/:id   (quiz without the correct answers)
exports.getMyQuest = async (req, res) => {
  try {
    const quest = await dbStore.getMyQuest(req.params.id, req.user.id);
    res.json({ success: true, quest });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /api/my-quests/:id/submit   { answers: { [questionId]: [choiceId, ...] } }
exports.submitMyQuest = async (req, res) => {
  try {
    const answers = req.body && req.body.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw httpError(400, 'กรุณาส่งคำตอบ (answers)');
    }
    const result = await dbStore.submitMyQuest(req.params.id, req.user.id, answers);
    if (result.passed) {
      logAudit(req, { action: 'QUEST_PASSED', resourceType: 'quest', resourceId: req.params.id, details: { points: result.pointsAwarded, reward: result.reward ? result.reward.title : null } }).catch(() => {});
    }
    res.json({
      success: true,
      message: result.passed ? 'ยินดีด้วย คุณผ่าน Quest นี้แล้ว' : `ยังไม่ผ่าน (ตอบถูก ${result.correctCount}/${result.totalQuestions} ข้อ ต้องถูกอย่างน้อย ${result.passCount} ข้อ) ลองทำใหม่ได้`,
      result,
    });
  } catch (error) {
    sendError(res, error);
  }
};
