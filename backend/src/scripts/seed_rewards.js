const db = require('../config/database');

async function seedRewards() {
  await db.query(`
    INSERT INTO rewards (id, title, description, points_required, category, image_url, stock, status)
    VALUES
      ('rew-001', 'Starbucks Voucher 100 บาท', 'บัตรกำนัลเครื่องดื่มสตาร์บัคส์ มูลค่า 100 บาท ใช้ได้ทุกสาขาทั่วประเทศ', 500, 'เครื่องดื่มและอาหาร', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400', 50, 'Active'),
      ('rew-002', 'Shopee Code ส่วนลด 200 บาท', 'โค้ดส่วนลด 200 บาท สำหรับสั่งซื้อสินค้าบนแอป Shopee', 900, 'ช้อปปิ้ง', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400', 30, 'Active'),
      ('rew-003', 'วันลาพักร้อนพิเศษ 1 วัน (WellX Bonus Leave)', 'สิทธิลาพักร้อนพิเศษเพิ่มเติม 1 วัน อนุมัติโดย HR', 2500, 'สวัสดิการพิเศษ', 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400', 10, 'Active'),
      ('rew-004', 'GrabFood Voucher 150 บาท', 'ส่วนลดค่าอาหาร GrabFood มูลค่า 150 บาท', 750, 'เครื่องดื่มและอาหาร', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 40, 'Active')
    ON CONFLICT (id) DO NOTHING;
  `);

  const res = await db.query('SELECT count(*) FROM rewards');
  console.log('Total rewards in DB:', res.rows[0].count);
  process.exit(0);
}

seedRewards().catch(err => {
  console.error(err);
  process.exit(1);
});
