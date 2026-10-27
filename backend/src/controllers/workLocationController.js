const dbStore = require('../services/dbStore');
const httpError = require('../utils/httpError');
const { send: sendError } = httpError;
const getEmpId = require('../helpers/getEmployeeId');
const { distanceMeters } = require('../utils/geo');
const { logAudit } = require('../utils/auditLogger');

const TYPES = ['Office', 'WFH', 'Site', 'Other'];
const SCOPES = ['all', 'departments', 'members'];
const STATUSES = ['Active', 'Inactive'];

// Validate and normalise the body of create / update (400 on anything wrong)
const cleanLocation = (body = {}) => {
  const name = String(body.name || '').trim();
  if (!name) throw httpError(400, 'Location name is required');
  if (name.length > 100) throw httpError(400, 'Location name is too long (max 100 characters)');

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (body.latitude === '' || body.latitude == null || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw httpError(400, 'Latitude must be a number between -90 and 90');
  }
  if (body.longitude === '' || body.longitude == null || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw httpError(400, 'Longitude must be a number between -180 and 180');
  }

  const radiusM = Math.round(Number(body.radiusM));
  if (!Number.isFinite(radiusM) || radiusM < 20 || radiusM > 5000) {
    throw httpError(400, 'Radius must be between 20 and 5,000 metres');
  }

  const type = TYPES.includes(body.type) ? body.type : 'Office';
  const status = STATUSES.includes(body.status) ? body.status : 'Active';
  const scope = SCOPES.includes(body.scope) ? body.scope : 'all';
  const ids = (v) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x)).filter(Boolean))] : []);
  const departmentIds = scope === 'departments' ? ids(body.departmentIds) : [];
  const memberIds = scope === 'members' ? ids(body.memberIds) : [];
  if (scope === 'departments' && departmentIds.length === 0) throw httpError(400, 'Select at least one department');
  if (scope === 'members' && memberIds.length === 0) throw httpError(400, 'Select at least one employee');

  return {
    name,
    type,
    address: String(body.address || '').trim().slice(0, 500),
    latitude,
    longitude,
    radiusM,
    status,
    scope,
    departmentIds,
    memberIds,
  };
};

// ---- Admin (web) -------------------------------------------------------

// GET /api/work-locations
exports.getWorkLocations = async (req, res) => {
  try {
    const locations = await dbStore.getWorkLocations();
    return res.status(200).json({ success: true, locations });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/work-locations
exports.createWorkLocation = async (req, res) => {
  try {
    const location = await dbStore.createWorkLocation(cleanLocation(req.body));
    logAudit(req, { action: 'CREATE_WORK_LOCATION', resourceType: 'work_location', resourceId: location.id, details: { name: location.name } }).catch(() => {});
    return res.status(201).json({ success: true, message: 'Work location created', location });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/work-locations/:id
exports.updateWorkLocation = async (req, res) => {
  try {
    const location = await dbStore.updateWorkLocation(req.params.id, cleanLocation(req.body));
    logAudit(req, { action: 'UPDATE_WORK_LOCATION', resourceType: 'work_location', resourceId: req.params.id, details: { name: location.name } }).catch(() => {});
    return res.status(200).json({ success: true, message: 'Work location updated', location });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/work-locations/:id
exports.deleteWorkLocation = async (req, res) => {
  try {
    await dbStore.deleteWorkLocation(req.params.id);
    logAudit(req, { action: 'DELETE_WORK_LOCATION', resourceType: 'work_location', resourceId: req.params.id }).catch(() => {});
    return res.status(200).json({ success: true, message: 'Work location deleted' });
  } catch (error) {
    return sendError(res, error);
  }
};

// ---- Employee (app) ----------------------------------------------------

// GET /api/attendance/locations?latitude=..&longitude=..
// The work locations this employee may clock in / out at, nearest first. `required` is false while no
// location has been set up yet, so punches stay unrestricted until an Admin creates the first one.
exports.getMyWorkLocations = async (req, res) => {
  try {
    const empId = getEmpId(req);
    const lat = Number(req.query.latitude);
    const lng = Number(req.query.longitude);
    const hasPosition = req.query.latitude !== undefined && req.query.longitude !== undefined && Number.isFinite(lat) && Number.isFinite(lng);

    const required = (await dbStore.countActiveWorkLocations()) > 0;
    const allowed = required ? await dbStore.getAllowedWorkLocations(empId) : [];

    const locations = allowed
      .map((l) => {
        const distanceM = hasPosition ? Math.round(distanceMeters(lat, lng, l.latitude, l.longitude)) : null;
        return {
          id: l.id,
          name: l.name,
          type: l.type,
          address: l.address,
          latitude: l.latitude,
          longitude: l.longitude,
          radiusM: l.radiusM,
          distanceM,
          inRange: distanceM !== null && distanceM <= l.radiusM,
        };
      })
      .sort((a, b) => (a.distanceM === null ? 1 : b.distanceM === null ? -1 : a.distanceM - b.distanceM));

    return res.status(200).json({ success: true, required, locations });
  } catch (error) {
    return sendError(res, error);
  }
};

// Used by clock-in / clock-out. Returns the verified location. Punching needs a work location the employee is inside of,
// so while HR has not set up any location nobody can clock in / out.
// Distance is recomputed here from the coordinates the phone sent, never trusted from the app.
exports.verifyPunchLocation = async (empId, { locationId, latitude, longitude }) => {
  if ((await dbStore.countActiveWorkLocations()) === 0) {
    throw httpError(403, 'ยังไม่ได้กำหนดสถานที่ทำงาน ไม่สามารถลงเวลาได้ กรุณาติดต่อ HR');
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!locationId) throw httpError(400, 'กรุณาเลือกสถานที่ลงเวลา');
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw httpError(400, 'ไม่พบตำแหน่งของคุณ กรุณาเปิดตำแหน่ง (GPS) แล้วลองใหม่อีกครั้ง');
  }

  const allowed = await dbStore.getAllowedWorkLocations(empId);
  if (allowed.length === 0) {
    throw httpError(403, 'ยังไม่มีสถานที่ทำงานที่คุณลงเวลาได้ กรุณาติดต่อ HR');
  }
  const location = allowed.find((l) => l.id === locationId);
  if (!location) throw httpError(403, 'คุณไม่มีสิทธิ์ลงเวลาที่สถานที่นี้');

  const distanceM = Math.round(distanceMeters(lat, lng, location.latitude, location.longitude));
  if (distanceM > location.radiusM) {
    throw httpError(403, `คุณอยู่นอกพื้นที่ "${location.name}" (ห่าง ${distanceM} ม. อนุญาตภายใน ${location.radiusM} ม.) กรุณาเดินทางไปยังสถานที่ก่อนลงเวลา`);
  }
  return { ...location, distanceM };
};
