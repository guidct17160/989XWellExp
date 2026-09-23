const db = require('../config/database');

async function clean() {
  try {
    const res = await db.query("DELETE FROM employees WHERE email = 'guidt.2546@gmail.com' OR code = 'EMP-APP-TEST'");
    console.log('✅ Cleaned test employee from PostgreSQL DB:', res.rowCount, 'rows deleted');
  } catch (err) {
    console.error('Error cleaning test employee:', err.message);
  }
  process.exit(0);
}

setTimeout(clean, 1000);
