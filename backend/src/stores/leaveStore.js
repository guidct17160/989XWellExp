const db = require('../config/database');
const memoryStore = require('./memoryStore');

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
          allowedStartDate: p.allowedStartDate,
          allowedEndDate: p.allowedEndDate,
          dateRangeEnabled: p.dateRangeEnabled,
          minAdvanceDays: p.minAdvanceDays,
          maxConsecutiveDays: p.maxConsecutiveDays,
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
      ) || { id: 'ADM-001', name: 'สมชาย ใจดี (CEO / SuperBoss)', role: 'SuperBoss' };

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
            throw new Error(
              `ไม่อนุญาตให้ยื่นลาประเภท "${matchedPolicy.typeName}" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศหญิงเท่านั้น`
            );
          }
          if (isMalePolicy && !isRequesterMale) {
            throw new Error(
              `ไม่อนุญาตให้ยื่นลาประเภท "${matchedPolicy.typeName}" เนื่องจากสิทธิ์การลานี้เปิดให้เฉพาะพนักงานเพศชายเท่านั้น`
            );
          }
        }

        // 2. Date Range Constraints
        if (matchedPolicy.dateRangeEnabled) {
          if (matchedPolicy.allowedStartDate && data.startDate < matchedPolicy.allowedStartDate) {
            throw new Error(
              `ไม่อนุญาตให้ยื่นลาประเภทนี้ในวันที่ ${data.startDate} เนื่องจากอยู่นอกช่วงเวลาที่กำหนด (สามารถลาได้ตั้งแต่วันที่ ${matchedPolicy.allowedStartDate})`
            );
          }
          if (matchedPolicy.allowedEndDate && data.endDate > matchedPolicy.allowedEndDate) {
            throw new Error(
              `ไม่อนุญาตให้ยื่นลาประเภทนี้ในวันที่ ${data.endDate} เนื่องจากเกินวันที่กำหนดให้ลาได้ (สิ้นสุดวันที่ ${matchedPolicy.allowedEndDate})`
            );
          }
        }

        // 3. Balance / Quota Validation against Real Database
        const currentBalances = await (storeRef ? storeRef.getLeaveBalances(requester.id) : store.getLeaveBalances(requester.id));
        const reqBal = currentBalances.find(b => b.policyId === matchedPolicy.id || b.id === matchedPolicy.categoryKey);
        if (reqBal) {
          if (reqBal.remaining <= 0) {
            throw new Error(`คุณใช้สิทธิ์ "${matchedPolicy.typeName}" ครบตามกำหนดแล้ว (เหลือ 0 วัน) ไม่สามารถยื่นลาเพิ่มได้`);
          }
          if (Number(data.totalDays || 1) > reqBal.remaining) {
            throw new Error(`จำนวนวันลาที่ระบุ (${data.totalDays || 1} วัน) เกินสิทธิ์คงเหลือของคุณ (คงเหลือ ${reqBal.remaining} วัน)`);
          }
        }
      }

      const newLeave = {
        id: `leave-${Date.now()}`,
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
        superbossId: superboss.id,
        createdAt: new Date().toISOString().split('T')[0],
      };

      memoryStore.memoryLeaves.unshift(newLeave);

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
        }
      }

      if (targetApprover) {
        memoryStore.memoryNotifications.unshift({
          id: `notif-${Date.now()}`,
          employeeId: targetApprover.id,
          title: `📩 คำขอใหม่ (${data.leaveType}) จาก ${requester.name}`,
          message: `คุณได้รับการแจ้งเตือนคำขอ${data.leaveType} จาก ${requester.name} (${requester.department}) รอการอนุมัติระดับ ${initialLevel}`,
          type: 'warning',
          isRead: false,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        });
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
        }
      }
      return item;
    },

    // LEAVE POLICIES
    getLeavePolicies: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM leave_policies ORDER BY id ASC');
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              typeName: r.type_name,
              categoryKey: r.category_key,
              defaultQuota: parseInt(r.default_quota, 10) || 0,
              isPaid: !!r.is_paid,
              applicableGender: r.applicable_gender || 'all',
              allowedStartDate: r.allowed_start_date || null,
              allowedEndDate: r.allowed_end_date || null,
              dateRangeEnabled: !!r.date_range_enabled,
              minAdvanceDays: parseInt(r.min_advance_days, 10) || 0,
              maxConsecutiveDays: parseInt(r.max_consecutive_days, 10) || 30,
              allowBackdated: !!r.allow_backdated,
              maxBackdatedDays: parseInt(r.max_backdated_days, 10) || 0,
              requireAttachment: !!r.require_attachment,
              description: r.description || '',
              status: r.status || 'Active',
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in getLeavePolicies:', e);
        }
      }
      return memoryStore.memoryLeavePolicies;
    },

    addLeavePolicy: async (policyData) => {
      const newId = policyData.id || `LP-${String(memoryStore.memoryLeavePolicies.length + 1).padStart(2, '0')}`;
      const newPolicy = {
        id: newId,
        typeName: policyData.typeName || 'นโยบายการลาใหม่',
        categoryKey: policyData.categoryKey || 'custom',
        defaultQuota: parseInt(policyData.defaultQuota, 10) || 10,
        isPaid: policyData.isPaid !== undefined ? !!policyData.isPaid : true,
        applicableGender: policyData.applicableGender || 'all',
        allowedStartDate: policyData.allowedStartDate || null,
        allowedEndDate: policyData.allowedEndDate || null,
        dateRangeEnabled: !!policyData.dateRangeEnabled,
        minAdvanceDays: parseInt(policyData.minAdvanceDays, 10) || 0,
        maxConsecutiveDays: parseInt(policyData.maxConsecutiveDays, 10) || 30,
        allowBackdated: !!policyData.allowBackdated,
        maxBackdatedDays: parseInt(policyData.maxBackdatedDays, 10) || 0,
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
               allowed_start_date, allowed_end_date, date_range_enabled,
               min_advance_days, max_consecutive_days, allow_backdated, max_backdated_days,
               require_attachment, description, status, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               type_name = EXCLUDED.type_name,
               category_key = EXCLUDED.category_key,
               default_quota = EXCLUDED.default_quota,
               is_paid = EXCLUDED.is_paid,
               applicable_gender = EXCLUDED.applicable_gender,
               allowed_start_date = EXCLUDED.allowed_start_date,
               allowed_end_date = EXCLUDED.allowed_end_date,
               date_range_enabled = EXCLUDED.date_range_enabled,
               min_advance_days = EXCLUDED.min_advance_days,
               max_consecutive_days = EXCLUDED.max_consecutive_days,
               allow_backdated = EXCLUDED.allow_backdated,
               max_backdated_days = EXCLUDED.max_backdated_days,
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
              newPolicy.allowedStartDate,
              newPolicy.allowedEndDate,
              newPolicy.dateRangeEnabled,
              newPolicy.minAdvanceDays,
              newPolicy.maxConsecutiveDays,
              newPolicy.allowBackdated,
              newPolicy.maxBackdatedDays,
              newPolicy.requireAttachment,
              newPolicy.description,
              newPolicy.status,
            ]
          );
        } catch (e) {
          console.error('PG insert error in addLeavePolicy:', e);
        }
      }
      return newPolicy;
    },

    updateLeavePolicy: async (id, updateData) => {
      let existing = memoryStore.memoryLeavePolicies.find((p) => p.id === id);
      if (!existing) {
        existing = { id, typeName: updateData.typeName || 'นโยบายการลา', categoryKey: updateData.categoryKey || 'custom' };
        memoryStore.memoryLeavePolicies.push(existing);
      }

      const updated = {
        ...existing,
        ...updateData,
        id,
        defaultQuota: updateData.defaultQuota !== undefined ? parseInt(updateData.defaultQuota, 10) : existing.defaultQuota,
        applicableGender: updateData.applicableGender || existing.applicableGender || 'all',
        minAdvanceDays: updateData.minAdvanceDays !== undefined ? parseInt(updateData.minAdvanceDays, 10) : existing.minAdvanceDays,
        maxConsecutiveDays: updateData.maxConsecutiveDays !== undefined ? parseInt(updateData.maxConsecutiveDays, 10) : existing.maxConsecutiveDays,
        maxBackdatedDays: updateData.maxBackdatedDays !== undefined ? parseInt(updateData.maxBackdatedDays, 10) : existing.maxBackdatedDays,
        updatedAt: new Date().toISOString(),
      };

      const idx = memoryStore.memoryLeavePolicies.findIndex((p) => p.id === id);
      if (idx >= 0) memoryStore.memoryLeavePolicies[idx] = updated;

      if (db.isPgConnected()) {
        try {
          await db.query(
            `UPDATE leave_policies SET
               type_name = COALESCE($1, type_name),
               category_key = COALESCE($2, category_key),
               default_quota = COALESCE($3, default_quota),
               is_paid = COALESCE($4, is_paid),
               allowed_start_date = $5,
               allowed_end_date = $6,
               date_range_enabled = COALESCE($7, date_range_enabled),
               min_advance_days = COALESCE($8, min_advance_days),
               max_consecutive_days = COALESCE($9, max_consecutive_days),
               allow_backdated = COALESCE($10, allow_backdated),
               max_backdated_days = COALESCE($11, max_backdated_days),
               require_attachment = COALESCE($12, require_attachment),
               description = COALESCE($13, description),
               status = COALESCE($14, status),
               applicable_gender = COALESCE($15, applicable_gender),
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $16`,
            [
              updated.typeName,
              updated.categoryKey,
              updated.defaultQuota,
              updated.isPaid,
              updated.allowedStartDate || null,
              updated.allowedEndDate || null,
              updated.dateRangeEnabled,
              updated.minAdvanceDays,
              updated.maxConsecutiveDays,
              updated.allowBackdated,
              updated.maxBackdatedDays,
              updated.requireAttachment,
              updated.description,
              updated.status,
              updated.applicableGender,
              id,
            ]
          );
        } catch (e) {
          console.error('PG update error in updateLeavePolicy:', e);
        }
      }
      return updated;
    },

    deleteLeavePolicy: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM leave_policies WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteLeavePolicy:', e);
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

      // 2. Fetch OT
      let otList = [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query(`
            SELECT ot.*, 
                   COALESCE(e.name, a.name, ot.employee_id) as "employeeName", 
                   COALESCE(e.department, a.department, 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)') as department, 
                   COALESCE(e.role, a.role, 'Employee') as "requesterRole", 
                   COALESCE(e.code, a.code, ot.employee_id) as "employeeCode"
            FROM ot_requests ot
            LEFT JOIN employees e ON ot.employee_id = e.id OR ot.employee_id = e.code OR ot.employee_id = e.email
            LEFT JOIN admins a ON ot.employee_id = a.id OR ot.employee_id = a.code OR ot.employee_id = a.email
            ORDER BY ot.created_at DESC
          `);
          if (res.rows) {
            otList = res.rows.map((r) => enrichUserData({
              id: r.id,
              employeeId: r.employee_id,
              employeeName: r.employeeName,
              employeeCode: r.employeeCode,
              department: r.department,
              requesterRole: r.requesterRole,
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
          console.error('PG query error in ot pending:', e);
        }
      }
      if (otList.length === 0) {
        otList = memoryStore.memoryOt.map(enrichUserData);
      }

      // 3. Fetch Time Corrections
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
        if (s === 'อนุมัติแล้ว' || s === 'อนุมัติเรียบร้อย' || s === 'ไม่อนุมัติ' || s === 'ยกเลิกแล้ว') {
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

      const pendingOt = otList.filter(filterForUser).map((o) => ({
        ...o,
        requestType: 'ot',
        role: o.requesterRole || 'Employee',
        type: `ขอ OT (${o.hours || 1} ชม.)`,
        title: `ขอ OT (${o.hours || 1} ชม.)`,
        date: o.dateIso || o.createdAt || '-',
        details: o.taskDescription || o.reason || `ปฏิบัติงานล่วงเวลา ${o.startTime || '18:00'} - ${o.endTime || '20:00'} (${o.hours || 1} ชม.)`,
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

      return [...pendingLeaves, ...pendingOt, ...pendingCorrections];
    },

    processApprovalRequest: async ({ requestType, id, status, approver, remark, approverRole }) => {
      let target = null;
      let tableName = null;

      if (requestType === 'leave') {
        target = memoryStore.memoryLeaves.find((l) => l.id === id);
        tableName = 'leave_requests';
      } else if (requestType === 'ot') {
        target = memoryStore.memoryOt.find((o) => o.id === id);
        tableName = 'ot_requests';
      } else if (requestType === 'time-correction' || requestType === 'time_correction') {
        target = memoryStore.memoryTimeCorrections.find((c) => c.id === id);
        tableName = 'time_corrections';
      }

      if (db.isPgConnected() && tableName) {
        try {
          const res = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            target = {
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
              ...(target || {}),
            };
          }
        } catch (e) {
          console.error('PG query error in processApprovalRequest target lookup:', e);
        }
      }

      const isApproveAction = status === 'approved' || status === 'อนุมัติ' || status === 'อนุมัติแล้ว';
      const isApproverSuperboss =
        approverRole === 'SuperBoss' ||
        (approver && (approver.includes('SuperBoss') || approver.includes('CEO') || approver.includes('เดชอุดม')));

      if (isApproveAction) {
        const isLevel1 =
          !isApproverSuperboss &&
          target &&
          (target.approvalLevel === 1 ||
           target.status === 'รออนุมัติ' ||
           target.status === 'รออนุมัติระดับ 1 (Boss)') &&
          target.requesterRole !== 'Boss' &&
          target.requesterRole !== 'Manager';

        if (isLevel1) {
          if (target) {
            target.approvalLevel = 2;
            target.status = 'รออนุมัติระดับ 2 (Superboss)';
            target.approverLevel1 = approver;
          }

          if (db.isPgConnected() && tableName) {
            try {
              await db.query(
                `UPDATE ${tableName} SET status = $1, approver = $2 WHERE id = $3`,
                ['รออนุมัติระดับ 2 (Superboss)', approver, id]
              );
            } catch (e) {
              console.error('PG update error in approval Level 1:', e);
            }
          }

          const superbossId = (target && target.superbossId) || 'ADM-001';
          memoryStore.memoryNotifications.unshift({
            id: `notif-${Date.now()}`,
            employeeId: superbossId,
            title: `📢 คำขอของ ${target?.employeeName || 'พนักงาน'} ผ่านการอนุมัติระดับ 1 แล้ว`,
            message: `คำขอผ่าน Boss (${approver}) เรียบร้อยแล้ว รอ Superboss พิจารณาอนุมัติระดับ 2`,
            type: 'info',
            isRead: false,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          });

          return {
            id,
            status: 'รออนุมัติระดับ 2 (Superboss)',
            message: 'อนุมัติระดับ 1 (Boss) เรียบร้อยแล้ว ส่งต่อไปยังระดับ 2 (Superboss)',
          };
        } else {
          // Level 2 Final Approval
          if (target) {
            target.status = 'อนุมัติแล้ว';
            target.approver = approver;
            target.remark = remark || 'อนุมัติสมบูรณ์';
          }

          if (db.isPgConnected() && tableName) {
            try {
              await db.query(
                `UPDATE ${tableName} SET status = $1, approver = $2, remark = $3 WHERE id = $4`,
                ['อนุมัติแล้ว', approver, remark || 'อนุมัติสมบูรณ์', id]
              );
            } catch (e) {
              console.error('PG update error in approval Level 2:', e);
            }
          }

          // If Time Correction is approved, update the attendance table
          if (requestType === 'time-correction' || requestType === 'time_correction' || target?.dateIso) {
            const targetDate = target?.dateIso;
            const newIn = target?.newCheckIn;
            const newOut = target?.newCheckOut;
            const targetEmpId = target?.employeeId;

            if (targetDate && targetEmpId) {
              const attIdx = memoryStore.memoryAttendance.findIndex(
                (a) => a && (a.employeeId === targetEmpId || a.employeeCode === targetEmpId) && a.dateIso === targetDate
              );
              if (attIdx !== -1) {
                if (newIn && newIn !== '-') memoryStore.memoryAttendance[attIdx].checkIn = newIn;
                if (newOut && newOut !== '-') memoryStore.memoryAttendance[attIdx].checkOut = newOut;
                memoryStore.memoryAttendance[attIdx].status = 'ลงเวลาเข้า-ออกครบถ้วน';
                memoryStore.memoryAttendance[attIdx].isCorrected = true;
                memoryStore.memoryAttendance[attIdx].isApproved = true;
              }

              if (db.isPgConnected()) {
                try {
                  await db.query(
                    `UPDATE attendance 
                     SET check_in = COALESCE(NULLIF($1, '-'), check_in),
                         check_out = COALESCE(NULLIF($2, '-'), check_out),
                         status = 'ลงเวลาเข้า-ออกครบถ้วน'
                     WHERE (employee_id = $3 OR employee_id = (SELECT code FROM employees WHERE id = $3 LIMIT 1))
                       AND date_iso = $4`,
                    [newIn, newOut, targetEmpId, targetDate]
                  );
                } catch (e) {
                  console.error('PG update attendance upon correction approval error:', e);
                }
              }
            }
          }

          if (target && target.employeeId) {
            memoryStore.memoryNotifications.unshift({
              id: `notif-${Date.now()}`,
              employeeId: target.employeeId,
              title: `✅ คำขอของคุณได้รับการอนุมัติแล้ว`,
              message: `คำขอ ${target.title || target.leaveType || 'ของคุณ'} ได้รับการอนุมัติสมบูรณ์เรียบร้อยแล้ว โดย ${approver}`,
              type: 'success',
              isRead: false,
              createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            });
          }

          return {
            id,
            status: 'อนุมัติแล้ว',
            message: 'อนุมัติคำขอสมบูรณ์เรียบร้อยแล้ว',
          };
        }
      } else {
        // Reject Action
        if (target) {
          target.status = 'ไม่อนุมัติ';
          target.approver = approver;
          target.remark = remark || 'ไม่อนุมัติคำขอ';
        }

        if (db.isPgConnected() && tableName) {
          try {
            await db.query(
              `UPDATE ${tableName} SET status = $1, approver = $2, remark = $3 WHERE id = $4`,
              ['ไม่อนุมัติ', approver, remark || 'ไม่อนุมัติคำขอ', id]
            );
          } catch (e) {
            console.error('PG update error in reject:', e);
          }
        }

        if (target && target.employeeId) {
          memoryStore.memoryNotifications.unshift({
            id: `notif-${Date.now()}`,
            employeeId: target.employeeId,
            title: `❌ คำขอของคุณไม่ได้รับการอนุมัติ`,
            message: `คำขอ ${target.title || target.leaveType || 'ของคุณ'} ถูกปฏิเสธ โดย ${approver} (เหตุผล: ${remark || 'ไม่ระบุ'})`,
            type: 'error',
            isRead: false,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          });
        }

        return {
          id,
          status: 'ไม่อนุมัติ',
          message: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
        };
      }
    },
  };

  return store;
};
