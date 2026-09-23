import { tryFetchApi } from './apiClient';

const defaultHistory = [];

function calculateCorrectedDuration(inStr, outStr) {
  if (!inStr || !outStr) return '09:00:00 ชม.';
  const cleanIn = inStr.replace('น.', '').trim();
  const cleanOut = outStr.replace('น.', '').trim();

  const inParts = cleanIn.split(':');
  const outParts = cleanOut.split(':');

  let inH = parseInt(inParts[0], 10) || 8;
  let inM = parseInt(inParts[1], 10) || 0;
  let outH = parseInt(outParts[0], 10) || 17;
  let outM = parseInt(outParts[1], 10) || 0;

  // Rule: Work counting starts at 08:00 AM if checked in earlier
  if (inH < 8) {
    inH = 8;
    inM = 0;
  }

  const startSec = inH * 3600 + inM * 60;
  const endSec = outH * 3600 + outM * 60;
  const diffSec = Math.max(0, endSec - startSec);

  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} ชม.`;
}

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
  } catch (e) { }
  return 'default';
};

const getStorageKey = (prefix) => `${prefix}_${getUserId()}`;

let globalState = {
  isCheckedIn: false,
  checkInTime: null,
  checkOutTime: null,
  history: [],
  punchLogs: [],
};

const checkMidnightAutoClockOut = () => {
  const now = new Date();
  if (globalState.isCheckedIn && globalState.checkInTime) {
    const checkInDate = new Date(globalState.checkInTime);
    if (checkInDate.toDateString() !== now.toDateString() && checkInDate < now) {
      const checkInFormatted = checkInDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      const dateIsoStr = checkInDate.toISOString().split('T')[0];
      const formattedDateStr = checkInDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      const dayThaiStr = checkInDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const durationStr = calculateCorrectedDuration(checkInFormatted, '23:59 น.');

      const autoCloseRecord = {
        id: 'att_auto_' + checkInDate.getTime(),
        date: formattedDateStr,
        dateIso: dateIsoStr,
        dayThai: dayThaiStr,
        checkIn: checkInFormatted,
        checkOut: '23:59 น.',
        duration: durationStr,
        isIncomplete: true,
        isComplete: false,
        isAutoClosed: true,
        status: 'ไม่ลงเวลาออกงาน (ตัดอัตโนมัติตอนเที่ยงคืน)',
        statusColor: '#EF4444',
      };

      const currentHistory = globalState.history || [];
      const exists = currentHistory.some((h) => h.dateIso === dateIsoStr || h.id === autoCloseRecord.id);
      const newHistory = exists ? currentHistory : [autoCloseRecord, ...currentHistory];

      globalState = {
        ...globalState,
        isCheckedIn: false,
        checkInTime: null,
        checkOutTime: null,
        history: newHistory,
      };

      saveState();
      listeners.forEach((l) => l(globalState));
    }
  }
};

const loadLocalState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(getStorageKey('attendance_state'));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.checkInTime) parsed.checkInTime = new Date(parsed.checkInTime);
        if (parsed.checkOutTime) parsed.checkOutTime = new Date(parsed.checkOutTime);
        globalState = {
          isCheckedIn: !!parsed.isCheckedIn,
          checkInTime: parsed.checkInTime || null,
          checkOutTime: parsed.checkOutTime || null,
          history: Array.isArray(parsed.history) ? parsed.history : [],
          punchLogs: Array.isArray(parsed.punchLogs) ? parsed.punchLogs : [],
        };
        checkMidnightAutoClockOut();
        return;
      }
    }
  } catch (e) { }
  globalState = {
    isCheckedIn: false,
    checkInTime: null,
    checkOutTime: null,
    history: [],
    punchLogs: [],
  };
};
loadLocalState();

// Async sync with backend API database
const syncWithBackend = async () => {
  try {
    const res = await tryFetchApi('/attendance/history');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.history)) {
        const mergedHistory = [...data.history];
        (globalState.history || []).forEach((localItem) => {
          if (localItem && !mergedHistory.some((b) => b.id === localItem.id || b.dateIso === localItem.dateIso)) {
            mergedHistory.push(localItem);
          }
        });
        globalState.history = mergedHistory;
        checkMidnightAutoClockOut();
        saveState();
        listeners.forEach((l) => l(globalState));
      }
    }
  } catch (e) {
    console.log('Failed to sync attendance history from API', e);
  }
};
syncWithBackend();

// Check for midnight auto-cutoff every 15 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    checkMidnightAutoClockOut();
  }, 15000);
}

const listeners = new Set();

const saveState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getStorageKey('attendance_state'), JSON.stringify(globalState));
    }
  } catch (e) {
    console.log('Error saving attendanceState to localStorage', e);
  }
};

export const attendanceStorage = {
  getState() {
    checkMidnightAutoClockOut();
    return { ...globalState };
  },
  setState(newState) {
    globalState = { ...globalState, ...newState };
    saveState();
    listeners.forEach((l) => l(globalState));
  },
  async clearAndSync() {
    loadLocalState();
    saveState();
    listeners.forEach((l) => l(globalState));
    await syncWithBackend();
  },
  async clockIn(latitude, longitude, locationName) {
    const nowObj = new Date();
    const nowTime = nowObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    const dateIsoStr = nowObj.toISOString().split('T')[0];
    const formattedDateStr = nowObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayThaiStr = nowObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Work schedule: 08:00 - 17:00. Must check in before 09:00 AM.
    // If checking in after 09:00:00 (h > 9 || (h === 9 && m > 0)), status is 'สาย'
    const h = nowObj.getHours();
    const m = nowObj.getMinutes();
    const isLate = h > 9 || (h === 9 && m > 0);

    const todayRecord = {
      id: 'att_' + nowObj.getTime(),
      date: formattedDateStr,
      dateIso: dateIsoStr,
      dayThai: dayThaiStr,
      checkIn: nowTime,
      checkOut: null,
      duration: '00:00:00 ชม.',
      isLate: isLate,
      status: isLate ? 'สาย' : 'ปกติ',
      statusColor: isLate ? '#EF4444' : '#10B981',
      latitude: latitude || 13.7563,
      longitude: longitude || 100.5018,
      locationName: locationName || 'อาคารสำนักงานใหญ่ (HQ)',
    };

    try {
      await tryFetchApi('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, locationName }),
      });
    } catch (e) { }

    this.addPunchLog('check_in', nowTime, formattedDateStr, locationName);

    const currentHistory = globalState.history || [];
    const updatedHistory = [todayRecord, ...currentHistory.filter(item => item.dateIso !== dateIsoStr)];

    this.setState({
      isCheckedIn: true,
      checkInTime: nowObj,
      history: updatedHistory,
    });
  },
  async clockOut(latitude, longitude, locationName) {
    const nowObj = new Date();
    const nowTime = nowObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    const dateIsoStr = nowObj.toISOString().split('T')[0];

    try {
      await tryFetchApi('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, locationName }),
      });
    } catch (e) { }

    this.addPunchLog('check_out', nowTime, nowObj.toLocaleDateString('th-TH'), locationName);

    const history = globalState.history || [];
    const index = history.findIndex((h) => h.dateIso === dateIsoStr || (h.checkIn && !h.checkOut));

    let updatedHistory = [...history];
    if (index !== -1) {
      const rec = updatedHistory[index];
      const dur = calculateCorrectedDuration(rec.checkIn, nowTime);
      updatedHistory[index] = {
        ...rec,
        checkOut: nowTime,
        duration: dur,
        isComplete: true,
      };
    }

    this.setState({
      isCheckedIn: false,
      checkOutTime: nowObj,
      history: updatedHistory,
    });
  },
  updateCorrection(dateMatchStr, newCheckIn, newCheckOut, reason) {
    const history = globalState.history || [];
    const calculatedDur = calculateCorrectedDuration(newCheckIn, newCheckOut);
    const formattedIn = newCheckIn.includes('น.') ? newCheckIn : `${newCheckIn} น.`;
    const formattedOut = newCheckOut.includes('น.') ? newCheckOut : `${newCheckOut} น.`;

    let matchedAny = false;
    const updatedHistory = history.map((item) => {
      if (!item) return item;
      const isMatch = (
        item.date === dateMatchStr ||
        item.dateIso === dateMatchStr ||
        (item.dayThai && item.dayThai.includes(dateMatchStr)) ||
        (dateMatchStr && dateMatchStr.includes(item.date)) ||
        (dateMatchStr && item.dayThai && dateMatchStr.includes(item.dayThai))
      );
      if (isMatch) {
        matchedAny = true;
        return {
          ...item,
          checkIn: formattedIn,
          checkOut: formattedOut,
          duration: calculatedDur,
          isIncomplete: false,
          isCorrected: true,
          approvalStatus: 'รออนุมัติ',
          status: 'ปรับปรุงเวลา (รออนุมัติ)',
          statusColor: '#F5A623',
          reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
        };
      }
      return item;
    });

    if (!matchedAny) {
      const newRec = {
        id: 'att_corr_' + Date.now(),
        date: dateMatchStr,
        checkIn: formattedIn,
        checkOut: formattedOut,
        duration: calculatedDur,
        isIncomplete: false,
        isCorrected: true,
        approvalStatus: 'รออนุมัติ',
        status: 'ปรับปรุงเวลา (รออนุมัติ)',
        statusColor: '#F5A623',
        reason: reason || 'ขอปรับปรุงเวลาเข้า-ออกงาน',
      };
      updatedHistory.unshift(newRec);
    }

    globalState = {
      ...globalState,
      history: updatedHistory,
    };
    saveState();
    listeners.forEach((l) => l(globalState));
  },

  approveCorrection(dateMatchStr, newCheckIn = '08:00 น.', newCheckOut = '17:00 น.') {
    const history = globalState.history || [];
    const calculatedDur = calculateCorrectedDuration(newCheckIn, newCheckOut);
    const formattedIn = newCheckIn.includes('น.') ? newCheckIn : `${newCheckIn} น.`;
    const formattedOut = newCheckOut.includes('น.') ? newCheckOut : `${newCheckOut} น.`;

    const updatedHistory = history.map((item) => {
      if (!item) return item;
      const isMatch = (
        item.date === dateMatchStr ||
        item.dateIso === dateMatchStr ||
        (item.dayThai && item.dayThai.includes(dateMatchStr)) ||
        (dateMatchStr && dateMatchStr.includes(item.date))
      );
      if (isMatch) {
        return {
          ...item,
          checkIn: formattedIn,
          checkOut: formattedOut,
          duration: calculatedDur,
          isIncomplete: false,
          isComplete: true,
          isCorrected: false,
          isApproved: true,
          approvalStatus: 'อนุมัติแล้ว',
          status: 'ลงเวลาเข้า-ออกครบถ้วน',
          statusColor: '#27AE60',
        };
      }
      return item;
    });

    globalState = {
      ...globalState,
      history: updatedHistory,
    };
    saveState();
    listeners.forEach((l) => l(globalState));
  },
  addPunchLog(type, timeStr, dateStr, location = 'อาคารสำนักงานใหญ่ (HQ)') {
    const newPunch = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      label: type === 'check_in' ? 'เข้างาน' : 'ออกงาน',
      time: timeStr,
      date: dateStr,
      timestamp: Date.now(),
      location: location,
    };
    const updatedPunchLogs = [newPunch, ...(globalState.punchLogs || [])];
    globalState = {
      ...globalState,
      punchLogs: updatedPunchLogs,
    };
    saveState();
    listeners.forEach((l) => l(globalState));
    return updatedPunchLogs;
  },
  getPunchLogsForDate(date) {
    if (!date) return [];
    const punchList = globalState.punchLogs || [];
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();

    return punchList.filter((log) => {
      if (!log) return false;
      if (log.timestamp) {
        const logDate = new Date(log.timestamp);
        return (
          logDate.getDate() === d &&
          logDate.getMonth() === m &&
          logDate.getFullYear() === y
        );
      }
      const thaiStr = date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return log.date === thaiStr;
    });
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(globalState);
    return () => listeners.delete(listener);
  },
};
