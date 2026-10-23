const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ============================================================
// Departments
// ============================================================
exports.getDepartments = async (req, res) => {
  try {
    const departments = await dbStore.getDepartments();
    res.json({ success: true, departments });
  } catch (error) {
    sendError(res, error);
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Department name is required' });

    const existing = await dbStore.getDepartments();
    if (existing.some((d) => sameName(d.name, name))) {
      return res.status(409).json({ success: false, message: `มีแผนก "${String(name).trim()}" อยู่ในระบบแล้ว` });
    }

    // never trust a client-supplied id on create (it would overwrite an existing department)
    const { id: _ignoredId, ...body } = req.body;
    const dept = await dbStore.addDepartment(body);
    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    sendError(res, error);
  }
};

// updateDepartment merges the request onto the STORED department so a partial update
// (e.g. only { manager }) does not reset code / name / status to defaults.
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = (await dbStore.getDepartments()).find((d) => d.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบแผนกที่ต้องการแก้ไข' });
    }
    if (req.body.name && !sameName(req.body.name, existing.name)) {
      const all = await dbStore.getDepartments();
      if (all.some((d) => d.id !== id && sameName(d.name, req.body.name))) {
        return res.status(409).json({ success: false, message: `มีแผนก "${String(req.body.name).trim()}" อยู่ในระบบแล้ว` });
      }
    }
    const dept = await dbStore.addDepartment({
      code: existing.code,
      name: existing.name,
      status: existing.status,
      ...req.body,
      id,
    });
    res.json({ success: true, message: 'อัปเดตแผนกเรียบร้อยแล้ว', department: dept });
  } catch (error) {
    sendError(res, error);
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const all = await dbStore.getDepartments();
    const dept = all.find((d) => d.id === req.params.id || d.code === req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'ไม่พบแผนกที่ต้องการลบ' });
    }
    if ((dept.employeeCount || 0) > 0) {
      return res.status(409).json({
        success: false,
        message: `ไม่สามารถลบแผนก "${dept.name}" ได้ เนื่องจากยังมีพนักงาน ${dept.employeeCount} คนอยู่ในแผนกนี้ กรุณาย้ายพนักงานก่อน`,
      });
    }
    await dbStore.deleteDepartment(dept.id);
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    sendError(res, error);
  }
};

