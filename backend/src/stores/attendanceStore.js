const db = require('../config/database');
const memoryStore = require('./memoryStore');

module.exports = function createAttendanceStore(storeRef) {
  const store = {
    // ATTENDANCE
    addClockIn: async ({ employeeId, latitude, longitude, locationName, photoUrl }) => {
      const today = new Date().toISOString().split('T')[0];
      const nowObj = new Date();
      const nowTime = nowObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

      // Work Schedule: 08:00 - 17:00 (9 hours/day). Must check in before 09:00 AM.
      // If checking in after 09:00:00 (hour > 9 or (hour === 9 && minute > 0)), status is 'สาย'
      const h = nowObj.getHours();
      const m = nowObj.getMinutes();
      const isLate = h > 9 || (h === 9 && m > 0);

      // Geofence: Read from system settings, fallback to default Bangkok office
      let targetLat = 13.7563;
      let targetLng = 100.5018;
      let geofenceRadius = 0.005;
      try {
        const settings = await (storeRef ? storeRef.getSettings() : null);
        if (settings) {
          if (settings.geofenceLatitude) targetLat = Number(settings.geofenceLatitude);
          if (settings.geofenceLongitude) targetLng = Number(settings.geofenceLongitude);
          if (settings.geofenceRadius) geofenceRadius = Number(settings.geofenceRadius);
        }
      } catch (e) { /* use defaults */ }

      const currentLat = latitude || targetLat;
      const currentLng = longitude || targetLng;

      const latDiff = Math.abs(currentLat - targetLat);
      const lngDiff = Math.abs(currentLng - targetLng);
      const isOutRange = latDiff > geofenceRadius || lngDiff > geofenceRadius;

      const newAtt = {
        id: `att-${Date.now()}`,
        employeeId,
        dateIso: today,
        checkIn: nowTime,
        checkOut: null,
        duration: '00:00:00 ชม.',
        status: isLate ? 'สาย' : 'ปกติ',
        statusColor: isLate ? '#EF4444' : '#10B981',
        latitude: currentLat,
        longitude: currentLng,
        isOutRange,
        locationName: (locationName || 'อาคารสำนักงาน WellX989') + (isOutRange ? ' ⚠️ [นอกพื้นที่ Geofence]' : ' 🟢 [ในพื้นที่ Geofence]'),
        photoUrl: photoUrl || null,
      };
      memoryStore.memoryAttendance.unshift(newAtt);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color, latitude, longitude, location_name, photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET check_in = EXCLUDED.check_in, status = EXCLUDED.status, status_color = EXCLUDED.status_color`,
            [newAtt.id, newAtt.employeeId, newAtt.dateIso, newAtt.checkIn, newAtt.checkOut, newAtt.duration, newAtt.status, newAtt.statusColor, newAtt.latitude, newAtt.longitude, newAtt.locationName, newAtt.photoUrl]
          );
        } catch (e) {
          console.error('PG insert error in addClockIn:', e);
        }
      }

      return newAtt;
    },

    addClockOut: async ({ employeeId }) => {
      const today = new Date().toISOString().split('T')[0];
      const nowObj = new Date();
      const nowTime = nowObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

      // Helper: calculate real duration from checkIn string to now
      const calcDuration = (checkInStr) => {
        if (!checkInStr) return '00:00:00 ชม.';
        const match = checkInStr.match(/(\d{1,2}):(\d{2})/);
        if (!match) return '00:00:00 ชม.';
        const ciH = parseInt(match[1], 10);
        const ciM = parseInt(match[2], 10);
        const diffMs = nowObj.getTime() - new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate(), ciH, ciM).getTime();
        if (diffMs <= 0) return '00:00:00 ชม.';
        const totalSec = Math.floor(diffMs / 1000);
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss} ชม.`;
      };

      // 1. Try memory first
      let found = memoryStore.memoryAttendance.find((a) => a.employeeId === employeeId && a.dateIso === today);

      // 2. If not in memory, query PostgreSQL
      if (!found && db.isPgConnected()) {
        try {
          const res = await db.query(
            'SELECT * FROM attendance WHERE employee_id = $1 AND date_iso = $2 ORDER BY created_at DESC LIMIT 1',
            [employeeId, today]
          );
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            found = {
              id: r.id,
              employeeId: r.employee_id,
              dateIso: r.date_iso,
              checkIn: r.check_in,
              checkOut: r.check_out,
              duration: r.duration,
              status: r.status,
              statusColor: r.status_color,
              latitude: r.latitude,
              longitude: r.longitude,
              locationName: r.location_name,
              photoUrl: r.photo_url,
            };
            memoryStore.memoryAttendance.unshift(found);
          }
        } catch (e) {
          console.error('PG query error in addClockOut lookup:', e);
        }
      }

      if (found) {
        found.checkOut = nowTime;
        found.duration = calcDuration(found.checkIn);
        if (db.isPgConnected()) {
          try {
            await db.query('UPDATE attendance SET check_out = $1, duration = $2 WHERE id = $3', [nowTime, found.duration, found.id]);
          } catch (e) {
            console.error('PG update error in addClockOut:', e);
          }
        }
        return found;
      }

      // Fallback: create a new record if no check-in found
      const newAtt = {
        id: `att-${Date.now()}`,
        employeeId,
        dateIso: today,
        checkIn: '08:00 น.',
        checkOut: nowTime,
        duration: calcDuration('08:00'),
        status: 'ปกติ',
        statusColor: '#10B981',
      };
      memoryStore.memoryAttendance.unshift(newAtt);
      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [newAtt.id, newAtt.employeeId, newAtt.dateIso, newAtt.checkIn, newAtt.checkOut, newAtt.duration, newAtt.status, newAtt.statusColor]
          );
        } catch (e) {
          console.error('PG insert error in addClockOut:', e);
        }
      }
      return newAtt;
    },

    checkAutoClockOutMidnight: (employeeId) => {
      const today = new Date().toISOString().split('T')[0];
      memoryStore.memoryAttendance.forEach((a) => {
        if (a.employeeId === employeeId && a.dateIso < today && (!a.checkOut || a.checkOut === 'กำลังทำงาน...')) {
          a.checkOut = '23:59 น.';
          a.status = 'ไม่ลงเวลาออกงาน (ระบบตัดออกงานอัตโนมัติตอนเที่ยงคืน)';
          a.statusColor = '#EF4444';
          a.isIncomplete = true;
        }
      });
    },

    getTodayAttendance: async (employeeId) => {
      (storeRef ? storeRef.checkAutoClockOutMidnight : store.checkAutoClockOutMidnight)(employeeId);
      const today = new Date().toISOString().split('T')[0];
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            'SELECT * FROM attendance WHERE (employee_id = $1) AND date_iso = $2 ORDER BY created_at DESC LIMIT 1',
            [employeeId, today]
          );
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              employeeId: r.employee_id,
              dateIso: r.date_iso,
              checkIn: r.check_in,
              checkOut: r.check_out,
              duration: r.duration,
              status: r.status,
              statusColor: r.status_color,
              latitude: r.latitude,
              longitude: r.longitude,
              locationName: r.location_name,
              photoUrl: r.photo_url,
            };
          }
        } catch (e) {
          console.error('PG query error in getTodayAttendance:', e);
        }
      }
      const found = memoryStore.memoryAttendance.find((a) => a.employeeId === employeeId && a.dateIso === today);
      return found || { employeeId, dateIso: today, checkIn: null, checkOut: null, status: 'ยังไม่ได้ลงเวลา' };
    },

    getAttendanceHistory: async (employeeId, month) => {
      if (!employeeId) return [];
      (storeRef ? storeRef.checkAutoClockOutMidnight : store.checkAutoClockOutMidnight)(employeeId);
      if (db.isPgConnected()) {
        try {
          let query = 'SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date_iso DESC';
          const params = [employeeId];
          if (month) {
            query = 'SELECT * FROM attendance WHERE employee_id = $1 AND date_iso LIKE $2 ORDER BY date_iso DESC';
            params.push(`${month}%`);
          }
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              dateIso: r.date_iso,
              checkIn: r.check_in,
              checkOut: r.check_out,
              duration: r.duration,
              status: r.status,
              statusColor: r.status_color,
              latitude: r.latitude,
              longitude: r.longitude,
              locationName: r.location_name,
              photoUrl: r.photo_url,
            }));
          }
        } catch (e) {
          console.error('PG query error in getAttendanceHistory:', e);
        }
      }
      return memoryStore.memoryAttendance.filter((a) => a.employeeId === employeeId);
    },

    getAttendanceSummary: async (employeeId) => {
      const history = await (storeRef ? storeRef.getAttendanceHistory : store.getAttendanceHistory)(employeeId);
      const onTime = history.filter((a) => a.status === 'ปกติ').length;
      const late = history.filter((a) => a.status === 'สาย' || a.status === 'เข้างานสาย').length;
      const incomplete = history.filter((a) => a.status && a.status.includes('ไม่ลงเวลา')).length;
      return {
        totalWorkDays: history.length,
        onTimeDays: onTime,
        lateDays: late,
        absentDays: incomplete,
        totalHours: `${history.length * 8} ชม.`,
      };
    },

    // OVERTIME
    addOtRequest: async (data) => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];

      const requester = allUsers.find((e) => e.id === data.employeeId || e.code === data.employeeId || e.email === data.employeeId) || {
        id: data.employeeId || 'EMP-UNKNOWN',
        name: 'พนักงาน',
        role: 'Employee',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      };

      const isBoss = requester.role === 'Boss' || requester.role === 'Manager' || requester.role === 'HR Admin';
      const isSuperBoss = requester.role === 'SuperBoss' || requester.role === 'Super Admin' || requester.role === 'CEO';
      const requesterDept = (requester.department || '').trim().toLowerCase();

      // 1. Find direct manager (Boss) in the EXACT same department
      let directManager = allUsers.find(
        (u) =>
          (u.role === 'Boss' || u.role === 'Manager') &&
          u.department &&
          u.department.trim().toLowerCase() === requesterDept &&
          u.id !== requester.id &&
          u.code !== requester.code
      );

      let superboss = allUsers.find(
        (u) =>
          (u.role === 'SuperBoss' || u.role === 'Super Admin' || u.role === 'CEO') &&
          u.id !== requester.id &&
          u.code !== requester.code
      ) || { id: 'ADM-001', name: 'สมชาย ใจดี (CEO / SuperBoss)', role: 'SuperBoss' };

      const hasDeptBoss = !!directManager;
      const initialLevel = (isBoss || isSuperBoss || !hasDeptBoss) ? 2 : 1;
      const initialStatus = (isBoss || isSuperBoss || !hasDeptBoss)
        ? 'รออนุมัติระดับ 2 (Superboss)'
        : 'รออนุมัติระดับ 1 (Boss)';
      const targetApprover = (isBoss || isSuperBoss || !hasDeptBoss) ? superboss : directManager;

      const newOt = {
        id: `ot-${Date.now()}`,
        employeeId: requester.id,
        employeeName: requester.name,
        employeeCode: requester.code || requester.id,
        department: requester.department,
        requesterRole: requester.role,
        dateIso: data.dateIso,
        startTime: data.startTime,
        endTime: data.endTime,
        hours: data.hours || 2,
        taskDescription: data.taskDescription,
        status: initialStatus,
        approvalLevel: initialLevel,
        currentApproverId: targetApprover ? targetApprover.id : null,
        currentApproverName: targetApprover ? targetApprover.name : null,
        directManagerId: directManager ? directManager.id : null,
        superbossId: superboss.id,
        createdAt: new Date().toISOString().split('T')[0],
      };

      memoryStore.memoryOt.unshift(newOt);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO ot_requests (id, employee_id, date_iso, start_time, end_time, hours, task_description, status, approver, remark)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [newOt.id, newOt.employeeId, newOt.dateIso, newOt.startTime, newOt.endTime, newOt.hours, newOt.taskDescription, newOt.status, null, null]
          );
        } catch (e) {
          console.error('PG insert error in addOtRequest:', e);
        }
      }

      if (targetApprover) {
        memoryStore.memoryNotifications.unshift({
          id: `notif-${Date.now()}`,
          employeeId: targetApprover.id,
          title: `📩 คำขอ OT ใหม่จาก ${requester.name}`,
          message: `คุณได้รับการแจ้งเตือนคำขอ OT (${data.hours || 2} ชม.) จาก ${requester.name} (${requester.department}) รอการอนุมัติระดับ ${initialLevel}`,
          type: 'warning',
          isRead: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
      }

      return newOt;
    },

    getOtRequests: async (employeeId = null) => {
      if (db.isPgConnected()) {
        try {
          const query = employeeId
            ? `SELECT ot.*, COALESCE(e.name, ot.employee_id) as "employeeName"
               FROM ot_requests ot
               LEFT JOIN employees e ON ot.employee_id = e.id OR ot.employee_id = e.code
               WHERE ot.employee_id = $1 OR e.id = $1 OR e.code = $1 OR e.email = $1
               ORDER BY ot.created_at DESC`
            : `SELECT ot.*, COALESCE(e.name, ot.employee_id) as "employeeName"
               FROM ot_requests ot
               LEFT JOIN employees e ON ot.employee_id = e.id OR ot.employee_id = e.code
               ORDER BY ot.created_at DESC`;
          const params = employeeId ? [employeeId] : [];
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              dateIso: r.date_iso,
              startTime: r.start_time,
              endTime: r.end_time,
              hours: Number(r.hours || 1),
              taskDescription: r.task_description,
              reason: r.task_description,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in getOtRequests:', e);
        }
      }
      if (employeeId) {
        return memoryStore.memoryOt.filter((o) => o.employeeId === employeeId || o.employeeCode === employeeId);
      }
      return memoryStore.memoryOt;
    },

    getOtById: async (id) => {
      const memItem = memoryStore.memoryOt.find((o) => o.id === id);
      if (memItem) return memItem;

      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT ot.*, COALESCE(e.name, ot.employee_id) as "employeeName"
             FROM ot_requests ot
             LEFT JOIN employees e ON ot.employee_id = e.id OR ot.employee_id = e.code
             WHERE ot.id = $1`,
            [id]
          );
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              dateIso: r.date_iso,
              startTime: r.start_time,
              endTime: r.end_time,
              hours: Number(r.hours || 1),
              taskDescription: r.task_description,
              reason: r.task_description,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            };
          }
        } catch (e) {
          console.error('PG query error in getOtById:', e);
        }
      }
      return null;
    },

    updateOtStatus: async (id, status, remark) => {
      const item = memoryStore.memoryOt.find((o) => o.id === id);
      if (item) {
        item.status = status;
        if (remark) item.remark = remark;
      }
      if (db.isPgConnected()) {
        try {
          await db.query(
            'UPDATE ot_requests SET status = $1, remark = $2 WHERE id = $3',
            [status, remark || null, id]
          );
        } catch (e) {
          console.error('PG update error in updateOtStatus:', e);
        }
      }
      return item;
    },

    // TIME CORRECTIONS
    getTimeCorrectionRequests: async (employeeId = null) => {
      if (db.isPgConnected()) {
        try {
          const query = employeeId
            ? `SELECT tc.*, COALESCE(e.name, tc.employee_id) as "employeeName"
               FROM time_corrections tc
               LEFT JOIN employees e ON tc.employee_id = e.id OR tc.employee_id = e.code
               WHERE tc.employee_id = $1 OR e.id = $1 OR e.code = $1 OR e.email = $1
               ORDER BY tc.created_at DESC`
            : `SELECT tc.*, COALESCE(e.name, tc.employee_id) as "employeeName"
               FROM time_corrections tc
               LEFT JOIN employees e ON tc.employee_id = e.id OR tc.employee_id = e.code
               ORDER BY tc.created_at DESC`;
          const params = employeeId ? [employeeId] : [];
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              dateIso: r.date_iso,
              oldCheckIn: r.old_check_in,
              newCheckIn: r.new_check_in,
              oldCheckOut: r.old_check_out,
              newCheckOut: r.new_check_out,
              reason: r.reason,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in getTimeCorrectionRequests:', e);
        }
      }
      if (employeeId) {
        return memoryStore.memoryTimeCorrections.filter((c) => c.employeeId === employeeId || c.employeeCode === employeeId);
      }
      return memoryStore.memoryTimeCorrections;
    },

    addTimeCorrection: async (data) => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];

      const requester = allUsers.find((e) => e.id === data.employeeId || e.code === data.employeeId || e.email === data.employeeId) || {
        id: data.employeeId || 'EMP-UNKNOWN',
        name: 'พนักงาน',
        role: 'Employee',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      };

      const isBoss = requester.role === 'Boss' || requester.role === 'Manager' || requester.role === 'HR Admin';
      const isSuperBoss = requester.role === 'SuperBoss' || requester.role === 'Super Admin' || requester.role === 'CEO';
      const requesterDept = (requester.department || '').trim().toLowerCase();

      // 1. Find direct manager (Boss) in the EXACT same department
      let directManager = allUsers.find(
        (u) =>
          (u.role === 'Boss' || u.role === 'Manager') &&
          u.department &&
          u.department.trim().toLowerCase() === requesterDept &&
          u.id !== requester.id &&
          u.code !== requester.code
      );

      let superboss = allUsers.find(
        (u) =>
          (u.role === 'SuperBoss' || u.role === 'Super Admin' || u.role === 'CEO') &&
          u.id !== requester.id &&
          u.code !== requester.code
      ) || { id: 'ADM-001', name: 'สมชาย ใจดี (CEO / SuperBoss)', role: 'SuperBoss' };

      const hasDeptBoss = !!directManager;
      const initialLevel = (isBoss || isSuperBoss || !hasDeptBoss) ? 2 : 1;
      const initialStatus = (isBoss || isSuperBoss || !hasDeptBoss)
        ? 'รออนุมัติระดับ 2 (Superboss)'
        : 'รออนุมัติระดับ 1 (Boss)';
      const targetApprover = (isBoss || isSuperBoss || !hasDeptBoss) ? superboss : directManager;

      const newCorrection = {
        id: `tc-${Date.now()}`,
        employeeId: requester.id,
        employeeName: requester.name,
        employeeCode: requester.code || requester.id,
        department: requester.department,
        requesterRole: requester.role,
        dateIso: data.dateIso || new Date().toISOString().split('T')[0],
        oldCheckIn: data.oldCheckIn || '-',
        newCheckIn: data.newCheckIn || '08:00',
        oldCheckOut: data.oldCheckOut || '-',
        newCheckOut: data.newCheckOut || '17:00',
        reason: data.reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        status: initialStatus,
        approvalLevel: initialLevel,
        currentApproverId: targetApprover ? targetApprover.id : null,
        currentApproverName: targetApprover ? targetApprover.name : null,
        directManagerId: directManager ? directManager.id : null,
        superbossId: superboss.id,
        createdAt: new Date().toISOString().split('T')[0],
      };

      memoryStore.memoryTimeCorrections.unshift(newCorrection);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO time_corrections (id, employee_id, date_iso, old_check_in, new_check_in, old_check_out, new_check_out, reason, status, approver, remark)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [newCorrection.id, newCorrection.employeeId, newCorrection.dateIso, newCorrection.oldCheckIn, newCorrection.newCheckIn, newCorrection.oldCheckOut, newCorrection.newCheckOut, newCorrection.reason, newCorrection.status, null, null]
          );
        } catch (e) {
          console.error('PG insert error in addTimeCorrection:', e);
        }
      }

      if (targetApprover) {
        memoryStore.memoryNotifications.unshift({
          id: `notif-${Date.now()}`,
          employeeId: targetApprover.id,
          title: `📩 คำขอปรับปรุงเวลาใหม่จาก ${requester.name}`,
          message: `คุณได้รับการแจ้งเตือนคำขอปรับปรุงเวลาจาก ${requester.name} (${requester.department}) รอการอนุมัติระดับ ${initialLevel}`,
          type: 'warning',
          isRead: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
      }

      return newCorrection;
    },

    // HR DASHBOARD & ATTENDANCE REPORTS
    getHrDashboardStats: async () => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const today = new Date().toISOString().split('T')[0];

      let clockedInToday = 0;
      let lateToday = 0;
      let onLeaveToday = 0;
      let pendingCount = 0;

      if (db.isPgConnected()) {
        try {
          const attRes = await db.query('SELECT status, COUNT(*) as cnt FROM attendance WHERE date_iso = $1 GROUP BY status', [today]);
          if (attRes.rows) {
            attRes.rows.forEach((r) => {
              const cnt = parseInt(r.cnt, 10);
              if (r.status === 'ปกติ') clockedInToday += cnt;
              if (r.status === 'สาย' || r.status === 'เข้างานสาย') { clockedInToday += cnt; lateToday += cnt; }
            });
          }
          const leaveRes = await db.query(
            `SELECT COUNT(*) as cnt FROM leave_requests WHERE status LIKE '%อนุมัติแล้ว%' AND start_date <= $1 AND end_date >= $1`,
            [today]
          );
          if (leaveRes.rows && leaveRes.rows.length > 0) {
            onLeaveToday = parseInt(leaveRes.rows[0].cnt, 10);
          }
          const pendLeave = await db.query(`SELECT COUNT(*) as cnt FROM leave_requests WHERE status LIKE '%รออนุมัติ%'`);
          const pendOt = await db.query(`SELECT COUNT(*) as cnt FROM ot_requests WHERE status LIKE '%รออนุมัติ%'`);
          const pendTc = await db.query(`SELECT COUNT(*) as cnt FROM time_corrections WHERE status LIKE '%รออนุมัติ%'`);
          pendingCount = parseInt(pendLeave.rows[0].cnt, 10) + parseInt(pendOt.rows[0].cnt, 10) + parseInt(pendTc.rows[0].cnt, 10);
        } catch (e) {
          console.error('PG query error in getHrDashboardStats:', e);
        }
      } else {
        clockedInToday = memoryStore.memoryAttendance.filter((a) => a.dateIso === today).length;
        lateToday = memoryStore.memoryAttendance.filter((a) => a.dateIso === today && (a.status === 'สาย' || a.status === 'เข้างานสาย')).length;
        pendingCount = memoryStore.memoryLeaves.filter((l) => l.status && l.status.includes('รออนุมัติ')).length +
                       memoryStore.memoryOt.filter((o) => o.status && o.status.includes('รออนุมัติ')).length;
      }

      return {
        totalEmployees: employees.length,
        clockedInToday,
        lateToday,
        onLeaveToday,
        pendingApprovalsCount: pendingCount,
      };
    },

    getHrAttendanceReport: async (month) => {
      if (db.isPgConnected()) {
        try {
          let query = `SELECT a.*, COALESCE(e.name, a.employee_id) as employee_name, e.department
                       FROM attendance a
                       LEFT JOIN employees e ON a.employee_id = e.id OR a.employee_id = e.code`;
          const params = [];
          if (month) {
            params.push(`${month}%`);
            query += ` WHERE a.date_iso LIKE $1`;
          }
          query += ' ORDER BY a.date_iso DESC, a.created_at DESC';
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employee_name,
              department: r.department,
              dateIso: r.date_iso,
              checkIn: r.check_in,
              checkOut: r.check_out,
              duration: r.duration,
              status: r.status,
              statusColor: r.status_color,
              locationName: r.location_name,
            }));
          }
        } catch (e) {
          console.error('PG query error in getHrAttendanceReport:', e);
        }
      }
      return memoryStore.memoryAttendance;
    },
  };

  return store;
};
