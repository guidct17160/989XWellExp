const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function backupDatabase() {
  console.log('\n==================================================================');
  console.log('💾 Starting Automated Database Backup for WellX989');
  console.log('==================================================================\n');

  const backupsDir = path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Get all public tables
    const tablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC"
    );
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`📋 Found ${tableNames.length} tables to backup...`);

    const backupData = {
      meta: {
        timestamp: new Date().toISOString(),
        database: 'wellx989_db',
        totalTables: tableNames.length,
      },
      tables: {},
    };

    for (const table of tableNames) {
      const res = await client.query(`SELECT * FROM ${table}`);
      backupData.tables[table] = res.rows;
      console.log(`  ✓ Table '${table}': ${res.rows.length} records backed up.`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `wellx989_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    const stats = fs.statSync(backupFilePath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    console.log('\n==================================================================');
    console.log(`🎉 Backup Completed Successfully!`);
    console.log(`📁 File: ${backupFilePath}`);
    console.log(`📦 Size: ${sizeKb} KB`);
    console.log('==================================================================\n');
  } catch (err) {
    console.error('❌ Database Backup Failed:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

backupDatabase();
