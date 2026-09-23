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

/**
 * Strict requirement: user MUST be an Administrator
 * 
 * CRIT-4 FIX: Removed `req.user.portal === 'web'` check.
 * Admin status is now determined solely by the user's role field.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ (Unauthorized)',
    });
  }

  const role = String(req.user.role || '').toLowerCase();
  // CRIT-4 FIX: Only role-based admin check. Portal field is NOT used for authorization.
  const isAdmin = role.includes('admin') || role === 'superadmin' || role === 'super admin';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น (Forbidden)',
    });
  }

  next();
};

module.exports = {
  authenticate,
  requireAuth,
  requireAdmin,
};

