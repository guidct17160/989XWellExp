const { pool } = require('../config/database');

async function createAuditLogsTable() {
  console.log('\n==================================================================');
  console.log('🛡️ Creating Audit Logs Schema in wellx989_db (PDPA & Compliance)');
  console.log('==================================================================\n');

  let client;
  try {
    client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        actor_id VARCHAR(50) NOT NULL,
        actor_name VARCHAR(255),
        actor_role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(100),
        details JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    `);

    console.log('  ✅ Table audit_logs created successfully.');
    console.log('  ✅ Created indexes: idx_audit_logs_actor, idx_audit_logs_action, idx_audit_logs_resource, idx_audit_logs_created');
    console.log('\n==================================================================');
    console.log('🎉 Audit Trail Schema Ready!');
    console.log('==================================================================\n');
  } catch (err) {
    console.error('❌ Error creating audit_logs table:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

createAuditLogsTable();
