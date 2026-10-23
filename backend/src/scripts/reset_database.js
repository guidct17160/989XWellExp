const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function resetDatabase() {
  console.log('🧹 Starting full database clean-up for wellx989_db...');

  // Wait a moment for pool connection
  await new Promise((r) => setTimeout(r, 1000));

  if (!db.isPgConnected()) {
    console.error('❌ PostgreSQL is not connected!');
    process.exit(1);
  }

  const tablesToTruncate = [
    'attendance',
    'time_corrections',
    'leave_requests',
    'redemptions',
    'point_transactions',
    'announcements',
    'notifications',
    'audit_logs',
    'employees',
    'departments',
    'quests',
    'rewards',
    'leave_policies',
  ];

  for (const table of tablesToTruncate) {
    try {
      await db.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`  ✅ Wiped table: ${table}`);
    } catch (err) {
      console.warn(`  ⚠️ Table ${table} skip/error:`, err.message);
    }
  }

  // Clean admins table and insert the master Super Admin account
  try {
    await db.query('DELETE FROM admins');
    const hashedPwd = bcrypt.hashSync('1234', 10);
    await db.query(
      `INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date)
       VALUES ('ADM-001', 'ADM-001', 'admin', $1, 'ผู้ดูแลระบบ (Web Admin)', 'admin@wellx989.com', '081-234-5678', '-', 'Super Admin', 'Active', '2026-01-01')`,
      [hashedPwd]
    );
    console.log('  ✅ Retained master Super Admin account: username="admin", password="1234"');
  } catch (err) {
    console.error('  ❌ Error resetting admin:', err.message);
  }

  console.log('\n🎉 Database reset complete! All mock and test data removed.');
  process.exit(0);
}

resetDatabase().catch((e) => {
  console.error('Fatal error during reset:', e);
  process.exit(1);
});
