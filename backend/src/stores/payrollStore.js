const db = require('../config/database');
const memoryStore = require('./memoryStore');

module.exports = function createPayrollStore(storeRef) {
  return {
    getPayslips: async (employeeId, year) => {
      if (db.isPgConnected()) {
        try {
          let query = 'SELECT * FROM payslips WHERE 1=1';
          const params = [];
          if (employeeId) {
            params.push(employeeId);
            query += ` AND employee_id = $${params.length}`;
          }
          if (year) {
            params.push(Number(year));
            query += ` AND year = $${params.length}`;
          }
          query += ' ORDER BY created_at DESC';
          const res = await db.query(query, params);
          if (res.rows && res.rows.length > 0) {
            return res.rows.map((r) => ({
              id: r.id,
              employeeId: r.employee_id,
              month: r.month,
              year: r.year,
              baseSalary: Number(r.base_salary),
              otPay: Number(r.ot_pay),
              bonus: Number(r.bonus),
              allowance: Number(r.allowance),
              taxDeduction: Number(r.tax_deduction),
              socialSecurity: Number(r.social_security),
              otherDeduction: Number(r.other_deduction),
              netPay: Number(r.net_pay),
              pdfUrl: r.pdf_url,
              createdAt: r.created_at,
            }));
          }
        } catch (e) {
          console.error('PG query error in getPayslips:', e);
        }
      }
      return memoryStore.memoryPayslips.filter((p) => (p.employeeId === employeeId || !employeeId) && (!year || p.year === Number(year)));
    },

    getPayslipById: async (id) => {
      if (db.isPgConnected()) {
        try {
          const res = await db.query('SELECT * FROM payslips WHERE id = $1', [id]);
          if (res.rows && res.rows.length > 0) {
            const r = res.rows[0];
            return {
              id: r.id,
              employeeId: r.employee_id,
              month: r.month,
              year: r.year,
              baseSalary: Number(r.base_salary),
              otPay: Number(r.ot_pay),
              bonus: Number(r.bonus),
              allowance: Number(r.allowance),
              taxDeduction: Number(r.tax_deduction),
              socialSecurity: Number(r.social_security),
              otherDeduction: Number(r.other_deduction),
              netPay: Number(r.net_pay),
              pdfUrl: r.pdf_url,
              createdAt: r.created_at,
            };
          }
        } catch (e) {
          console.error('PG query error in getPayslipById:', e);
        }
      }
      return memoryStore.memoryPayslips.find((p) => p.id === id);
    },

    generatePayslip: async (data) => {
      const newPayslip = {
        id: `ps-${Date.now()}`,
        employeeId: data.employeeId || 'EMP-IT-DEV',
        month: data.month || 'สิงหาคม',
        year: Number(data.year) || 2026,
        baseSalary: Number(data.baseSalary) || 45000,
        otPay: Number(data.otPay) || 0,
        bonus: Number(data.bonus) || 0,
        allowance: Number(data.allowance) || 0,
        taxDeduction: Number(data.taxDeduction) || 1000,
        socialSecurity: Number(data.socialSecurity) || 750,
        otherDeduction: Number(data.otherDeduction) || 0,
        netPay: (Number(data.baseSalary) || 45000) + (Number(data.otPay) || 0) + (Number(data.bonus) || 0) + (Number(data.allowance) || 0) - (Number(data.taxDeduction) || 1000) - (Number(data.socialSecurity) || 750) - (Number(data.otherDeduction) || 0),
        createdDate: new Date().toISOString().split('T')[0],
      };
      memoryStore.memoryPayslips.unshift(newPayslip);

      if (db.isPgConnected()) {
        try {
          await db.query(
            `INSERT INTO payslips (id, employee_id, month, year, base_salary, ot_pay, bonus, allowance, tax_deduction, social_security, other_deduction, net_pay)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING`,
            [newPayslip.id, newPayslip.employeeId, newPayslip.month, newPayslip.year, newPayslip.baseSalary, newPayslip.otPay, newPayslip.bonus, newPayslip.allowance, newPayslip.taxDeduction, newPayslip.socialSecurity, newPayslip.otherDeduction, newPayslip.netPay]
          );
        } catch (e) {
          console.error('PG insert error in generatePayslip:', e);
        }
      }

      return newPayslip;
    },
  };
};
