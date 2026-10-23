const dbStore = require('../services/dbStore');
const httpError = require('../utils/httpError');
const { send: sendError } = httpError;
const getEmpId = require('../helpers/getEmployeeId');
const { isAdminRole } = require('../middlewares/authMiddleware');

// GET /api/rewards
exports.getRewards = async (req, res) => {
  try {
    const rewards = await dbStore.getRewards();
    return res.status(200).json({
      success: true,
      total: rewards.length,
      rewards,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/rewards/:id
exports.getRewardById = async (req, res) => {
  try {
    const reward = await dbStore.getRewardById(req.params.id);
    if (!reward) {
      return res.status(404).json({ success: false, message: 'ไม่พบของรางวัลนี้' });
    }
    return res.status(200).json({ success: true, reward });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/rewards/:id/redeem
exports.redeemReward = async (req, res) => {
  try {
    const { id } = req.params;
    const empId = getEmpId(req);

    const redemption = await dbStore.redeemReward(empId, id);

    return res.status(200).json({
      success: true,
      message: 'แลกของรางวัลสำเร็จเรียบร้อยแล้ว!',
      redemption,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/rewards/my-coupons
exports.getMyCoupons = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const coupons = await dbStore.getUserCoupons(empId);

    return res.status(200).json({
      success: true,
      total: coupons.length,
      coupons,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/points/history
exports.getPointHistory = async (req, res) => {
  try {
    const empId = (isAdminRole(req.user?.role) && req.query.employeeId) || getEmpId(req);
    const data = await dbStore.getPointHistory(empId);

    return res.status(200).json({
      success: true,
      currentPoints: data.currentPoints,
      history: data.history,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/rewards
exports.createReward = async (req, res) => {
  try {
    const { title, pointsRequired, stock, categoryId } = req.body || {};
    const code = String((req.body || {}).code || '').trim();
    if (code && !/^[A-Za-z0-9_-]{1,30}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Reward code can only contain letters, numbers, - and _ (up to 30 characters)' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อของรางวัล (title)' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Please select a category for the reward' });
    }
    if (pointsRequired !== undefined && !(Number(pointsRequired) >= 0)) {
      return res.status(400).json({ success: false, message: 'คะแนนที่ใช้แลกต้องเป็นตัวเลขที่ไม่ติดลบ' });
    }
    if (stock !== undefined && !(Number(stock) >= 0)) {
      return res.status(400).json({ success: false, message: 'จำนวนสต็อกต้องเป็นตัวเลขที่ไม่ติดลบ' });
    }
    const reward = await dbStore.addReward({ ...req.body, code });
    return res.status(201).json({ success: true, message: 'สร้างของรางวัลสำเร็จ', reward });
  } catch (error) {
    return sendError(res, error);
  }
};

// Reward categories (admin only): GET/POST /api/reward-categories, PUT/DELETE /api/reward-categories/:id
const cleanCategory = (body = {}) => {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  if (!name) throw httpError(400, 'Category name is required');
  if (name.length > 100) throw httpError(400, 'Category name must be 100 characters or fewer');
  const code = String(body.code || '').trim();
  if (code && !/^[A-Za-z0-9_-]{1,30}$/.test(code)) {
    throw httpError(400, 'Category code can only contain letters, numbers, - and _ (up to 30 characters)');
  }
  return { name, code };
};

exports.getRewardCategories = async (req, res) => {
  try {
    const categories = await dbStore.getRewardCategories();
    return res.status(200).json({ success: true, total: categories.length, categories });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.createRewardCategory = async (req, res) => {
  try {
    const category = await dbStore.addRewardCategory(cleanCategory(req.body));
    return res.status(201).json({ success: true, message: 'Category created', category });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.updateRewardCategory = async (req, res) => {
  try {
    const category = await dbStore.updateRewardCategory(req.params.id, cleanCategory(req.body));
    return res.status(200).json({ success: true, message: 'Category updated', category });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.deleteRewardCategory = async (req, res) => {
  try {
    await dbStore.deleteRewardCategory(req.params.id);
    return res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/rewards/:id
exports.deleteReward = async (req, res) => {
  try {
    await dbStore.deleteReward(req.params.id);
    return res.status(200).json({ success: true, message: 'ลบของรางวัลสำเร็จ' });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const employees = await dbStore.getEmployees();
    // Only people who can actually earn points: not resigned / inactive / still waiting to set a password
    const active = employees.filter(e => !['Inactive', 'Resign', 'Resigned', 'Pending', 'Pending Password'].includes(e.status));
    const sorted = active
      .map(e => ({
        id: e.id,
        code: e.code,
        name: e.name,
        department: e.department,
        position: e.position,
        points: parseInt(e.points, 10) || 0,
        avatarUrl: e.avatarUrl || e.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    return res.status(200).json({
      success: true,
      total: sorted.length,
      leaderboard: sorted,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
