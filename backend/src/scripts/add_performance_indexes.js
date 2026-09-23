const { pool } = require('../config/database');

const performanceIndexes = [
  // 1. Attendance Indexes
  {
    name: 'idx_attendance_emp_date',
    sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date_iso DESC)',
    desc: 'Accelerates daily clock-in lookup & employee monthly attendance queries',
  },
  {
    name: 'idx_attendance_date',
    sql: 'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date_iso)',
    desc: 'Accelerates HR daily dashboard attendance statistics and report generation',
  },

  // 2. Leave Requests Indexes
  {
    name: 'idx_leave_requests_emp',
    sql: 'CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id)',
    desc: 'Accelerates employee leave history and dynamic balance calculations',
  },
  {
    name: 'idx_leave_requests_status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status)',
    desc: 'Accelerates HR & Manager pending leave approval queues',
  },
  {
    name: 'idx_leave_requests_dates',
    sql: 'CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date)',
    desc: 'Accelerates active on-leave headcount checks for HR dashboard',
  },

  // 3. Overtime Requests Indexes
  {
    name: 'idx_ot_requests_emp',
    sql: 'CREATE INDEX IF NOT EXISTS idx_ot_requests_emp ON ot_requests(employee_id)',
    desc: 'Accelerates employee overtime history queries',
  },
  {
    name: 'idx_ot_requests_status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_ot_requests_status ON ot_requests(status)',
    desc: 'Accelerates Manager & SuperBoss OT approval queue queries',
  },

  // 4. Time Corrections Indexes
  {
    name: 'idx_time_corrections_emp',
    sql: 'CREATE INDEX IF NOT EXISTS idx_time_corrections_emp ON time_corrections(employee_id)',
    desc: 'Accelerates employee time correction history queries',
  },
  {
    name: 'idx_time_corrections_status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_time_corrections_status ON time_corrections(status)',
    desc: 'Accelerates Manager time correction approval filtering',
  },

  // 5. Notifications Indexes
  {
    name: 'idx_notifications_emp_read',
    sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_emp_read ON notifications(employee_id, is_read)',
    desc: 'Accelerates unread notification count badge and notifications feed',
  },

  // 6. Payslips Indexes
  {
    name: 'idx_payslips_emp_year',
    sql: 'CREATE INDEX IF NOT EXISTS idx_payslips_emp_year ON payslips(employee_id, year DESC)',
    desc: 'Accelerates employee yearly/monthly payslip history retrieval',
  },

  // 7. Gamification & Missions Indexes
  {
    name: 'idx_user_missions_emp_mission',
    sql: 'CREATE INDEX IF NOT EXISTS idx_user_missions_emp_mission ON user_missions(employee_id, mission_id)',
    desc: 'Accelerates step-count sync and mission completion lookups',
  },
  {
    name: 'idx_missions_status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status)',
    desc: 'Accelerates active missions catalog listing',
  },
  {
    name: 'idx_rewards_status_pts',
    sql: 'CREATE INDEX IF NOT EXISTS idx_rewards_status_pts ON rewards(status, points_required ASC)',
    desc: 'Accelerates rewards catalog sorting by points',
  },
  {
    name: 'idx_redemptions_emp',
    sql: 'CREATE INDEX IF NOT EXISTS idx_redemptions_emp ON redemptions(employee_id)',
    desc: 'Accelerates user coupon & voucher retrieval',
  },

  // 8. System & Employees Indexes
  {
    name: 'idx_announcements_pinned',
    sql: 'CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned DESC)',
    desc: 'Accelerates pinned announcement display at top of company feed',
  },
  {
    name: 'idx_employees_username',
    sql: 'CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username)',
    desc: 'Accelerates username lookup on mobile and web login',
  },
];

async function applyPerformanceIndexes() {
  console.log('\n==================================================================');
  console.log('⚡ Applying High-Performance Database Indexes to wellx989_db');
  console.log('==================================================================\n');

  let client;
  try {
    client = await pool.connect();
    let count = 0;

    for (const idx of performanceIndexes) {
      const startTime = Date.now();
      await client.query(idx.sql);
      const elapsed = Date.now() - startTime;
      count++;
      console.log(`  [${count}/${performanceIndexes.length}] ✅ Applied ${idx.name} (${elapsed}ms)`);
      console.log(`      └─ ${idx.desc}`);
    }

    console.log('\n==================================================================');
    console.log(`🎉 All ${count} Performance Indexes Applied Successfully!`);
    console.log('==================================================================\n');
  } catch (err) {
    console.error('❌ Error applying indexes:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

applyPerformanceIndexes();
