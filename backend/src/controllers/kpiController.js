const db = require('../config/database');

const calculateGrade = (score) => {
  const num = parseFloat(score);
  if (isNaN(num)) return 'C';
  if (num >= 90) return 'A';
  if (num >= 80) return 'B+';
  if (num >= 70) return 'B';
  if (num >= 60) return 'C';
  return 'D';
};

// GET /api/kpi/evaluations
exports.getEvaluations = async (req, res) => {
  try {
    if (db.isPgConnected()) {
      const query = `
        SELECT k.*, COALESCE(e.name, k.employee_id) as employee_name, e.code as employee_code, e.department
        FROM kpi_evaluations k
        LEFT JOIN employees e ON k.employee_id = e.id OR k.employee_id = e.code
        ORDER BY k.created_at DESC
      `;
      const result = await db.query(query);
      const evaluations = (result.rows || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeCode: r.employee_code || r.employee_id,
        employeeName: r.employee_name,
        department: r.department || '-',
        evaluator: r.evaluator,
        kpiScore: parseFloat(r.kpi_score),
        grade: r.grade,
        remark: r.remark,
        evaluationDate: r.evaluation_date,
        createdAt: r.created_at,
      }));
      return res.status(200).json({ success: true, evaluations });
    }
    return res.status(200).json({ success: true, evaluations: [] });
  } catch (error) {
    console.error('Error fetching KPI evaluations:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/kpi/evaluations
exports.addEvaluation = async (req, res) => {
  try {
    const { employeeId, evaluator, kpiScore, remark } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรหัสพนักงาน (employeeId)' });
    }

    const score = parseFloat(kpiScore);
    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ success: false, message: 'คะแนน KPI ต้องอยู่ระหว่าง 0 - 100' });
    }

    const grade = calculateGrade(score);
    const id = `kpi-${Date.now()}`;
    const evaluationDate = new Date().toISOString().split('T')[0];
    const evaluatorName = evaluator || req.user?.name || 'Super Admin';

    if (db.isPgConnected()) {
      await db.query(
        `INSERT INTO kpi_evaluations (id, employee_id, evaluator, kpi_score, grade, remark, evaluation_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, employeeId, evaluatorName, score, grade, remark || 'ประเมินผลการทำงาน', evaluationDate]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'บันทึกผลประเมิน KPI/OKR สำเร็จเรียบร้อยแล้ว',
      evaluation: {
        id,
        employeeId,
        evaluator: evaluatorName,
        kpiScore: score,
        grade,
        remark: remark || 'ประเมินผลการทำงาน',
        evaluationDate,
      },
    });
  } catch (error) {
    console.error('Error creating KPI evaluation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
