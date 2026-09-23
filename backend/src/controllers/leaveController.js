const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

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
    return res.status(500).json({ success: false, message: error.message });
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

    const newRequest = await dbStore.addLeaveRequest({
      employeeId: empId,
      leaveType,
      startDate,
      endDate,
      totalDays: totalDays || 1,
      reason,
      attachmentUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'ยื่นใบลาเรียบร้อยแล้ว รอการอนุมัติจากหัวหน้างาน',
      request: newRequest,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/leaves/:id
exports.getLeaveById = async (req, res) => {
  try {
    const reqItem = await dbStore.getLeaveById(req.params.id);
    if (!reqItem) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการใบลา' });
    }
    return res.status(200).json({ success: true, request: reqItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    const updated = await dbStore.updateLeaveStatus(req.params.id, 'ยกเลิก', 'ยกเลิกโดยผู้ยื่น');
    return res.status(200).json({
      success: true,
      message: 'ยกเลิกคำขอใบลาเรียบร้อยแล้ว',
      request: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
