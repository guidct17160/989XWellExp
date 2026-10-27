const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');
const getEmpId = require('../helpers/getEmployeeId');
const { todayIso } = require('../utils/time');
const { verifyPunchLocation } = require('./workLocationController');
const { logAudit } = require('../utils/auditLogger');

// POST /api/attendance/clock-in
exports.clockIn = async (req, res) => {
  try {
    const { latitude, longitude, locationName, locationId, photoUrl } = req.body;
    const empId = getEmpId(req);

    // When work locations are set up, the punch must be made inside the chosen location's radius
    const verified = await verifyPunchLocation(empId, { locationId, latitude, longitude });

    const result = await dbStore.addClockIn({
      employeeId: empId,
      latitude,
      longitude,
      locationName: verified ? verified.name : locationName,
      locationId: verified ? verified.id : null,
      photoUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'บันทึกเวลาเข้างานสำเร็จเรียบร้อยแล้ว',
      attendance: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/attendance/clock-out
exports.clockOut = async (req, res) => {
  try {
    const { latitude, longitude, locationName, locationId } = req.body;
    const empId = getEmpId(req);

    const verified = await verifyPunchLocation(empId, { locationId, latitude, longitude });

    const result = await dbStore.addClockOut({
      employeeId: empId,
      latitude,
      longitude,
      locationName: verified ? verified.name : locationName,
    });

    return res.status(200).json({
      success: true,
      message: 'บันทึกเวลาออกงานสำเร็จเรียบร้อยแล้ว',
      attendance: result,
      pointsAwarded: result.pointsAwarded || 0, // bonus for on-time check-in + full hours (0 otherwise / switched off)
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/attendance/today
exports.getTodayStatus = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const todayData = await dbStore.getTodayAttendance(empId);

    return res.status(200).json({
      success: true,
      attendance: todayData,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/attendance/history
exports.getHistory = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const month = req.query.month;
    const history = await dbStore.getAttendanceHistory(empId, month);

    return res.status(200).json({
      success: true,
      total: history.length,
      history,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/attendance/summary
exports.getSummary = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const summary = await dbStore.getAttendanceSummary(empId);

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/attendance/corrections
exports.addCorrection = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const { dateIso, oldCheckIn, newCheckIn, oldCheckOut, newCheckOut, reason } = req.body;

    const day = dateIso || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)) || Number.isNaN(Date.parse(day))) {
      return res.status(400).json({ success: false, message: 'รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' });
    }
    if (day > todayIso()) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถขอปรับปรุงเวลาของวันที่ในอนาคตได้' });
    }
    const hasTime = (v) => v && String(v).trim() !== '' && String(v).trim() !== '-';
    if (!hasTime(newCheckIn) && !hasTime(newCheckOut)) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุเวลาเข้างานหรือเวลาออกงานที่ต้องการแก้ไข' });
    }
    if ((hasTime(newCheckIn) && !/\d{1,2}:\d{2}/.test(String(newCheckIn))) || (hasTime(newCheckOut) && !/\d{1,2}:\d{2}/.test(String(newCheckOut)))) {
      return res.status(400).json({ success: false, message: 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)' });
    }

    const result = await dbStore.addTimeCorrection({
      employeeId: empId,
      dateIso: day,
      oldCheckIn: oldCheckIn || '-',
      newCheckIn: hasTime(newCheckIn) ? newCheckIn : '-',
      oldCheckOut: oldCheckOut || '-',
      newCheckOut: hasTime(newCheckOut) ? newCheckOut : '-',
      reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
    });

    const approvedNow = result && result.status === 'อนุมัติแล้ว';
    if (approvedNow) {
      // a SuperBoss correction is approved by the system, so the audit trail records it
      logAudit(req, { action: 'APPROVE_REQUEST', resourceType: 'time-correction', resourceId: result.id, details: { approver: req.user?.name, approverRole: req.user?.role, status: 'อนุมัติแล้ว', remark: 'SuperBoss: no approval needed' } }).catch(() => {});
    }
    return res.status(201).json({
      success: true,
      message: approvedNow ? 'ปรับปรุงเวลาเรียบร้อยแล้ว (SuperBoss ไม่ต้องรออนุมัติ)' : 'ยื่นคำขอปรับปรุงเวลาเรียบร้อยแล้ว รอการอนุมัติ',
      correction: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/attendance/corrections/my-requests
exports.getMyCorrections = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const list = await dbStore.getTimeCorrectionRequests(empId);

    return res.status(200).json({
      success: true,
      total: list.length,
      corrections: list,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/attendance/corrections (Admin / Overview)
exports.getCorrections = async (req, res) => {
  try {
    const empId = req.query?.employeeId || null;
    const list = await dbStore.getTimeCorrectionRequests(empId);

    return res.status(200).json({
      success: true,
      total: list.length,
      corrections: list,
    });
  } catch (error) {
    return sendError(res, error);
  }
};


