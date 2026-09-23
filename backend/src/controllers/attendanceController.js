const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

// POST /api/attendance/clock-in
exports.clockIn = async (req, res) => {
  try {
    const { latitude, longitude, locationName, photoUrl } = req.body;
    const empId = getEmpId(req);

    const result = await dbStore.addClockIn({
      employeeId: empId,
      latitude,
      longitude,
      locationName,
      photoUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'บันทึกเวลาเข้างานสำเร็จเรียบร้อยแล้ว',
      attendance: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance/clock-out
exports.clockOut = async (req, res) => {
  try {
    const { latitude, longitude, locationName } = req.body;
    const empId = getEmpId(req);

    const result = await dbStore.addClockOut({
      employeeId: empId,
      latitude,
      longitude,
      locationName,
    });

    return res.status(200).json({
      success: true,
      message: 'บันทึกเวลาออกงานสำเร็จเรียบร้อยแล้ว',
      attendance: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/attendance/corrections
exports.addCorrection = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const { dateIso, oldCheckIn, newCheckIn, oldCheckOut, newCheckOut, reason } = req.body;

    const result = await dbStore.addTimeCorrection({
      employeeId: empId,
      dateIso: dateIso || new Date().toISOString().split('T')[0],
      oldCheckIn: oldCheckIn || '-',
      newCheckIn: newCheckIn || '08:00',
      oldCheckOut: oldCheckOut || '-',
      newCheckOut: newCheckOut || '17:00',
      reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
    });

    return res.status(201).json({
      success: true,
      message: 'ยื่นคำขอปรับปรุงเวลาเรียบร้อยแล้ว รอการอนุมัติ',
      correction: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};


