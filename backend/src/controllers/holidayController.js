// holidayController.js — Official Real Calendar Public Holidays (Thailand 2025 - 2027)
const THAI_PUBLIC_HOLIDAYS = [
  // 2025
  { date: '2025-01-01', name: 'วันขึ้นปีใหม่ (New Year\'s Day)', year: 2025 },
  { date: '2025-02-12', name: 'วันมาฆบูชา (Makha Bucha Day)', year: 2025 },
  { date: '2025-04-06', name: 'วันจักรี (Chakri Memorial Day)', year: 2025 },
  { date: '2025-04-07', name: 'วันหยุดชดเชยวันจักรี', year: 2025 },
  { date: '2025-04-13', name: 'วันสงกรานต์ (Songkran Festival)', year: 2025 },
  { date: '2025-04-14', name: 'วันสงกรานต์ (Songkran Festival)', year: 2025 },
  { date: '2025-04-15', name: 'วันสงกรานต์ (Songkran Festival)', year: 2025 },
  { date: '2025-04-16', name: 'วันหยุดชดเชยวันสงกรานต์', year: 2025 },
  { date: '2025-05-01', name: 'วันแรงงานแห่งชาติ (Labour Day)', year: 2025 },
  { date: '2025-05-05', name: 'วันฉัตรมงคล (Coronation Day)', year: 2025 },
  { date: '2025-05-11', name: 'วันวิสาขบูชา (Visakha Bucha Day)', year: 2025 },
  { date: '2025-05-12', name: 'วันหยุดชดเชยวันวิสาขบูชา', year: 2025 },
  { date: '2025-06-03', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', year: 2025 },
  { date: '2025-07-10', name: 'วันอาสาฬหบูชา (Asarnha Bucha Day)', year: 2025 },
  { date: '2025-07-11', name: 'วันเข้าพรรษา (Buddhist Lent Day)', year: 2025 },
  { date: '2025-07-28', name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (King\'s Birthday)', year: 2025 },
  { date: '2025-08-12', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ (Mother\'s Day)', year: 2025 },
  { date: '2025-10-13', name: 'วันนวมินทรมหาราช (King Rama IX Memorial Day)', year: 2025 },
  { date: '2025-10-23', name: 'วันปิยมหาราช (Chulalongkorn Day)', year: 2025 },
  { date: '2025-12-05', name: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ (Father\'s Day)', year: 2025 },
  { date: '2025-12-10', name: 'วันรัฐธรรมนูญ (Constitution Day)', year: 2025 },
  { date: '2025-12-31', name: 'วันสิ้นปี (New Year\'s Eve)', year: 2025 },

  // 2026
  { date: '2026-01-01', name: 'วันขึ้นปีใหม่ (New Year\'s Day)', year: 2026 },
  { date: '2026-01-02', name: 'วันหยุดพิเศษเทศกาลปีใหม่', year: 2026 },
  { date: '2026-03-03', name: 'วันมาฆบูชา (Makha Bucha Day)', year: 2026 },
  { date: '2026-04-06', name: 'วันจักรี (Chakri Memorial Day)', year: 2026 },
  { date: '2026-04-13', name: 'วันสงกรานต์ (Songkran Festival)', year: 2026 },
  { date: '2026-04-14', name: 'วันสงกรานต์ (Songkran Festival)', year: 2026 },
  { date: '2026-04-15', name: 'วันสงกรานต์ (Songkran Festival)', year: 2026 },
  { date: '2026-05-01', name: 'วันแรงงานแห่งชาติ (Labour Day)', year: 2026 },
  { date: '2026-05-04', name: 'วันฉัตรมงคล (Coronation Day)', year: 2026 },
  { date: '2026-05-31', name: 'วันวิสาขบูชา (Visakha Bucha Day)', year: 2026 },
  { date: '2026-06-01', name: 'วันหยุดชดเชยวันวิสาขบูชา', year: 2026 },
  { date: '2026-06-03', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', year: 2026 },
  { date: '2026-07-27', name: 'วันหยุดชดเชยวันอาสาฬหบูชา', year: 2026 },
  { date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (King\'s Birthday)', year: 2026 },
  { date: '2026-07-29', name: 'วันเข้าพรรษา (Buddhist Lent Day)', year: 2026 },
  { date: '2026-08-12', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ (Mother\'s Day)', year: 2026 },
  { date: '2026-10-13', name: 'วันนวมินทรมหาราช (King Rama IX Memorial Day)', year: 2026 },
  { date: '2026-10-23', name: 'วันปิยมหาราช (Chulalongkorn Day)', year: 2026 },
  { date: '2026-12-05', name: 'วันพ่อแห่งชาติ (Father\'s Day)', year: 2026 },
  { date: '2026-12-07', name: 'วันหยุดชดเชยวันพ่อแห่งชาติ', year: 2026 },
  { date: '2026-12-10', name: 'วันรัฐธรรมนูญ (Constitution Day)', year: 2026 },
  { date: '2026-12-31', name: 'วันสิ้นปี (New Year\'s Eve)', year: 2026 },

  // 2027
  { date: '2027-01-01', name: 'วันขึ้นปีใหม่ (New Year\'s Day)', year: 2027 },
  { date: '2027-02-21', name: 'วันมาฆบูชา (Makha Bucha Day)', year: 2027 },
  { date: '2027-02-22', name: 'วันหยุดชดเชยวันมาฆบูชา', year: 2027 },
  { date: '2027-04-06', name: 'วันจักรี (Chakri Memorial Day)', year: 2027 },
  { date: '2027-04-13', name: 'วันสงกรานต์ (Songkran Festival)', year: 2027 },
  { date: '2027-04-14', name: 'วันสงกรานต์ (Songkran Festival)', year: 2027 },
  { date: '2027-04-15', name: 'วันสงกรานต์ (Songkran Festival)', year: 2027 },
  { date: '2027-05-01', name: 'วันแรงงานแห่งชาติ (Labour Day)', year: 2027 },
  { date: '2027-05-03', name: 'วันหยุดชดเชยวันแรงงานแห่งชาติ', year: 2027 },
  { date: '2027-05-04', name: 'วันฉัตรมงคล (Coronation Day)', year: 2027 },
  { date: '2027-05-20', name: 'วันวิสาขบูชา (Visakha Bucha Day)', year: 2027 },
  { date: '2027-06-03', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', year: 2027 },
  { date: '2027-07-18', name: 'วันอาสาฬหบูชา (Asarnha Bucha Day)', year: 2027 },
  { date: '2027-07-19', name: 'วันเข้าพรรษา / ชดเชยวันอาสาฬหบูชา', year: 2027 },
  { date: '2027-07-28', name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (King\'s Birthday)', year: 2027 },
  { date: '2027-08-12', name: 'วันแม่แห่งชาติ (Mother\'s Day)', year: 2027 },
  { date: '2027-10-13', name: 'วันนวมินทรมหาราช (King Rama IX Memorial Day)', year: 2027 },
  { date: '2027-10-23', name: 'วันปิยมหาราช (Chulalongkorn Day)', year: 2027 },
  { date: '2027-10-25', name: 'วันหยุดชดเชยวันปิยมหาราช', year: 2027 },
  { date: '2027-12-05', name: 'วันพ่อแห่งชาติ (Father\'s Day)', year: 2027 },
  { date: '2027-12-06', name: 'วันหยุดชดเชยวันพ่อแห่งชาติ', year: 2027 },
  { date: '2027-12-10', name: 'วันรัฐธรรมนูญ (Constitution Day)', year: 2027 },
  { date: '2027-12-31', name: 'วันสิ้นปี (New Year\'s Eve)', year: 2027 },
];

exports.getHolidays = async (req, res) => {
  try {
    const db = require('../config/database');
    const { year } = req.query;

    let query = 'SELECT id, date, name, year FROM company_holidays WHERE 1=1';
    const params = [];
    if (year) {
      params.push(parseInt(year, 10));
      query += ` AND year = $${params.length}`;
    }
    query += ' ORDER BY date ASC';
    const result = await db.query(query, params);
    return res.status(200).json({
      success: true,
      total: result.rows ? result.rows.length : 0,
      holidays: result.rows || [],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Database query error: ' + error.message });
  }
};

exports.THAI_PUBLIC_HOLIDAYS = THAI_PUBLIC_HOLIDAYS;
