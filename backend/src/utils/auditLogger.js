const db = require('../config/database');
const memoryStore = require('../stores/memoryStore');

/**
 * Enterprise Audit Trail Logger (PDPA / ISO 27001 Compliance)
 * Records who did what, when, and from where, without slowing down API responses.
 */

async function logAudit(req, { action, resourceType, resourceId, details = {} }) {
  const actorId = req?.user?.id || req?.user?.code || req?.user?.username || 'SYSTEM_OR_ANONYMOUS';
  const actorName = req?.user?.name || (req?.user?.role ? `${req.user.role} User` : 'Anonymous');
  const actorRole = req?.user?.role || 'Guest';
  
  const ipAddress =
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    '127.0.0.1';

  const userAgent = req?.headers?.['user-agent'] || 'Unknown Client';

  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    actorId,
    actorName,
    actorRole,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    details: details || {},
    ipAddress,
    userAgent,
    createdAt: new Date().toISOString(),
  };

  // Push to memory fallback
  memoryStore.memoryAuditLogs.unshift(auditEntry);
  if (memoryStore.memoryAuditLogs.length > 500) {
    memoryStore.memoryAuditLogs.pop();
  }

  // Persist to PostgreSQL asynchronously
  if (db.isPgConnected()) {
    try {
      await db.query(
        `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          auditEntry.id,
          auditEntry.actorId,
          auditEntry.actorName,
          auditEntry.actorRole,
          auditEntry.action,
          auditEntry.resourceType,
          auditEntry.resourceId,
          JSON.stringify(auditEntry.details),
          auditEntry.ipAddress,
          auditEntry.userAgent,
        ]
      );
    } catch (err) {
      console.error('Failed to persist audit log into PostgreSQL:', err.message);
    }
  }

  return auditEntry;
}

async function getAuditLogs({ limit = 50, offset = 0, actorId, action, resourceType } = {}) {
  if (db.isPgConnected()) {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (actorId) {
        params.push(actorId);
        query += ` AND actor_id = $${params.length}`;
      }
      if (action) {
        params.push(action);
        query += ` AND action = $${params.length}`;
      }
      if (resourceType) {
        params.push(resourceType);
        query += ` AND resource_type = $${params.length}`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), Number(offset));

      const res = await db.query(query, params);
      if (res.rows) {
        return res.rows.map((r) => ({
          id: r.id,
          actorId: r.actor_id,
          actorName: r.actor_name,
          actorRole: r.actor_role,
          action: r.action,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          details: r.details,
          ipAddress: r.ip_address,
          userAgent: r.user_agent,
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      console.error('Failed to query audit logs from PostgreSQL:', err.message);
    }
  }

  // Fallback to memory
  return memoryStore.memoryAuditLogs.filter((log) => {
    if (actorId && log.actorId !== actorId) return false;
    if (action && log.action !== action) return false;
    if (resourceType && log.resourceType !== resourceType) return false;
    return true;
  }).slice(offset, offset + limit);
}

module.exports = {
  logAudit,
  getAuditLogs,
};
