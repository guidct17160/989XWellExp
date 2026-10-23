const { pool } = require('../config/database');

const seedRealDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('🐘 Connected to PostgreSQL database (wellx989_db)...');

    // 1. Create Admins Table & Ensure Columns Exist
    await client.query(`
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
    `);

    const adminSeeds = [
      {
        id: 'ADM-001',
        code: 'ADM-001',
        username: 'admin',
        password: '1234',
        name: 'สมชาย ใจดี (Web Admin)',
        email: 'admin@wellx989.com',
        phone: '081-234-5678',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        role: 'Super Admin',
        status: 'Active',
        start_date: '2025-01-01',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
      {
        id: 'ADM-002',
        code: 'ADM-002',
        username: 'hr_admin',
        password: '1234',
        name: 'อนันต์ ทรัพย์มาก (HR Admin)',
        email: 'hr.admin@wellx989.com',
        phone: '089-876-5432',
        department: 'ฝ่ายทรัพยากรบุคคล (HR)',
        role: 'HR Admin',
        status: 'Active',
        start_date: '2025-02-15',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      },
      {
        id: 'ADM-003',
        code: 'ADM-003',
        username: 'sys_admin',
        password: '1234',
        name: 'กิตติพงษ์ วงศ์ดี (System Admin)',
        email: 'sysadmin@wellx989.com',
        phone: '082-999-8877',
        department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
        role: 'Admin',
        status: 'Active',
        start_date: '2025-03-01',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      },
    ];

    for (const a of adminSeeds) {
      await client.query(
        `INSERT INTO admins (id, code, username, password, name, email, phone, department, role, status, start_date, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           username = EXCLUDED.username,
           password = EXCLUDED.password,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           department = EXCLUDED.department,
           role = EXCLUDED.role,
           status = EXCLUDED.status`,
        [a.id, a.code, a.username, a.password, a.name, a.email, a.phone, a.department, a.role, a.status, a.start_date, a.avatar_url]
      );
    }
    console.log('✅ Admins table seeded successfully into PostgreSQL!');

    // 2. Create Departments Table & Seed
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        manager VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active'
      );
    `);

    const deptSeeds = [
      { id: 'DEP-01', code: 'IT', name: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', manager: 'คุณ สมชาย ใจดี (Boss IT)', employeeCount: 15, status: 'Active' },
      { id: 'DEP-02', code: 'HR', name: 'ฝ่ายทรัพยากรบุคคล (HR)', manager: 'คุณ อนันต์ ทรัพย์มาก', employeeCount: 6, status: 'Active' },
      { id: 'DEP-03', code: 'MKT', name: 'ฝ่ายการตลาด (Marketing)', manager: 'คุณ กานดา วงษ์สว่าง (Boss Marketing)', employeeCount: 12, status: 'Active' },
      { id: 'DEP-04', code: 'FIN', name: 'ฝ่ายบัญชีและการเงิน (Finance)', manager: 'คุณ ศิริพร บุญช่วย', employeeCount: 8, status: 'Active' },
      { id: 'DEP-05', code: 'OPS', name: 'ฝ่ายปฏิบัติการ (Operations)', manager: 'คุณ ธีระเดช อุ่นใจ', employeeCount: 20, status: 'Active' },
    ];

    for (const d of deptSeeds) {
      await client.query(
        `INSERT INTO departments (id, code, name, manager, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           manager = EXCLUDED.manager,
           status = EXCLUDED.status`,
        [d.id, d.code, d.name, d.manager, d.status]
      );
    }
    console.log('✅ Departments table seeded successfully into PostgreSQL!');

    // 3. Create Sections Table & Seed
    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id VARCHAR(50) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        head VARCHAR(255)
      );
    `);

    const secSeeds = [
      { id: 'SEC-01', code: 'DEV', name: 'การพัฒนาซอฟต์แวร์ (Software Development)', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', head: 'คุณ สมชาย ใจดี' },
      { id: 'SEC-02', code: 'INFRA', name: 'โครงสร้างพื้นฐานและเครือข่าย (Infrastructure)', department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', head: 'คุณ สุรชัย สายฟ้า' },
      { id: 'SEC-03', code: 'RECRUIT', name: 'สรรหาและว่าจ้าง (Recruitment)', department: 'ฝ่ายทรัพยากรบุคคล (HR)', head: 'คุณ อนันต์ ทรัพย์มาก' },
      { id: 'SEC-04', code: 'PAYROLL', name: 'เงินเดือนและสวัสดิการ (Payroll & Benefits)', department: 'ฝ่ายทรัพยากรบุคคล (HR)', head: 'คุณ นภา สว่างจิต' },
      { id: 'SEC-05', code: 'DIGITAL', name: 'การตลาดดิจิทัล (Digital Marketing)', department: 'ฝ่ายการตลาด (Marketing)', head: 'คุณ กานดา วงษ์สว่าง' },
    ];

    for (const s of secSeeds) {
      await client.query(
        `INSERT INTO sections (id, code, name, department, head)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           department = EXCLUDED.department,
           head = EXCLUDED.head`,
        [s.id, s.code, s.name, s.department, s.head]
      );
    }
    console.log('✅ Sections table seeded successfully into PostgreSQL!');

    client.release();
    console.log('🚀 All Real Database Tables & Data Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding PostgreSQL database:', err);
    process.exit(1);
  }
};

seedRealDatabase();
