const crypto = require('crypto');
const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');

const newId = () => `loc-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

// Run fn inside a PostgreSQL transaction (rolls back on any thrown error)
const withTx = async (fn) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  address: r.address || '',
  latitude: Number(r.latitude),
  longitude: Number(r.longitude),
  radiusM: Number(r.radius_m),
  status: r.status,
  scope: r.scope,
  departmentIds: [],
  members: [],
  assignedCount: r.assigned_count === undefined ? undefined : Number(r.assigned_count),
});

// Number of employees who may use a location (shown in the admin list)
const ASSIGNED_COUNT_SQL = `
  CASE l.scope
    WHEN 'departments' THEN (SELECT COUNT(*) FROM employees e WHERE e.status = 'Active' AND e.department_id IN (SELECT department_id FROM work_location_departments d WHERE d.location_id = l.id))
    WHEN 'members' THEN (SELECT COUNT(*) FROM work_location_members m WHERE m.location_id = l.id)
    ELSE (SELECT COUNT(*) FROM employees e WHERE e.status = 'Active')
  END`;

const friendlyFkError = (e) => {
  if (e && e.code === '23503') return httpError(400, 'Some selected departments or employees no longer exist');
  return e;
};

const insertAssignments = async (client, locationId, data) => {
  if (data.scope === 'departments') {
    for (const departmentId of data.departmentIds) {
      await client.query('INSERT INTO work_location_departments (location_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [locationId, departmentId]);
    }
  }
  if (data.scope === 'members') {
    for (const employeeId of data.memberIds) {
      await client.query('INSERT INTO work_location_members (location_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [locationId, employeeId]);
    }
  }
};

module.exports = function createLocationStore() {
  const store = {
    // Admin list with assignment details
    getWorkLocations: async () => {
      if (!db.isPgConnected()) {
        return memoryStore.memoryWorkLocations.map((l) => ({ ...l }));
      }
      const res = await db.query(`SELECT l.*, ${ASSIGNED_COUNT_SQL} AS assigned_count FROM work_locations l ORDER BY l.created_at DESC`);
      const list = res.rows.map(mapRow);
      if (list.length === 0) return list;
      const ids = list.map((l) => l.id);
      const deps = await db.query('SELECT location_id, department_id FROM work_location_departments WHERE location_id = ANY($1)', [ids]);
      const mems = await db.query(
        `SELECT m.location_id, e.id, e.code, e.name FROM work_location_members m JOIN employees e ON e.id = m.employee_id WHERE m.location_id = ANY($1)`,
        [ids]
      );
      const byId = new Map(list.map((l) => [l.id, l]));
      deps.rows.forEach((d) => byId.get(d.location_id).departmentIds.push(d.department_id));
      mems.rows.forEach((m) => byId.get(m.location_id).members.push({ id: m.id, code: m.code, name: m.name }));
      return list;
    },

    createWorkLocation: async (data) => {
      const id = newId();
      if (!db.isPgConnected()) {
        const loc = { id, ...data, departmentIds: data.departmentIds || [], members: [], assignedCount: 0 };
        memoryStore.memoryWorkLocations.unshift(loc);
        return loc;
      }
      try {
        await withTx(async (client) => {
          await client.query(
            `INSERT INTO work_locations (id, name, type, address, latitude, longitude, radius_m, status, scope)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, data.name, data.type, data.address, data.latitude, data.longitude, data.radiusM, data.status, data.scope]
          );
          await insertAssignments(client, id, data);
        });
      } catch (e) {
        throw friendlyFkError(e);
      }
      return (await store.getWorkLocations()).find((l) => l.id === id);
    },

    updateWorkLocation: async (id, data) => {
      if (!db.isPgConnected()) {
        const idx = memoryStore.memoryWorkLocations.findIndex((l) => l.id === id);
        if (idx === -1) throw httpError(404, 'Work location not found');
        memoryStore.memoryWorkLocations[idx] = { ...memoryStore.memoryWorkLocations[idx], ...data };
        return memoryStore.memoryWorkLocations[idx];
      }
      try {
        await withTx(async (client) => {
          const upd = await client.query(
            `UPDATE work_locations SET name=$2, type=$3, address=$4, latitude=$5, longitude=$6, radius_m=$7, status=$8, scope=$9 WHERE id=$1`,
            [id, data.name, data.type, data.address, data.latitude, data.longitude, data.radiusM, data.status, data.scope]
          );
          if (upd.rowCount === 0) throw httpError(404, 'Work location not found');
          await client.query('DELETE FROM work_location_departments WHERE location_id = $1', [id]);
          await client.query('DELETE FROM work_location_members WHERE location_id = $1', [id]);
          await insertAssignments(client, id, data);
        });
      } catch (e) {
        throw friendlyFkError(e);
      }
      return (await store.getWorkLocations()).find((l) => l.id === id);
    },

    deleteWorkLocation: async (id) => {
      if (!db.isPgConnected()) {
        const before = memoryStore.memoryWorkLocations.length;
        memoryStore.memoryWorkLocations = memoryStore.memoryWorkLocations.filter((l) => l.id !== id);
        if (memoryStore.memoryWorkLocations.length === before) throw httpError(404, 'Work location not found');
        return true;
      }
      const res = await db.query('DELETE FROM work_locations WHERE id = $1', [id]);
      if (res.rowCount === 0) throw httpError(404, 'Work location not found');
      return true;
    },

    // How many active locations exist company-wide (0 = locations not set up yet, punches stay unrestricted)
    countActiveWorkLocations: async () => {
      if (!db.isPgConnected()) {
        return memoryStore.memoryWorkLocations.filter((l) => l.status === 'Active').length;
      }
      const res = await db.query(`SELECT COUNT(*) AS n FROM work_locations WHERE status = 'Active'`);
      return Number(res.rows[0].n) || 0;
    },

    // Active locations this employee is allowed to clock in / out at (for everyone, their department, or them personally)
    getAllowedWorkLocations: async (employeeId) => {
      if (!db.isPgConnected()) {
        return memoryStore.memoryWorkLocations.filter(
          (l) => l.status === 'Active' && (l.scope === 'all' || (l.members || []).some((m) => m.id === employeeId))
        );
      }
      const emp = await db.query('SELECT id FROM employees WHERE id = $1 OR code = $1 LIMIT 1', [employeeId]);
      const empId = emp.rows[0] ? emp.rows[0].id : employeeId;
      const res = await db.query(
        `SELECT l.* FROM work_locations l
         WHERE l.status = 'Active' AND (
           l.scope = 'all'
           OR (l.scope = 'departments' AND EXISTS (
                 SELECT 1 FROM work_location_departments d JOIN employees e ON e.department_id = d.department_id
                 WHERE d.location_id = l.id AND e.id = $1))
           OR (l.scope = 'members' AND EXISTS (
                 SELECT 1 FROM work_location_members m WHERE m.location_id = l.id AND m.employee_id = $1))
         )
         ORDER BY l.name`,
        [empId]
      );
      return res.rows.map(mapRow);
    },
  };
  return store;
};
