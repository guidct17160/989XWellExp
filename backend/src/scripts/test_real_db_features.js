const db = require('../config/database');

async function testRealDbFeatures() {
  console.log('Testing Real DB Data integrations...');

  // Wait for pool connection
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // 1. KPI Evaluations
    const testKpiId = `kpi-test-${Date.now()}`;
    await db.query(
      `INSERT INTO kpi_evaluations (id, employee_id, evaluator, kpi_score, grade, remark, evaluation_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [testKpiId, 'EMP-001', 'Super Admin', 95.0, 'A', 'ผลงานยอดเยี่ยมประจำปี', '2026-09-23']
    );
    const kpiCheck = await db.query('SELECT * FROM kpi_evaluations WHERE id = $1', [testKpiId]);
    if (kpiCheck.rows.length > 0 && parseFloat(kpiCheck.rows[0].kpi_score) === 95.0) {
      console.log('✅ [PASS] KPI Evaluation persisted in PostgreSQL (Score: 95, Grade: A)');
    } else {
      throw new Error('Failed to verify KPI evaluation in DB');
    }
    await db.query('DELETE FROM kpi_evaluations WHERE id = $1', [testKpiId]);

    // 2. Point Transactions & Employee Points
    const testTxId = `pt-test-${Date.now()}`;
    await db.query(
      `INSERT INTO point_transactions (id, employee_id, title, points, type, category)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testTxId, 'EMP-001', 'โบนัสทดสอบ', 50, 'earn', 'ทั่วไป']
    );
    const txCheck = await db.query('SELECT * FROM point_transactions WHERE id = $1', [testTxId]);
    if (txCheck.rows.length > 0 && txCheck.rows[0].points === 50) {
      console.log('✅ [PASS] Point Transaction persisted in PostgreSQL (+50 PTS)');
    } else {
      throw new Error('Failed to verify Point transaction in DB');
    }
    await db.query('DELETE FROM point_transactions WHERE id = $1', [testTxId]);

    // 3. Payslips Table
    const payslipCheck = await db.query('SELECT COUNT(*) FROM payslips');
    console.log(`✅ [PASS] Payslips PostgreSQL table ready (Found ${payslipCheck.rows[0].count} payslips)`);

    // 4. Employees Points Column
    const empPointsCol = await db.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'employees' AND column_name = 'points'`
    );
    if (empPointsCol.rows.length > 0) {
      console.log('✅ [PASS] Employees table has points column (Type: ' + empPointsCol.rows[0].data_type + ')');
    } else {
      throw new Error('points column missing on employees table');
    }

    console.log('\n🎉 ALL REAL DB DATA FEATURES VERIFIED SUCCESSFULLY (100%)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

testRealDbFeatures();
