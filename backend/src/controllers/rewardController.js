const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/points/history
exports.getPointHistory = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const data = await dbStore.getPointHistory(empId);

    return res.status(200).json({
      success: true,
      currentPoints: data.currentPoints,
      history: data.history,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/rewards
exports.createReward = async (req, res) => {
  try {
    const reward = await dbStore.addReward(req.body);
    return res.status(201).json({ success: true, message: 'สร้างของรางวัลสำเร็จ', reward });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/rewards/:id
exports.deleteReward = async (req, res) => {
  try {
    await dbStore.deleteReward(req.params.id);
    return res.status(200).json({ success: true, message: 'ลบของรางวัลสำเร็จ' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
