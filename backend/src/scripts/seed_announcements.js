const db = require('../config/database');

async function seed() {
  await db.query(`
    INSERT INTO announcements (id, title, content, category, author, is_pinned, created_at)
    VALUES 
      ('anno-001', '📢 ประกาศวันหยุดตามประเพณีประจำปี 2026', 'บริษัท WellX989 ขอแจ้งกำหนดการวันหยุดตามประเพณีและวันหยุดนักขัตฤกษ์ประจำปี 2569 เพื่อให้พนักงานทุกท่านวางแผนการทำงานและการลากิจล่วงหน้า', 'ประกาศสำคัญ', 'ฝ่ายทรัพยากรบุคคล (HR)', true, NOW() - INTERVAL '1 day'),
      ('anno-002', '🎉 กิจกรรม WellX Healthy Company & กีฬาสีประจำปี', 'ขอเชิญชวนพนักงานทุกแผนกร่วมกิจกรรมสะสมคะแนนก้าวเดินเพื่อสุขภาพ ชิงรางวัลบัตรของขวัญและวันลาพักร้อนพิเศษประจำเดือนนี้', 'โปรโมชั่น & กิจกรรม', 'HR & WellX Community', false, NOW() - INTERVAL '2 days'),
      ('anno-003', '⚙️ แจ้งอัปเดตระบบ WellX989 Mobile App เวอร์ชันใหม่', 'ระบบได้ทำการเชื่อมต่อฐานข้อมูล Realtime PostgreSQL เต็มรูปแบบ พร้อมระบบตรวจสอบความปลอดภัยสลิปเงินเดือนด้วย PIN', 'อัปเดตระบบ', 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', false, NOW() - INTERVAL '3 days')
    ON CONFLICT (id) DO NOTHING;
  `);

  const res = await db.query('SELECT count(*) FROM announcements');
  console.log('Total announcements in DB:', res.rows[0].count);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
