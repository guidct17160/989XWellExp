const dbStore = require('../services/dbStore');
const getEmpId = require('../helpers/getEmployeeId');

// GET /api/payslips
exports.getPayslips = async (req, res) => {
  try {
    const isHrOrAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin' || req.user?.role === 'HR Admin' || req.headers['x-employee-id']?.startsWith('ADM');
    const empId = req.query.employeeId || (isHrOrAdmin ? null : getEmpId(req));
    const year = req.query.year || null;
    const list = await dbStore.getPayslips(empId, year);

    return res.status(200).json({
      success: true,
      total: list.length,
      payslips: list,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payslips/my-payslips
exports.getMyPayslips = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const payslips = await dbStore.getPayslips(empId, req.query.year);
    return res.status(200).json({ success: true, payslips });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/payslips/generate
exports.generatePayslip = async (req, res) => {
  try {
    const payslip = await dbStore.generatePayslip(req.body);
    return res.status(201).json({ success: true, payslip });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payslips/:id
exports.getPayslipById = async (req, res) => {
  try {
    const payslip = await dbStore.getPayslipById(req.params.id);
    if (!payslip) {
      return res.status(404).json({ success: false, message: 'ไม่พบสลิปเงินเดือน' });
    }
    return res.status(200).json({ success: true, payslip });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
