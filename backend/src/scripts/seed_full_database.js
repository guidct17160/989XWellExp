const db = require('../config/database');

async function seedFullDatabase() {
  console.log('🌱 Seeding real database records for WellX989...');

  try {
    // 1. Departments
    await db.query(`
      INSERT INTO departments (id, code, name, manager, status)
      VALUES 
        ('DEP-01', 'IT', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', 'ผู้จัดการฝ่าย IT', 'Active'),
        ('DEP-02', 'HR', 'ฝ่ายทรัพยากรบุคคล (HR)', 'ผู้จัดการฝ่าย HR', 'Active'),
        ('DEP-03', 'MKT', 'ฝ่ายการตลาดและการขาย (Marketing & Sales)', 'ผู้จัดการฝ่ายการตลาด', 'Active')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `);
    console.log('✅ Departments seeded.');

    // 2. Employees (Colleagues in IT and other departments)
    await db.query(`
      INSERT INTO employees (id, code, name, first_name, last_name, username, password, email, phone, department, role, status, start_date, points, birth_date)
      VALUES 
        ('EMP-199012', 'EMP-001', 'Dechathon Thongthipyarat', 'Dechathon', 'Thongthipyarat', 'dechathon', '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK', 'dechathon@wellx989.com', '089-123-4567', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', 'Employee', 'Active', '2024-01-15', 0, '2003-12-02'),
        ('EMP-002', 'EMP-002', 'ธนภัทร สุขสมบัติ', 'ธนภัทร', 'สุขสมบัติ', 'thanapat', '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK', 'thanapat@wellx989.com', '081-222-3344', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', 'Employee', 'Active', '2023-05-10', 0, '1998-05-14'),
        ('EMP-003', 'EMP-003', 'ภาณุวัฒน์ กลิ่นเกสร', 'ภาณุวัฒน์', 'กลิ่นเกสร', 'panuwat', '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK', 'panuwat@wellx989.com', '089-333-5566', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', 'Employee', 'Active', '2024-02-01', 0, '2000-11-20'),
        ('EMP-004', 'EMP-004', 'วิภาดา เลิศรัตนกุล', 'วิภาดา', 'เลิศรัตนกุล', 'wiphada', '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK', 'wiphada@wellx989.com', '082-444-6677', 'ฝ่ายทรัพยากรบุคคล (HR)', 'Employee', 'Active', '2023-08-15', 0, '1995-03-08'),
        ('EMP-005', 'EMP-005', 'ณัฐวุฒิ สิริวัฒนา', 'ณัฐวุฒิ', 'สิริวัฒนา', 'nattawut', '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK', 'nattawut@wellx989.com', '086-555-7788', 'ฝ่ายการตลาดและการขาย (Marketing & Sales)', 'Employee', 'Active', '2024-03-01', 0, '1997-07-25')
      ON CONFLICT (id) DO UPDATE SET 
        department = EXCLUDED.department, 
        points = EXCLUDED.points, 
        birth_date = EXCLUDED.birth_date,
        name = EXCLUDED.name;
    `);
    console.log('✅ Employees seeded.');

    // 3. Leave Policies
    await db.query(`
      INSERT INTO leave_policies (id, type_name, category_key, default_quota, is_paid, applicable_gender, min_advance_days, max_consecutive_days, description)
      VALUES 
        ('LP-01', 'ลาป่วย (Sick Leave)', 'sick', 30, true, 'all', 0, 30, 'ต้องมีใบรับรองแพทย์กรณีลาติดต่อกันเกิน 3 วัน'),
        ('LP-02', 'ลากิจ (Personal Leave)', 'personal', 6, true, 'all', 1, 3, 'ยื่นคำขอล่วงหน้าอย่างน้อย 1 วัน'),
        ('LP-03', 'ลาพักร้อนประจำปี (Annual Leave)', 'annual', 10, true, 'all', 3, 10, 'สำหรับพนักงานที่ผ่านทดลองงานและทำงานครบ 1 ปี'),
        ('LP-04', 'ลาคลอดบุตร (Maternity Leave)', 'maternity', 98, true, 'female', 7, 98, 'ตามกฎหมายแรงงานกำหนด (เฉพาะเพศหญิง)'),
        ('LP-05', 'ลาบวช / ปฏิบัติธรรม (Ordination Leave)', 'ordination', 15, true, 'male', 15, 15, 'ยื่นขอล่วงหน้าอย่างน้อย 15 วัน (เฉพาะเพศชาย)')
      ON CONFLICT (id) DO UPDATE SET type_name = EXCLUDED.type_name, default_quota = EXCLUDED.default_quota;
    `);
    console.log('✅ Leave policies seeded.');

    // 4. Attendance records (with late arrival & missing check-out for EMP-199012)
    await db.query(`
      INSERT INTO attendance (id, employee_id, date_iso, check_in, check_out, duration, status, status_color, latitude, longitude, location_name)
      VALUES 
        ('att-20261001', 'EMP-199012', '2026-10-01', '08:30 น.', '17:15 น.', '08:45:00 ชม.', 'ปกติ', '#10B981', 13.7563, 100.5018, 'อาคารสำนักงาน WellX989'),
        ('att-20261002', 'EMP-199012', '2026-10-02', '09:25 น.', '17:05 น.', '07:40:00 ชม.', 'สาย', '#EF4444', 13.7563, 100.5018, 'อาคารสำนักงาน WellX989'),
        ('att-20261005', 'EMP-199012', '2026-10-05', '08:45 น.', null, '00:00:00 ชม.', 'ไม่ลงเวลาออกงาน', '#EF4444', 13.7563, 100.5018, 'อาคารสำนักงาน WellX989'),
        ('att-20261006', 'EMP-199012', '2026-10-06', '08:20 น.', '17:00 น.', '08:40:00 ชม.', 'ปกติ', '#10B981', 13.7563, 100.5018, 'อาคารสำนักงาน WellX989'),
        ('att-20261007', 'EMP-199012', '2026-10-07', '08:15 น.', '17:30 น.', '09:15:00 ชม.', 'ปกติ', '#10B981', 13.7563, 100.5018, 'อาคารสำนักงาน WellX989')
      ON CONFLICT (id) DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, status = EXCLUDED.status;
    `);
    console.log('✅ Real attendance records seeded.');

    // 5. Leave requests
    await db.query(`
      INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, status, approver, remark)
      VALUES 
        ('LV-20260918', 'EMP-199012', 'ลาพักร้อนประจำปี (Annual Leave)', '2026-09-18', '2026-09-19', 2, 'พักผ่อนประจำปีกับครอบครัว', 'อนุมัติแล้ว', 'ผู้จัดการฝ่าย IT', 'อนุมัติตามระเบียบบริษัท')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✅ Real leave requests seeded.');

    console.log('🎉 Full database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error seeding full database:', err);
  } finally {
    process.exit(0);
  }
}

seedFullDatabase();
