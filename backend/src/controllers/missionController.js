const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

// GET /api/missions
exports.getMissions = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const missions = await dbStore.getMissions(empId);

    return res.status(200).json({
      success: true,
      total: missions.length,
      missions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/missions/sync-steps
exports.syncSteps = async (req, res) => {
  try {
    const { steps } = req.body;
    const empId = getEmpId(req);

    if (steps === undefined || steps === null) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวนก้าวเดิน (steps)' });
    }

    const updatedMissions = await dbStore.updateUserSteps(empId, Number(steps));

    return res.status(200).json({
      success: true,
      message: `ซิงค์จำนวนก้าวเดิน ${steps} ก้าวสำเร็จแล้ว`,
      missions: updatedMissions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/missions/:id/progress
exports.updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, isCompleted } = req.body;
    const empId = getEmpId(req);
    if (!empId) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });

    const updatedMissions = await dbStore.updateMissionProgress(
      empId,
      id,
      progress !== undefined ? Number(progress) : 1,
      isCompleted
    );

    return res.status(200).json({
      success: true,
      message: 'อัปเดตความคืบหน้าภารกิจสำเร็จ',
      missions: updatedMissions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/missions/:id/claim
exports.claimMission = async (req, res) => {
  try {
    const { id } = req.params;
    const empId = getEmpId(req);

    const result = await dbStore.claimMissionReward(empId, id);

    return res.status(200).json({
      success: true,
      message: `รับแต้มสำเร็จ +${result.pointsEarned} แต้ม!`,
      pointsEarned: result.pointsEarned,
      newTotalPoints: result.newTotalPoints,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/missions
exports.createMission = async (req, res) => {
  try {
    const mission = await dbStore.addMission(req.body);
    return res.status(201).json({ success: true, message: 'สร้าง Mission สำเร็จ', mission });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/missions/:id
exports.deleteMission = async (req, res) => {
  try {
    await dbStore.deleteMission(req.params.id);
    return res.status(200).json({ success: true, message: 'ลบ Mission สำเร็จ' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
