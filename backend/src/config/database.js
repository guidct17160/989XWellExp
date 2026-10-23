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

// Idempotent integrity migration. Each step is safe to run on every start:
//  - removes columns/tables nothing maintains or reads
//  - links employees to departments by id (the department name column stays as a denormalised display value)
//  - retires the removed Employee Group, Payslip, Salary, step-Mission and Overtime features: their tables / columns are dropped ONLY when empty,
//    so rows that already hold real data are never deleted automatically
//  - adds real FOREIGN KEY constraints, but only where the existing data has no orphan rows
//  - adds ISO-date CHECK constraints as NOT VALID (enforced for new/updated rows, old rows untouched)
const INTEGRITY_MIGRATION_SQL = `
  ALTER TABLE departments DROP COLUMN IF EXISTS employee_count;
  DO $$
  DECLARE
    is_empty BOOLEAN;
  BEGIN
    IF to_regclass('public.leave_balances') IS NOT NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM leave_balances)' INTO is_empty;
      IF is_empty THEN DROP TABLE leave_balances CASCADE; END IF;
    END IF;
    IF to_regclass('public.employee_groups') IS NOT NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM employee_groups)' INTO is_empty;
      IF is_empty THEN DROP TABLE employee_groups CASCADE; END IF;
    END IF;
    IF to_regclass('public.ot_requests') IS NOT NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM ot_requests)' INTO is_empty;
      IF is_empty THEN DROP TABLE ot_requests CASCADE; END IF;
    END IF;
    IF to_regclass('public.ot_requests') IS NULL AND to_regclass('public.ot_policies') IS NOT NULL THEN
      DROP TABLE ot_policies CASCADE;
    END IF;
    IF to_regclass('public.user_missions') IS NOT NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM user_missions)' INTO is_empty;
      IF is_empty THEN DROP TABLE user_missions CASCADE; END IF;
    END IF;
    IF to_regclass('public.missions') IS NOT NULL AND to_regclass('public.user_missions') IS NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM missions)' INTO is_empty;
      IF is_empty THEN DROP TABLE missions CASCADE; END IF;
    END IF;
    IF to_regclass('public.payslips') IS NOT NULL THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM payslips)' INTO is_empty;
      IF is_empty THEN DROP TABLE payslips CASCADE; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'group_name') THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM employees WHERE group_name IS NOT NULL AND length(group_name) > 0)' INTO is_empty;
      IF is_empty THEN ALTER TABLE employees DROP COLUMN group_name; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'salary') THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM employees WHERE salary IS NOT NULL AND salary <> 0)' INTO is_empty;
      IF is_empty THEN ALTER TABLE employees DROP COLUMN salary; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'group_id') THEN
      EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM employees WHERE group_id IS NOT NULL)' INTO is_empty;
      IF is_empty THEN ALTER TABLE employees DROP COLUMN group_id; END IF;
    END IF;
  END $$;

  ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id VARCHAR(50);
  UPDATE employees e SET department_id = d.id
    FROM departments d WHERE e.department_id IS NULL AND e.department = d.name;

  DO $$
  DECLARE
    r RECORD;
    orphans BIGINT;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('attendance',         'employee_id',   'employees',       'id', 'CASCADE',  'fk_attendance_employee'),
      ('time_corrections',   'employee_id',   'employees',       'id', 'CASCADE',  'fk_time_corrections_employee'),
      ('leave_requests',     'employee_id',   'employees',       'id', 'CASCADE',  'fk_leave_requests_employee'),
      ('point_transactions', 'employee_id',   'employees',       'id', 'CASCADE',  'fk_point_transactions_employee'),
      ('redemptions',        'employee_id',   'employees',       'id', 'CASCADE',  'fk_redemptions_employee'),
      ('redemptions',        'reward_id',     'rewards',         'id', 'RESTRICT', 'fk_redemptions_reward'),
      ('rewards',            'category_id',   'reward_categories', 'id', 'RESTRICT', 'fk_rewards_category'),
      ('employees',          'department_id', 'departments',     'id', 'SET NULL', 'fk_employees_department')
    ) AS t(tbl, col, ref_tbl, ref_col, on_delete, cname)
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.cname) THEN
        EXECUTE format(
          'SELECT count(*) FROM %I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I p WHERE p.%I = c.%I)',
          r.tbl, r.col, r.ref_tbl, r.ref_col, r.col
        ) INTO orphans;
        IF orphans = 0 THEN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
            r.tbl, r.cname, r.col, r.ref_tbl, r.ref_col, r.on_delete
          );
        ELSE
          RAISE WARNING 'FK % skipped: % orphan row(s) in %.%', r.cname, orphans, r.tbl, r.col;
        END IF;
      END IF;
    END LOOP;
  END $$;

  DO $$
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN SELECT * FROM (VALUES
      ('attendance',       'date_iso',   'chk_attendance_date_iso'),
      ('time_corrections', 'date_iso',   'chk_time_corrections_date_iso'),
      ('leave_requests',   'start_date', 'chk_leave_requests_start_date'),
      ('leave_requests',   'end_date',   'chk_leave_requests_end_date')
    ) AS t(tbl, col, cname)
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.cname) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I ~ ''^[0-9]{4}-[0-9]{2}-[0-9]{2}$'') NOT VALID',
          r.tbl, r.cname, r.col
        );
      END IF;
    END LOOP;
  END $$;
`;

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
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date VARCHAR(50);
      ALTER TABLE employees DROP COLUMN IF EXISTS position;
      ALTER TABLE employees DROP COLUMN IF EXISTS section;
      ALTER TABLE employees DROP COLUMN IF EXISTS "group";
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS resign_date VARCHAR(50);

      DROP TABLE IF EXISTS positions CASCADE;
      DROP TABLE IF EXISTS sections CASCADE;
      DROP TABLE IF EXISTS kpi_evaluations CASCADE;

      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        manager VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active'
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

      CREATE TABLE IF NOT EXISTS quests (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        send_mode VARCHAR(20) DEFAULT 'now',
        start_date VARCHAR(10) NOT NULL CHECK (start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
        start_time VARCHAR(5) NOT NULL DEFAULT '00:00',
        end_date VARCHAR(10) NOT NULL CHECK (end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
        end_time VARCHAR(5) NOT NULL DEFAULT '23:45',
        assign_type VARCHAR(20) DEFAULT 'all',
        auto_approve BOOLEAN DEFAULT FALSE,
        reward_points INT DEFAULT 0,
        created_by VARCHAR(50),
        created_by_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quest_sections (
        id VARCHAR(50) PRIMARY KEY,
        quest_id VARCHAR(50) NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        position INT NOT NULL DEFAULT 0,
        type VARCHAR(20) NOT NULL DEFAULT 'quiz',
        title VARCHAR(255) NOT NULL,
        description TEXT,
        time_limit_minutes INT,
        edit_type VARCHAR(20) DEFAULT 'can_edit'
      );

      CREATE TABLE IF NOT EXISTS quest_questions (
        id VARCHAR(50) PRIMARY KEY,
        section_id VARCHAR(50) NOT NULL REFERENCES quest_sections(id) ON DELETE CASCADE,
        position INT NOT NULL DEFAULT 0,
        type VARCHAR(20) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        points INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS quest_choices (
        id VARCHAR(50) PRIMARY KEY,
        question_id VARCHAR(50) NOT NULL REFERENCES quest_questions(id) ON DELETE CASCADE,
        position INT NOT NULL DEFAULT 0,
        text TEXT NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS quest_members (
        quest_id VARCHAR(50) NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        PRIMARY KEY (quest_id, employee_id)
      );

      CREATE TABLE IF NOT EXISTS quest_progress (
        quest_id VARCHAR(50) NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        completed_at TIMESTAMP,
        approved_at TIMESTAMP,
        PRIMARY KEY (quest_id, employee_id)
      );

      -- Quest pass rule + free reward, and each employee's result
      ALTER TABLE quests ADD COLUMN IF NOT EXISTS code VARCHAR(30);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_quests_code ON quests (LOWER(code)) WHERE code IS NOT NULL;
      ALTER TABLE quests ADD COLUMN IF NOT EXISTS pass_count INT DEFAULT 0;
      ALTER TABLE quests ADD COLUMN IF NOT EXISTS reward_id VARCHAR(50);
      ALTER TABLE quest_progress ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT FALSE;
      ALTER TABLE quest_progress ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;
      ALTER TABLE quest_progress ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
      ALTER TABLE quest_progress ADD COLUMN IF NOT EXISTS points_awarded INT DEFAULT 0;
      ALTER TABLE quest_progress ADD COLUMN IF NOT EXISTS reward_redemption_id VARCHAR(50);

      -- Leave attachments (medical certificate, photo, PDF ...) uploaded from the app; leave_requests.attachment_url points to them
      CREATE TABLE IF NOT EXISTS leave_attachments (
        id VARCHAR(50) PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Work locations: where employees may clock in / out (checked on the server by distance)
      CREATE TABLE IF NOT EXISTS work_locations (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'Office',
        address TEXT,
        latitude NUMERIC(10,7) NOT NULL,
        longitude NUMERIC(10,7) NOT NULL,
        radius_m INT NOT NULL DEFAULT 100,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        scope VARCHAR(20) NOT NULL DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS work_location_departments (
        location_id VARCHAR(50) NOT NULL REFERENCES work_locations(id) ON DELETE CASCADE,
        department_id VARCHAR(50) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        PRIMARY KEY (location_id, department_id)
      );

      CREATE TABLE IF NOT EXISTS work_location_members (
        location_id VARCHAR(50) NOT NULL REFERENCES work_locations(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        PRIMARY KEY (location_id, employee_id)
      );

      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_location_id VARCHAR(50);

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

      -- Reward categories (admin managed). rewards.category stays as the display name, rewards.category_id is the real link
      CREATE TABLE IF NOT EXISTS reward_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_categories_name ON reward_categories (LOWER(name));
      ALTER TABLE reward_categories ADD COLUMN IF NOT EXISTS code VARCHAR(30);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_categories_code ON reward_categories (LOWER(code)) WHERE code IS NOT NULL;
      ALTER TABLE rewards ADD COLUMN IF NOT EXISTS category_id VARCHAR(50);

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
      CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_time_corrections_emp ON time_corrections(employee_id);
      CREATE INDEX IF NOT EXISTS idx_quest_sections_quest ON quest_sections(quest_id, position);
      CREATE INDEX IF NOT EXISTS idx_quest_questions_section ON quest_questions(section_id, position);
      CREATE INDEX IF NOT EXISTS idx_quest_choices_question ON quest_choices(question_id, position);

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

      CREATE TABLE IF NOT EXISTS company_holidays (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        year INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Integrity migration: a failure here must only log. The catch below would otherwise flip the app to memory mode.
    try {
      await client.query(INTEGRITY_MIGRATION_SQL);
    } catch (migrationError) {
      console.warn('⚠️ Schema integrity migration skipped:', migrationError.message);
    }

    // Seed master initial Super Admin only if admins table is completely empty
    const adminCheck = await client.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count, 10) === 0) {
      const bcrypt = require('bcryptjs');
      const hashedSeedPwd = bcrypt.hashSync('1234', 10);
      await client.query(`
        INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date)
        VALUES 
          ('ADM-001', 'ADM-001', 'admin', $1, 'ผู้ดูแลระบบ (Web Admin)', 'admin@wellx989.com', '081-234-5678', '-', 'Super Admin', 'Active', '2026-01-01')
        ON CONFLICT (id) DO NOTHING;
      `, [hashedSeedPwd]);
      console.log('🌱 Seeded master Super Admin into admins table: admin (pass: 1234, bcrypt hashed)');
    }

    // Seed official Company Holidays if empty
    const holCheck = await client.query('SELECT COUNT(*) FROM company_holidays');
    if (parseInt(holCheck.rows[0].count, 10) === 0) {
      const { THAI_PUBLIC_HOLIDAYS } = require('../controllers/holidayController');
      for (const h of THAI_PUBLIC_HOLIDAYS) {
        await client.query(
          `INSERT INTO company_holidays (id, date, name, year) VALUES ($1, $2, $3, $4) ON CONFLICT (date) DO NOTHING`,
          [`hol-${h.date}`, h.date, h.name, h.year]
        );
      }
      console.log('🌱 Seeded official Company Holidays into PostgreSQL company_holidays table.');
    }

    // Seed default Rewards if empty
    const rewardsCheck = await client.query('SELECT COUNT(*) FROM rewards');
    if (parseInt(rewardsCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO rewards (id, title, description, points_required, category, image_url, stock, status)
        VALUES
          ('rew-001', 'Starbucks Voucher 100 บาท', 'บัตรกำนัลเครื่องดื่มสตาร์บัคส์ มูลค่า 100 บาท ใช้ได้ทุกสาขาทั่วประเทศ', 500, 'เครื่องดื่มและอาหาร', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400', 50, 'Active'),
          ('rew-002', 'Shopee Code ส่วนลด 200 บาท', 'โค้ดส่วนลด 200 บาท สำหรับสั่งซื้อสินค้าบนแอป Shopee', 900, 'ช้อปปิ้ง', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', 30, 'Active'),
          ('rew-003', 'วันลาพักร้อนพิเศษ 1 วัน (WellX Bonus Leave)', 'สิทธิลาพักร้อนพิเศษเพิ่มเติม 1 วัน อนุมัติโดย HR', 2500, 'สวัสดิการพิเศษ', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400', 10, 'Active'),
          ('rew-004', 'GrabFood Voucher 150 บาท', 'ส่วนลดค่าอาหาร GrabFood มูลค่า 150 บาท', 750, 'เครื่องดื่มและอาหาร', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 40, 'Active')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('🌱 Seeded default Rewards catalog into PostgreSQL rewards table.');
    }

    // Rewards created before categories existed: turn each distinct category text into a category and link it (idempotent, additive)
    await client.query(`
      INSERT INTO reward_categories (id, name)
      SELECT DISTINCT ON (LOWER(TRIM(category))) 'rcat-' || SUBSTR(MD5(LOWER(TRIM(category))), 1, 10), TRIM(category)
      FROM rewards
      WHERE category_id IS NULL AND TRIM(COALESCE(category, '')) <> ''
      ORDER BY LOWER(TRIM(category))
      ON CONFLICT DO NOTHING;
      UPDATE rewards r SET category_id = c.id
      FROM reward_categories c
      WHERE r.category_id IS NULL AND LOWER(c.name) = LOWER(TRIM(r.category));
      UPDATE reward_categories c SET code = 'CAT-' || LPAD((n.rn + COALESCE((SELECT MAX(SUBSTRING(code FROM '^CAT-([0-9]{1,6})$')::int) FROM reward_categories), 0))::text, 3, '0')
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, LOWER(name)) AS rn FROM reward_categories WHERE code IS NULL) n
      WHERE c.id = n.id;
    `);
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
