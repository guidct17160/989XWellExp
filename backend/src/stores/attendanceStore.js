const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');
const { bangkokParts, todayIso, durationUntilEndOfDay } = require('../utils/time');

// attendance.employee_id may hold the employee id OR the employee code -> match both ($1 = id or code)
const ATT_EMP_MATCH = `(employee_id = $1 OR employee_id IN (SELECT code FROM employees WHERE id = $1) OR employee_id IN (SELECT id FROM employees WHERE code = $1))`;

module.exports = function createAttendanceStore(storeRef) {
  const store = {
    // ATTENDANCE
    addClockIn: async ({ employeeId, latitude, longitude, locationName, locationId, photoUrl }) => {
      const nowBkk = bangkokParts();
      const today = nowBkk.dateIso;
      const nowTime = nowBkk.timeLabel;

      // Prevent double clock-in on the same day (PostgreSQL is the source of truth)
      if (db.isPgConnected()) {
        const dup = await db.query(
          `SELECT id FROM attendance WHERE ${ATT_EMP_MATCH} AND date_iso = $2 LIMIT 1`,
          [employeeId, today]
        );
        if (dup.rows && dup.rows.length > 0) {
          throw httpError(400, 'คุณได้ลงเวลาเข้างานของวันนี้แล้ว');
        }
      } else if (memoryStore.memoryAttendance.some((a) => a.employeeId === employeeId && a.dateIso === today)) {
        throw httpError(400, 'คุณได้ลงเวลาเข้างานของวันนี้แล้ว');
      }

      // Geofence + late threshold: read from database system settings
      let targetLat = null;
      let targetLng = null;
      let geofenceRadius = null;
      let lateThreshold = '09:00';
      try {
        const settings = await (storeRef ? storeRef.getSettings() : null);
        if (settings) {
          if (settings.geofenceLatitude !== undefined && settings.geofenceLatitude !== null) targetLat = Number(settings.geofenceLatitude);
          if (settings.geofenceLongitude !== undefined && settings.geofenceLongitude !== null) targetLng = Number(settings.geofenceLongitude);
          if (settings.geofenceRadius !== undefined && settings.geofenceRadius !== null) geofenceRadius = Number(settings.geofenceRadius);
          if (/^\d{1,2}:\d{2}$/.test(String(settings.lateThresholdTime || ''))) lateThreshold = String(settings.lateThresholdTime);
        }
      } catch (e) { /* ignore */ }

      // Work Schedule default 08:00 - 17:00; check-in after the threshold (default 09:00:00) is 'สาย' (Thai local time)
      const [thH, thM] = lateThreshold.split(':').map((n) => parseInt(n, 10));
      const nowSec = nowBkk.hour * 3600 + nowBkk.minute * 60 + nowBkk.second;
      const isLate = nowSec > thH * 3600 + thM * 60;

      const currentLat = latitude !== undefined && latitude !== null ? Number(latitude) : null;
      const currentLng = longitude !== undefined && longitude !== null ? Number(longitude) : null;

      let isOutRange = false;
      if (currentLat !== null && currentLng !== null && targetLat !== null && targetLng !== null && geofenceRadius !== null) {
        const latDiff = Math.abs(currentLat - targetLat);
        const lngDiff = Math.abs(currentLng - targetLng);
        isOutRange = latDiff > geofenceRadius || lngDiff > geofenceRadius;
      }

      let formattedLocation = locationName || (currentLat && currentLng ? `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}` : 'ไม่ระบุพิกัด');
      // A chosen work location was already verified by distance, so the old settings-based marker is skipped
      if (!locationId && currentLat !== null && currentLng !== null && targetLat !== null) {
        formattedLocation += (isOutRange ? ' ⚠️ [นอกพื้นที่ Geofence]' : ' 🟢 [ในพื้นที่ Geofence]');
      }

      const newAtt = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        locationName: formattedLocation,
        workLocationId: locationId || null,
        photoUrl: photoUrl || null,
      };

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color, latitude, longitude, location_name, photo_url, work_location_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [newAtt.id, newAtt.employeeId, newAtt.dateIso, newAtt.checkIn, newAtt.checkOut, newAtt.duration, newAtt.status, newAtt.statusColor, newAtt.latitude, newAtt.longitude, newAtt.locationName, newAtt.photoUrl, newAtt.workLocationId]
          );
        } catch (e) {
          console.error('PG insert error in addClockIn:', e);
          throw new Error('ไม่สามารถบันทึกเวลาเข้างานลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      }
      memoryStore.memoryAttendance.unshift(newAtt);

      return newAtt;
    },

    addClockOut: async ({ employeeId }) => {
      const nowBkk = bangkokParts();
      const today = nowBkk.dateIso;
      const nowTime = nowBkk.timeLabel;

      // Helper: calculate real duration from checkIn string to now (Thai local time)
      const calcDuration = (checkInStr) => {
        if (!checkInStr) return '00:00:00 ชม.';
        const match = checkInStr.match(/(\d{1,2}):(\d{2})/);
        if (!match) return '00:00:00 ชม.';
        const ciH = parseInt(match[1], 10);
        const ciM = parseInt(match[2], 10);
        const diffSec = (nowBkk.hour * 3600 + nowBkk.minute * 60 + nowBkk.second) - (ciH * 3600 + ciM * 60);
        if (diffSec <= 0) return '00:00:00 ชม.';
        const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
        const ss = String(diffSec % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss} ชม.`;
      };

      let found = null;
      if (db.isPgConnected()) {
        // PostgreSQL is the source of truth
        const res = await db.query(
          `SELECT * FROM attendance WHERE ${ATT_EMP_MATCH} AND date_iso = $2 ORDER BY created_at DESC LIMIT 1`,
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
        }
      } else {
        found = memoryStore.memoryAttendance.find((a) => a.employeeId === employeeId && a.dateIso === today) || null;
      }

      if (!found) {
        throw httpError(400, 'ยังไม่พบการลงเวลาเข้างานของวันนี้ กรุณาลงเวลาเข้างานก่อนออกงาน หรือยื่นคำขอปรับปรุงเวลา');
      }
      if (found.checkOut && found.checkOut !== 'กำลังทำงาน...') {
        throw httpError(400, 'คุณได้ลงเวลาออกงานของวันนี้แล้ว');
      }

      found.checkOut = nowTime;
      found.duration = calcDuration(found.checkIn);
      if (db.isPgConnected()) {
        try {
          await db.query('UPDATE attendance SET check_out = $1, duration = $2 WHERE id = $3', [nowTime, found.duration, found.id]);
        } catch (e) {
          console.error('PG update error in addClockOut:', e);
          throw new Error('ไม่สามารถบันทึกเวลาออกงานลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      }
      const memIdx = memoryStore.memoryAttendance.findIndex((a) => a.id === found.id);
      if (memIdx >= 0) {
        memoryStore.memoryAttendance[memIdx] = found;
      } else {
        memoryStore.memoryAttendance.unshift(found);
      }
      return found;
    },

    checkAutoClockOutMidnight: (employeeId) => {
      // PostgreSQL rows are closed by the background job in server.js; this keeps the in-memory mirror consistent
      const today = todayIso();
      memoryStore.memoryAttendance.forEach((a) => {
        if (a.employeeId === employeeId && a.dateIso < today && (!a.checkOut || a.checkOut === 'กำลังทำงาน...')) {
          a.checkOut = '23:59 น.';
          a.duration = durationUntilEndOfDay(a.checkIn);
          a.isIncomplete = true;
        }
      });
    },

    getTodayAttendance: async (employeeId) => {
      (storeRef ? storeRef.checkAutoClockOutMidnight : store.checkAutoClockOutMidnight)(employeeId);
      const today = todayIso();
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT * FROM attendance
             WHERE ${ATT_EMP_MATCH}
               AND date_iso = $2
             ORDER BY created_at DESC LIMIT 1`,
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
          return { employeeId, dateIso: today, checkIn: null, checkOut: null, status: 'ยังไม่ได้ลงเวลา' };
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
          let query = `SELECT * FROM attendance
                       WHERE ${ATT_EMP_MATCH}
                       ORDER BY date_iso DESC`;
          const params = [employeeId];
          if (month) {
            query = `SELECT * FROM attendance
                     WHERE ${ATT_EMP_MATCH}
                       AND date_iso LIKE $2
                     ORDER BY date_iso DESC`;
            params.push(`${month}%`);
          }
          const res = await db.query(query, params);
          if (res.rows) {
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
      return memoryStore.memoryAttendance.filter((a) => a.employeeId === employeeId && (!month || (a.dateIso && a.dateIso.startsWith(month))));
    },

    getAttendanceSummary: async (employeeId) => {
      const history = await (storeRef ? storeRef.getAttendanceHistory : store.getAttendanceHistory)(employeeId);
      const onTime = history.filter((a) => a.status === 'ปกติ' || a.status === 'ลงเวลาเข้า-ออกครบถ้วน').length;
      const late = history.filter((a) => a.status === 'สาย' || a.status === 'เข้างานสาย').length;
      const incomplete = history.filter((a) => a.status && a.status.includes('ไม่ลงเวลา')).length;
      // Real worked time = sum of recorded durations ("HH:MM:SS ชม.")
      let totalSeconds = 0;
      history.forEach((a) => {
        const m = String(a.duration || '').match(/(\d+):(\d{2}):(\d{2})/);
        if (m) totalSeconds += parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
      });
      const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
      return {
        totalWorkDays: history.length,
        onTimeDays: onTime,
        lateDays: late,
        absentDays: incomplete,
        totalHours: `${totalHours} ชม.`,
      };
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
      ) || admins.find((a) => a.role === 'Super Admin' || a.role === 'CEO') || admins[0] || null;

      const hasDeptBoss = !!directManager;
      const initialLevel = (isBoss || isSuperBoss || !hasDeptBoss) ? 2 : 1;
      const initialStatus = (isBoss || isSuperBoss || !hasDeptBoss)
        ? 'รออนุมัติระดับ 2 (Superboss)'
        : 'รออนุมัติระดับ 1 (Boss)';
      const targetApprover = (isBoss || isSuperBoss || !hasDeptBoss) ? superboss : directManager;

      // Show the approver what is currently recorded for that day
      const corrDate = data.dateIso || todayIso();
      let oldIn = data.oldCheckIn && data.oldCheckIn !== '-' ? data.oldCheckIn : '-';
      let oldOut = data.oldCheckOut && data.oldCheckOut !== '-' ? data.oldCheckOut : '-';
      if (oldIn === '-' && oldOut === '-') {
        try {
          const hist = await (storeRef ? storeRef.getAttendanceHistory : store.getAttendanceHistory)(requester.id, corrDate.slice(0, 7));
          const rec = (hist || []).find((a) => a.dateIso === corrDate);
          if (rec) {
            oldIn = rec.checkIn || '-';
            oldOut = rec.checkOut || '-';
          }
        } catch (e) { /* keep '-' */ }
      }

      const newCorrection = {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        employeeId: requester.id,
        employeeName: requester.name,
        employeeCode: requester.code || requester.id,
        department: requester.department,
        requesterRole: requester.role,
        dateIso: corrDate,
        oldCheckIn: oldIn,
        newCheckIn: data.newCheckIn || '-',
        oldCheckOut: oldOut,
        newCheckOut: data.newCheckOut || '-',
        reason: data.reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        status: initialStatus,
        approvalLevel: initialLevel,
        currentApproverId: targetApprover ? targetApprover.id : null,
        currentApproverName: targetApprover ? targetApprover.name : null,
        directManagerId: directManager ? directManager.id : null,
        superbossId: superboss ? superboss.id : (admins[0]?.id || 'ADM-001'),
        createdAt: new Date().toISOString().split('T')[0],
      };

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
          throw new Error('ไม่สามารถบันทึกคำขอปรับปรุงเวลาลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      }
      memoryStore.memoryTimeCorrections.unshift(newCorrection);

      if (targetApprover) {
        const notifPayload = {
          id: `notif-${Date.now()}`,
          employeeId: targetApprover.id,
          title: `📩 คำขอปรับปรุงเวลาใหม่จาก ${requester.name}`,
          message: `คุณได้รับการแจ้งเตือนคำขอปรับปรุงเวลาจาก ${requester.name} (${requester.department}) รอการอนุมัติระดับ ${initialLevel}`,
          type: 'warning',
          isRead: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        if (storeRef?.addNotification) {
          storeRef.addNotification(notifPayload);
        } else {
          memoryStore.memoryNotifications.unshift(notifPayload);
        }
      }

      return newCorrection;
    },

    // HR DASHBOARD & ATTENDANCE REPORTS
    getHrDashboardStats: async () => {
      const allEmployees = await (storeRef ? storeRef.getEmployees() : []);
      const employees = allEmployees.filter((e) => e && !['Resign', 'Resigned', 'Inactive'].includes(e.status));
      const today = todayIso();

      let clockedInToday = 0;
      let lateToday = 0;
      let onLeaveToday = 0;
      let pendingCount = 0;

      if (db.isPgConnected()) {
        try {
          // Distinct employees who clocked in today (any status, incl. corrected records)
          const attRes = await db.query(
            `SELECT COUNT(DISTINCT employee_id) AS total,
                    COUNT(DISTINCT employee_id) FILTER (WHERE status IN ('สาย', 'เข้างานสาย')) AS late
             FROM attendance WHERE date_iso = $1`,
            [today]
          );
          if (attRes.rows && attRes.rows[0]) {
            clockedInToday = parseInt(attRes.rows[0].total, 10) || 0;
            lateToday = parseInt(attRes.rows[0].late, 10) || 0;
          }
          const leaveRes = await db.query(
            `SELECT COUNT(DISTINCT employee_id) as cnt FROM leave_requests WHERE status = 'อนุมัติแล้ว' AND start_date <= $1 AND end_date >= $1`,
            [today]
          );
          if (leaveRes.rows && leaveRes.rows.length > 0) {
            onLeaveToday = parseInt(leaveRes.rows[0].cnt, 10);
          }
          const pendLeave = await db.query(`SELECT COUNT(*) as cnt FROM leave_requests WHERE status LIKE '%รออนุมัติ%'`);
          const pendTc = await db.query(`SELECT COUNT(*) as cnt FROM time_corrections WHERE status LIKE '%รออนุมัติ%'`);
          pendingCount = parseInt(pendLeave.rows[0].cnt, 10) + parseInt(pendTc.rows[0].cnt, 10);
        } catch (e) {
          console.error('PG query error in getHrDashboardStats:', e);
        }
      } else {
        clockedInToday = memoryStore.memoryAttendance.filter((a) => a.dateIso === today).length;
        lateToday = memoryStore.memoryAttendance.filter((a) => a.dateIso === today && (a.status === 'สาย' || a.status === 'เข้างานสาย')).length;
        pendingCount = memoryStore.memoryLeaves.filter((l) => l.status && l.status.includes('รออนุมัติ')).length;
      }

      let onTimeRate = '100%';
      if (db.isPgConnected()) {
        try {
          const statsRes = await db.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE status IN ('ปกติ', 'ลงเวลาเข้า-ออกครบถ้วน')) as on_time
            FROM attendance 
            WHERE date_iso >= TO_CHAR((NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '30 days', 'YYYY-MM-DD')
          `);
          if (statsRes.rows && statsRes.rows[0]) {
            const totalAtt = parseInt(statsRes.rows[0].total, 10) || 0;
            const onTimeAtt = parseInt(statsRes.rows[0].on_time, 10) || 0;
            if (totalAtt > 0) {
              onTimeRate = `${Math.round((onTimeAtt / totalAtt) * 100)}%`;
            }
          }
        } catch (e) {
          if (clockedInToday > 0) {
            onTimeRate = `${Math.round(((clockedInToday - lateToday) / clockedInToday) * 100)}%`;
          }
        }
      } else if (clockedInToday > 0) {
        onTimeRate = `${Math.round(((clockedInToday - lateToday) / clockedInToday) * 100)}%`;
      }

      return {
        totalEmployees: employees.length,
        clockedInToday,
        presentToday: clockedInToday,
        lateToday,
        onLeaveToday,
        pendingApprovalsCount: pendingCount,
        onTimeRate,
      };
    },

    getHrAttendanceReport: async (month, date) => {
      if (db.isPgConnected()) {
        try {
          let query = `SELECT a.*, COALESCE(e.name, a.employee_id) as employee_name, e.code as employee_code, e.department
                       FROM attendance a
                       LEFT JOIN employees e ON a.employee_id = e.id OR a.employee_id = e.code`;
          const params = [];
          if (date) {
            params.push(date);
            query += ` WHERE a.date_iso = $1`;
          } else if (month) {
            params.push(`${month}%`);
            query += ` WHERE a.date_iso LIKE $1`;
          }
          query += ' ORDER BY a.date_iso DESC, a.created_at DESC';
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              employeeCode: r.employee_code || r.employee_id,
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
      if (date) {
        return memoryStore.memoryAttendance.filter((a) => a.dateIso === date);
      }
      if (month) {
        return memoryStore.memoryAttendance.filter((a) => a.dateIso && a.dateIso.startsWith(month));
      }
      return memoryStore.memoryAttendance;
    },
  };

  return store;
};
