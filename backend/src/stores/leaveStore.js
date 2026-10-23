const db = require('../config/database');
const memoryStore = require('./memoryStore');
const httpError = require('../utils/httpError');
const { todayIso, bangkokParts } = require('../utils/time');

module.exports = function createLeaveStore(storeRef) {
  const store = {
    // LEAVE BALANCES & ACCURATE LIVE QUOTAS PER EMPLOYEE
    getLeaveBalances: async (employeeId) => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];

      const cleanId = employeeId ? String(employeeId).trim() : '';
      const emp = allUsers.find(
        (u) =>
          u &&
          (u.id === cleanId ||
           u.code === cleanId ||
           u.email === cleanId ||
           u.username === cleanId)
      );

      const userGender = emp ? String(emp.gender || 'all').toLowerCase().trim() : 'all';
      const isUserMale = userGender === 'male' || userGender === 'ชาย';
      const isUserFemale = userGender === 'female' || userGender === 'หญิง';

      // 1. Fetch Active Policies
      const policies = await (storeRef ? storeRef.getLeavePolicies() : store.getLeavePolicies());

      // 2. Fetch User's Leave Requests to calculate accurately used days
      let myLeaves = [];
      if (cleanId) {
        myLeaves = await (storeRef ? storeRef.getLeaveRequests(cleanId) : store.getLeaveRequests(cleanId));
      }
      // Quota is per calendar year: leave from previous years must not consume this year's quota
      const currentYear = String(bangkokParts().year);
      myLeaves = myLeaves.filter((l) => !l || !l.startDate || String(l.startDate).startsWith(currentYear));

      // 3. Filter by gender & Active status
      const eligiblePolicies = policies.filter((p) => {
        if (p.status !== 'Active') return false;
        const polGender = (p.applicableGender || 'all').toLowerCase();
        if (polGender === 'all') return true;
        if (polGender === 'female' || polGender === 'หญิง') return isUserFemale;
        if (polGender === 'male' || polGender === 'ชาย') return isUserMale;
        return true;
      });

      // 4. Map balances with live calculation
      return eligiblePolicies.map((p) => {
        const pKey = (p.categoryKey || p.id).toLowerCase();
        const pName = (p.typeName || '').toLowerCase();

        // Find all leave requests matching this policy category or type name
        const matchingLeaves = myLeaves.filter((l) => {
          if (!l || l.status === 'ไม่อนุมัติ' || l.status === 'ปฏิเสธแล้ว' || l.status === 'ยกเลิก') return false;
          const lType = (l.leaveType || '').toLowerCase();
          return (
            lType === pKey ||
            lType === pName ||
            lType.includes(pKey) ||
            pName.includes(lType) ||
            (pKey === 'annual' && (lType.includes('พักร้อน') || lType.includes('annual'))) ||
            (pKey === 'sick' && (lType.includes('ป่วย') || lType.includes('sick'))) ||
            (pKey === 'personal' && (lType.includes('กิจ') || lType.includes('personal'))) ||
            (pKey === 'maternity' && (lType.includes('คลอด') || lType.includes('maternity'))) ||
            (pKey === 'ordination' && (lType.includes('บวช') || lType.includes('ordination'))) ||
            (pKey === 'paternity' && (lType.includes('ภริยา') || lType.includes('paternity')))
          );
        });

        const usedDays = matchingLeaves.reduce((sum, l) => sum + Number(l.totalDays || 1), 0);
        const totalQuota = parseInt(p.defaultQuota, 10) || 0;
        const remainingDays = Math.max(0, totalQuota - usedDays);

        const icon =
          pKey === 'sick' ? 'medical-outline' :
          pKey === 'personal' ? 'briefcase-outline' :
          pKey === 'maternity' ? 'heart-outline' :
          pKey === 'ordination' ? 'sunny-outline' :
          pKey === 'paternity' ? 'people-outline' :
          pKey === 'annual' ? 'umbrella-outline' : 'calendar-outline';

        return {
          id: p.categoryKey || p.id,
          policyId: p.id,
          label: p.typeName.replace(/\s*\(.*?\)\s*/g, '').trim(),
          fullName: p.typeName,
          categoryKey: p.categoryKey,
          total: totalQuota,
          used: usedDays,
          remaining: remainingDays,
          applicableGender: p.applicableGender || 'all',
          color: '#F5A623',
          icon: icon,
        };
      });
    },

    // LEAVE REQUESTS
    addLeaveRequest: async (data) => {
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

      // Check Leave Policy rules, gender applicability, and date constraints
      const policies = await (storeRef ? storeRef.getLeavePolicies() : store.getLeavePolicies());
      const matchedPolicy = policies.find(
        (p) =>
          p.typeName === data.leaveType ||
          p.categoryKey === data.leaveType ||
          (data.leaveType && p.typeName.includes(data.leaveType)) ||
          (data.leaveType && data.leaveType.includes(p.typeName))
      );

      if (matchedPolicy) {
        // 1. Gender Validation
        const reqGender = (requester.gender || 'Male').toLowerCase();
        const polGender = (matchedPolicy.applicableGender || 'all').toLowerCase();
        if (polGender !== 'all') {
          const isFemalePolicy = polGender === 'female' || polGender === 'หญิง';
          const isMalePolicy = polGender === 'male' || polGender === 'ชาย';
          const isRequesterFemale = reqGender === 'female' || reqGender === 'หญิง';
          const isRequesterMale = reqGender === 'male' || reqGender === 'ชาย';

          if (isFemalePolicy && !isRequesterFemale) {
            throw httpError(400, 
              `ไม่อนุญาตให้ยื่นลาประเภท "${matchedPolicy.typeName}" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศหญิงเท่านั้น`
            );
          }
          if (isMalePolicy && !isRequesterMale) {
            throw httpError(400, 
              `ไม่อนุญาตให้ยื่นลาประเภท "${matchedPolicy.typeName}" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศชายเท่านั้น`
            );
          }
        }

        // 2. Policy rule configured by HR: supporting document
        if (matchedPolicy.requireAttachment && !data.attachmentUrl) {
          throw httpError(400, `ประเภทการลา "${matchedPolicy.typeName}" ต้องแนบเอกสารประกอบการลา`);
        }

        // 3. Balance / Quota Validation against Real Database
        const currentBalances = await (storeRef ? storeRef.getLeaveBalances(requester.id) : store.getLeaveBalances(requester.id));
        const reqBal = currentBalances.find(b => b.policyId === matchedPolicy.id || b.id === matchedPolicy.categoryKey);
        if (reqBal) {
          if (reqBal.remaining <= 0) {
            throw httpError(400, `คุณใช้สิทธิ์ "${matchedPolicy.typeName}" ครบตามกำหนดแล้ว (เหลือ 0 วัน) ไม่สามารถยื่นลาเพิ่มได้`);
          }
          if (Number(data.totalDays || 1) > reqBal.remaining) {
            throw httpError(400, `จำนวนวันลาที่ระบุ (${data.totalDays || 1} วัน) เกินสิทธิ์คงเหลือของคุณ (คงเหลือ ${reqBal.remaining} วัน)`);
          }
        }
      }

      const newLeave = {
        id: `leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        employeeId: requester.id,
        employeeName: requester.name,
        employeeCode: requester.code || requester.id,
        department: requester.department,
        requesterRole: requester.role,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays: data.totalDays || 1,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl || null,
        status: initialStatus,
        approvalLevel: initialLevel,
        currentApproverId: targetApprover ? targetApprover.id : null,
        currentApproverName: targetApprover ? targetApprover.name : null,
        directManagerId: directManager ? directManager.id : null,
        superbossId: superboss ? superboss.id : (admins[0]?.id || 'ADM-001'),
        createdAt: todayIso(),
      };

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, attachment_url, status, approver, remark)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO NOTHING`,
            [newLeave.id, newLeave.employeeId, newLeave.leaveType, newLeave.startDate, newLeave.endDate, newLeave.totalDays, newLeave.reason, newLeave.attachmentUrl, newLeave.status, null, null]
          );
        } catch (e) {
          console.error('PG insert error in addLeaveRequest:', e);
          throw new Error('ไม่สามารถบันทึกใบลาลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        }
      }
      memoryStore.memoryLeaves.unshift(newLeave);

      if (targetApprover) {
        const notifPayload = {
          id: `notif-${Date.now()}`,
          employeeId: targetApprover.id,
          title: `📩 คำขอใหม่ (${data.leaveType}) จาก ${requester.name}`,
          message: `คุณได้รับการแจ้งเตือนคำขอ${data.leaveType} จาก ${requester.name} (${requester.department}) รอการอนุมัติระดับ ${initialLevel}`,
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

      return newLeave;
    },

    getLeaveRequests: async (employeeId) => {
      if (!employeeId) return [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT l.*, COALESCE(e.name, l.employee_id) as "employeeName"
             FROM leave_requests l
             LEFT JOIN employees e ON l.employee_id = e.id OR l.employee_id = e.code
             WHERE l.employee_id = $1 OR e.id = $1 OR e.code = $1 OR e.email = $1
             ORDER BY l.created_at DESC`,
            [employeeId]
          );
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              leaveType: r.leave_type,
              startDate: r.start_date,
              endDate: r.end_date,
              totalDays: Number(r.total_days || 1),
              reason: r.reason,
              attachmentUrl: r.attachment_url || null,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in getLeaveRequests:', e);
        }
      }
      return memoryStore.memoryLeaves.filter((l) => l.employeeId === employeeId || l.employeeCode === employeeId);
    },

    getLeaveById: async (id) => {
      const memItem = memoryStore.memoryLeaves.find((l) => l.id === id);
      if (memItem) return memItem;

      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            `SELECT l.*, COALESCE(e.name, l.employee_id) as "employeeName"
             FROM leave_requests l
             LEFT JOIN employees e ON l.employee_id = e.id OR l.employee_id = e.code
             WHERE l.id = $1`,
            [id]
          );
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              leaveType: r.leave_type,
              startDate: r.start_date,
              endDate: r.end_date,
              totalDays: Number(r.total_days || 1),
              reason: r.reason,
              attachmentUrl: r.attachment_url || null,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            };
          }
        } catch (e) {
          console.error('PG query error in getLeaveById:', e);
        }
      }
      return null;
    },

    updateLeaveStatus: async (id, status, remark) => {
      const item = memoryStore.memoryLeaves.find((l) => l.id === id);
      if (item) {
        item.status = status;
        if (remark) item.remark = remark;
      }
      if (db.isPgConnected()) {
        try {
          await db.query(
            'UPDATE leave_requests SET status = $1, remark = $2 WHERE id = $3',
            [status, remark || null, id]
          );
        } catch (e) {
          console.error('PG update error in updateLeaveStatus:', e);
          throw new Error('ไม่สามารถอัปเดตสถานะใบลาในฐานข้อมูลได้');
        }
      }
      return item;
    },

    // LEAVE ATTACHMENTS (files the employee attaches to a leave request)
    addLeaveAttachment: async ({ id, employeeId, fileName, mimeType, buffer }) => {
      if (db.isPgConnected()) {
        try {
          await db.query(
            'INSERT INTO leave_attachments (id, employee_id, file_name, mime_type, size_bytes, data) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, employeeId, fileName, mimeType, buffer.length, buffer]
          );
        } catch (e) {
          console.error('PG insert error in addLeaveAttachment:', e);
          throw new Error('ไม่สามารถบันทึกไฟล์แนบลงฐานข้อมูลได้');
        }
        return { id, employeeId, fileName, mimeType, size: buffer.length };
      }
      const item = { id, employeeId, fileName, mimeType, size: buffer.length, buffer };
      memoryStore.memoryLeaveAttachments.push(item);
      return { id, employeeId, fileName, mimeType, size: buffer.length };
    },

    getLeaveAttachment: async (id) => {
      if (db.isPgConnected()) {
        const res = await db.query('SELECT id, employee_id, file_name, mime_type, size_bytes, data FROM leave_attachments WHERE id = $1', [id]);
        const r = res.rows[0];
        if (!r) return null;
        return { id: r.id, employeeId: r.employee_id, fileName: r.file_name, mimeType: r.mime_type, size: r.size_bytes, buffer: r.data };
      }
      return memoryStore.memoryLeaveAttachments.find((a) => a.id === id) || null;
    },

    // LEAVE POLICIES
    getLeavePolicies: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM leave_policies ORDER BY id ASC');
          return res.rows.map((r) => ({
            id: r.id,
            typeName: r.type_name,
            categoryKey: r.category_key,
            defaultQuota: parseInt(r.default_quota, 10) || 0,
            isPaid: !!r.is_paid,
            applicableGender: r.applicable_gender || 'all',
            requireAttachment: !!r.require_attachment,
            description: r.description || '',
            status: r.status || 'Active',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        } catch (e) {
          // never answer from the in-memory copy while PostgreSQL is the source of truth: the web and the app would disagree
          console.error('PG query error in getLeavePolicies:', e);
          throw new Error('ไม่สามารถโหลดนโยบายการลาจากฐานข้อมูลได้');
        }
      }
      return memoryStore.memoryLeavePolicies;
    },

    addLeavePolicy: async (policyData) => {
      // Never derive the id from the in-memory array length (empty after restart -> would overwrite LP-01)
      const newId = policyData.id || `LP-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const newPolicy = {
        id: newId,
        typeName: policyData.typeName || 'นโยบายการลาใหม่',
        // no category given (the web form no longer asks for one): use the unique policy id so balances never collide
        categoryKey: policyData.categoryKey || newId,
        defaultQuota: parseInt(policyData.defaultQuota, 10) || 10,
        isPaid: policyData.isPaid !== undefined ? !!policyData.isPaid : true,
        applicableGender: policyData.applicableGender || 'all',
        requireAttachment: !!policyData.requireAttachment,
        description: policyData.description || '',
        status: policyData.status || 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const idx = memoryStore.memoryLeavePolicies.findIndex((p) => p.id === newId);
      if (idx >= 0) {
        memoryStore.memoryLeavePolicies[idx] = newPolicy;
      } else {
        memoryStore.memoryLeavePolicies.push(newPolicy);
      }

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO leave_policies (
               id, type_name, category_key, default_quota, is_paid, applicable_gender,
               require_attachment, description, status, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               type_name = EXCLUDED.type_name,
               category_key = EXCLUDED.category_key,
               default_quota = EXCLUDED.default_quota,
               is_paid = EXCLUDED.is_paid,
               applicable_gender = EXCLUDED.applicable_gender,
               require_attachment = EXCLUDED.require_attachment,
               description = EXCLUDED.description,
               status = EXCLUDED.status,
               updated_at = CURRENT_TIMESTAMP`,
            [
              newPolicy.id,
              newPolicy.typeName,
              newPolicy.categoryKey,
              newPolicy.defaultQuota,
              newPolicy.isPaid,
              newPolicy.applicableGender,
              newPolicy.requireAttachment,
              newPolicy.description,
              newPolicy.status,
            ]
          );
        } catch (e) {
          console.error('PG insert error in addLeavePolicy:', e);
          throw new Error('ไม่สามารถบันทึกนโยบายการลาลงฐานข้อมูลได้');
        }
      }
      return newPolicy;
    },

    updateLeavePolicy: async (id, updateData) => {
      // Always merge onto the CURRENT stored policy (PostgreSQL), so a partial update
      // (e.g. only { status }) never wipes the other columns
      const allPolicies = await store.getLeavePolicies();
      const existing = allPolicies.find((p) => p.id === id);
      if (!existing) throw httpError(404, 'ไม่พบนโยบายการลาที่ต้องการแก้ไข');

      const intOr = (v, fallback) => {
        if (v === undefined || v === null || v === '') return fallback;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? fallback : n;
      };

      const updated = {
        ...existing,
        ...updateData,
        id,
        defaultQuota: intOr(updateData.defaultQuota, existing.defaultQuota),
        applicableGender: updateData.applicableGender || existing.applicableGender || 'all',
        isPaid: updateData.isPaid !== undefined ? !!updateData.isPaid : existing.isPaid,
        requireAttachment: updateData.requireAttachment !== undefined ? !!updateData.requireAttachment : existing.requireAttachment,
        updatedAt: new Date().toISOString(),
      };

      if (db.isPgConnected()) {
        try {
          await db.query(
            `UPDATE leave_policies SET
               type_name = COALESCE($1, type_name),
               category_key = COALESCE($2, category_key),
               default_quota = COALESCE($3, default_quota),
               is_paid = COALESCE($4, is_paid),
               require_attachment = COALESCE($5, require_attachment),
               description = COALESCE($6, description),
               status = COALESCE($7, status),
               applicable_gender = COALESCE($8, applicable_gender),
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $9`,
            [
              updated.typeName,
              updated.categoryKey,
              updated.defaultQuota,
              updated.isPaid,
              updated.requireAttachment,
              updated.description,
              updated.status,
              updated.applicableGender,
              id,
            ]
          );
        } catch (e) {
          console.error('PG update error in updateLeavePolicy:', e);
          throw new Error('ไม่สามารถบันทึกนโยบายการลาลงฐานข้อมูลได้');
        }
      }

      const idx = memoryStore.memoryLeavePolicies.findIndex((p) => p.id === id);
      if (idx >= 0) {
        memoryStore.memoryLeavePolicies[idx] = updated;
      } else {
        memoryStore.memoryLeavePolicies.push(updated);
      }
      return updated;
    },

    deleteLeavePolicy: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM leave_policies WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteLeavePolicy:', e);
          throw new Error('ไม่สามารถลบนโยบายการลาออกจากฐานข้อมูลได้');
        }
      }
      memoryStore.memoryLeavePolicies = memoryStore.memoryLeavePolicies.filter((p) => p.id !== id);
      return true;
    },

    // PENDING APPROVALS
    getPendingApprovals: async (managerId) => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];

      const cleanManagerId = managerId ? String(managerId).trim().toLowerCase() : '';
      const currentUser = allUsers.find(
        (u) =>
          u &&
          ((u.id && String(u.id).toLowerCase() === cleanManagerId) ||
           (u.code && String(u.code).toLowerCase() === cleanManagerId) ||
           (u.username && String(u.username).toLowerCase() === cleanManagerId) ||
           (u.email && String(u.email).toLowerCase() === cleanManagerId) ||
           (u.name && u.name.toLowerCase().includes(cleanManagerId)) ||
           (cleanManagerId.includes('superboss') && (u.role === 'SuperBoss' || u.role === 'Super Admin' || u.role === 'CEO')) ||
           (cleanManagerId.includes('boss_it') && u.role === 'Boss' && u.department?.includes('IT')) ||
           (cleanManagerId.includes('boss_mkt') && u.role === 'Boss' && u.department?.includes('Marketing')))
      ) || {
        id: managerId || 'ADM-001',
        name: cleanManagerId.includes('superboss') ? 'SuperBoss / CEO' : 'ผู้จัดการ',
        role: cleanManagerId.includes('superboss') ? 'SuperBoss' : 'Boss',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      };

      const isSuperboss =
        currentUser.role === 'SuperBoss' ||
        currentUser.role === 'Super Admin' ||
        currentUser.role === 'SuperAdmin' ||
        currentUser.role === 'CEO' ||
        currentUser.role === 'Director' ||
        cleanManagerId === 'superboss' ||
        cleanManagerId === 'adm-001' ||
        cleanManagerId === 'admin';

      const isBoss =
        currentUser.role === 'Boss' ||
        currentUser.role === 'Manager' ||
        currentUser.role === 'HR Admin' ||
        cleanManagerId.startsWith('boss');

      const enrichUserData = (item) => {
        const emp = allUsers.find(
          (u) =>
            u &&
            (u.id === item.employeeId ||
             u.code === item.employeeId ||
             u.id === item.employeeCode ||
             u.code === item.employeeCode ||
             u.email === item.employeeId)
        );
        return {
          ...item,
          employeeName: item.employeeName || (emp ? emp.name : item.employeeId),
          employeeCode: item.employeeCode || (emp ? emp.code : item.employeeId),
          department: item.department || (emp ? emp.department : 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'),
          requesterRole: item.requesterRole || (emp ? emp.role : 'Employee'),
          role: item.requesterRole || (emp ? emp.role : 'Employee'),
        };
      };

      // 1. Fetch Leaves
      let leavesList = [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query(`
            SELECT l.*, 
                   COALESCE(e.name, a.name, l.employee_id) as "employeeName", 
                   COALESCE(e.department, a.department, 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)') as department, 
                   COALESCE(e.role, a.role, 'Employee') as "requesterRole", 
                   COALESCE(e.code, a.code, l.employee_id) as "employeeCode"
            FROM leave_requests l
            LEFT JOIN employees e ON l.employee_id = e.id OR l.employee_id = e.code OR l.employee_id = e.email
            LEFT JOIN admins a ON l.employee_id = a.id OR l.employee_id = a.code OR l.employee_id = a.email
            ORDER BY l.created_at DESC
          `);
          if (res.rows) {
            leavesList = res.rows.map((r) => enrichUserData({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              department: r.department,
              requesterRole: r.requesterRole,
              leaveType: r.leave_type,
              startDate: r.start_date,
              endDate: r.end_date,
              totalDays: Number(r.total_days || 1),
              reason: r.reason,
              attachmentUrl: r.attachment_url || null,
              status: r.status,
              approver: r.approver,
              remark: r.remark,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in leaves pending:', e);
        }
      }
      if (leavesList.length === 0) {
        leavesList = memoryStore.memoryLeaves.map(enrichUserData);
      }

      // 2. Fetch Time Corrections
      let tcList = [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query(`
            SELECT tc.*, 
                   COALESCE(e.name, a.name, tc.employee_id) as "employeeName", 
                   COALESCE(e.department, a.department, 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)') as department, 
                   COALESCE(e.role, a.role, 'Employee') as "requesterRole", 
                   COALESCE(e.code, a.code, tc.employee_id) as "employeeCode"
            FROM time_corrections tc
            LEFT JOIN employees e ON tc.employee_id = e.id OR tc.employee_id = e.code OR tc.employee_id = e.email
            LEFT JOIN admins a ON tc.employee_id = a.id OR tc.employee_id = a.code OR tc.employee_id = a.email
            ORDER BY tc.created_at DESC
          `);
          if (res.rows) {
            tcList = res.rows.map((r) => enrichUserData({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              department: r.department,
              requesterRole: r.requesterRole,
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
          console.error('PG query error in time corrections pending:', e);
        }
      }
      if (tcList.length === 0) {
        tcList = memoryStore.memoryTimeCorrections.map(enrichUserData);
      }

      // Strict Department & Multi-tier Hierarchy Filter
      const filterForUser = (item) => {
        if (!item) return false;
        const s = item.status ? item.status.trim() : '';
        if (!s.startsWith('รออนุมัติ')) {
          return false;
        }

        const itemDept = (item.department || '').trim().toLowerCase();
        const userDept = (currentUser.department || '').trim().toLowerCase();
        const isRequesterBoss = item.requesterRole === 'Boss' || item.requesterRole === 'Manager' || item.requesterRole === 'HR Admin';

        // 1. SuperBoss can see:
        if (isSuperboss) {
          if (isRequesterBoss) return true;
          if (s.includes('ระดับ 2') || s.includes('Superboss')) return true;
          if (item.currentApproverId === currentUser.id || item.superbossId === currentUser.id) return true;
          if (s === 'รออนุมัติ' || s.includes('รอการอนุมัติ')) return true;
          return true;
        }

        // 2. Boss can ONLY see Level 1 requests from their EXACT SAME DEPARTMENT
        if (isBoss) {
          const isSameDept = itemDept !== '' && userDept !== '' && itemDept === userDept;
          const isTargetBoss = item.currentApproverId === currentUser.id || item.directManagerId === currentUser.id;
          const isNotLevel2 = !s.includes('ระดับ 2') && !s.includes('Superboss');
          const isNotSelf = item.employeeId !== currentUser.id && item.employeeCode !== currentUser.code;

          return (isSameDept || isTargetBoss) && isNotLevel2 && isNotSelf && !isRequesterBoss;
        }

        return false;
      };

      const pendingLeaves = leavesList.filter(filterForUser).map((l) => ({
        ...l,
        requestType: 'leave',
        role: l.requesterRole || 'Employee',
        type: l.leaveType ? `ยื่น${l.leaveType} (${l.totalDays || 1} วัน)` : 'ยื่นลางาน',
        title: `ยื่น${l.leaveType || 'ลางาน'} (${l.totalDays || 1} วัน)`,
        date: l.startDate === l.endDate ? (l.startDate || '-') : `${l.startDate} ถึง ${l.endDate}`,
        details: l.reason || `ยื่นขอลา ${l.leaveType || 'ลางาน'} จำนวน ${l.totalDays || 1} วัน`,
      }));

      const pendingCorrections = tcList.filter(filterForUser).map((c) => ({
        ...c,
        requestType: 'time-correction',
        role: c.requesterRole || 'Employee',
        type: 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        title: 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        date: c.dateIso || c.createdAt || '-',
        details: c.reason || `ขอปรับปรุงเวลาเป็น เข้า: ${c.newCheckIn || '-'} / ออก: ${c.newCheckOut || '-'}`,
      }));

      return [...pendingLeaves, ...pendingCorrections];
    },

    // APPROVAL HISTORY (Real DB)
    getApprovalHistory: async () => {
      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];

      const enrichUserData = (item) => {
        const emp = allUsers.find(
          (u) =>
            u &&
            (u.id === item.employeeId ||
             u.code === item.employeeId ||
             u.id === item.employeeCode ||
             u.code === item.employeeCode ||
             u.email === item.employeeId)
        );
        return {
          ...item,
          employeeName: item.employeeName || (emp ? emp.name : item.employeeId),
          employeeCode: item.employeeCode || (emp ? emp.code : item.employeeId),
          department: item.department || (emp ? emp.department : 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'),
          requesterRole: item.requesterRole || (emp ? emp.role : 'Employee'),
        };
      };

      let historyList = [];
      if (db.isPgConnected()) {
        try {
          const [leavesRes, tcRes] = await Promise.all([
            db.query(`
              SELECT l.*, 
                     COALESCE(e.name, a.name, l.employee_id) as "employeeName", 
                     COALESCE(e.department, a.department, 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)') as department, 
                     COALESCE(e.role, a.role, 'Employee') as "requesterRole", 
                     COALESCE(e.code, a.code, l.employee_id) as "employeeCode"
              FROM leave_requests l
              LEFT JOIN employees e ON l.employee_id = e.id OR l.employee_id = e.code OR l.employee_id = e.email
              LEFT JOIN admins a ON l.employee_id = a.id OR l.employee_id = a.code OR l.employee_id = a.email
              WHERE l.status NOT LIKE 'รออนุมัติ%'
              ORDER BY l.created_at DESC
            `),
            db.query(`
              SELECT tc.*, 
                     COALESCE(e.name, a.name, tc.employee_id) as "employeeName", 
                     COALESCE(e.department, a.department, 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)') as department, 
                     COALESCE(e.role, a.role, 'Employee') as "requesterRole", 
                     COALESCE(e.code, a.code, tc.employee_id) as "employeeCode"
              FROM time_corrections tc
              LEFT JOIN employees e ON tc.employee_id = e.id OR tc.employee_id = e.code OR tc.employee_id = e.email
              LEFT JOIN admins a ON tc.employee_id = a.id OR tc.employee_id = a.code OR tc.employee_id = a.email
              WHERE tc.status NOT LIKE 'รออนุมัติ%'
              ORDER BY tc.created_at DESC
            `),
          ]);

          if (leavesRes.rows) {
            historyList.push(...leavesRes.rows.map((r) => enrichUserData({
              id: r.id,
              requestType: 'leave',
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              department: r.department,
              leaveType: r.leave_type,
              days: Number(r.total_days || 1),
              startDate: r.start_date,
              endDate: r.end_date,
              date: r.start_date === r.end_date ? r.start_date : `${r.start_date} ถึง ${r.end_date}`,
              reason: r.reason,
              status: r.status,
              approverName: r.approver || 'ผู้จัดการ',
              remark: r.remark,
              actionTime: r.created_at ? new Date(r.created_at).toLocaleString('th-TH') : '-',
              createdAt: r.created_at,
            })));
          }

          if (tcRes.rows) {
            historyList.push(...tcRes.rows.map((r) => enrichUserData({
              id: r.id,
              requestType: 'time-correction',
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              department: r.department,
              date: r.date_iso,
              reason: r.reason,
              details: `เข้า: ${r.new_check_in || '-'} / ออก: ${r.new_check_out || '-'}`,
              status: r.status,
              approverName: r.approver || 'ผู้จัดการ',
              remark: r.remark,
              actionTime: r.created_at ? new Date(r.created_at).toLocaleString('th-TH') : '-',
              createdAt: r.created_at,
            })));
          }
        } catch (e) {
          console.error('PG query error in getApprovalHistory:', e);
        }
      }

      // Sort by creation date descending
      historyList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return historyList;
    },

    processApprovalRequest: async ({ requestType, id, status, approver, approverId, remark, approverRole }) => {
      const rt = requestType === 'time_correction' ? 'time-correction' : requestType;
      let target = null;
      let tableName = null;
      let memList = null;

      if (rt === 'leave') {
        memList = memoryStore.memoryLeaves;
        tableName = 'leave_requests';
      } else if (rt === 'time-correction') {
        memList = memoryStore.memoryTimeCorrections;
        tableName = 'time_corrections';
      } else {
        throw httpError(400, 'ประเภทคำขอไม่ถูกต้อง (ต้องเป็น leave หรือ time-correction)');
      }
      target = memList.find((x) => x.id === id) || null;

      if (db.isPgConnected()) {
        // PostgreSQL is the source of truth for the current status
        const res = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
        if (res.rows && res.rows.length > 0) {
          const r = res.rows[0];
          target = {
            ...(target || {}),
            id: r.id,
            employeeId: r.employee_id,
            leaveType: r.leave_type,
            startDate: r.start_date,
            endDate: r.end_date,
            dateIso: r.date_iso,
            oldCheckIn: r.old_check_in,
            newCheckIn: r.new_check_in,
            oldCheckOut: r.old_check_out,
            newCheckOut: r.new_check_out,
            hours: r.hours,
            status: r.status,
            approver: r.approver,
            remark: r.remark,
          };
        } else {
          target = null;
        }
      }

      if (!target) throw httpError(404, 'ไม่พบคำขอที่ต้องการดำเนินการ');

      const currentStatus = String(target.status || '').trim();
      if (!currentStatus.startsWith('รออนุมัติ')) {
        throw httpError(409, `คำขอนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: ${currentStatus || '-'})`);
      }

      const normRole = (r) => String(r || '').toLowerCase().replace(/[\s_-]+/g, '');
      const SUPER_ROLES = ['superboss', 'superadmin', 'ceo', 'director'];
      const isApproverSuperboss = SUPER_ROLES.includes(normRole(approverRole));
      const isLevel2Status = currentStatus.includes('ระดับ 2') || currentStatus.includes('Superboss');
      const isApproveAction = status === 'approved' || status === 'อนุมัติ' || status === 'อนุมัติแล้ว';

      const employees = await (storeRef ? storeRef.getEmployees() : []);
      const admins = await (storeRef ? storeRef.getAdmins() : []);
      const allUsers = [...employees, ...admins];
      const findUser = (uid) => allUsers.find((u) => u && uid && (u.id === uid || u.code === uid || u.email === uid));
      const requester = findUser(target.employeeId);
      const requesterRole = target.requesterRole || (requester ? requester.role : 'Employee');

      // ---- Authorization of the approver for THIS request ----
      if (!isApproverSuperboss) {
        if (approverId && target.employeeId === approverId) {
          throw httpError(403, 'ไม่สามารถอนุมัติ/ปฏิเสธคำขอของตนเองได้');
        }
        if (isLevel2Status) {
          throw httpError(403, 'คำขอนี้อยู่ในขั้นอนุมัติระดับ 2 ต้องให้ Superboss เป็นผู้พิจารณา');
        }
        if (requesterRole === 'Boss' || requesterRole === 'Manager' || requesterRole === 'HR Admin') {
          throw httpError(403, 'คำขอของหัวหน้างานต้องให้ Superboss เป็นผู้พิจารณา');
        }
        const approverUser = findUser(approverId);
        const dA = String((approverUser && approverUser.department) || '').trim().toLowerCase();
        const dR = String((requester && requester.department) || '').trim().toLowerCase();
        if (dA && dA !== '-' && dR && dA !== dR) {
          throw httpError(403, 'คุณสามารถอนุมัติได้เฉพาะคำขอของพนักงานในแผนกเดียวกันเท่านั้น');
        }
      }

      const syncMemory = (patch) => {
        const m = memList.find((x) => x.id === id);
        if (m) Object.assign(m, patch);
      };
      const sendNotif = (payload) => {
        const n = {
          ...payload,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          isRead: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        };
        if (storeRef?.addNotification) {
          storeRef.addNotification(n);
        } else {
          memoryStore.memoryNotifications.unshift(n);
        }
      };
      // Conditional update: only succeeds while the request is still pending (prevents double processing)
      const updatePg = async (setSql, params) => {
        if (!db.isPgConnected()) return;
        const r = await db.query(
          `UPDATE ${tableName} SET ${setSql} WHERE id = $${params.length + 1} AND status LIKE 'รออนุมัติ%'`,
          [...params, id]
        );
        if (r.rowCount === 0) throw httpError(409, 'คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชรายการ');
      };
      const typeLabel = rt === 'leave' ? `ใบลา${target.leaveType ? ` (${target.leaveType})` : ''}` : 'คำขอปรับปรุงเวลา';

      if (isApproveAction) {
        if (!isApproverSuperboss) {
          // Level 1 (Boss) approval -> forward to Level 2 (Superboss)
          await updatePg('status = $1, approver = $2', ['รออนุมัติระดับ 2 (Superboss)', approver]);
          syncMemory({ approvalLevel: 2, status: 'รออนุมัติระดับ 2 (Superboss)', approverLevel1: approver });

          const superbossUser =
            (target.superbossId && findUser(target.superbossId)) ||
            allUsers.find((u) => u && SUPER_ROLES.includes(normRole(u.role)) && u.id !== target.employeeId) ||
            admins[0] ||
            null;
          if (superbossUser) {
            sendNotif({
              employeeId: superbossUser.id,
              title: `📢 ${typeLabel} ของ ${(requester && requester.name) || target.employeeName || 'พนักงาน'} ผ่านการอนุมัติระดับ 1 แล้ว`,
              message: `คำขอผ่าน Boss (${approver}) เรียบร้อยแล้ว รอ Superboss พิจารณาอนุมัติระดับ 2`,
              type: 'info',
            });
          }

          return {
            id,
            status: 'รออนุมัติระดับ 2 (Superboss)',
            message: 'อนุมัติระดับ 1 (Boss) เรียบร้อยแล้ว ส่งต่อไปยังระดับ 2 (Superboss)',
          };
        }

        // Level 2 (Superboss) = final approval
        await updatePg('status = $1, approver = $2, remark = $3', ['อนุมัติแล้ว', approver, remark || 'อนุมัติสมบูรณ์']);
        syncMemory({ status: 'อนุมัติแล้ว', approver, remark: remark || 'อนุมัติสมบูรณ์' });

        // Approved Time Correction -> apply it to the attendance record (create it if the day has none)
        if (rt === 'time-correction' && target.dateIso && target.employeeId) {
          const fmt = (t) => {
            const v = String(t || '').trim();
            if (!v || v === '-') return null;
            return /^\d{1,2}:\d{2}$/.test(v) ? `${v.padStart(5, '0')} น.` : v;
          };
          const toSec = (t) => {
            const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
            return m ? parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 : null;
          };
          const calcDur = (a, b) => {
            const sa = toSec(a);
            const sb = toSec(b);
            if (sa === null || sb === null || sb <= sa) return '00:00:00 ชม.';
            const d = sb - sa;
            return `${String(Math.floor(d / 3600)).padStart(2, '0')}:${String(Math.floor((d % 3600) / 60)).padStart(2, '0')}:00 ชม.`;
          };
          const inT = fmt(target.newCheckIn);
          const outT = fmt(target.newCheckOut);

          const memAtt = memoryStore.memoryAttendance.find(
            (a) => a && (a.employeeId === target.employeeId || a.employeeCode === target.employeeId) && a.dateIso === target.dateIso
          );
          if (memAtt) {
            if (inT) memAtt.checkIn = inT;
            if (outT) memAtt.checkOut = outT;
            memAtt.duration = calcDur(memAtt.checkIn, memAtt.checkOut);
            memAtt.status = 'ลงเวลาเข้า-ออกครบถ้วน';
            memAtt.statusColor = '#10B981';
            memAtt.isCorrected = true;
            memAtt.isApproved = true;
          }

          if (db.isPgConnected()) {
            const upd = await db.query(
              `UPDATE attendance
               SET check_in = COALESCE($1, check_in),
                   check_out = COALESCE($2, check_out),
                   status = 'ลงเวลาเข้า-ออกครบถ้วน',
                   status_color = '#10B981'
               WHERE (employee_id = $3 OR employee_id IN (SELECT code FROM employees WHERE id = $3) OR employee_id IN (SELECT id FROM employees WHERE code = $3))
                 AND date_iso = $4
               RETURNING id, check_in, check_out`,
              [inT, outT, target.employeeId, target.dateIso]
            );
            if (upd.rows && upd.rows.length > 0) {
              for (const row of upd.rows) {
                await db.query('UPDATE attendance SET duration = $1 WHERE id = $2', [calcDur(row.check_in, row.check_out), row.id]);
              }
            } else if (inT || outT) {
              await db.query(
                `INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color, location_name)
                 VALUES ($1, $2, $3, $4, $5, $6, 'ลงเวลาเข้า-ออกครบถ้วน', '#10B981', $7)`,
                [`att-corr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, target.employeeId, target.dateIso, inT, outT, calcDur(inT, outT), 'บันทึกจากคำขอปรับปรุงเวลา (อนุมัติแล้ว)']
              );
            }
          }
        }

        if (target.employeeId) {
          sendNotif({
            employeeId: target.employeeId,
            title: `✅ ${typeLabel} ของคุณได้รับการอนุมัติแล้ว`,
            message: `${typeLabel} ได้รับการอนุมัติสมบูรณ์เรียบร้อยแล้ว โดย ${approver}`,
            type: 'success',
          });
        }

        return {
          id,
          status: 'อนุมัติแล้ว',
          message: 'อนุมัติคำขอสมบูรณ์เรียบร้อยแล้ว',
        };
      }

      // Reject Action (allowed at either level)
      await updatePg('status = $1, approver = $2, remark = $3', ['ไม่อนุมัติ', approver, remark || 'ไม่อนุมัติคำขอ']);
      syncMemory({ status: 'ไม่อนุมัติ', approver, remark: remark || 'ไม่อนุมัติคำขอ' });

      if (target.employeeId) {
        sendNotif({
          employeeId: target.employeeId,
          title: `❌ ${typeLabel} ของคุณไม่ได้รับการอนุมัติ`,
          message: `${typeLabel} ถูกปฏิเสธ โดย ${approver} (เหตุผล: ${remark || 'ไม่ระบุ'})`,
          type: 'error',
        });
      }

      return {
        id,
        status: 'ไม่อนุมัติ',
        message: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
      };
    },
  };

  return store;
};
