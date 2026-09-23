const db = require('../config/database');
const memoryStore = require('./memoryStore');

module.exports = function createUserStore(storeRef) {
  return {
    // EMPLOYEES
    getEmployees: async () => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM employees ORDER BY created_at DESC');
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => {
              const firstName = r.first_name || (r.name ? r.name.split(' ')[0] : '');
              const lastName = r.last_name || (r.name ? r.name.split(' ').slice(1).join(' ') : '');
              const fullName = `${firstName} ${lastName}`.trim() || r.name;
              return {
                id: r.id,
                code: r.code,
                username: r.username || r.code,
                password: r.password || '1234',
                name: fullName,
                firstName: firstName,
                lastName: lastName,
                email: r.email,
                phone: r.phone,
                department: r.department,
                role: r.role || 'Employee',
                status: r.status,
                startDate: r.start_date,
                salary: Number(r.salary),
                avatarUrl: r.avatar_url,
                gender: r.gender || 'Male',
              };
            });
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
            const r = res.rows[0];
            const firstName = r.first_name || (r.name ? r.name.split(' ')[0] : '');
            const lastName = r.last_name || (r.name ? r.name.split(' ').slice(1).join(' ') : '');
            const fullName = `${firstName} ${lastName}`.trim() || r.name;
            return {
              id: r.id,
              code: r.code,
              username: r.username || r.code,
              password: r.password || '1234',
              name: fullName,
              firstName: firstName,
              lastName: lastName,
              email: r.email,
              phone: r.phone,
              department: r.department,
              role: r.role || 'Employee',
              status: r.status,
              startDate: r.start_date,
              salary: Number(r.salary),
              avatarUrl: r.avatar_url,
              gender: r.gender || 'Male',
            };
          }
        } catch (e) { }
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
      delete memoryStore.memoryUserMissions[inputEmail];
      delete memoryStore.memoryPushTokens[inputEmail];

      const newEmp = {
        id: newId,
        guid: newGuid,
        code: finalCode,
        username: finalUsername,
        password: finalPassword,
        name: fullName,
        firstName: inputFirstName,
        lastName: inputLastName,
        email: inputEmail,
        phone: empData.phone || '-',
        department: empData.department || '-',
        role: empData.role || 'Employee',
        status: empData.status || 'Pending',
        startDate: empData.startDate || new Date().toISOString().split('T')[0],
        salary: Number(empData.salary) || 30000,
        avatarUrl: empData.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        gender: finalGender,
      };

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO employees (id, code, username, password, name, first_name, last_name, email, phone, department, role, status, start_date, salary, avatar_url, gender)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
              newEmp.salary,
              newEmp.avatarUrl,
              newEmp.gender,
            ]
          );
        } catch (e) {
          console.error('PG insert error in addEmployee:', e);
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
          if (res.rows.length > 0) {
            const r = res.rows[0];
            const existing = {
              id: r.id,
              code: r.code,
              username: r.username || r.code,
              password: r.password || '1234',
              name: r.name,
              firstName: r.first_name || (r.name ? r.name.split(' ')[0] : ''),
              lastName: r.last_name || (r.name ? r.name.split(' ').slice(1).join(' ') : ''),
              email: r.email,
              phone: r.phone,
              department: r.department,
              role: r.role || 'Employee',
              status: r.status,
              startDate: r.start_date,
              salary: Number(r.salary),
              avatarUrl: r.avatar_url,
              gender: r.gender || 'Male',
            };
            const updated = { ...existing, ...updateData };
            if (updateData.firstName || updateData.lastName) {
              updated.firstName = updateData.firstName || existing.firstName;
              updated.lastName = updateData.lastName || existing.lastName;
              updated.name = `${updated.firstName} ${updated.lastName}`.trim();
            }
            await db.query(
              `UPDATE employees 
               SET name=$1, first_name=$2, last_name=$3, email=$4, phone=$5, department=$6, role=$7, status=$8, password=$9, username=$10, avatar_url=$11, gender=$12 
               WHERE id=$13 OR code=$13 OR email=$13 OR username=$13`,
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
                id,
              ]
            );

            const idx = memoryStore.memoryEmployees.findIndex(
              (e) => e.id === id || e.code === id || e.email === id || e.username === id
            );
            if (idx !== -1) {
              memoryStore.memoryEmployees[idx] = updated;
            } else {
              memoryStore.memoryEmployees.push(updated);
            }
            return updated;
          }
        } catch (e) {
          console.error('PG update error', e);
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

      if (!emp && db.isPgConnected()) {
        try {
          const res = await db.query(
            'SELECT * FROM employees WHERE id = $1 OR code = $1 OR email = $1 OR username = $1',
            [id]
          );
          if (res.rows && res.rows.length > 0) {
            emp = res.rows[0];
          }
        } catch (e) {
          console.error('PG query error in deleteEmployee lookup:', e);
        }
      }

      const empId = emp ? emp.id : id;
      const empCode = emp ? emp.code : id;
      const empEmail = emp ? emp.email : id;

      const prevLen = memoryStore.memoryEmployees.length;
      memoryStore.memoryEmployees = memoryStore.memoryEmployees.filter(
        (e) => e && e.id !== id && e.code !== id && e.email !== id && e.username !== id
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
      memoryStore.memoryOt = memoryStore.memoryOt.filter(
        (o) => o && o.employeeId !== empId && o.employeeId !== empCode
      );
      memoryStore.memoryPayslips = memoryStore.memoryPayslips.filter(
        (p) => p && p.employeeId !== empId && p.employeeId !== empCode
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

      delete memoryStore.memoryUserMissions[empId];
      delete memoryStore.memoryUserMissions[empCode];
      delete memoryStore.memoryUserMissions[empEmail];

      delete memoryStore.memoryPushTokens[empId];
      delete memoryStore.memoryPushTokens[empCode];
      delete memoryStore.memoryPushTokens[empEmail];

      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM attendance WHERE employee_id = $1 OR employee_id = $2 OR employee_id = $3', [empId, empCode, empEmail]);
          await db.query('DELETE FROM leave_requests WHERE employee_id = $1 OR employee_id = $2 OR employee_id = $3', [empId, empCode, empEmail]);
          await db.query('DELETE FROM ot_requests WHERE employee_id = $1 OR employee_id = $2', [empId, empCode]);
          await db.query('DELETE FROM payslips WHERE employee_id = $1 OR employee_id = $2', [empId, empCode]);
          await db.query('DELETE FROM notifications WHERE employee_id = $1 OR employee_id = $2', [empId, empCode]);

          const res = await db.query(
            'DELETE FROM employees WHERE id = $1 OR code = $1 OR email = $2 OR username = $2',
            [empId, empEmail]
          );
          if (res.rowCount > 0) {
            isDeleted = true;
          }
        } catch (e) {
          console.error('PG delete error in deleteEmployee:', e);
        }
      }
      return isDeleted || true;
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
              employeeCount: r.employee_count || 0,
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
      const newId = deptData.id || `DEP-${String(memoryStore.memoryDepartments.length + 1).padStart(2, '0')}`;
      const newDept = {
        id: newId,
        code: deptData.code || `DEP-${memoryStore.memoryDepartments.length + 1}`,
        name: deptData.name ? deptData.name.trim() : 'ฝ่ายงานใหม่',
        manager: deptData.manager || 'ไม่ระบุ',
        employeeCount: 0,
        status: 'Active',
      };

      const idx = memoryStore.memoryDepartments.findIndex((d) => d.id === newDept.id || d.name === newDept.name);
      if (idx >= 0) {
        memoryStore.memoryDepartments[idx] = newDept;
      } else {
        memoryStore.memoryDepartments.push(newDept);
      }

      if (db.isPgConnected()) {
        try {
          const check = await db.query('SELECT * FROM departments WHERE id = $1 OR name = $2', [newDept.id, newDept.name]);
          if (check.rows && check.rows.length > 0) {
            await db.query(
              `UPDATE departments SET
                 code = $1,
                 name = $2,
                 manager = $3,
                 status = $4
               WHERE id = $5 OR name = $6`,
              [newDept.code, newDept.name, newDept.manager, newDept.status, check.rows[0].id, newDept.name]
            );
          } else {
            await db.query(
              `INSERT INTO departments (id, code, name, manager, employee_count, status)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [newDept.id, newDept.code, newDept.name, newDept.manager, 0, newDept.status]
            );
          }
        } catch (e) {
          console.error('PG insert/update error in addDepartment:', e);
        }
      }

      return newDept;
    },

    deleteDepartment: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM departments WHERE id = $1 OR code = $1 OR name = $1', [id]);
        } catch (e) {
          console.error('PG delete error in deleteDepartment:', e);
        }
      }
      memoryStore.memoryDepartments = memoryStore.memoryDepartments.filter((d) => d.id !== id && d.code !== id && d.name !== id);
      return true;
    },

    // POSITIONS
    getPositions: async () => {
      let finalPositions = [];
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM positions ORDER BY id ASC');
          if (res.rows) {
            finalPositions = res.rows.map((r) => ({
              id: r.id,
              code: r.code,
              title: r.title,
              department: r.department,
              level: r.level,
              status: r.status,
            }));
          }
        } catch (e) {
          console.error('PG error in getPositions:', e);
          finalPositions = memoryStore.memoryPositions;
        }
      } else {
        finalPositions = memoryStore.memoryPositions;
      }
      const employees = await storeRef.getEmployees();
      return finalPositions.map((p) => {
        const count = employees.filter((e) => {
          if (!e.position) return false;
          const posStr = e.position.trim().toLowerCase();
          const pTitle = p.title ? p.title.trim().toLowerCase() : '';
          const pCode = p.code ? p.code.trim().toLowerCase() : '';
          return posStr === pTitle || posStr === pCode || posStr.includes(pTitle) || pTitle.includes(posStr);
        }).length;
        return { ...p, employeeCount: count, memberCount: count };
      });
    },

    addPosition: async (posData) => {
      const newId = posData.id || `POS-${String(memoryStore.memoryPositions.length + 1).padStart(2, '0')}`;
      const newPos = {
        id: newId,
        code: posData.code || posData.id || `POS-${memoryStore.memoryPositions.length + 1}`,
        title: posData.title || posData.name || 'ตำแหน่งงานใหม่',
        department: posData.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        level: posData.level || 'Mid-Level',
        status: 'Active',
      };
      const idx = memoryStore.memoryPositions.findIndex((p) => p.id === newPos.id);
      if (idx >= 0) {
        memoryStore.memoryPositions[idx] = { ...memoryStore.memoryPositions[idx], ...newPos };
      } else {
        memoryStore.memoryPositions.push(newPos);
      }
      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO positions (id, code, title, department, level, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, department = EXCLUDED.department, level = EXCLUDED.level, status = EXCLUDED.status`,
            [newPos.id, newPos.code, newPos.title, newPos.department, newPos.level, newPos.status]
          );
        } catch (e) {
          console.error('PG insert/update error in addPosition:', e);
        }
      }
      return newPos;
    },

    deletePosition: async (id) => {
      if (db.isPgConnected()) {
        try {
          await db.query('DELETE FROM positions WHERE id = $1', [id]);
        } catch (e) {}
      }
      memoryStore.memoryPositions = memoryStore.memoryPositions.filter((p) => p.id !== id);
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
        department: adminData.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        role: adminData.role || 'Admin',
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
        }
      }

      return newAdmin;
    },

    updateAdmin: async (id, updateData) => {
      let existing = await storeRef.getAdminById(id);
      if (!existing) return null;

      const updated = { ...existing, ...updateData };

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
               status = COALESCE($8, status)
             WHERE id = $9`,
            [
              updateData.username,
              updateData.password,
              updateData.name,
              updateData.email,
              updateData.phone,
              updateData.department,
              updateData.role,
              updateData.status,
              id,
            ]
          );
        } catch (e) {
          console.error('PG update error in updateAdmin:', e);
        }
      }

      const idx = memoryStore.memoryAdmins.findIndex((a) => a.id === id);
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
        }
      }
      memoryStore.memoryAdmins = memoryStore.memoryAdmins.filter((a) => a.id !== id);
      return true;
    },
  };
};
