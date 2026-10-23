const dbStore = require('../services/dbStore');
const { send: sendError } = require('../utils/httpError');

// GET /api/leave-policies
exports.getLeavePolicies = async (req, res) => {
  try {
    const policies = await dbStore.getLeavePolicies();
    return res.status(200).json({
      success: true,
      total: policies.length,
      policies,
    });
  } catch (error) {
    console.error('Error fetching leave policies:', error);
    return sendError(res, error);
  }
};

// POST /api/leave-policies
exports.createLeavePolicy = async (req, res) => {
  try {
    const {
      id,
      typeName,
      categoryKey,
      defaultQuota,
      isPaid,
      applicableGender,
      requireAttachment,
      description,
      status,
    } = req.body;

    if (!typeName) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อประเภทการลา (typeName)',
      });
    }

    // Use the Policy ID typed in the form (e.g. LP-07). Without one the store generates an id.
    // The store saves with "insert or overwrite", so an id that already exists must be refused here.
    const policyId = id ? String(id).trim() : '';
    if (policyId) {
      if (!/^[A-Za-z0-9_-]{1,30}$/.test(policyId)) {
        return res.status(400).json({
          success: false,
          message: 'Policy ID ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข - และ _ (ไม่เกิน 30 ตัว)',
        });
      }
      const existing = await dbStore.getLeavePolicies();
      if (existing.some((p) => String(p.id).toLowerCase() === policyId.toLowerCase())) {
        return res.status(409).json({
          success: false,
          message: `Policy ID "${policyId}" มีอยู่แล้ว กรุณาใช้รหัสอื่น`,
        });
      }
    }

    const newPolicy = await dbStore.addLeavePolicy({
      id: policyId || undefined,
      typeName,
      categoryKey: categoryKey || undefined, // the store falls back to the policy id
      defaultQuota: defaultQuota !== undefined ? parseInt(defaultQuota, 10) : 10,
      isPaid: isPaid !== undefined ? isPaid : true,
      applicableGender: applicableGender || 'all',
      requireAttachment: !!requireAttachment,
      description: description || '',
      status: status || 'Active',
    });

    return res.status(201).json({
      success: true,
      message: 'สร้างนโยบายการลาใหม่สำเร็จ',
      policy: newPolicy,
    });
  } catch (error) {
    console.error('Error creating leave policy:', error);
    return sendError(res, error);
  }
};

// PUT /api/leave-policies/:id
exports.updateLeavePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dbStore.updateLeavePolicy(id, req.body);

    return res.status(200).json({
      success: true,
      message: 'บันทึกการตั้งค่านโยบายการลาสำเร็จ',
      policy: updated,
    });
  } catch (error) {
    console.error('Error updating leave policy:', error);
    return sendError(res, error);
  }
};

// DELETE /api/leave-policies/:id
exports.deleteLeavePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    await dbStore.deleteLeavePolicy(id);

    return res.status(200).json({
      success: true,
      message: 'ลบนโยบายการลาเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error deleting leave policy:', error);
    return sendError(res, error);
  }
};
