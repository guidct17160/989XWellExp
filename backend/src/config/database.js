const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || '1234'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'wellx989_db'}`;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
});

let isConnected = false;

// No initial mock employees - User creates real accounts from Web Admin
const initialEmployees = [];

// Initialize Database Schema in PostgreSQL
const initPostgresSchema = async () => {
  let client;
  try {
    client = await pool.connect();
    isConnected = true;
    console.log('🐘 PostgreSQL connected successfully to wellx989_db!');

    // Create Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL DEFAULT '',
        password VARCHAR(255) NOT NULL DEFAULT '1234',
        name VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        department VARCHAR(255),
        role VARCHAR(50) DEFAULT 'Employee',
        status VARCHAR(50) DEFAULT 'Pending',
        start_date VARCHAR(50),
        salary NUMERIC(12,2),
        avatar_url TEXT,
        gender VARCHAR(20) DEFAULT 'Male',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE employees ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '1234';
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'Male';
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
      ALTER TABLE employees DROP COLUMN IF EXISTS position;
      ALTER TABLE employees DROP COLUMN IF EXISTS section;
      ALTER TABLE employees DROP COLUMN IF EXISTS "group";

      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        manager VARCHAR(255),
        employee_count INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS positions (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        level VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        head VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS employee_groups (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        member_count INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL DEFAULT '1234',
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        department VARCHAR(255),
        role VARCHAR(50) DEFAULT 'Admin',
        status VARCHAR(50) DEFAULT 'Active',
        start_date VARCHAR(50),
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE admins ADD COLUMN IF NOT EXISTS department VARCHAR(255);
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Admin';
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS start_date VARCHAR(50);
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        date_iso VARCHAR(20) NOT NULL,
        check_in VARCHAR(20),
        check_out VARCHAR(20),
        duration VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ปกติ',
        status_color VARCHAR(20) DEFAULT '#10B981',
        latitude NUMERIC(10,8),
        longitude NUMERIC(11,8),
        location_name TEXT,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- High-Performance Enterprise Indexing
      CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department, status);
      CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date_iso);
      CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role, status);

      CREATE TABLE IF NOT EXISTS time_corrections (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        date_iso VARCHAR(20) NOT NULL,
        old_check_in VARCHAR(20),
        new_check_in VARCHAR(20),
        old_check_out VARCHAR(20),
        new_check_out VARCHAR(20),
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'รออนุมัติ',
        approver VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        leave_type VARCHAR(100) NOT NULL,
        start_date VARCHAR(20) NOT NULL,
        end_date VARCHAR(20) NOT NULL,
        total_days NUMERIC(4,1) NOT NULL DEFAULT 1,
        reason TEXT NOT NULL,
        attachment_url TEXT,
        status VARCHAR(50) DEFAULT 'รออนุมัติ',
        approver VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS leave_balances (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        sick_leave_used INT DEFAULT 0,
        sick_leave_max INT DEFAULT 30,
        personal_leave_used INT DEFAULT 0,
        personal_leave_max INT DEFAULT 6,
        annual_leave_used INT DEFAULT 0,
        annual_leave_max INT DEFAULT 10,
        other_leave_used INT DEFAULT 0,
        other_leave_max INT DEFAULT 5
      );

      CREATE TABLE IF NOT EXISTS ot_requests (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        date_iso VARCHAR(20) NOT NULL,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        hours NUMERIC(4,1) NOT NULL DEFAULT 1,
        task_description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'รออนุมัติ',
        approver VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payslips (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        month VARCHAR(20) NOT NULL,
        year INT NOT NULL,
        base_salary NUMERIC(12,2) NOT NULL,
        ot_pay NUMERIC(12,2) DEFAULT 0,
        bonus NUMERIC(12,2) DEFAULT 0,
        allowance NUMERIC(12,2) DEFAULT 0,
        tax_deduction NUMERIC(12,2) DEFAULT 0,
        social_security NUMERIC(12,2) DEFAULT 0,
        other_deduction NUMERIC(12,2) DEFAULT 0,
        net_pay NUMERIC(12,2) NOT NULL,
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS missions (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        target_value INT DEFAULT 1,
        reward_points INT DEFAULT 10,
        category VARCHAR(50) DEFAULT 'Daily',
        icon VARCHAR(50) DEFAULT 'footsteps',
        status VARCHAR(50) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS user_missions (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        mission_id VARCHAR(50) NOT NULL,
        current_value INT DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        is_claimed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rewards (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        points_required INT NOT NULL,
        category VARCHAR(50) DEFAULT 'Voucher',
        image_url TEXT,
        stock INT DEFAULT 100,
        status VARCHAR(50) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS redemptions (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        reward_id VARCHAR(50) NOT NULL,
        coupon_code VARCHAR(100) NOT NULL,
        points_used INT NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        author VARCHAR(100) DEFAULT 'HR Admin',
        is_pinned BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_emp ON notifications(employee_id, is_read);

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

      CREATE TABLE IF NOT EXISTS leave_policies (
        id VARCHAR(50) PRIMARY KEY,
        type_name VARCHAR(100) NOT NULL,
        category_key VARCHAR(50) NOT NULL,
        default_quota INT DEFAULT 30,
        is_paid BOOLEAN DEFAULT TRUE,
        applicable_gender VARCHAR(20) DEFAULT 'all',
        allowed_start_date VARCHAR(20),
        allowed_end_date VARCHAR(20),
        date_range_enabled BOOLEAN DEFAULT FALSE,
        min_advance_days INT DEFAULT 0,
        max_consecutive_days INT DEFAULT 30,
        allow_backdated BOOLEAN DEFAULT FALSE,
        max_backdated_days INT DEFAULT 0,
        require_attachment BOOLEAN DEFAULT FALSE,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS applicable_gender VARCHAR(20) DEFAULT 'all';
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS allowed_start_date VARCHAR(20);
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS allowed_end_date VARCHAR(20);
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS date_range_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS min_advance_days INT DEFAULT 0;
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS max_consecutive_days INT DEFAULT 30;
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS allow_backdated BOOLEAN DEFAULT FALSE;
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS max_backdated_days INT DEFAULT 0;
      ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS require_attachment BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS kpi_evaluations (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        evaluator VARCHAR(255) DEFAULT 'Super Admin',
        kpi_score NUMERIC(5,2) NOT NULL,
        grade VARCHAR(10) NOT NULL,
        remark TEXT,
        evaluation_date VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_kpi_employee ON kpi_evaluations(employee_id);

      CREATE TABLE IF NOT EXISTS point_transactions (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        points INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(100) DEFAULT 'ทั่วไป',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_point_tx_employee ON point_transactions(employee_id);
    `);

    // Seed default initial admins if admins table is empty
    const adminCheck = await client.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      const bcrypt = require('bcryptjs');
      const hashedSeedPwd = bcrypt.hashSync('1234', 10);
      await client.query(`
        INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date)
        VALUES 
          ('ADM-001', 'ADM-001', 'admin', $1, 'สมชาย ใจดี (Web Admin)', 'admin@wellx989.com', '081-234-5678', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', 'Super Admin', 'Active', '2025-01-01'),
          ('ADM-002', 'ADM-002', 'hr_admin', $1, 'อนันต์ ทรัพย์มาก (HR Admin)', 'hr.admin@wellx989.com', '089-876-5432', 'ฝ่ายทรัพยากรบุคคล (HR)', 'HR Admin', 'Active', '2025-02-15')
        ON CONFLICT (id) DO NOTHING;
      `, [hashedSeedPwd]);
      console.log('🌱 Seeded default initial Admins into admins table: admin (pass: 1234, bcrypt hashed), hr_admin (pass: 1234, bcrypt hashed)');
    }

    // Seed default leave policies if empty
    const policyCheck = await client.query('SELECT COUNT(*) FROM leave_policies');
    if (parseInt(policyCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO leave_policies (id, type_name, category_key, default_quota, is_paid, applicable_gender, allowed_start_date, allowed_end_date, date_range_enabled, min_advance_days, max_consecutive_days, allow_backdated, max_backdated_days, require_attachment, description, status)
        VALUES
          ('LP-01', 'ลาป่วย (Sick Leave)', 'sick', 30, TRUE, 'all', NULL, NULL, FALSE, 0, 3, TRUE, 3, FALSE, 'ต้องมีใบรับรองแพทย์กรณีลาติดต่อกันเกิน 3 วัน (ทุกเพศ)', 'Active'),
          ('LP-02', 'ลากิจ (Personal Leave)', 'personal', 6, TRUE, 'all', NULL, NULL, FALSE, 1, 3, FALSE, 0, FALSE, 'ยื่นคำขอล่วงหน้าอย่างน้อย 1 วัน (ทุกเพศ)', 'Active'),
          ('LP-03', 'ลาพักร้อนประจำปี (Annual Leave)', 'annual', 10, TRUE, 'all', '2026-01-01', '2026-12-31', TRUE, 3, 10, FALSE, 0, FALSE, 'สำหรับพนักงานที่ผ่านทดลองงานและทำงานครบ 1 ปี (ใช้สิทธิ์ได้ภายในปี 2569 เท่านั้น)', 'Active'),
          ('LP-04', 'ลาคลอดบุตร (Maternity Leave)', 'maternity', 98, TRUE, 'female', NULL, NULL, FALSE, 7, 98, FALSE, 0, TRUE, 'สำหรับพนักงานหญิงตามกฎหมายแรงงานกำหนด พร้อมแนบเอกสารรับรองแพทย์', 'Active'),
          ('LP-05', 'ลาบวช / ปฏิบัติธรรม (Ordination Leave)', 'ordination', 15, TRUE, 'male', NULL, NULL, FALSE, 15, 15, FALSE, 0, TRUE, 'สำหรับพนักงานชาย ยื่นขอล่วงหน้าอย่างน้อย 15 วัน พร้อมเอกสารรับรอง', 'Active'),
          ('LP-06', 'ลาอื่นๆ (Other Leave)', 'other', 5, FALSE, 'all', NULL, NULL, FALSE, 1, 5, FALSE, 0, FALSE, 'การลาอื่นๆ ที่ไม่เข้าข่ายหมวดข้างต้น (ทุกเพศ)', 'Active'),
          ('LP-07', 'ลาดูแลภริยาคลอดบุตร (Paternity Leave)', 'paternity', 15, TRUE, 'male', NULL, NULL, FALSE, 3, 15, FALSE, 0, TRUE, 'สำหรับพนักงานชายเพื่อดูแลภริยาคลอดบุตรและบุตรแรกเกิด', 'Active')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('🌱 Seeded default Leave Policies into leave_policies table (with Gender Specific rules)');
    }

    // Seed default missions if empty
    const missionCheck = await client.query('SELECT COUNT(*) FROM missions');
    if (parseInt(missionCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO missions (id, title, description, target_value, reward_points, category, icon, status)
        VALUES
          ('ms-01', 'ดื่มน้ำให้ครบ 8 แก้วต่อวัน', 'ดื่มน้ำเปล่าสะอาดเพื่อสุขภาพที่ดีและเติมความสดชื่นตลอดวันทำงาน', 8, 20, 'daily', 'water', 'Active'),
          ('ms-02', 'เดินสะสมก้าว 10,000 ก้าว', 'สะสมก้าวเดินระหว่างวันเพื่อสุขภาพหัวใจและร่างกายที่แข็งแรง', 10000, 50, 'daily', 'footsteps', 'Active'),
          ('ms-03', 'ลงเวลาเข้างานตรงเวลา 5 วันทำการ', 'ลงเวลาเข้างานก่อน 09:00 น. ต่อเนื่อง 5 วันทำการในสัปดาห์', 5, 100, 'weekly', 'alarm', 'Active'),
          ('ms-04', 'ทำแบบสำรวจสุขภาพประจำเดือน', 'ตอบแบบสอบถามประเมินสุขภาพจิตและสุขภาพกายเพื่อรับสวัสดิการ', 1, 150, 'weekly', 'fitness', 'Active')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('🌱 Seeded default Missions into missions table');
    }

    // Seed default rewards if empty
    const rewardCheck = await client.query('SELECT COUNT(*) FROM rewards');
    if (parseInt(rewardCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO rewards (id, title, description, points_required, category, image_url, stock, status)
        VALUES
          ('rew-01', 'บัตรของขวัญ Starbucks 100 บาท', 'ใช้แทนเงินสดได้ที่ร้าน Starbucks ทุกสาขาทั่วประเทศ', 150, 'Voucher', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300', 50, 'Active'),
          ('rew-02', 'คูปองส่วนลด GrabFood 50 บาท', 'ส่วนลดค่าอาหารไม่มีขั้นต่ำ ใช้ได้ทุกร้านอาหาร', 80, 'Food & Beverage', 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=300', 100, 'Active'),
          ('rew-03', 'บัตรชมภาพยนตร์ Major Cineplex', 'บัตรชมภาพยนตร์ที่นั่ง Deluxe 1 ที่นั่ง (ทุกสาขา)', 200, 'Entertainment', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300', 30, 'Active')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('🌱 Seeded default Rewards into rewards table');
    }

  } catch (err) {
    isConnected = false;
    console.log('⚠️ PostgreSQL connection failed:', err.message);
  } finally {
    if (client) {
      try { client.release(); } catch (e) {}
    }
  }
};

initPostgresSchema();

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  isPgConnected: () => isConnected,
};
