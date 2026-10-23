import { Platform } from 'react-native';
import * as Location from 'expo-location';
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

const syncPreviousDayState = () => {
  const now = new Date();
  if (globalState.isCheckedIn && globalState.checkInTime) {
    const checkInDate = new Date(globalState.checkInTime);
    if (checkInDate.toDateString() !== now.toDateString() && checkInDate < now) {
      // Previous day check-in was auto-closed on backend database
      globalState = {
        ...globalState,
        isCheckedIn: false,
        checkInTime: null,
        checkOutTime: null,
      };
      saveState();
      listeners.forEach((l) => l(globalState));
      syncWithBackend();
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
        syncPreviousDayState();
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

// Parse "HH:mm น." (as written by the backend) into a Date on the given ISO day
const parseTimeOnDate = (timeStr, dateIso) => {
  if (!timeStr || !dateIso) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = String(dateIso).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

// Map a backend attendance row { id, dateIso, checkIn, checkOut, duration, status, statusColor, ... }
// to the display shape the screens expect (date / dayThai / isComplete / isLate ...)
const normalizeServerAttendance = (r) => {
  const dateIso = r.dateIso ? String(r.dateIso).slice(0, 10) : null;
  let dateObj = null;
  if (dateIso) {
    const [y, mo, d] = dateIso.split('-').map(Number);
    dateObj = new Date(y, (mo || 1) - 1, d || 1);
  }
  const checkOut = r.checkOut && r.checkOut !== 'กำลังทำงาน...' ? r.checkOut : null;
  const rawStatus = r.status || '';
  const isLate = rawStatus === 'สาย' || rawStatus.includes('เข้างานสาย') || !!r.isLate;
  // A past-day record that never got a clock-out is incomplete (backend may leave it open)
  const staleOpen = !checkOut && !!dateIso && dateIso < new Date().toISOString().split('T')[0];
  const isIncomplete = !!r.isIncomplete || rawStatus.includes('ไม่ลงเวลา') || staleOpen;
  let status = staleOpen && !rawStatus.includes('ไม่ลงเวลา') ? 'ไม่ลงเวลาออกงาน' : rawStatus;
  let statusColor = staleOpen ? '#EF4444' : r.statusColor;
  if (!isIncomplete) {
    if (checkOut) {
      // late first; only an on-time record is checked for the worked hours (under 9 hours = not enough)
      const m = String(r.duration || '').match(/(\d+):(\d+)/);
      const workedSec = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
      const shortHours = workedSec !== null && workedSec > 0 && workedSec < 9 * 3600;
      status = isLate ? 'เข้างานสาย' : shortHours ? 'ทำงานไม่ครบเวลา' : 'ลงเวลาเข้า-ออกครบถ้วน';
    } else {
      status = isLate ? 'เข้างานสาย (กำลังทำงาน)' : 'เข้างานตรงเวลา (กำลังทำงาน)';
    }
    statusColor = isLate ? '#EF4444' : status === 'ทำงานไม่ครบเวลา' ? '#F5A623' : '#27AE60';
  }
  return {
    ...r,
    dateIso,
    date: dateObj ? dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : r.date,
    dayThai: dateObj ? dateObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : r.dayThai,
    checkIn: r.checkIn || '--:--',
    checkOut,
    duration: r.duration || '00:00:00 ชม.',
    status,
    statusColor,
    isLate,
    isIncomplete,
    isComplete: !!checkOut && !isIncomplete,
    isApproved: !!r.isApproved,
    isCorrected: !!r.isCorrected && !r.isApproved,
  };
};

// Async sync with backend API database (server is the source of truth for history)
const syncWithBackend = async () => {
  try {
    const res = await tryFetchApi('/attendance/history');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.history)) {
        const serverHistory = data.history.map(normalizeServerAttendance);
        globalState.history = serverHistory;

        // Restore today's clocked-in state from the server (e.g. new device / cleared storage)
        const todayIso = new Date().toISOString().split('T')[0];
        const todayRecords = serverHistory.filter((h) => h.dateIso === todayIso);
        if (todayRecords.length > 0) {
          const openRecord = todayRecords.find((h) => h.checkIn && h.checkIn !== '--:--' && !h.checkOut);
          if (openRecord) {
            const inDate = parseTimeOnDate(openRecord.checkIn, todayIso);
            if (inDate && !globalState.isCheckedIn) {
              globalState.isCheckedIn = true;
              globalState.checkInTime = inDate;
              globalState.checkOutTime = null;
            }
          } else if (globalState.isCheckedIn) {
            globalState.isCheckedIn = false;
            const outDate = parseTimeOnDate(todayRecords[0].checkOut, todayIso);
            if (outDate) globalState.checkOutTime = outDate;
          }
        } else if (globalState.isCheckedIn) {
          // Server has no record for today -> stale local "checked in" flag (previous day / other account)
          globalState.isCheckedIn = false;
          globalState.checkInTime = null;
          globalState.checkOutTime = null;
        }

        syncPreviousDayState();
        saveState();
        listeners.forEach((l) => l(globalState));
      }
    }
  } catch (e) {
    console.log('Failed to sync attendance history from API', e);
  }
};
syncWithBackend();

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

// Real device position (expo-location on native, browser geolocation on web). Resolves null when
// unavailable or denied — never fabricates coordinates, so the backend geofence check is not
// bypassed by a fake HQ position.
const getCurrentPosition = async () => {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
    return await new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      );
    });
  } catch (e) {
    return null;
  }
};

export const attendanceStorage = {
  /**
   * POST /attendance/clock-in | /attendance/clock-out. Throws if the server did not accept the punch,
   * so callers never record a punch locally that the backend does not have.
   * @param {'clock-in'|'clock-out'} kind
   * @param {{latitude?:number,longitude?:number,locationName?:string,photoUrl?:string}} [extra]
   */
  async punch(kind, extra = {}) {
    let { latitude, longitude } = extra;
    if (latitude === undefined || longitude === undefined) {
      const pos = await getCurrentPosition();
      latitude = pos ? pos.latitude : null;
      longitude = pos ? pos.longitude : null;
    }
    const payload = { latitude, longitude };
    if (extra.locationId) payload.locationId = extra.locationId;
    if (extra.locationName) payload.locationName = extra.locationName;
    if (kind === 'clock-in' && extra.photoUrl) payload.photoUrl = extra.photoUrl;

    const res = await tryFetchApi(`/attendance/${kind}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ระบบยังไม่ได้บันทึกเวลา กรุณาลองใหม่อีกครั้ง');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'ไม่สามารถบันทึกเวลาได้ กรุณาลองใหม่อีกครั้ง');
    }
    return data.attendance || null;
  },

  /** Current device position { latitude, longitude } or null (permission denied / GPS off) */
  getPosition() {
    return getCurrentPosition();
  },

  /**
   * Work locations this employee may punch at, nearest first (GET /attendance/locations).
   * `required` is false while no location has been set up, so punching stays unrestricted.
   */
  async fetchWorkLocations(position) {
    const q = position ? `?latitude=${position.latitude}&longitude=${position.longitude}` : '';
    const res = await tryFetchApi(`/attendance/locations${q}`);
    if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถโหลดสถานที่ลงเวลาได้');
    return { required: !!data.required, locations: data.locations || [] };
  },

  /** Re-fetch attendance history / today's state from the backend */
  refresh() {
    return syncWithBackend();
  },
  getState() {
    syncPreviousDayState();
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
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      locationName: locationName || 'ไม่ระบุพิกัด',
    };

    await this.punch('clock-in', { latitude, longitude, locationName });

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

    await this.punch('clock-out', { latitude, longitude, locationName });

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
