const dbStore = require('../services/dbStore');
const { logAudit } = require('../utils/auditLogger');

// GET /api/approvals/pending
exports.getPendingApprovals = async (req, res) => {
  try {
    // LOW-1 FIX: No more hardcoded fallback. User must be authenticated.
    const managerId = req.user?.id;
    if (!managerId) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }    const pendingList = await dbStore.getPendingApprovals(managerId);

    return res.status(200).json({
      success: true,
      total: pendingList.length,
      approvals: pendingList,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/approvals/:requestType/:id
// requestType: 'leave' | 'ot' | 'time-correction'
exports.processApproval = async (req, res) => {
  try {
    const { requestType, id } = req.params;
    const { action, remark, approverName } = req.body; // action: 'approved' | 'rejected'

    if (!action || !['approved', 'rejected', 'อนุมัติ', 'ไม่อนุมัติ'].includes(action.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Action ต้องเป็น 'approved' หรือ 'rejected'",
      });
    }

    const statusText = action.toLowerCase() === 'approved' || action === 'อนุมัติ' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ';
    const approver = approverName || req.user?.name || req.body.approver || 'ผู้จัดการ';
    const approverRole = req.body.approverRole || req.user?.role || req.headers['x-role'] || (approver.includes('SuperBoss') ? 'SuperBoss' : 'Boss');

    const result = await dbStore.processApprovalRequest({
      requestType,
      id,
      status: statusText,
      approver,
      approverRole,
      remark: remark || '',
    });

    logAudit(req, {
      action: statusText === 'อนุมัติแล้ว' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
      resourceType: requestType,
      resourceId: id,
      details: { approver, approverRole, status: statusText, remark: remark || '' },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `ทำรายการ ${statusText} เรียบร้อยแล้ว`,
      result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
