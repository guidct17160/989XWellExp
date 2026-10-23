const db = require('../config/database');
const memoryStore = require('./memoryStore');
const { todayIso } = require('../utils/time');

// Single source of truth: PostgreSQL employees row -> client object (snake_case -> camelCase)
const mapEmployeeRow = (r) => {
  const firstName = r.first_name || (r.name ? r.name.split(' ')[0] : '');
  const lastName = r.last_name || (r.name ? r.name.split(' ').slice(1).join(' ') : '');
  const fullName = `${firstName} ${lastName}`.trim() || r.name;
  return {
    id: r.id,
    code: r.code,
    username: r.username || r.code,
    password: r.password || '',
    name: fullName,
    firstName: firstName,
    lastName: lastName,
    email: r.email,
    phone: r.phone,
    department: r.department,
    role: r.role || 'Employee',
    status: r.status,
    startDate: r.start_date,
    resignDate: r.resign_date || null,
    avatarUrl: r.avatar_url,
    gender: r.gender || 'Male',
    pinHash: r.pin_hash || null,
    points: parseInt(r.points, 10) || 0,
    birthDate: r.birth_date || null,
    dob: r.birth_date || null,
    createdAt: r.created_at,
  };
};

// Translate common PG errors into user-facing messages
const pgFriendlyError = (e, fallback) => {
  if (e && e.code === '23505') {
    const err = new Error('ข้อมูลซ้ำในระบบ (อีเมล / รหัสพนักงาน / ชื่อผู้ใช้ ถูกใช้งานแล้ว)');
    err.status = 409;
    return err;
  }
  return new Error(fallback || (e && e.message) || 'Database error');
};

module.exports = function createUserStore(storeRef) {
  return {
    // EMPLOYEES
    getEmployees: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM employees ORDER BY created_at DESC');
          if (res.rows) {
            return res.rows.map(mapEmployeeRow);
          }
        } catch (e) {
          console.error('PG query error in getEmployees:', e);
        }
      }
      return memoryStore.memoryEmployees;
    },

    getEmployeeById: async (id) => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM employees WHERE id = $1 OR code = $1 OR username = $1', [id]);
          if (res.rows.length > 0) {
            return mapEmployeeRow(res.rows[0]);
          }
          return undefined;
        } catch (e) {
          console.error('PG query error in getEmployeeById:', e);
        }
      }
      return memoryStore.memoryEmployees.find((e) => e.id === id || e.code === id || e.username === id);
    },

    addEmployee: async (empData) => {
      const inputEmail = empData.email ? empData.email.trim().toLowerCase() : '';
      const inputCode = empData.code ? empData.code.trim() : '';

      if (!inputEmail) {
        throw new Error('อีเมลพนักงานจำเป็นต้องระบุ เพื่อใช้เป็น Username ในการเข้าสู่ระบบ Mobile App');
      }

      const newGuid = `GUID-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const newId = empData.id || `EMP-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
      const finalCode = inputCode || newId;
      const finalUsername = inputEmail;
      const finalPassword = empData.password && empData.password.trim() ? empData.password.trim() : '1234';

      const inputFirstName = empData.firstName ? empData.firstName.trim() : (empData.name ? empData.name.trim().split(/\s+/)[0] : '');
      const inputLastName = empData.lastName ? empData.lastName.trim() : (empData.name ? empData.name.trim().split(/\s+/).slice(1).join(' ') : '');
      const fullName = `${inputFirstName} ${inputLastName}`.trim() || empData.name || 'Unassigned Employee';
      const finalGender = empData.gender || 'Male';

      // Clear History: Purge residual historical logs if re-registering with an email of a deleted account
      memoryStore.memoryAttendance = memoryStore.memoryAttendance.filter((a) => a.employeeId !== inputEmail && a.employeeId !== finalCode && a.employeeId !== newId);
      memoryStore.memoryLeaves = memoryStore.memoryLeaves.filter((l) => l.employeeId !== inputEmail && l.employeeId !== finalCode && l.employeeId !== newId);
      memoryStore.memoryNotifications = memoryStore.memoryNotifications.filter((n) => n.employeeId !== inputEmail && n.employeeId !== finalCode && n.employeeId !== newId);
      delete memoryStore.memoryPointHistory[inputEmail];

      const newEmp = {
        id: newId,
        code: finalCode,
        username: finalUsername,
        password: finalPassword,
        name: fullName,
        firstName: inputFirstName,
        lastName: inputLastName,
        email: inputEmail,
        phone: empData.phone || '-',
        department: empData.department || '',
        role: empData.role || 'Employee',
        status: empData.status || 'Pending Password',
        startDate: empData.startDate || todayIso(),
        avatarUrl:
          empData.avatarUrl ||
          (finalGender === 'Female'
            ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
        gender: finalGender,
        pinHash: empData.pinHash || null,
        points: parseInt(empData.points, 10) || 0,
        birthDate: empData.birthDate || empData.birth_date || empData.dob || null,
        dob: empData.birthDate || empData.birth_date || empData.dob || null,
        resignDate: null,
        createdAt: new Date().toISOString(),
      };

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO employees (id, code, username, password, name, first_name, last_name, email, phone, department, role, status, start_date, avatar_url, gender, pin_hash, birth_date, points, department_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text, $11, $12, $13, $14, $15, $16, $17, $18,
               (SELECT id FROM departments WHERE name = $10::text LIMIT 1))`,
            [
              newEmp.id,
              newEmp.code,
              newEmp.username,
              newEmp.password,
              newEmp.name,
              newEmp.firstName,
              newEmp.lastName,
              newEmp.email,
              newEmp.phone,
              newEmp.department,
              newEmp.role,
              newEmp.status,
              newEmp.startDate,
              newEmp.avatarUrl,
              newEmp.gender,
              newEmp.pinHash,
              newEmp.birthDate,
              newEmp.points,
            ]
          );
        } catch (e) {
          // PostgreSQL is the source of truth - never report success if the row was not saved
          console.error('PG insert error in addEmployee:', e);
          throw pgFriendlyError(e, 'ไม่สามารถบันทึกข้อมูลพนักงานลงฐานข้อมูลได้');
        }
      }

      memoryStore.memoryEmployees = [newEmp, ...memoryStore.memoryEmployees.filter((e) => e.id !== newEmp.id && e.email !== newEmp.email)];
      return newEmp;
    },

    updateEmployee: async (id, updateData) => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query(
            'SELECT * FROM employees WHERE id = $1 OR code = $1 OR email = $1 OR username = $1',
            [id]
          );
          if (res.rows.length === 0) return null;

          const r = res.rows[0];
          const existing = mapEmployeeRow(r);
          const updated = { ...existing, ...updateData };
          if (updateData.firstName || updateData.lastName) {
            updated.firstName = updateData.firstName || existing.firstName;
            updated.lastName = updateData.lastName || existing.lastName;
            updated.name = `${updated.firstName} ${updated.lastName}`.trim();
          } else if (updateData.name && updateData.name !== existing.name) {
            const parts = String(updateData.name).trim().split(/\s+/);
            updated.firstName = parts[0] || '';
            updated.lastName = parts.slice(1).join(' ');
          }
          if (updateData.startDate || updateData.start_date) {
            updated.startDate = updateData.startDate || updateData.start_date;
          }
          if (updateData.birthDate || updateData.birth_date || updateData.dob) {
            updated.birthDate = updateData.birthDate || updateData.birth_date || updateData.dob;
            updated.dob = updated.birthDate;
          }
          if (updateData.points !== undefined) {
            updated.points = parseInt(updateData.points, 10) || 0;
          }
          if (updateData.resignDate || updateData.resign_date) {
            updated.resignDate = updateData.resignDate || updateData.resign_date;
          } else if ((updateData.status === 'Resign' || updateData.status === 'Resigned') && !existing.resignDate) {
            // Resign date defaults to today (NOT the hire date)
            updated.resignDate = todayIso();
          } else {
            updated.resignDate = existing.resignDate;
          }
          await db.query(
            `UPDATE employees
             SET name=$1, first_name=$2, last_name=$3, email=$4, phone=$5, department=$6::text, role=$7, status=$8, password=$9, username=$10, avatar_url=$11, gender=$12, pin_hash=$13, start_date=$14, birth_date=$15, points=$16, resign_date=$17,
                 department_id=(SELECT id FROM departments WHERE name = $6::text LIMIT 1)
             WHERE id=$18`,
            [
              updated.name,
              updated.firstName,
              updated.lastName,
              updated.email,
              updated.phone,
              updated.department,
              updated.role,
              updated.status,
              updated.password,
              updated.username,
              updated.avatarUrl,
              updated.gender || 'Male',
              updated.pinHash !== undefined ? updated.pinHash : existing.pinHash,
              updated.startDate,
              updated.birthDate,
              updated.points,
              updated.resignDate || null,
              r.id,
            ]
          );

          const idx = memoryStore.memoryEmployees.findIndex((e) => e.id === r.id);
          if (idx !== -1) {
            memoryStore.memoryEmployees[idx] = updated;
          } else {
            memoryStore.memoryEmployees.push(updated);
          }
          return updated;
        } catch (e) {
          console.error('PG update error in updateEmployee:', e);
          throw pgFriendlyError(e, 'ไม่สามารถบันทึกการแก้ไขข้อมูลพนักงานลงฐานข้อมูลได้');
        }
      }

      const idx = memoryStore.memoryEmployees.findIndex(
        (e) => e.id === id || e.code === id || e.email === id || e.username === id
      );
      if (idx !== -1) {
        memoryStore.memoryEmployees[idx] = { ...memoryStore.memoryEmployees[idx], ...updateData };
        return memoryStore.memoryEmployees[idx];
      }
      return null;
    },

    deleteEmployee: async (id) => {
      let isDeleted = false;

      let emp = memoryStore.memoryEmployees.find(
        (e) => e && (e.id === id || e.code === id || e.email === id || e.username === id)
      );

      if (db.isPgConnected()) {
        const res = await db.query(
          'SELECT id, code, email FROM employees WHERE id = $1 OR code = $1 OR email = $1 OR username = $1',
          [id]
        );
        if (res.rows && res.rows.length > 0) {
          emp = res.rows[0];
        }
      }

      const empId = emp ? emp.id : id;
      const empCode = emp ? emp.code : id;
      const empEmail = emp ? emp.email : id;

      if (db.isPgConnected()) {
        // One transaction: remove the employee together with ALL rows that reference them
        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');
          const ids = [empId, empCode, empEmail];
          await client.query('DELETE FROM attendance WHERE employee_id = ANY($1)', [ids]);
          await client.query('DELETE FROM leave_requests WHERE employee_id = ANY($1)', [ids]);
          await client.query('DELETE FROM time_corrections WHERE employee_id = ANY($1)', [ids]);
          await client.query('DELETE FROM notifications WHERE employee_id = ANY($1)', [ids]);
          await client.query('DELETE FROM point_transactions WHERE employee_id = ANY($1)', [ids]);
          await client.query('DELETE FROM redemptions WHERE employee_id = ANY($1)', [ids]);
          const delRes = await client.query('DELETE FROM employees WHERE id = $1', [empId]);
          await client.query('COMMIT');
          if (delRes.rowCount > 0) {
            isDeleted = true;
          }
        } catch (e) {
          try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
          console.error('PG delete error in deleteEmployee:', e);
          throw new Error('ไม่สามารถลบข้อมูลพนักงานออกจากฐานข้อมูลได้');
        } finally {
          client.release();
        }
      }

      const prevLen = memoryStore.memoryEmployees.length;
      memoryStore.memoryEmployees = memoryStore.memoryEmployees.filter(
        (e) => e && e.id !== id && e.code !== id && e.email !== id && e.username !== id && e.id !== empId
      );
      if (memoryStore.memoryEmployees.length < prevLen) {
        isDeleted = true;
      }

      memoryStore.memoryAttendance = memoryStore.memoryAttendance.filter(
        (a) => a && a.employeeId !== empId && a.employeeId !== empCode && a.employeeId !== empEmail
      );
      memoryStore.memoryLeaves = memoryStore.memoryLeaves.filter(
        (l) => l && l.employeeId !== empId && l.employeeId !== empCode && l.employeeId !== empEmail
      );
      memoryStore.memoryTimeCorrections = memoryStore.memoryTimeCorrections.filter(
        (c) => c && c.employeeId !== empId && c.employeeId !== empCode
      );
      memoryStore.memoryRedemptions = memoryStore.memoryRedemptions.filter(
        (r) => r && r.employeeId !== empId && r.employeeId !== empCode
      );
      memoryStore.memoryNotifications = memoryStore.memoryNotifications.filter(
        (n) => n && n.employeeId !== empId && n.employeeId !== empCode
      );

      delete memoryStore.memoryPointHistory[empId];
      delete memoryStore.memoryPointHistory[empCode];
      delete memoryStore.memoryPointHistory[empEmail];


      delete memoryStore.memoryPushTokens[empId];
      delete memoryStore.memoryPushTokens[empCode];
      delete memoryStore.memoryPushTokens[empEmail];

      return isDeleted;
    },

    // DEPARTMENTS
    getDepartments: async () => {
      let finalDepts = [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM departments ORDER BY id ASC');
          if (res.rows) {
            finalDepts = res.rows.map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              manager: r.manager || 'ไม่ระบุ',
              employeeCount: 0, // replaced by the live count below
              status: r.status || 'Active',
            }));
          }
        } catch (e) {
          console.error('PG error in getDepartments:', e);
          finalDepts = memoryStore.memoryDepartments;
        }
      } else {
        finalDepts = memoryStore.memoryDepartments;
      }

      const [employees, admins] = await Promise.all([
        storeRef.getEmployees(),
        storeRef.getAdmins(),
      ]);

      const allUsers = [...employees, ...admins];

      return finalDepts.map((d) => {
        const deptEmployees = employees.filter(
          (e) => e && e.department && e.department.trim().toLowerCase() === d.name.trim().toLowerCase()
        );
        const count = deptEmployees.length;

        const bossObj = allUsers.find(
          (u) => u && u.department && u.department.trim().toLowerCase() === d.name.trim().toLowerCase() &&
                 (u.role === 'Boss' || u.role === 'Manager' || u.role === 'HR Admin' || u.role === 'Super Admin' || u.role === 'SuperBoss')
        );

        const managerName = bossObj ? `คุณ ${bossObj.name}` : (d.manager && d.manager !== 'ไม่ระบุหัวหน้าฝ่าย' ? d.manager : 'ไม่ระบุหัวหน้าฝ่าย');

        return {
          ...d,
          manager: managerName,
          employeeCount: count,
          memberCount: count,
        };
      });
    },

    addDepartment: async (deptData) => {
      // Unique id/code (never derived from the in-memory array length: it is empty after a restart
      // and would collide with / overwrite an existing DEP-01 row)
      const uniq = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const newId = deptData.id || `DEP-${uniq}`;
      const newDept = {
        id: newId,
        code: deptData.code || `DEP-${uniq}`,
        name: deptData.name ? deptData.name.trim() : 'ฝ่ายงานใหม่',
        manager: deptData.manager || 'ไม่ระบุ',
        employeeCount: 0,
        status: deptData.status || 'Active',
      };

      if (db.isPgConnected()) {
        try {
          const check = await db.query('SELECT * FROM departments WHERE id = $1 OR (name = $2 AND $3::boolean = FALSE)', [newDept.id, newDept.name, !!deptData.id]);
          if (check.rows && check.rows.length > 0) {
            const old = check.rows[0];
            await db.query(
              `UPDATE departments SET
                 code = $1,
                 name = $2,
                 manager = COALESCE($3, manager),
                 status = $4
               WHERE id = $5`,
              [newDept.code, newDept.name, deptData.manager || null, newDept.status, old.id]
            );
            newDept.id = old.id;
            // Employees / admins reference the department by NAME -> keep them in sync on rename
            if (old.name && old.name !== newDept.name) {
              await db.query('UPDATE employees SET department = $1 WHERE department = $2', [newDept.name, old.name]);
              await db.query('UPDATE admins SET department = $1 WHERE department = $2', [newDept.name, old.name]);
              memoryStore.memoryEmployees.forEach((e) => { if (e.department === old.name) e.department = newDept.name; });
            }
          } else {
            await db.query(
              `INSERT INTO departments (id, code, name, manager, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [newDept.id, newDept.code, newDept.name, newDept.manager, newDept.status]
            );
          }
        } catch (e) {
          console.error('PG insert/update error in addDepartment:', e);
          throw pgFriendlyError(e, 'ไม่สามารถบันทึกข้อมูลแผนกลงฐานข้อมูลได้');
        }
      }

      const idx = memoryStore.memoryDepartments.findIndex((d) => d.id === newDept.id || d.name === newDept.name);
      if (idx >= 0) {
        memoryStore.memoryDepartments[idx] = newDept;
      } else {
        memoryStore.memoryDepartments.push(newDept);
      }

      return newDept;
    },

    deleteDepartment: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM departments WHERE id = $1 OR code = $1 OR name = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteDepartment:', e);
          throw new Error('ไม่สามารถลบแผนกออกจากฐานข้อมูลได้');
        }
      }
      memoryStore.memoryDepartments = memoryStore.memoryDepartments.filter((d) => d.id !== id && d.code !== id && d.name !== id);
      return true;
    },

    // ADMINS
    getAdmins: async () => {

      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM admins ORDER BY created_at DESC');
          if (res.rows) {
            return res.rows.map((r) => ({
              id: r.id,
              code: r.code,
              username: r.username,
              password: r.password,
              name: r.name,
              email: r.email,
              phone: r.phone,
              department: r.department,
              role: r.role,
              status: r.status,
              startDate: r.start_date,
              avatarUrl: r.avatar_url,
              pinHash: r.pin_hash || null,
            }));
          }
        } catch (e) {
          console.error('PG query error in getAdmins:', e);
        }
      }
      return memoryStore.memoryAdmins;
    },

    getAdminById: async (id) => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM admins WHERE id = $1 OR username = $1 OR code = $1', [id]);
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              code: r.code,
              username: r.username,
              password: r.password,
              name: r.name,
              email: r.email,
              phone: r.phone,
              department: r.department,
              role: r.role,
              status: r.status,
              startDate: r.start_date,
              avatarUrl: r.avatar_url,
              pinHash: r.pin_hash || null,
            };
          }
        } catch (e) { }
      }
      return memoryStore.memoryAdmins.find((a) => a.id === id || a.username === id || a.code === id);
    },

    addAdmin: async (adminData) => {
      const finalId = adminData.id || `ADM-${Date.now().toString().slice(-4)}`;
      const finalCode = adminData.code || finalId;
      const finalUsername = adminData.username ? adminData.username.trim() : `admin_${Date.now().toString().slice(-4)}`;
      const finalEmail = adminData.email && adminData.email.trim() ? adminData.email.trim() : `${finalUsername}@wellx989.com`;

      const newAdmin = {
        id: finalId,
        code: finalCode,
        username: finalUsername,
        password: adminData.password || '1234',
        name: adminData.name ? adminData.name.trim() : 'Web Admin',
        email: finalEmail,
        phone: adminData.phone || '-',
        department: adminData.department || '-',
        role: adminData.role || 'HR Admin',
        status: adminData.status || 'Active',
        startDate: adminData.startDate || new Date().toISOString().split('T')[0],
        avatarUrl: adminData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      };

      const idx = memoryStore.memoryAdmins.findIndex((a) => a.id === newAdmin.id || a.username === newAdmin.username);
      if (idx >= 0) {
        memoryStore.memoryAdmins[idx] = newAdmin;
      } else {
        memoryStore.memoryAdmins.unshift(newAdmin);
      }

      if (db.isPgConnected()) {
        try {
          const check = await db.query('SELECT * FROM admins WHERE id = $1 OR username = $2', [newAdmin.id, newAdmin.username]);
          if (check.rows && check.rows.length > 0) {
            await db.query(
              `UPDATE admins SET
                 code = $1,
                 password = $2,
                 name = $3,
                 email = $4,
                 phone = $5,
                 department = $6,
                 role = $7,
                 status = $8,
                 avatar_url = $9
               WHERE id = $10 OR username = $11`,
              [
                newAdmin.code,
                newAdmin.password,
                newAdmin.name,
                newAdmin.email,
                newAdmin.phone,
                newAdmin.department,
                newAdmin.role,
                newAdmin.status,
                newAdmin.avatarUrl,
                check.rows[0].id,
                newAdmin.username,
              ]
            );
          } else {
            await db.query(
              `INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date, avatar_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                newAdmin.id,
                newAdmin.code,
                newAdmin.username,
                newAdmin.password,
                newAdmin.name,
                newAdmin.email,
                newAdmin.phone,
                newAdmin.department,
                newAdmin.role,
                newAdmin.status,
                newAdmin.startDate,
                newAdmin.avatarUrl,
              ]
            );
          }
        } catch (e) {
          console.error('PG insert/update error in addAdmin:', e);
          throw pgFriendlyError(e, 'ไม่สามารถบันทึกข้อมูลผู้ดูแลระบบลงฐานข้อมูลได้');
        }
      }

      return newAdmin;
    },

    updateAdmin: async (id, updateData) => {
      let existing = await storeRef.getAdminById(id);
      if (!existing) return null;

      const updated = { ...existing, ...updateData };
      // pinHash: undefined = keep, null = clear, string = set
      const pinProvided = updateData.pinHash !== undefined;

      if (db.isPgConnected()) {
        try {
          await db.query(
            `UPDATE admins SET
               username = COALESCE($1, username),
               password = COALESCE($2, password),
               name = COALESCE($3, name),
               email = COALESCE($4, email),
               phone = COALESCE($5, phone),
               department = COALESCE($6, department),
               role = COALESCE($7, role),
               status = COALESCE($8, status),
               avatar_url = COALESCE($9, avatar_url),
               start_date = COALESCE($10, start_date),
               pin_hash = CASE WHEN $11::boolean THEN $12 ELSE pin_hash END
             WHERE id = $13`,
            [
              updateData.username,
              updateData.password,
              updateData.name,
              updateData.email,
              updateData.phone,
              updateData.department,
              updateData.role,
              updateData.status,
              updateData.avatarUrl,
              updateData.startDate,
              pinProvided,
              pinProvided ? updateData.pinHash : null,
              existing.id,
            ]
          );
        } catch (e) {
          console.error('PG update error in updateAdmin:', e);
          throw pgFriendlyError(e, 'ไม่สามารถบันทึกการแก้ไขผู้ดูแลระบบลงฐานข้อมูลได้');
        }
      }

      const idx = memoryStore.memoryAdmins.findIndex((a) => a.id === existing.id);
      if (idx >= 0) {
        memoryStore.memoryAdmins[idx] = updated;
      }
      return updated;
    },

    deleteAdmin: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM admins WHERE id = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteAdmin:', e);
          throw new Error('ไม่สามารถลบผู้ดูแลระบบออกจากฐานข้อมูลได้');
        }
      }
      memoryStore.memoryAdmins = memoryStore.memoryAdmins.filter((a) => a.id !== id);
      return true;
    },
  };
};
