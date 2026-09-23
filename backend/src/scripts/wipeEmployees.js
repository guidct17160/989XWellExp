const db = require('../config/database');

async function wipe() {
  try {
    const res = await db.query('TRUNCATE TABLE employees CASCADE;');
    console.log('✅ Wiped all employees from PostgreSQL employees table');
  } catch (err) {
    try {
      await db.query('DELETE FROM employees;');
      console.log('✅ Deleted all employees from PostgreSQL employees table');
    } catch (e) {
      console.error('Error wiping employees:', e.message);
    }
  }
  process.exit(0);
}

setTimeout(wipe, 1000);
