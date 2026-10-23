/**
 * Centralized In-Memory Seed & State Store for WellX989
 * Cleaned: All mock employees, departments, positions, payslips and rewards cleared.
 * Master admin (admin / 1234) retained for system authentication.
 */

const memoryStore = {
  memoryAdmins: [
    {
      id: 'ADM-001',
      code: 'ADM-001',
      username: 'admin',
      password: '$2b$10$u9G4gLOe.Mtb/Inw/OqpPODNkSewMjLjtQvyonSLcoXw61Q3HQcbK',
      name: 'ผู้ดูแลระบบ (Web Admin)',
      email: 'admin@wellx989.com',
      phone: '081-234-5678',
      department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      role: 'Super Admin',
      status: 'Active',
      startDate: '2026-01-01',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  ],

  memoryEmployees: [],
  memoryDepartments: [],
  memoryPositions: [],
  memorySections: [],

  memorySettings: {
    companyName: 'WellX989 Enterprise Co., Ltd.',
    workTimeStart: '08:00',
    workTimeEnd: '17:00',
    workHoursPerDay: 9,
    lateThresholdTime: '09:00',
    lateGraceMinutes: 60,
    enableBiometrics: true,
    enableGPSAttendance: true,
    allowRemoteCheckin: true,
    appVersion: '1.0.0 (Build 1)',
  },

  memoryAttendance: [],
  memoryTimeCorrections: [],
  memoryLeaves: [],
  memoryLeaveBalances: {},
  memoryQuests: [],
  memoryWorkLocations: [],
  memoryLeaveAttachments: [],


  memoryRewards: [],
  memoryRewardCategories: [],
  memoryRedemptions: [],
  memoryPointHistory: {},

  memoryAnnouncements: [],
  memoryNotifications: [],
  memoryPushTokens: {},
  memoryLeavePolicies: [],
  memoryAuditLogs: [],
};

module.exports = memoryStore;
