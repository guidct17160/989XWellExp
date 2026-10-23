const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');
const getEmpId = require('../helpers/getEmployeeId');
const { isApproverRole } = require('../middlewares/authMiddleware');
const { todayIso } = require('../utils/time');
const { attachmentIdFromUrl } = require('./uploadController');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isValidIsoDate = (v) => ISO_DATE.test(String(v || '')) && !Number.isNaN(Date.parse(v));

// GET /api/leaves/balances
exports.getBalances = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const balances = await dbStore.getLeaveBalances(empId);

    return res.status(200).json({
      success: true,
      balances,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/leaves
exports.createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, totalDays, reason, attachmentUrl } = req.body;
    const empId = getEmpId(req);

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลประเภทการลา วันที่ และเหตุผลให้ครบถ้วน',
      });
    }

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      return res.status(400).json({ success: false, message: 'รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: 'วันสิ้นสุดการลาต้องไม่ก่อนวันเริ่มลา' });
    }
    // Inclusive calendar span; half-day leave (0.5) is allowed, anything above the span is not
    const spanDays = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
    const days = totalDays === undefined || totalDays === null || totalDays === '' ? spanDays : Number(totalDays);
    if (!Number.isFinite(days) || days <= 0 || days > spanDays || (days * 2) % 1 !== 0) {
      return res.status(400).json({
        success: false,
        message: `จำนวนวันลาไม่ถูกต้อง (ต้องมากกว่า 0 และไม่เกิน ${spanDays} วันตามช่วงวันที่เลือก)`,
      });
    }

    // An attachment must be a file this employee uploaded through /uploads/leave-attachment
    if (attachmentUrl) {
      const attId = attachmentIdFromUrl(attachmentUrl);
      const att = attId ? await dbStore.getLeaveAttachment(attId) : null;
      if (!att || att.employeeId !== empId) {
        return res.status(400).json({ success: false, message: 'ไฟล์แนบไม่ถูกต้อง กรุณาอัปโหลดไฟล์ใหม่อีกครั้ง' });
      }
    }

    const newRequest = await dbStore.addLeaveRequest({
      employeeId: empId,
      leaveType,
      startDate,
      endDate,
      totalDays: days,
      reason,
      attachmentUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'ยื่นใบลาเรียบร้อยแล้ว รอการอนุมัติจากหัวหน้างาน',
      request: newRequest,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/leaves/my-requests
exports.getMyRequests = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const list = await dbStore.getLeaveRequests(empId);

    return res.status(200).json({
      success: true,
      total: list.length,
      requests: list,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/leaves/:id
exports.getLeaveById = async (req, res) => {
  try {
    const reqItem = await dbStore.getLeaveById(req.params.id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการใบลา' });
    }

    const ownerId = reqItem.employeeId || reqItem.employee_id;
    if (!isApproverRole(req.user?.role) && ownerId !== req.user?.id && ownerId !== req.user?.code) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์เข้าถึงใบลาของพนักงานคนอื่น (Forbidden)',
      });
    }

    return res.status(200).json({ success: true, request: reqItem });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/leaves/:id/cancel (MED-4 FIX: Ownership check added)
exports.cancelLeave = async (req, res) => {
  try {
    const empId = getEmpId(req);

    // MED-4 FIX: Verify ownership before allowing cancellation
    const leaveRequest = await dbStore.getLeaveById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการใบลา' });
    }
    if (leaveRequest.employeeId !== empId && leaveRequest.employee_id !== empId) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์ยกเลิกใบลาของพนักงานคนอื่น (Forbidden)',
      });
    }

    const st = String(leaveRequest.status || '');
    if (st === 'ไม่อนุมัติ' || st === 'ยกเลิก') {
      return res.status(400).json({ success: false, message: `ไม่สามารถยกเลิกได้ เนื่องจากใบลานี้อยู่ในสถานะ "${st}" แล้ว` });
    }
    if (st === 'อนุมัติแล้ว' && leaveRequest.startDate && leaveRequest.startDate < todayIso()) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถยกเลิกใบลาที่อนุมัติแล้วและเริ่มลาไปแล้วได้ กรุณาติดต่อ HR' });
    }

    const updated = await dbStore.updateLeaveStatus(req.params.id, 'ยกเลิก', 'ยกเลิกโดยผู้ยื่น');
    return res.status(200).json({
      success: true,
      message: 'ยกเลิกคำขอใบลาเรียบร้อยแล้ว',
      request: updated,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
