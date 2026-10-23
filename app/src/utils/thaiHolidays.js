// thaiHolidays.js — Official Real Calendar Public Holidays (Thailand 2025 - 2027)
import { tryFetchApi } from '../services/apiClient';

export const THAI_PUBLIC_HOLIDAYS_MAP = {
  // 2025
  '2025-01-01': 'วันขึ้นปีใหม่ (New Year\'s Day)',
  '2025-02-12': 'วันมาฆบูชา (Makha Bucha Day)',
  '2025-04-06': 'วันจักรี (Chakri Memorial Day)',
  '2025-04-07': 'วันหยุดชดเชยวันจักรี',
  '2025-04-13': 'วันสงกรานต์ (Songkran Festival)',
  '2025-04-14': 'วันสงกรานต์ (Songkran Festival)',
  '2025-04-15': 'วันสงกรานต์ (Songkran Festival)',
  '2025-04-16': 'วันหยุดชดเชยวันสงกรานต์',
  '2025-05-01': 'วันแรงงานแห่งชาติ (Labour Day)',
  '2025-05-05': 'วันฉัตรมงคล (Coronation Day)',
  '2025-05-11': 'วันวิสาขบูชา (Visakha Bucha Day)',
  '2025-05-12': 'วันหยุดชดเชยวันวิสาขบูชา',
  '2025-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2025-07-10': 'วันอาสาฬหบูชา (Asarnha Bucha Day)',
  '2025-07-11': 'วันเข้าพรรษา (Buddhist Lent Day)',
  '2025-07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
  '2025-08-12': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ',
  '2025-10-13': 'วันนวมินทรมหาราช (King Rama IX Memorial Day)',
  '2025-10-23': 'วันปิยมหาราช (Chulalongkorn Day)',
  '2025-12-05': 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ',
  '2025-12-10': 'วันรัฐธรรมนูญ (Constitution Day)',
  '2025-12-31': 'วันสิ้นปี (New Year\'s Eve)',

  // 2026
  '2026-01-01': 'วันขึ้นปีใหม่ (New Year\'s Day)',
  '2026-01-02': 'วันหยุดพิเศษเทศกาลปีใหม่',
  '2026-03-03': 'วันมาฆบูชา (Makha Bucha Day)',
  '2026-04-06': 'วันจักรี (Chakri Memorial Day)',
  '2026-04-13': 'วันสงกรานต์ (Songkran Festival)',
  '2026-04-14': 'วันสงกรานต์ (Songkran Festival)',
  '2026-04-15': 'วันสงกรานต์ (Songkran Festival)',
  '2026-05-01': 'วันแรงงานแห่งชาติ (Labour Day)',
  '2026-05-04': 'วันฉัตรมงคล (Coronation Day)',
  '2026-05-31': 'วันวิสาขบูชา (Visakha Bucha Day)',
  '2026-06-01': 'วันหยุดชดเชยวันวิสาขบูชา',
  '2026-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2026-07-27': 'วันหยุดชดเชยวันอาสาฬหบูชา',
  '2026-07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
  '2026-07-29': 'วันเข้าพรรษา (Buddhist Lent Day)',
  '2026-08-12': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง / วันแม่แห่งชาติ',
  '2026-10-13': 'วันนวมินทรมหาราช (King Rama IX Memorial Day)',
  '2026-10-23': 'วันปิยมหาราช (Chulalongkorn Day)',
  '2026-12-05': 'วันพ่อแห่งชาติ (Father\'s Day)',
  '2026-12-07': 'วันหยุดชดเชยวันพ่อแห่งชาติ',
  '2026-12-10': 'วันรัฐธรรมนูญ (Constitution Day)',
  '2026-12-31': 'วันสิ้นปี (New Year\'s Eve)',

  // 2027
  '2027-01-01': 'วันขึ้นปีใหม่ (New Year\'s Day)',
  '2027-02-21': 'วันมาฆบูชา (Makha Bucha Day)',
  '2027-02-22': 'วันหยุดชดเชยวันมาฆบูชา',
  '2027-04-06': 'วันจักรี (Chakri Memorial Day)',
  '2027-04-13': 'วันสงกรานต์ (Songkran Festival)',
  '2027-04-14': 'วันสงกรานต์ (Songkran Festival)',
  '2027-04-15': 'วันสงกรานต์ (Songkran Festival)',
  '2027-05-01': 'วันแรงงานแห่งชาติ (Labour Day)',
  '2027-05-03': 'วันหยุดชดเชยวันแรงงานแห่งชาติ',
  '2027-05-04': 'วันฉัตรมงคล (Coronation Day)',
  '2027-05-20': 'วันวิสาขบูชา (Visakha Bucha Day)',
  '2027-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '2027-07-18': 'วันอาสาฬหบูชา (Asarnha Bucha Day)',
  '2027-07-19': 'วันเข้าพรรษา / ชดเชยวันอาสาฬหบูชา',
  '2027-07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
  '2027-08-12': 'วันแม่แห่งชาติ (Mother\'s Day)',
  '2027-10-13': 'วันนวมินทรมหาราช (King Rama IX Memorial Day)',
  '2027-10-23': 'วันปิยมหาราช (Chulalongkorn Day)',
  '2027-10-25': 'วันหยุดชดเชยวันปิยมหาราช',
  '2027-12-05': 'วันพ่อแห่งชาติ (Father\'s Day)',
  '2027-12-06': 'วันหยุดชดเชยวันพ่อแห่งชาติ',
  '2027-12-10': 'วันรัฐธรรมนูญ (Constitution Day)',
  '2027-12-31': 'วันสิ้นปี (New Year\'s Eve)',
};

let liveHolidays = { ...THAI_PUBLIC_HOLIDAYS_MAP };

export const fetchHolidaysFromBackend = async () => {
  try {
    const res = await tryFetchApi('/holidays');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.holidays)) {
        data.holidays.forEach((h) => {
          if (h.date && h.name) {
            liveHolidays[h.date] = h.name;
          }
        });
      }
    }
  } catch (e) {
    // Retain default official Thai calendar
  }
};

export const getPublicHolidayName = (date) => {
  if (!date) return null;
  let dateStr = '';
  if (typeof date === 'string') {
    dateStr = date.split('T')[0];
  } else if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  }
  return liveHolidays[dateStr] || THAI_PUBLIC_HOLIDAYS_MAP[dateStr] || null;
};

export const isPublicHoliday = (date) => {
  return getPublicHolidayName(date) !== null;
};
