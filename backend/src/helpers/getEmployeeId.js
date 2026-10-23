/**
 * Shared helper: Extract employee/user ID from request
 * Used across all controllers to avoid duplicate getEmpId() functions
 */
const getEmployeeId = (req, fallback = null) => {
  // SECURITY: identity comes ONLY from the verified JWT.
  // x-employee-id header / query / body fallbacks were removed (IDOR).
  return req.user?.id || fallback;
};

module.exports = getEmployeeId;
