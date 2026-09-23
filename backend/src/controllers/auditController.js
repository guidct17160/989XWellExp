const { getAuditLogs } = require('../utils/auditLogger');

exports.getLogs = async (req, res) => {
  try {
    const { limit, offset, actorId, action, resourceType } = req.query;
    const logs = await getAuditLogs({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      actorId,
      action,
      resourceType,
    });
    res.json({ success: true, count: logs.length, data: logs, logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Audit Logs' });
  }
};
