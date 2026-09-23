const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

// POST /api/overtime
exports.createOtRequest = async (req, res) => {
  try {
    const { dateIso, startTime, endTime, hours, taskDescription } = req.body;
    const empId = getEmpId(req);

    if (!dateIso || !startTime || !endTime || !taskDescription) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลวันที่ เวลา และรายละเอียดงาน OT ให้ครบถ้วน',
      });
    }

    const otItem = await dbStore.addOtRequest({
      employeeId: empId,
      dateIso,
      startTime,
      endTime,
      hours: hours || 2,
      taskDescription,
    });

    return res.status(201).json({
      success: true,
      message: 'ยื่นคำขอทำงานล่วงเวลา (OT) เรียบร้อยแล้ว',
      request: otItem,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/overtime/my-requests
exports.getMyOtRequests = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const list = await dbStore.getOtRequests(empId);

    return res.status(200).json({
      success: true,
      total: list.length,
      requests: list,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/overtime/:id
exports.getOtById = async (req, res) => {
  try {
    const otItem = await dbStore.getOtById(req.params.id);
    if (!otItem) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการคำขอ OT' });
    }
    return res.status(200).json({ success: true, request: otItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/overtime/:id/cancel (MED-4 FIX: Ownership check added)
exports.cancelOt = async (req, res) => {
  try {
    const empId = getEmpId(req);

    // MED-4 FIX: Verify ownership before allowing cancellation
    const otRequest = await dbStore.getOtById(req.params.id);
    if (!otRequest) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการคำขอ OT' });
    }
    if (otRequest.employeeId !== empId && otRequest.employee_id !== empId) {
      return res.status(403).json({
        success: false,
        message: 'คุณไม่มีสิทธิ์ยกเลิกคำขอ OT ของพนักงานคนอื่น (Forbidden)',
      });
    }

    const updated = await dbStore.updateOtStatus(req.params.id, 'ยกเลิก', 'ยกเลิกโดยผู้ยื่น');
    return res.status(200).json({
      success: true,
      message: 'ยกเลิกคำขอ OT เรียบร้อยแล้ว',
      request: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/attendance/overtime (or /api/overtime)
exports.getAllOtRequests = async (req, res) => {
  try {
    const empId = req.query?.employeeId || null;
    const list = await dbStore.getOtRequests(empId);
    return res.status(200).json({
      success: true,
      total: list.length,
      overtime: list,
      requests: list,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
