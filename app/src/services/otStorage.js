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

const getStorageKey = (prefix) => `${prefix}_${getUserId()}`;

const initialOtState = {
  otBalances: [
    { id: 'ot_normal', label: 'OT วันทำงานปกติ (1.5 เท่า)', remaining: 28, total: 40, color: '#27AE60', icon: 'time-outline' },
    { id: 'ot_holiday', label: 'OT วันหยุด (2.0 เท่า)', remaining: 22, total: 30, color: '#F5A623', icon: 'calendar-outline' },
    { id: 'ot_special', label: 'OT ล่วงเวลาวันหยุด (3.0 เท่า)', remaining: 20, total: 20, color: '#E24C4B', icon: 'flash-outline' },
    { id: 'ot_emergency', label: 'OT งานฉุกเฉิน / พิเศษ', remaining: 12, total: 15, color: '#9B59B6', icon: 'alert-circle-outline' },
  ],
  otHistory: [],
};

let globalState = { ...initialOtState };

const loadLocalState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(getStorageKey('ot_state_v1'));
      if (saved) {
        globalState = JSON.parse(saved);
        return;
      }
    }
  } catch (e) {
    console.log('Error loading OT state from localStorage', e);
  }
  globalState = { ...initialOtState };
};
loadLocalState();

const listeners = new Set();

const syncWithBackend = async () => {
  try {
    const res = await tryFetchApi('/overtime/my-requests');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.requests)) {
        globalState.otHistory = data.requests.map((r) => ({
          id: r.id,
          typeId: 'ot',
          type: `ขอ OT (${r.hours || 1} ชม.)`,
          dates: r.dateIso ? formatThaiDate(r.dateIso) : 'วันนี้',
          hours: r.hours || 1,
          status: r.status || 'รออนุมัติ',
          statusColor: r.status === 'อนุมัติแล้ว' || r.status === 'อนุมัติ' ? '#10B981' : r.status === 'ไม่อนุมัติ' ? '#EF4444' : '#F5A623',
          start: r.dateIso,
          end: r.dateIso,
          reason: r.taskDescription || r.reason || 'ขอทำ OT',
          approver: r.approver,
          remark: r.remark,
          createdAt: r.createdAt,
        }));
        saveState();
        listeners.forEach((l) => l(globalState));
      }
    }
  } catch (e) {
    console.log('Failed to sync OT state from API', e);
  }
};
syncWithBackend();

const saveState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getStorageKey('ot_state_v1'), JSON.stringify(globalState));
    }
  } catch (e) {
    console.log('Error saving OT state to localStorage', e);
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

export const otStorage = {
  getState() {
    return { ...globalState };
  },

  setState(newState) {
    globalState = { ...globalState, ...newState };
    saveState();
    listeners.forEach((listener) => listener(globalState));
  },

  async clearAndSync() {
    loadLocalState();
    saveState();
    listeners.forEach((listener) => listener(globalState));
    await syncWithBackend();
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async addOtRequest(typeId, dateStr, hours, reason) {
    const otType = globalState.otBalances.find((b) => b.id === typeId);
    if (!otType) throw new Error('ไม่พบประเภท OT ที่ระบุ');

    if (otType.remaining < hours) {
      throw new Error(`จำนวนชั่วโมง OT (${hours} ชม.) เกินสิทธิ์คงเหลือ (${otType.remaining} ชม.)`);
    }

    // Deduct remaining hours
    const updatedBalances = globalState.otBalances.map((b) => {
      if (b.id === typeId) {
        return { ...b, remaining: b.remaining - hours };
      }
      return b;
    });

    const newRequest = {
      id: Date.now().toString(),
      typeId,
      type: otType.label,
      dates: formatThaiDate(dateStr),
      hours: Number(hours),
      status: 'รออนุมัติ',
      statusColor: '#F5A623',
      start: dateStr,
      reason: reason || 'ขออนุมัติทำงานล่วงเวลา (OT)',
    };

    globalState = {
      ...globalState,
      otBalances: updatedBalances,
      otHistory: [newRequest, ...globalState.otHistory],
    };

    saveState();
    listeners.forEach((listener) => listener(globalState));

    // Trigger Notification
    notificationStorage.addNotification({
      id: 'notif_ot_' + Date.now(),
      type: 'warning',
      icon: 'time-outline',
      iconColor: '#E24C4B',
      title: `⏱️ ยื่นคำขอทำงานล่วงเวลา (OT)`,
      message: `ยื่นคำขอ ${otType.label} วันที่ ${newRequest.dates} (${hours} ชม.) เรียบร้อยแล้ว`,
      time: 'เมื่อครู่นี้',
      unread: true,
      screen: 'RequestStatus',
    });

    try {
      await tryFetchApi('/overtime', {
        method: 'POST',
        body: JSON.stringify({
          dateIso: dateStr,
          startTime: '18:00',
          endTime: '20:00',
          hours: Number(hours),
          taskDescription: reason || 'ขออนุมัติ OT',
        }),
      });
    } catch (e) {}

    return newRequest;
  },
};
