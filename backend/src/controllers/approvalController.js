const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');
const { logAudit } = require('../utils/auditLogger');

// GET /api/approvals/pending
exports.getPendingApprovals = async (req, res) => {
  try {
    // LOW-1 FIX: No more hardcoded fallback. User must be authenticated.
    const managerId = req.user?.id;
    if (!managerId) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }
    const pendingList = await dbStore.getPendingApprovals(managerId);

    return res.status(200).json({
      success: true,
      total: pendingList.length,
      approvals: pendingList,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/approvals/history (Real DB)
exports.getApprovalHistory = async (req, res) => {
  try {
    // SECURITY: the viewer comes from the verified token; the list only holds what this account decided
    const historyList = await dbStore.getApprovalHistory({ id: req.user?.id, name: req.user?.name });
    return res.status(200).json({
      success: true,
      total: historyList.length,
      history: historyList,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// PATCH /api/approvals/:requestType/:id
// requestType: 'leave' | 'time-correction'
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
    // SECURITY: approver identity comes from the verified JWT; a body-supplied name is only a last-resort label
    const approver = req.user?.name || req.user?.username || approverName || 'ผู้จัดการ';
    // SECURITY: role is taken ONLY from the verified JWT (never from body/headers)
    const approverRole = req.user.role;

    const result = await dbStore.processApprovalRequest({
      requestType,
      id,
      status: statusText,
      approver,
      approverId: req.user.id,
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
    return sendError(res, error);
  }
};
