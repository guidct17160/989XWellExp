const db = require('../config/database');
const { hashPassword } = require('../utils/security');

async function migratePasswords() {
  console.log('\n======================================================');
  console.log('🔒 Starting Database Passwords Migration to Bcrypt');
  console.log('======================================================\n');

  try {
    if (!db.isPgConnected()) {
      console.log('⏳ Waiting for PostgreSQL connection...');
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 1. Migrate Admins
    console.log('--- 1. Checking Admins Table ---');
    const adminRes = await db.query('SELECT id, username, password FROM admins');
    let adminMigrated = 0;

    for (const admin of adminRes.rows) {
      const pwd = String(admin.password || '').trim();
      const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(pwd);

      if (!isBcrypt) {
        const plainToHash = pwd || '1234';
        const hashed = await hashPassword(plainToHash);
        await db.query('UPDATE admins SET password = $1 WHERE id = $2', [hashed, admin.id]);
        console.log(`  🔑 Migrated Admin [${admin.username || admin.id}] to Bcrypt ($2b$10$)`);
        adminMigrated++;
      } else {
        console.log(`  ✅ Admin [${admin.username || admin.id}] is ALREADY hashed with Bcrypt`);
      }
    }
    console.log(`\n  Total Admins Migrated: ${adminMigrated} / ${adminRes.rows.length}\n`);

    // 2. Migrate Employees
    console.log('--- 2. Checking Employees Table ---');
    const empRes = await db.query('SELECT id, code, username, password FROM employees');
    let empMigrated = 0;

    for (const emp of empRes.rows) {
      const pwd = String(emp.password || '').trim();
      const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(pwd);

      if (!isBcrypt) {
        const plainToHash = pwd || '1234';
        const hashed = await hashPassword(plainToHash);
        await db.query('UPDATE employees SET password = $1 WHERE id = $2', [hashed, emp.id]);
        console.log(`  🔑 Migrated Employee [${emp.code || emp.username}] to Bcrypt ($2b$10$)`);
        empMigrated++;
      } else {
        console.log(`  ✅ Employee [${emp.code || emp.username}] is ALREADY hashed with Bcrypt`);
      }
    }
    console.log(`\n  Total Employees Migrated: ${empMigrated} / ${empRes.rows.length}\n`);

    console.log('======================================================');
    console.log('🎉 PASSWORD MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('100% of passwords in PostgreSQL are now secured with Bcrypt.');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migratePasswords();
