import { notificationStorage } from './notificationStorage';
import { tryFetchApi } from './apiClient';

const getUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const session = window.localStorage.getItem('wellx989_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && parsed.loggedIn && parsed.user) {
          return parsed.user.id || parsed.user.code || parsed.user.username;
        }
      }
    }
  } catch (e) {}
  return 'default';
};

const getUserGender = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const session = window.localStorage.getItem('wellx989_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && parsed.loggedIn && parsed.user && parsed.user.gender) {
          return String(parsed.user.gender).toLowerCase().trim();
        }
      }
    }
  } catch (e) {}
  return 'male';
};

const getStorageKey = (prefix) => `${prefix}_${getUserId()}`;

const defaultLeavePolicies = [
  {
    id: 'LP-01',
    typeName: 'ลาป่วย (Sick Leave)',
    categoryKey: 'sick',
    defaultQuota: 30,
    isPaid: true,
    applicableGender: 'all',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 0,
    maxConsecutiveDays: 3,
    allowBackdated: true,
    maxBackdatedDays: 3,
    requireAttachment: false,
    description: 'ต้องมีใบรับรองแพทย์กรณีลาติดต่อกันเกิน 3 วัน',
  },
  {
    id: 'LP-02',
    typeName: 'ลากิจ (Personal Leave)',
    categoryKey: 'personal',
    defaultQuota: 6,
    isPaid: true,
    applicableGender: 'all',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 1,
    maxConsecutiveDays: 3,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: false,
    description: 'ยื่นคำขอล่วงหน้าอย่างน้อย 1 วัน',
  },
  {
    id: 'LP-03',
    typeName: 'ลาพักร้อนประจำปี (Annual Leave)',
    categoryKey: 'annual',
    defaultQuota: 10,
    isPaid: true,
    applicableGender: 'all',
    allowedStartDate: '2026-01-01',
    allowedEndDate: '2026-12-31',
    dateRangeEnabled: true,
    minAdvanceDays: 3,
    maxConsecutiveDays: 10,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: false,
    description: 'สำหรับพนักงานที่ผ่านทดลองงานและทำงานครบ 1 ปี (ใช้สิทธิ์ได้ภายในปี 2569 เท่านั้น)',
  },
  {
    id: 'LP-04',
    typeName: 'ลาคลอดบุตร (Maternity Leave)',
    categoryKey: 'maternity',
    defaultQuota: 98,
    isPaid: true,
    applicableGender: 'female',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 7,
    maxConsecutiveDays: 98,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: true,
    description: 'ตามกฎหมายแรงงานกำหนด พร้อมแนบเอกสารรับรองแพทย์ (เฉพาะเพศหญิง)',
  },
  {
    id: 'LP-05',
    typeName: 'ลาบวช / ปฏิบัติธรรม (Ordination Leave)',
    categoryKey: 'ordination',
    defaultQuota: 15,
    isPaid: true,
    applicableGender: 'male',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 15,
    maxConsecutiveDays: 15,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: true,
    description: 'ยื่นขอล่วงหน้าอย่างน้อย 15 วัน พร้อมเอกสารรับรอง (เฉพาะเพศชาย)',
  },
  {
    id: 'LP-06',
    typeName: 'ลาอื่นๆ (Other Leave)',
    categoryKey: 'other',
    defaultQuota: 5,
    isPaid: false,
    applicableGender: 'all',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 1,
    maxConsecutiveDays: 5,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: false,
    description: 'การลาอื่นๆ ที่ไม่เข้าข่ายหมวดข้างต้น',
  },
  {
    id: 'LP-07',
    typeName: 'ลาดูแลภริยาคลอดบุตร (Paternity Leave)',
    categoryKey: 'paternity',
    defaultQuota: 15,
    isPaid: true,
    applicableGender: 'male',
    allowedStartDate: null,
    allowedEndDate: null,
    dateRangeEnabled: false,
    minAdvanceDays: 3,
    maxConsecutiveDays: 15,
    allowBackdated: false,
    maxBackdatedDays: 0,
    requireAttachment: true,
    description: 'สำหรับพนักงานชายเพื่อดูแลภริยาคลอดบุตรและบุตรแรกเกิด (เฉพาะเพศชาย)',
  },
];

let globalState = {
  leaveBalances: [
    { id: 'annual', label: 'ลาพักร้อน', remaining: 10, total: 10, color: '#F5A623', icon: 'umbrella-outline' },
    { id: 'sick', label: 'ลาป่วย', remaining: 30, total: 30, color: '#F5A623', icon: 'medical-outline' },
    { id: 'personal', label: 'ลากิจ', remaining: 6, total: 6, color: '#F5A623', icon: 'briefcase-outline' },
  ],
  leavePolicies: defaultLeavePolicies,
  leaveHistory: [],
};

const loadLocalState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(getStorageKey('leave_state_v2'));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.leaveHistory)) {
          parsed.leaveHistory = parsed.leaveHistory.filter(item => {
            if (!item) return false;
            if (item.dates && (item.dates.includes('31 ก.ค.') || item.dates.includes('31/07'))) return false;
            return true;
          });
        }
        if (!parsed.leavePolicies || parsed.leavePolicies.length === 0) {
          parsed.leavePolicies = defaultLeavePolicies;
        }
        globalState = parsed;
        return;
      }
    }
  } catch (e) {}
  globalState = {
    leaveBalances: [
      { id: 'annual', label: 'ลาพักร้อน', remaining: 10, total: 10, color: '#F5A623', icon: 'umbrella-outline' },
      { id: 'sick', label: 'ลาป่วย', remaining: 30, total: 30, color: '#F5A623', icon: 'medical-outline' },
      { id: 'personal', label: 'ลากิจ', remaining: 6, total: 6, color: '#F5A623', icon: 'briefcase-outline' },
    ],
    leavePolicies: defaultLeavePolicies,
    leaveHistory: [],
  };
};
loadLocalState();

const syncWithBackend = async () => {
  try {
    // 1. Fetch Live Balances & Policies from Real Backend API
    const [balRes, polRes] = await Promise.all([
      tryFetchApi('/leaves/balances'),
      tryFetchApi('/leave-policies'),
    ]);

    if (balRes && balRes.ok) {
      const balData = await balRes.json();
      if (balData && balData.success && Array.isArray(balData.balances) && balData.balances.length > 0) {
        globalState.leaveBalances = balData.balances;
      }
    }

    if (polRes && polRes.ok) {
      const polData = await polRes.json();
      if (polData && polData.success && Array.isArray(polData.policies) && polData.policies.length > 0) {
        globalState.leavePolicies = polData.policies;
      }
    }

    const [reqRes, tcRes] = await Promise.all([
      tryFetchApi('/leaves/my-requests'),
      tryFetchApi('/attendance/corrections/my-requests'),
    ]);

    let backendList = [];

    if (reqRes && reqRes.ok) {
      const reqData = await reqRes.json();
      if (reqData && reqData.success && Array.isArray(reqData.requests)) {
        backendList.push(
          ...reqData.requests.map((r) => ({
            id: r.id,
            typeId: 'leave',
            categoryKey: 'leave',
            categoryName: 'ลางาน',
            type: r.leaveType || 'ลางาน',
            dates: r.startDate === r.endDate ? formatThaiDate(r.startDate) : `${formatThaiDate(r.startDate)} – ${formatThaiDate(r.endDate)}`,
            days: r.totalDays || 1,
            status: r.status || 'รออนุมัติ',
            statusColor: r.status === 'อนุมัติแล้ว' || r.status === 'อนุมัติ' ? '#10B981' : r.status === 'ไม่อนุมัติ' ? '#EF4444' : '#F5A623',
            start: r.startDate,
            end: r.endDate,
            reason: r.reason,
            approver: r.approver,
            remark: r.remark,
            createdAt: r.createdAt,
          }))
        );
      }
    }

    if (tcRes && tcRes.ok) {
      const tcData = await tcRes.json();
      if (tcData && tcData.success && Array.isArray(tcData.corrections)) {
        backendList.push(
          ...tcData.corrections.map((c) => ({
            id: c.id,
            typeId: 'time_correction',
            categoryKey: 'correction',
            categoryName: 'ปรับปรุงเวลา',
            type: 'ปรับปรุงเวลาเข้า-ออกงาน',
            dates: c.dateIso ? formatThaiDate(c.dateIso) : 'วันนี้',
            inTime: c.newCheckIn || '08:00 น.',
            outTime: c.newCheckOut || '17:00 น.',
            status: c.status || 'รออนุมัติ',
            statusColor: c.status === 'อนุมัติแล้ว' || c.status === 'อนุมัติ' ? '#10B981' : c.status === 'ไม่อนุมัติ' ? '#EF4444' : '#F5A623',
            start: c.dateIso,
            end: c.dateIso,
            reason: c.reason,
            approver: c.approver,
            remark: c.remark,
            createdAt: c.createdAt,
          }))
        );
      }
    }

    if (backendList.length > 0) {
      globalState.leaveHistory = backendList;
    }
    saveState();
    listeners.forEach((l) => l(globalState));
  } catch (e) {
    console.log('Failed to sync leave state from API', e);
  }
};
syncWithBackend();

const listeners = new Set();

const saveState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getStorageKey('leave_state_v2'), JSON.stringify(globalState));
    }
  } catch (e) {
    console.log('Error saving leave state to localStorage', e);
  }
};

const formatThaiDate = (dateStr) => {
  const parts = dateStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const leaveStorage = {
  getState() {
    return { ...globalState };
  },
  
  setState(newState) {
    globalState = { ...globalState, ...newState };
    saveState();
    listeners.forEach(l => l(globalState));
  },

  async clearAndSync() {
    await syncWithBackend();
    listeners.forEach((l) => l(globalState));
  },
  
  subscribe(listener) {
    listeners.add(listener);
    listener(globalState);
    return () => listeners.delete(listener);
  },
  
  getPolicies() {
    return globalState.leavePolicies || defaultLeavePolicies;
  },

  getPolicyForType(typeId) {
    const policies = globalState.leavePolicies || defaultLeavePolicies;
    return policies.find(p => p.categoryKey === typeId || p.id === typeId || (p.typeName && p.typeName.toLowerCase().includes(typeId.toLowerCase())));
  },

  async addLeaveRequest(typeId, startStr, endStr, reason) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end - start);
    const requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check policy constraints
    const policy = this.getPolicyForType(typeId);
    if (policy && policy.dateRangeEnabled) {
      if (policy.allowedStartDate && startStr < policy.allowedStartDate) {
        throw new Error(`ไม่สามารถยื่นลาได้ เนื่องจากวันที่เริ่มต้น (${startStr}) อยู่นอกช่วงเวลาที่กำหนดให้ลาได้ (เปิดให้ลาได้ตั้งแต่วันที่ ${policy.allowedStartDate})`);
      }
      if (policy.allowedEndDate && endStr > policy.allowedEndDate) {
        throw new Error(`ไม่สามารถยื่นลาได้ เนื่องจากวันที่สิ้นสุด (${endStr}) เกินวันที่กำหนดให้ลาได้ (สิ้นสุดวันที่ ${policy.allowedEndDate})`);
      }
    }
    
    // Find the leave type balance
    const currentBal = globalState.leaveBalances.find(b => b.id === typeId || b.categoryKey === typeId);
    if (currentBal) {
      if (currentBal.remaining <= 0) {
        throw new Error(`คุณใช้สิทธิ์ ${currentBal.label} ครบตามกำหนดแล้ว (เหลือ 0 วัน) ไม่สามารถยื่นลาเพิ่มได้`);
      }
      if (requestedDays > currentBal.remaining) {
        throw new Error(`วันลาคงเหลือไม่พอ (เหลือ ${currentBal.remaining} วัน ต้องการ ${requestedDays} วัน)`);
      }
    }

    const leaveFullName = policy?.typeName || currentBal?.fullName || currentBal?.label || 'ลางาน';
    
    // Call Live Backend API to insert into PostgreSQL
    const res = await tryFetchApi('/leaves', {
      method: 'POST',
      body: JSON.stringify({
        leaveType: leaveFullName,
        startDate: startStr,
        endDate: endStr,
        totalDays: requestedDays,
        reason: reason || 'ไม่ได้ระบุเหตุผล',
      }),
    });

    if (res) {
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'ไม่สามารถยื่นใบลาได้');
      }
    }

    // Refresh live balances and history from the database
    await syncWithBackend();
    return true;
  },

  addTimeCorrectionRequest(dateStr, inTime, outTime, reason, issueId = null, rawDate = null) {
    const today = new Date();
    let isoDate = today.toISOString().split('T')[0];
    if (rawDate && typeof rawDate === 'string') {
      if (rawDate.includes('-') && rawDate.split('-').length === 3) {
        isoDate = rawDate;
      } else if (rawDate.includes('/') && rawDate.split('/').length === 3) {
        const parts = rawDate.split('/');
        let y = parseInt(parts[2], 10);
        if (y > 2500) y -= 543;
        isoDate = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    const formattedIn = inTime ? (inTime.includes('น.') ? inTime : `${inTime} น.`) : '09:00 น.';
    const formattedOut = outTime ? (outTime.includes('น.') ? outTime : `${outTime} น.`) : '18:00 น.';

    const newRequest = {
      id: 'tc_' + Date.now(),
      issueId: issueId || null,
      rawDate: rawDate || isoDate,
      typeId: 'time_correction',
      categoryKey: 'correction',
      categoryName: 'ปรับปรุงเวลา',
      type: 'ปรับปรุงเวลาเข้า-ออกงาน',
      dates: dateStr || 'วันนี้',
      inTime: formattedIn,
      outTime: formattedOut,
      status: 'รออนุมัติ',
      statusColor: '#F5A623',
      start: isoDate,
      end: isoDate,
      reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
      month: today.getMonth(),
      year: today.getFullYear(),
      createdAt: today.toISOString(),
    };

    globalState = {
      ...globalState,
      leaveHistory: [newRequest, ...globalState.leaveHistory],
    };

    saveState();
    listeners.forEach(l => l(globalState));

    try {
      tryFetchApi('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          dateIso: rawDate || isoDate,
          oldCheckIn: '-',
          newCheckIn: formattedIn,
          oldCheckOut: '-',
          newCheckOut: formattedOut,
          reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        }),
      });
    } catch (e) {}

    return newRequest;
  }
};
