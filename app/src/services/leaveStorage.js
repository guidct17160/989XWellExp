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

const defaultLeavePolicies = [];

let globalState = {
  leaveBalances: [],
  leavePolicies: [],
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
        globalState = {
          leaveBalances: Array.isArray(parsed.leaveBalances) ? parsed.leaveBalances : [],
          leavePolicies: Array.isArray(parsed.leavePolicies) ? parsed.leavePolicies : [],
          leaveHistory: Array.isArray(parsed.leaveHistory) ? parsed.leaveHistory : [],
        };
        return;
      }
    }
  } catch (e) {}
  globalState = {
    leaveBalances: [],
    leavePolicies: [],
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
      if (balData && balData.success && Array.isArray(balData.balances)) {
        globalState.leaveBalances = balData.balances;
      }
    }

    if (polRes && polRes.ok) {
      const polData = await polRes.json();
      if (polData && polData.success && Array.isArray(polData.policies)) {
        globalState.leavePolicies = polData.policies;
      }
    }

    const [reqRes, tcRes] = await Promise.all([
      tryFetchApi('/leaves/my-requests'),
      tryFetchApi('/attendance/corrections/my-requests'),
    ]);

    let backendList = [];
    let leaveListLoaded = false;
    let correctionListLoaded = false;

    if (reqRes && reqRes.ok) {
      const reqData = await reqRes.json();
      if (reqData && reqData.success && Array.isArray(reqData.requests)) {
        leaveListLoaded = true;
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
        correctionListLoaded = true;
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

    // Server is the source of truth: replace local history once both lists were fetched (even when empty)
    if (leaveListLoaded && correctionListLoaded) {
      globalState.leaveHistory = backendList;
    } else if (backendList.length > 0) {
      // One list failed to load: keep the previously known items of that category
      const kept = (globalState.leaveHistory || []).filter(
        (h) => (!leaveListLoaded && h.typeId === 'leave') || (!correctionListLoaded && h.typeId === 'time_correction')
      );
      globalState.leaveHistory = [...backendList, ...kept];
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
  const parts = String(dateStr).slice(0, 10).split('-');
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

  async addLeaveRequest(typeId, startStr, endStr, reason, attachmentUrl = null) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end - start);
    const requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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

    const policy = this.getPolicyForType(typeId);
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
        ...(attachmentUrl ? { attachmentUrl } : {}),
      }),
    });

    if (!res) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ใบลายังไม่ถูกบันทึก กรุณาลองใหม่อีกครั้ง');
    }
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success) {
      throw new Error(resData.message || 'ไม่สามารถยื่นใบลาได้');
    }

    // Refresh live balances and history from the database
    await syncWithBackend();
    return true;
  },

  async addTimeCorrectionRequest(dateStr, inTime, outTime, reason, issueId = null, rawDate = null) {
    const today = new Date();
    let isoDate = today.toISOString().split('T')[0];
    if (rawDate && typeof rawDate === 'string') {
      const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const thaiMatch = rawDate.trim().match(/^(d{1,2})s+(S+?).?s+(d{4})$/);
      if (/^d{4}-d{2}-d{2}/.test(rawDate)) {
        isoDate = rawDate.slice(0, 10);
      } else if (rawDate.includes('/') && rawDate.split('/').length === 3) {
        const parts = rawDate.split('/');
        let y = parseInt(parts[2], 10);
        if (y > 2500) y -= 543;
        isoDate = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (thaiMatch) {
        const mIdx = THAI_MONTHS.findIndex((m) => m.replace('.', '') === thaiMatch[2].replace('.', ''));
        if (mIdx >= 0) {
          let y = parseInt(thaiMatch[3], 10);
          if (y > 2500) y -= 543;
          isoDate = `${y}-${String(mIdx + 1).padStart(2, '0')}-${thaiMatch[1].padStart(2, '0')}`;
        }
      }
    }

    const formattedIn = inTime ? (inTime.includes('น.') ? inTime : `${inTime} น.`) : null;
    const formattedOut = outTime ? (outTime.includes('น.') ? outTime : `${outTime} น.`) : null;
    if (!formattedIn && !formattedOut) {
      throw new Error('กรุณาระบุเวลาเข้างานหรือเวลาออกงานอย่างน้อยหนึ่งช่อง');
    }

    // Submit to the backend FIRST; only reflect it locally when the server accepted it
    const res = await tryFetchApi('/attendance/corrections', {
      method: 'POST',
      body: JSON.stringify({
        dateIso: isoDate,
        oldCheckIn: '-',
        newCheckIn: formattedIn,
        oldCheckOut: '-',
        newCheckOut: formattedOut,
        reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
      }),
    });
    if (!res) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ คำขอยังไม่ถูกบันทึก กรุณาลองใหม่อีกครั้ง');
    }
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success) {
      throw new Error(resData.message || 'ไม่สามารถยื่นคำขอปรับปรุงเวลาได้');
    }

    const created = resData.correction || {};
    const newRequest = {
      id: created.id || 'tc_' + Date.now(),
      issueId: issueId || null,
      rawDate: rawDate || isoDate,
      typeId: 'time_correction',
      categoryKey: 'correction',
      categoryName: 'ปรับปรุงเวลา',
      type: 'ปรับปรุงเวลาเข้า-ออกงาน',
      dates: dateStr || 'วันนี้',
      inTime: formattedIn || '-',
      outTime: formattedOut || '-',
      status: created.status || 'รออนุมัติ',
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

    // Reconcile with the database (non-blocking)
    syncWithBackend();

    return newRequest;
  }
};
