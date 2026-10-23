import React, { createContext, useContext, useState, useEffect } from 'react';
import { colors } from '../theme/colors';

const translations = {
  th: {
    // Tabs & Navigation
    home: 'หน้าหลัก',
    calendar: 'ปฏิทิน',
    hr: 'HR',
    rewards: 'สิทธิพิเศษ',
    profile: 'โปรไฟล์',
    back: 'ย้อนกลับ',
    
    // Quick Actions & Headers
    quickActions: 'เมนูด่วน',
    leave: 'ลางาน',
    team: 'ทีมงาน',
    timeCorrection: 'ปรับปรุงเวลา',
    requestStatus: 'สถานะคำขอ',
    approval: 'อนุมัติคำขอ',
    announcements: 'ประกาศ / ข่าวสาร',
    noAnnouncements: 'ยังไม่มีประกาศในขณะนี้',
    leaderboard: 'Leaderboard รวม',
    pointHistory: 'ประวัติคะแนน',
    
    // Common Actions
    all: 'ทั้งหมด',
    search: 'ค้นหา',
    filter: 'ตัวกรอง',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    submit: 'ส่งคำขอ',
    verify: 'ยืนยันตัวตน',
    logout: 'ออกจากระบบ',
    logoutConfirm: 'คุณต้องการออกจากระบบใช่หรือไม่?',
    
    // Status
    pending: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ไม่อนุมัติ',
    completed: 'สำเร็จแล้ว',
    
    // Settings
    settings: 'การตั้งค่า',
    accountSecurity: 'ความปลอดภัยและบัญชี',
    changePassword: 'เปลี่ยนรหัสผ่าน',
    changePasswordDesc: 'เปลี่ยนรหัสผ่านใหม่ผ่านระบบอีเมล',
    setPin: 'ตั้งค่ารหัส PIN',
    removePin: 'ปิดการใช้งาน PIN',
    preferences: 'การแสดงผลและภาษา',
    darkMode: 'โหมดกลางคืน (Dark Mode)',
    languageLabel: 'ภาษา (Language)',
    notifications: 'การแจ้งเตือน',
    pushNotifications: 'การแจ้งเตือนแบบพุช',
    biometrics: 'สแกนลายนิ้วมือ / Face ID',
    aboutApp: 'เกี่ยวกับแอปพลิเคชัน',
    version: 'เวอร์ชัน',
    
    
    // Team & Directory
    myDepartmentTeam: 'ทีมงานแผนก',
    noTeamMembers: 'ไม่พบสมาชิกในแผนกนี้',
    
    // Messages & Alerts
    success: 'สำเร็จ',
    error: 'ข้อผิดพลาด',
    warning: 'แจ้งเตือน',
    cannotEditProfile: 'ข้อมูลพนักงานถูกกำหนดและดูแลโดยฝ่าย HR บนระบบ Web Admin ไม่สามารถแก้ไขได้ในแอป',
  },
  en: {
    // Tabs & Navigation
    home: 'Home',
    calendar: 'Calendar',
    hr: 'HR Suite',
    rewards: 'Perks',
    profile: 'Profile',
    back: 'Back',
    
    // Quick Actions & Headers
    quickActions: 'Quick Actions',
    leave: 'Leave Request',
    team: 'Department',
    timeCorrection: 'Time Correction',
    requestStatus: 'Request Status',
    approval: 'Approvals',
    announcements: 'Announcements',
    noAnnouncements: 'No announcements at this time',
    leaderboard: 'Company Leaderboard',
    pointHistory: 'Points History',
    
    // Common Actions
    all: 'All',
    search: 'Search',
    filter: 'Filter',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    submit: 'Submit',
    verify: 'Verify',
    logout: 'Log Out',
    logoutConfirm: 'Are you sure you want to log out?',
    
    // Status
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    completed: 'Completed',
    
    // Settings
    settings: 'Settings',
    accountSecurity: 'Account & Security',
    changePassword: 'Change Password',
    changePasswordDesc: 'Reset password via email verification link',
    setPin: 'Setup PIN',
    removePin: 'Disable PIN',
    preferences: 'Display & Language',
    darkMode: 'Dark Mode',
    languageLabel: 'Language',
    notifications: 'Notifications',
    pushNotifications: 'Push Notifications',
    biometrics: 'Biometric Login',
    aboutApp: 'About Application',
    version: 'Version',
    
    
    // Team & Directory
    myDepartmentTeam: 'Department Team',
    noTeamMembers: 'No department members found',
    
    // Messages & Alerts
    success: 'Success',
    error: 'Error',
    warning: 'Notice',
    cannotEditProfile: 'Profile information is officially managed by HR on Web Admin and cannot be edited in the app.',
  },
};

const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
  language: 'th',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  theme: {},
});

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('wellx989_dark_mode') === 'true';
      }
    } catch (e) {}
    return false;
  });

  const [language, setLanguageState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('wellx989_language');
        if (saved === 'en' || saved === 'English') return 'en';
      }
    } catch (e) {}
    return 'th';
  });

  const toggleDarkMode = (value) => {
    const nextVal = typeof value === 'boolean' ? value : !isDarkMode;
    setIsDarkMode(nextVal);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('wellx989_dark_mode', String(nextVal));
      }
    } catch (e) {}
  };

  const setLanguage = (lang) => {
    const nextLang = lang === 'en' || lang === 'English' ? 'en' : 'th';
    setLanguageState(nextLang);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('wellx989_language', nextLang);
      }
    } catch (e) {}
  };

  const t = (key, fallback) => {
    const dict = translations[language] || translations.th;
    return dict[key] || fallback || key;
  };

  const theme = {
    isDark: isDarkMode,
    background: isDarkMode ? '#0F172A' : '#F8FAFC',
    card: isDarkMode ? '#1E293B' : '#FFFFFF',
    cardBorder: isDarkMode ? '#334155' : '#F1F5F9',
    text: isDarkMode ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    headerBg: isDarkMode ? '#1E293B' : '#FFFFFF',
    inputBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    primary: colors.primary,
    primaryLight: isDarkMode ? '#1E293B' : colors.primaryLight,
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        language,
        setLanguage,
        t,
        theme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
