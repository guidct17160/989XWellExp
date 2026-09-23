const dbStore = require('../services/dbStore');

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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/leave-policies
exports.createLeavePolicy = async (req, res) => {
  try {
    const {
      typeName,
      categoryKey,
      defaultQuota,
      isPaid,
      applicableGender,
      allowedStartDate,
      allowedEndDate,
      dateRangeEnabled,
      minAdvanceDays,
      maxConsecutiveDays,
      allowBackdated,
      maxBackdatedDays,
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

    const newPolicy = await dbStore.addLeavePolicy({
      typeName,
      categoryKey: categoryKey || 'custom',
      defaultQuota: defaultQuota !== undefined ? parseInt(defaultQuota, 10) : 10,
      isPaid: isPaid !== undefined ? isPaid : true,
      applicableGender: applicableGender || 'all',
      allowedStartDate: allowedStartDate || null,
      allowedEndDate: allowedEndDate || null,
      dateRangeEnabled: !!dateRangeEnabled,
      minAdvanceDays: minAdvanceDays !== undefined ? parseInt(minAdvanceDays, 10) : 0,
      maxConsecutiveDays: maxConsecutiveDays !== undefined ? parseInt(maxConsecutiveDays, 10) : 30,
      allowBackdated: !!allowBackdated,
      maxBackdatedDays: maxBackdatedDays !== undefined ? parseInt(maxBackdatedDays, 10) : 0,
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
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
    return res.status(500).json({ success: false, message: error.message });
  }
};
