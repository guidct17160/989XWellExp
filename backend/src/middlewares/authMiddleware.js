const { verifyAccessToken } = require('../utils/security');

/**
 * Extract and authenticate token from Authorization header.
 * Populates `req.user` if token is valid.
 * 
 * CRIT-5 FIX: Removed legacy x-employee-id header fallback.
 * Only properly signed JWT Bearer tokens are accepted.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  // CRIT-5 FIX: No more x-employee-id header fallback.
  // All API consumers must authenticate with a valid JWT token.
  // req.user will be null/undefined for unauthenticated requests.

  next();
};

/**
 * Strict requirement: user MUST be authenticated
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)',
    });
  }
  next();
};

const normRole = (role) => String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const ADMIN_ROLES = new Set(['admin', 'super admin', 'superadmin', 'hr admin', 'system admin', 'sys admin']);
const APPROVER_ROLES = new Set([...ADMIN_ROLES, 'hr', 'manager', 'boss', 'superboss', 'super boss', 'supervisor', 'head', 'ceo', 'director']);

const isAdminRole = (role) => ADMIN_ROLES.has(normRole(role));
const isApproverRole = (role) => APPROVER_ROLES.has(normRole(role));
// Super Admin = web-admin account management. 'SuperBoss' is an employee (mobile) approver role and
// must NOT be able to create / edit / delete admin accounts.
const isSuperAdminRole = (role) => {
  const norm = normRole(role);
  return norm === 'super admin' || norm === 'superadmin';
};

const makeRoleGuard = (check, label) => (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)',
    });
  }
  if (!check(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะ${label}เท่านั้น (Forbidden)`,
    });
  }
  next();
};

/**
 * Strict requirement: user MUST be an Administrator (exact role allow-list)
 */
const requireAdmin = makeRoleGuard(isAdminRole, 'ผู้ดูแลระบบ (Admin)');

/**
 * Strict requirement: user MUST be Super Admin (highest privilege)
 */
const requireSuperAdmin = makeRoleGuard(isSuperAdminRole, 'ผู้ดูแลระบบสูงสุด (Super Admin)');

/**
 * Strict requirement: user MUST be Admin/HR/Manager (approval & company-wide reports)
 */
const requireApprover = makeRoleGuard(isApproverRole, 'ผู้ดูแลระบบ/หัวหน้างาน');

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireApprover,
  isAdminRole,
  isSuperAdminRole,
  isApproverRole,
};


