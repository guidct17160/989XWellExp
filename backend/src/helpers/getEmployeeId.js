/**
 * Shared helper: Extract employee/user ID from request
 * Used across all controllers to avoid duplicate getEmpId() functions
 */
const getEmployeeId = (req, fallback = null) => {
  return (
    req.user?.id ||
    req.headers['x-employee-id'] ||
    req.query?.employeeId ||
    req.body?.employeeId ||
    fallback
  );
};

module.exports = getEmployeeId;
