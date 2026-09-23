const dbStore = require('../services/dbStore');

// GET /api/hr/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await dbStore.getHrDashboardStats();
    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/hr/reports/attendance
exports.getAttendanceReport = async (req, res) => {
  try {
    const month = req.query.month;
    const report = await dbStore.getHrAttendanceReport(month);

    return res.status(200).json({
      success: true,
      month: month || 'ปัจจุบัน',
      totalRecords: report.length,
      report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
