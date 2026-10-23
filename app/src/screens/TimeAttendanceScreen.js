import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Platform,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScrollToTop } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { attendanceStorage } from '../services/attendanceStorage';
import { leaveStorage } from '../services/leaveStorage';
import { notificationStorage } from '../services/notificationStorage';
import TopNavbar from '../components/TopNavbar';
import { useTheme } from '../context/ThemeContext';
import { getPublicHolidayName, fetchHolidaysFromBackend } from '../utils/thaiHolidays';

export default function TimeAttendanceScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);
  const { theme, t } = useTheme();

  const [attendance, setAttendance] = useState(attendanceStorage.getState());
  const [leaveState, setLeaveState] = useState(leaveStorage.getState());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());

  // Time Correction Modal states
  const [isCorrectionModalVisible, setIsCorrectionModalVisible] = useState(false);
  const [modalDateText, setModalDateText] = useState('');
  const [modalInTime, setModalInTime] = useState('09:00');
  const [modalOutTime, setModalOutTime] = useState('18:00');
  const [modalReason, setModalReason] = useState('');

  const getLogForDate = (date) => {
    if (!date) return null;
    const historyList = attendance.history || [];
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return historyList.find((item) => {
      if (!item) return false;
      if (item.dateIso) {
        const parts = item.dateIso.split('-');
        if (parts.length === 3) {
          if (
            parseInt(parts[2], 10) === d &&
            parseInt(parts[1], 10) - 1 === m &&
            parseInt(parts[0], 10) === y
          ) {
            return true;
          }
        }
      }
      return item.date === dateStr;
    });
  };

  const isIncompleteDate = (date) => {
    if (!date) return false;
    const allSessions = getAllWorkSessionsForDate(date);
    if (allSessions.length === 0) return false;

    // If date is pending approval or approved, do not show incomplete highlight
    const isPendingOrApproved = allSessions.some(
      (s) => s.isCorrected || s.isApproved || s.approvalStatus === 'รออนุมัติ' || s.approvalStatus === 'อนุมัติแล้ว' || s.status?.includes('รออนุมัติ')
    );
    if (isPendingOrApproved) {
      return false;
    }

    return allSessions.some((s) => s.isIncomplete && !s.isWorking && !s.isComplete);
  };

  const getIncompleteData = (date) => {
    if (!date) return null;
    const log = getLogForDate(date);
    if (log) {
      return {
        title: log.status || 'เข้างานสาย / ไม่ครบกำหนด',
        checkIn: log.checkIn || '09:00 น.',
        checkOut: log.checkOut || '18:00 น.',
        totalHours: log.duration || '08:00:00 ชม.',
        lateDuration: log.status === 'เข้างานสาย' ? 'มาสาย' : null,
        earlyOutDuration: log.status === 'ออกก่อนเวลา' ? 'ออกก่อนเวลา' : null,
        isCorrected: !!log.isCorrected,
        status: log.status,
      };
    }
    return null;
  };

  const openCorrectionModal = (date) => {
    const formattedDate = formatThaiDate(date || selectedDate);
    setModalDateText(formattedDate);
    setModalInTime('09:00');
    setModalOutTime('18:00');
    setModalReason('');
    setIsCorrectionModalVisible(true);
  };

  const handleConfirmCorrection = async () => {
    const targetDateStr = modalDateText || formatThaiDate(selectedDate);
    const inVal = modalInTime || '09:00';
    const outVal = modalOutTime || '18:00';
    const reasonVal = modalReason || 'ขอปรับปรุงเวลาเข้า-ออกงาน';

    // 1. Record into "สถานะคำขอ"
    try {
      await leaveStorage.addTimeCorrectionRequest(targetDateStr, inVal, outVal, reasonVal, null, targetDateStr);
    } catch (error) {
      Alert.alert('ส่งคำขอไม่สำเร็จ', error.message);
      return;
    }

    // 2. Update attendance log for that specific date
    attendanceStorage.updateCorrection(targetDateStr, inVal, outVal, reasonVal);

    // 3. Trigger top sliding Alert Push Banner (Auto-realtime 4.5 seconds across screens)
    notificationStorage.addNotification({
      id: 'corr_succ_' + Date.now(),
      type: 'success',
      icon: 'checkmark-circle-outline',
      iconColor: '#27AE60',
      title: '✅ ส่งคำขอปรับปรุงเวลาสำเร็จ',
      message: `คำขอปรับปรุงเวลาประจำวันที่ ${targetDateStr} ถูกส่งไปยังฝ่ายบุคคลเรียบร้อยแล้ว`,
      time: 'เมื่อครู่นี้',
      unread: true,
      screen: 'RequestStatus',
    });

    // 4. Close modal
    setIsCorrectionModalVisible(false);
  };

  useEffect(() => {
    const unsubscribeAttendance = attendanceStorage.subscribe((state) => {
      setAttendance(state);
    });

    const unsubscribeLeave = leaveStorage.subscribe((state) => {
      setLeaveState(state);
    });

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      unsubscribeAttendance();
      unsubscribeLeave();
      clearInterval(timer);
    };
  }, []);

  const { isCheckedIn, checkInTime, checkOutTime, history } = attendance;
  const { leaveHistory } = leaveState;

  const formatTime = (date) => {
    if (!date) return '--:--';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getEffectiveCheckInTime = (time) => {
    if (!time) return null;
    const effective = new Date(time);
    if (effective.getHours() < 8) {
      effective.setHours(8, 0, 0, 0);
    }
    return effective;
  };

  const getDuration = () => {
    if (!checkInTime) return '00:00:00';
    const effectiveStart = getEffectiveCheckInTime(checkInTime);
    const endTime = checkOutTime ? checkOutTime : currentTime;

    if (endTime < effectiveStart) {
      return '00:00:00';
    }

    const diff = Math.floor((endTime - effectiveStart) / 1000); // seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const getDaysInMonth = (month, year) => {
    const date = new Date(year, month, 1);
    const days = [];
    const startDay = date.getDay();

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const getHistoryForDate = (date) => {
    if (!date) return null;
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return history.find(item => item.date === dateStr);
  };

  const getHistoryListForDate = (date) => {
    if (!date) return [];
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const paddedD = String(d).padStart(2, '0');
    const isoStr = `${y}-${String(m + 1).padStart(2, '0')}-${paddedD}`;
    const dateStr = date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return history.filter(item => {
      if (!item) return false;
      if (item.dateIso === isoStr) return true;
      if (item.date === dateStr) return true;
      return false;
    });
  };

  const isCheckInLate = (checkInStr, checkInTimestamp) => {
    if (!checkInStr || checkInStr === '--:--') return false;

    if (checkInTimestamp) {
      const d = new Date(checkInTimestamp);
      if (!isNaN(d.getTime())) {
        const h = d.getHours();
        const m = d.getMinutes();
        return h > 9 || (h === 9 && m > 0);
      }
    }

    const clean = checkInStr.replace('น.', '').trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (clean.toLowerCase().includes('pm') && h < 12) h += 12;
      if (clean.toLowerCase().includes('am') && h === 12) h = 0;
      if (!isNaN(h) && !isNaN(m)) {
        return h > 9 || (h === 9 && m > 0);
      }
    }
    return false;
  };

  const getAllWorkSessionsForDate = (date) => {
    if (!date) return [];
    const historyList = getHistoryListForDate(date);
    const punchLogs = getPunchLogsForDate(date);
    const today = new Date();
    const isToday = isSameDay(date, today);

    // 🟢 1. Check if there is an approved or pending time correction request in leaveStorage or history
    const leaveState = leaveStorage.getState();
    const correctionHistoryList = (leaveState.leaveHistory || []).filter(
      h => h.typeId === 'time_correction' || h.type === 'ปรับปรุงเวลางาน' || h.categoryKey === 'correction' || h.type === 'ปรับปรุงเวลาเข้า-ออกงาน'
    );

    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const paddedD = String(d).padStart(2, '0');
    const paddedM = String(m + 1).padStart(2, '0');
    const isoStr = `${y}-${paddedM}-${paddedD}`;
    const dateFormatted = `${paddedD}/${paddedM}/${y}`;
    const selectedDateThai = formatThaiDate(date);

    const approvedRequest = correctionHistoryList.find(item => {
      const itemStat = item.status || '';
      const isAppr = itemStat === 'อนุมัติแล้ว' || itemStat === 'อนุมัติ';
      if (!isAppr) return false;
      const itemDate = item.dates || item.rawDate || item.dayThai || item.start || '';
      return itemDate.includes(dateFormatted) || itemDate.includes(selectedDateThai) || itemDate.includes(isoStr);
    });

    const approvedHistory = historyList.find(
      item => item.approvalStatus === 'อนุมัติแล้ว' || item.isApproved || (item.status === 'ลงเวลาเข้า-ออกครบถ้วน' && item.isApproved)
    );

    if (approvedRequest || approvedHistory) {
      const inTime = approvedHistory?.checkIn || approvedRequest?.inTime || '08:00 น.';
      const outTime = approvedHistory?.checkOut || approvedRequest?.outTime || '17:00 น.';
      const formattedIn = inTime.includes('น.') ? inTime : `${inTime} น.`;
      const formattedOut = outTime.includes('น.') ? outTime : `${outTime} น.`;

      return [
        {
          id: approvedHistory?.id || approvedRequest?.id || 'appr_' + date.getTime(),
          checkIn: formattedIn,
          checkOut: formattedOut,
          duration: approvedHistory?.duration || '09:00:00 ชม.',
          status: 'ลงเวลาเข้า-ออกครบถ้วน',
          statusColor: '#27AE60',
          isApproved: true,
          isComplete: true,
          isIncomplete: false,
          isCorrected: false,
        },
      ];
    }

    // Check if this date has a PENDING correction request (รออนุมัติ)
    const pendingCorrection = correctionHistoryList.find(item => {
      const itemStat = item.status || '';
      const isPending = itemStat === 'รออนุมัติ' || itemStat.includes('รออนุมัติ') || itemStat.includes('ปรับปรุงเวลา');
      if (!isPending) return false;
      const itemDate = item.dates || item.rawDate || item.dayThai || item.start || '';
      return (
        itemDate.includes(dateFormatted) ||
        itemDate.includes(selectedDateThai) ||
        itemDate.includes(isoStr) ||
        (item.rawDate && item.rawDate.includes(isoStr)) ||
        (item.start && item.start.includes(isoStr)) ||
        (item.dates && (dateFormatted.includes(item.dates) || item.dates.includes(dateFormatted)))
      );
    });

    const hasHistoryPendingCorrection = historyList.some(
      item => item.isCorrected || item.approvalStatus === 'รออนุมัติ' || item.status?.includes('รออนุมัติ') || item.status?.includes('ปรับปรุงเวลา')
    );

    const isDatePendingCorrection = !!pendingCorrection || hasHistoryPendingCorrection;

    // 🟢 2. Build paired sessions from punchLogs
    let sessions = [];

    if (punchLogs.length > 0) {
      const sortedPunches = [...punchLogs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      let currentIn = null;
      let roundCounter = 1;

      sortedPunches.forEach((punch) => {
        if (punch.type === 'check_in') {
          if (currentIn) {
            sessions.push({
              round: roundCounter++,
              inPunch: currentIn,
              outPunch: null,
            });
          }
          currentIn = punch;
        } else if (punch.type === 'check_out') {
          sessions.push({
            round: roundCounter++,
            inPunch: currentIn,
            outPunch: punch,
          });
          currentIn = null;
        }
      });

      if (currentIn) {
        sessions.push({
          round: roundCounter++,
          inPunch: currentIn,
          outPunch: null,
        });
      }
    } else if (historyList.length > 0) {
      return historyList.map((hist, idx) => {
        const isCorr = isDatePendingCorrection || hist.isCorrected || hist.approvalStatus === 'รออนุมัติ';
        return {
          ...hist,
          round: hist.round || (idx + 1),
          isCorrected: isCorr,
          approvalStatus: isCorr ? 'รออนุมัติ' : hist.approvalStatus,
          status: isCorr ? 'ปรับปรุงเวลา (รออนุมัติ)' : hist.status,
          statusColor: isCorr ? '#F5A623' : hist.statusColor,
        };
      });
    }

    if (isToday && (isCheckedIn || checkInTime) && sessions.length === 0) {
      sessions.push({
        round: 1,
        inPunch: {
          id: 'active_in',
          time: formatTime(checkInTime) + ' น.',
          timestamp: checkInTime instanceof Date ? checkInTime.getTime() : Date.now(),
        },
        outPunch: checkOutTime ? {
          id: 'active_out',
          time: formatTime(checkOutTime) + ' น.',
          timestamp: checkOutTime instanceof Date ? checkOutTime.getTime() : Date.now(),
        } : null,
      });
    }

    const parseDurSec = (str) => {
      if (!str) return 0;
      const clean = str.replace('ชม.', '').trim();
      const parts = clean.split(':').map((p) => parseInt(p, 10) || 0);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
      return 0;
    };

    const resultSessions = sessions.map((sess, idx) => {
      const inPunch = sess.inPunch;
      const outPunch = sess.outPunch;

      const checkInStr = inPunch ? inPunch.time : '--:--';
      const checkOutStr = outPunch ? outPunch.time : (isToday && isCheckedIn && !outPunch ? '--:--' : (isToday && checkOutTime && idx === sessions.length - 1 ? formatTime(checkOutTime) + ' น.' : '--:--'));
      
      const isWorkingNow = isToday && !outPunch && (isCheckedIn || (!outPunch && inPunch));

      let durationStr = '00:00:00 ชม.';
      if (inPunch && outPunch && inPunch.timestamp && outPunch.timestamp) {
        const diffSec = Math.max(0, Math.floor((outPunch.timestamp - inPunch.timestamp) / 1000));
        const h = Math.floor(diffSec / 3600);
        const mi = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        durationStr = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')} ชม.`;
      } else if (isWorkingNow) {
        const checkInDateObj = inPunch?.timestamp ? new Date(inPunch.timestamp) : (checkInTime instanceof Date ? checkInTime : new Date());
        let effectiveStartTs = checkInDateObj.getTime();
        if (checkInDateObj.getHours() < 8) {
          const effectiveDate = new Date(checkInDateObj);
          effectiveDate.setHours(8, 0, 0, 0);
          effectiveStartTs = effectiveDate.getTime();
        }
        const diffSec = Math.max(0, Math.floor((currentTime.getTime() - effectiveStartTs) / 1000));
        const h = Math.floor(diffSec / 3600);
        const mi = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        durationStr = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')} ชม.`;
      }

      const lateCheck = isCheckInLate(checkInStr, inPunch?.timestamp);
      const totalDurationSec = parseDurSec(durationStr);
      const isShortShift = totalDurationSec > 0 && totalDurationSec < 32400; // < 9 hours

      let currentStatus = 'เข้างานตรงเวลา';
      let currentStatusColor = '#27AE60'; // Green

      if (isDatePendingCorrection) {
        currentStatus = 'ปรับปรุงเวลา (รออนุมัติ)';
        currentStatusColor = '#F5A623';
      } else if (isWorkingNow) {
        if (lateCheck) {
          currentStatus = 'เข้างานสาย (กำลังทำงาน)';
          currentStatusColor = '#EF4444';
        } else {
          currentStatus = 'เข้างานตรงเวลา (กำลังทำงาน)';
          currentStatusColor = '#27AE60';
        }
      } else if (checkInStr !== '--:--' && checkOutStr !== '--:--') {
        // 1) late is checked first: a late check-in stays "late" even when the hours are complete
        // 2) only when on time, check the worked hours (9 hours)
        if (lateCheck) {
          currentStatus = 'เข้างานสาย';
          currentStatusColor = '#EF4444';
        } else if (isShortShift) {
          currentStatus = 'ทำงานไม่ครบเวลา (ออกก่อนกำหนด / ไม่ถึง 9 ชม.)';
          currentStatusColor = '#F5A623';
        } else {
          currentStatus = 'ลงเวลาเข้า-ออกครบถ้วน';
          currentStatusColor = '#27AE60';
        }
      } else if (lateCheck) {
        currentStatus = 'เข้างานสาย';
        currentStatusColor = '#EF4444';
      }

      const isComplete = checkInStr !== '--:--' && checkOutStr !== '--:--' && !isWorkingNow && !isShortShift && !lateCheck;

      return {
        id: 'session_' + (inPunch ? inPunch.id : (outPunch ? outPunch.id : Date.now() + '_' + idx)),
        round: sess.round || (idx + 1),
        checkIn: checkInStr,
        checkOut: checkOutStr,
        duration: durationStr,
        status: currentStatus,
        statusColor: currentStatusColor,
        isComplete: isComplete,
        isIncomplete: isShortShift || (!isComplete && !isWorkingNow && lateCheck) || (checkInStr !== '--:--' && checkOutStr === '--:--' && !isWorkingNow),
        isWorking: isWorkingNow,
        isLate: lateCheck,
        isShortShift: isShortShift,
        isCorrected: isDatePendingCorrection,
        approvalStatus: isDatePendingCorrection ? 'รออนุมัติ' : null,
      };
    });

    return resultSessions;
  };

  const getPunchLogsForDate = (date) => {
    if (!date) return [];
    const punchList = attendance.punchLogs || [];
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
  };

  const getLeaveForDate = (date) => {
    if (!date) return null;
    return leaveHistory.find(leave => {
      if (leave.typeId === 'time_correction' || leave.categoryKey === 'correction' || leave.type?.includes('ปรับปรุง')) return false;
      if (leave.status !== 'อนุมัติ' && leave.status !== 'รออนุมัติ') return false;
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const startParts = leave.start.split('-');
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);

      const endParts = leave.end.split('-');
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

      return d >= start && d <= end;
    });
  };

  useEffect(() => {
    fetchHolidaysFromBackend();
    attendanceStorage.refresh();
  }, []);

  const formatThaiDate = (date) => {
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    attendanceStorage.refresh();
    leaveStorage.clearAndSync();
    setAttendance(attendanceStorage.getState());
    setLeaveState(leaveStorage.getState());
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  return (
    <SafeAreaView testID="screen-time-attendance" className="flex-1" style={[styles.safeArea, { backgroundColor: theme.card }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBg} />

      {/* Header */}
      <TopNavbar navigation={navigation} title={t('calendar', 'ปฏิทิน')} />

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Month/Year selector */}
        <View testID="time-attendance-month-selector" style={styles.calendarMonthSelector} className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
          <TouchableOpacity
            testID="time-attendance-prev-month-btn"
            onPress={() => {
              if (activeMonth === 0) {
                setActiveMonth(11);
                setActiveYear(prev => prev - 1);
              } else {
                setActiveMonth(prev => prev - 1);
              }
            }}
            style={styles.monthArrow}
            className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={20} color={colors.title} />
          </TouchableOpacity>

          <Text style={styles.calendarMonthText} className="text-base font-bold text-slate-900">
            {thaiMonths[activeMonth]} {activeYear + 543}
          </Text>

          <TouchableOpacity
            testID="time-attendance-next-month-btn"
            onPress={() => {
              if (activeMonth === 11) {
                setActiveMonth(0);
                setActiveYear(prev => prev + 1);
              } else {
                setActiveMonth(prev => prev + 1);
              }
            }}
            style={styles.monthArrow}
            className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.title} />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View testID="time-attendance-calendar-grid" style={styles.calendarGrid} className="p-4 bg-white border-b border-slate-100">
          {/* Week headers */}
          <View style={styles.weekHeaderRow} className="flex-row justify-around mb-2">
            <View style={styles.weekHeaderCell}><Text style={[styles.weekHeaderText, { color: colors.error }]} className="text-xs font-bold text-center">อา</Text></View>
            <View style={styles.weekHeaderCell}><Text style={styles.weekHeaderText} className="text-xs font-bold text-slate-700 text-center">จ</Text></View>
            <View style={styles.weekHeaderCell}><Text style={styles.weekHeaderText} className="text-xs font-bold text-slate-700 text-center">อ</Text></View>
            <View style={styles.weekHeaderCell}><Text style={styles.weekHeaderText} className="text-xs font-bold text-slate-700 text-center">พ</Text></View>
            <View style={styles.weekHeaderCell}><Text style={styles.weekHeaderText} className="text-xs font-bold text-slate-700 text-center">พฤ</Text></View>
            <View style={styles.weekHeaderCell}><Text style={styles.weekHeaderText} className="text-xs font-bold text-slate-700 text-center">ศ</Text></View>
            <View style={styles.weekHeaderCell}><Text style={[styles.weekHeaderText, { color: colors.warning }]} className="text-xs font-bold text-center">ส</Text></View>
          </View>

          {/* Day cells */}
          <View style={styles.daysGridContainer} className="flex-row flex-wrap">
            {getDaysInMonth(activeMonth, activeYear).map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.dayCellEmpty} className="w-[14.28%] h-12" />;
              }

              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const logsForDayCell = getHistoryListForDate(day);
              const punchesForDayCell = getPunchLogsForDate(day);
              const hasLog = logsForDayCell.length > 0 || punchesForDayCell.length > 0 || (isSameDay(day, new Date()) && checkInTime);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isHoliday = getPublicHolidayName(day) !== null;
              const isIncomplete = isIncompleteDate(day);
              const leaveItem = getLeaveForDate(day);

              return (
                <View key={day.toISOString()} style={styles.dayCellWrapper} className="w-[14.28%] h-12 p-0.5">
                  <TouchableOpacity
                    testID={`time-attendance-day-cell-${day.getDate()}`}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      !isSelected && isIncomplete && styles.dayCellIncomplete,
                      !isSelected && !isIncomplete && leaveItem && styles.dayCellLeave,
                      !isSelected && !isIncomplete && !leaveItem && isHoliday && styles.dayCellHoliday,
                      !isSelected && !isIncomplete && !leaveItem && !isHoliday && isWeekend && styles.dayCellWeekend,
                    ]}
                    onPress={() => setSelectedDate(day)}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        isSelected && styles.dayCellTextSelected,
                        !isSelected && isIncomplete && styles.dayCellTextIncomplete,
                        !isSelected && !isIncomplete && leaveItem && styles.dayCellTextLeave,
                        !isSelected && !isIncomplete && !leaveItem && isHoliday && styles.dayCellTextHoliday,
                        !isSelected && !isIncomplete && !leaveItem && !isHoliday && isToday && styles.dayCellTextToday,
                        !isSelected && !isIncomplete && !leaveItem && !isHoliday && !isToday && isWeekend && styles.dayCellTextWeekend,
                      ]}
                    >
                      {day.getDate()}
                    </Text>

                    {/* Today underline indicator */}
                    {isToday && (
                      <View
                        style={[
                          styles.todayUnderline,
                          isSelected && { backgroundColor: '#FFFFFF' },
                          !isSelected && (leaveItem || isHoliday) && { backgroundColor: '#FFFFFF' }
                        ]}
                      />
                    )}

                    {/* Attendance active dot */}
                    {hasLog && !isSelected && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isCheckedIn && isToday ? '#27AE60' : '#1F4C9C', marginTop: 1, alignSelf: 'center' }} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Selected Day Details */}
        <View style={styles.detailContainer}>
          <Text style={styles.detailDateTitle}>{formatThaiDate(selectedDate)}</Text>
          {(() => {
            const leaveItem = getLeaveForDate(selectedDate);
            const today = new Date();
            const isActiveToday = isSameDay(selectedDate, today) && checkInTime;

            // Combine saved logs with the active session if active today
            const allSessions = getAllWorkSessionsForDate(selectedDate);
            const combinedLogs = [...allSessions];
            if (isActiveToday && combinedLogs.length === 0) {
              const lateCheck = isCheckInLate(
                formatTime(checkInTime) + ' น.',
                checkInTime instanceof Date ? checkInTime.getTime() : null
              );
              combinedLogs.push({
                id: 'active_session',
                checkIn: formatTime(checkInTime) + ' น.',
                checkOut: checkOutTime ? formatTime(checkOutTime) + ' น.' : '--:--',
                duration: getDuration(),
                isVirtual: true,
                round: 1,
                status: lateCheck
                  ? 'เข้างานสาย (กำลังทำงาน)'
                  : checkOutTime
                  ? 'ลงเวลาเข้า-ออกครบถ้วน'
                  : 'เข้างานตรงเวลา (กำลังทำงาน)',
                statusColor: lateCheck ? '#EF4444' : '#27AE60',
                isWorking: isCheckedIn || !checkOutTime,
                isLate: lateCheck,
                isComplete: !!checkOutTime,
                isIncomplete: false,
              });
            }

            const hasAnyData = leaveItem || combinedLogs.length > 0;

            const leaveState = leaveStorage.getState();
            const correctionHistoryList = (leaveState.leaveHistory || []).filter(
              h => h.typeId === 'time_correction' || h.type === 'ปรับปรุงเวลางาน' || h.categoryKey === 'correction' || h.type === 'ปรับปรุงเวลาเข้า-ออกงาน'
            );
            const hasAnyCorrectionOnDate = combinedLogs.some(l => l.isCorrected || l.approvalStatus === 'รออนุมัติ' || l.status?.includes('รออนุมัติ') || l.status?.includes('ปรับปรุงเวลา')) || correctionHistoryList.some(item => {
              const selectedDateThai = formatThaiDate(selectedDate);
              const dd = String(selectedDate.getDate()).padStart(2, '0');
              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const yyyy = selectedDate.getFullYear();
              const dateFormatted = `${dd}/${mm}/${yyyy}`;
              const isoStr = `${yyyy}-${mm}-${dd}`;
              const itemDate = item.dates || item.rawDate || item.dayThai || item.start || '';
              return (
                itemDate.includes(dateFormatted) ||
                itemDate.includes(selectedDateThai) ||
                itemDate.includes(isoStr) ||
                (item.rawDate && item.rawDate.includes(isoStr)) ||
                (item.start && item.start.includes(isoStr))
              );
            });

            if (hasAnyData) {
              return (
                <View>
                  {leaveItem && (
                    <View style={[styles.calendarDetailCard, styles.leaveDetailCard, { marginBottom: 12 }]}>
                      <View style={styles.detailRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.detailIconBg, { backgroundColor: '#FFF3E0' }]}>
                            <Ionicons name="calendar" size={16} color="#F5A623" />
                          </View>
                          <Text style={[styles.detailLabel, { color: '#F5A623', fontWeight: '700' }]}>{leaveItem.type}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: leaveItem.statusColor + '15' }]}>
                          <Text style={[styles.statusText, { color: leaveItem.statusColor }]}>{leaveItem.status}</Text>
                        </View>
                      </View>

                      <View style={styles.detailDivider} />

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>ช่วงวันที่ลา</Text>
                        <Text style={styles.detailValue}>{leaveItem.dates}</Text>
                      </View>

                      <View style={styles.detailDivider} />

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>จำนวนวันลา</Text>
                        <Text style={styles.detailValue}>{leaveItem.days} วัน</Text>
                      </View>

                      {leaveItem.reason ? (
                        <>
                          <View style={styles.detailDivider} />
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>เหตุผลการลา</Text>
                            <Text style={[styles.detailValue, { fontStyle: 'italic', fontWeight: 'normal' }]}>{leaveItem.reason}</Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}

                  {combinedLogs.map((log, idx) => {
                    const isCorrected = log.isCorrected || hasAnyCorrectionOnDate;
                    const isWorking = log.isWorking || (isSameDay(selectedDate, new Date()) && isCheckedIn);
                    const hasBothPunches = log.checkIn && log.checkIn !== '--:--' && log.checkOut && log.checkOut !== '--:--' && log.checkOut !== 'กำลังทำงาน...';

                    // Parse duration seconds
                    const parseSec = (str) => {
                      if (!str) return 0;
                      const clean = str.replace('ชม.', '').trim();
                      const parts = clean.split(':').map((p) => parseInt(p, 10) || 0);
                      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                      if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
                      return 0;
                    };
                    const durSec = parseSec(log.duration);
                    const isShortShift = hasBothPunches && durSec > 0 && durSec < 32400; // < 9 hours

                    const isLate = typeof log.isLate === 'boolean' ? log.isLate : (log.status?.includes('เข้างานสาย') || false);
                    const isCompleted = (log.status === 'ลงเวลาเข้า-ออกครบถ้วน' || log.isComplete) && !isShortShift && !isLate;

                    let cardBorderColor = '#E2E8F0';
                    let statusColor = '#27AE60';
                    let statusTitle = 'เข้างานตรงเวลา';

                    if (isCorrected) {
                      cardBorderColor = '#F5A623';
                      statusColor = '#F5A623';
                      statusTitle = 'ปรับปรุงเวลา (รออนุมัติ)';
                    } else if (isWorking) {
                      cardBorderColor = '#27AE60';
                      statusColor = isLate ? '#EF4444' : '#27AE60';
                      statusTitle = isLate ? 'เข้างานสาย (กำลังทำงาน)' : 'เข้างานตรงเวลา (กำลังทำงาน)';
                    } else if (isLate) {
                      // late is checked first, whatever the worked hours are
                      cardBorderColor = '#EF4444';
                      statusColor = '#EF4444';
                      statusTitle = 'เข้างานสาย';
                    } else if (isShortShift) {
                      cardBorderColor = '#F5A623';
                      statusColor = '#F5A623';
                      statusTitle = 'ทำงานไม่ครบเวลา (ออกก่อนกำหนด / ไม่ถึง 9 ชม.)';
                    } else if (isCompleted) {
                      cardBorderColor = '#27AE60';
                      statusColor = '#27AE60';
                      statusTitle = 'ลงเวลาเข้า-ออกครบถ้วน';
                    }

                    // 🟢 CHECK-OUT TIME: DO NOT WRITE "กำลังทำงาน..."! Just show '--:--'
                    const displayCheckOut = (log.checkOut && log.checkOut !== 'กำลังทำงาน...') ? log.checkOut : '--:--';

                    // 🟢 TIME CORRECTION BUTTON: SHOW ONLY IF LATE OR INCOMPLETE AND NOT CURRENTLY WORKING & NOT ON-TIME & NOT ALREADY SUBMITTED!
                    const shouldShowCorrectionBtn = (isLate || isShortShift || log.isIncomplete) && !isWorking && !isCorrected && !hasAnyCorrectionOnDate && !isCompleted;

                    return (
                      <View
                        key={log.id || idx}
                        style={[
                          styles.calendarDetailCard,
                          {
                            marginBottom: 16,
                            borderColor: cardBorderColor,
                            borderWidth: 1.5,
                            borderRadius: 24,
                            padding: 20,
                            backgroundColor: '#FFFFFF',
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.04,
                            shadowRadius: 10,
                            elevation: 2,
                          },
                        ]}
                      >
                        {/* Header Status Row with Round Badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: isCorrected ? '#FFF3E0' : (isLate || isShortShift ? '#FEE2E2' : '#DCFCE7'),
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                              }}
                            >
                              <Ionicons
                                name={isCorrected ? "time" : (isLate || isShortShift ? "alert-circle" : "checkmark-circle")}
                                size={20}
                                color={isCorrected ? '#F5A623' : statusColor}
                              />
                            </View>

                            <Text style={{ color: isCorrected ? '#F5A623' : statusColor, fontWeight: '800', fontSize: 15, flexShrink: 1 }}>
                              {isCorrected ? 'ปรับปรุงเวลา (รออนุมัติ)' : statusTitle}
                            </Text>
                          </View>

                          {combinedLogs.length > 1 && (
                            <View style={{ backgroundColor: isCorrected ? '#FFF3E0' : '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: isCorrected ? '#FFE0B2' : '#E2E8F0' }}>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: isCorrected ? '#F5A623' : '#475569' }}>
                                รอบที่ {log.round || (idx + 1)}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.detailDivider} />

                        {/* Row 1: Check In */}
                        <View style={styles.detailRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.detailIconBg, { backgroundColor: colors.successLight }]}>
                              <Ionicons name="log-in" size={16} color={colors.success} />
                            </View>
                            <Text style={styles.detailLabel}>เวลาเข้างาน</Text>
                          </View>
                          <Text style={[styles.detailValue, { fontWeight: '700', color: '#0F172A' }]}>{log.checkIn}</Text>
                        </View>

                        <View style={styles.detailDivider} />

                        {/* Row 2: Check Out */}
                        <View style={styles.detailRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.detailIconBg, { backgroundColor: colors.errorLight }]}>
                              <Ionicons name="log-out" size={16} color={colors.error} />
                            </View>
                            <Text style={styles.detailLabel}>เวลาออกงาน</Text>
                          </View>
                          <Text style={[styles.detailValue, { fontWeight: '700', color: '#0F172A' }]}>{displayCheckOut}</Text>
                        </View>

                        <View style={styles.detailDivider} />

                        {/* Row 3: Total Hours */}
                        <View style={styles.detailRow}>
                          <Text style={styles.detailTotalHoursLabel}>รวมเวลาทำงาน</Text>
                          <Text style={[styles.detailTotalHoursValue, { color: isLate ? '#EF4444' : (isCorrected ? '#F5A623' : '#1F4C9C'), fontWeight: '800', fontSize: 15 }]}>
                            {log.duration ? log.duration.substring(0, 8) : '00:00:00'} ชม.
                          </Text>
                        </View>

                        {/* Row 4: Correction Action Button */}
                        {isCorrected || hasAnyCorrectionOnDate ? (
                          <View
                            style={{
                              marginTop: 14,
                              backgroundColor: '#FFF3E0',
                              borderRadius: 14,
                              paddingVertical: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              borderWidth: 1,
                              borderColor: '#FFE0B2',
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={18} color="#F5A623" style={{ marginRight: 6 }} />
                            <Text style={{ color: '#F5A623', fontWeight: '700', fontSize: 14 }}>
                              ยื่นขอปรับปรุงเวลางานแล้ว (รออนุมัติ)
                            </Text>
                          </View>
                        ) : shouldShowCorrectionBtn && navigation ? (
                          <TouchableOpacity
                            style={{
                              marginTop: 14,
                              backgroundColor: '#1F4C9C',
                              borderRadius: 14,
                              paddingVertical: 13,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              shadowColor: '#1F4C9C',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 8,
                              elevation: 3,
                            }}
                            onPress={() => {
                              const dayThai = formatThaiDate(selectedDate);
                              const dd = String(selectedDate.getDate()).padStart(2, '0');
                              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                              const yyyy = selectedDate.getFullYear();
                              const issueObj = {
                                id: log.id || 'issue_' + selectedDate.getTime() + '_' + idx,
                                date: `${dd}/${mm}/${yyyy}`,
                                dayThai: dayThai,
                                type: statusTitle,
                                typeColor: statusColor,
                                inTime: log.checkIn ? log.checkIn.split(' ')[0] : '09:45',
                                outTime: log.checkOut ? log.checkOut.split(' ')[0] : '17:00',
                                month: selectedDate.getMonth(),
                                year: selectedDate.getFullYear(),
                              };
                              navigation.navigate('TimeCorrection', { issueData: issueObj });
                            }}
                          >
                            <Ionicons name="sync-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>ขอปรับปรุงเวลาเข้างาน</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            } else if (getPublicHolidayName(selectedDate)) {
              // Public Holiday
              return (
                <View style={[styles.calendarDetailCard, styles.holidayCard]}>
                  <Ionicons name="calendar" size={40} color={colors.error} style={{ marginBottom: 8 }} />
                  <Text style={styles.holidayTitle}>วันหยุด</Text>
                  <Text style={styles.holidaySubtitle}>{getPublicHolidayName(selectedDate)}</Text>
                </View>
              );
            } else if (selectedDate.getDay() === 0 || selectedDate.getDay() === 6) {
              // Saturday or Sunday
              return (
                <View style={[styles.calendarDetailCard, styles.holidayCard]}>
                  <Ionicons name="calendar" size={40} color={colors.error} style={{ marginBottom: 8 }} />
                  <Text style={styles.holidayTitle}>วันหยุด</Text>
                  <Text style={styles.holidaySubtitle}>วันหยุดประจำสัปดาห์</Text>
                </View>
              );
            } else {
              // Regular weekday with no log
              return (
                <View style={[styles.calendarDetailCard, styles.noDataCard]}>
                  <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={styles.noDataTitle}>ไม่มีข้อมูลการลงเวลา</Text>
                  <Text style={styles.noDataSubtitle}>ไม่ได้เช็คอินเข้างานในวันนี้</Text>
                </View>
              );
            }
          })()}
        </View>
      </ScrollView>

      {/* History Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isHistoryModalVisible}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsHistoryModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIndicator} />
              <View style={styles.modalHeaderTitleRow}>
                <Text style={styles.modalTitle}>ประวัติการลงเวลา</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsHistoryModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={colors.title} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.historyList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="time-outline" size={60} color="#DDD" />
                  <Text style={styles.emptyText}>ไม่มีข้อมูลประวัติการลงเวลา</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyDateContainer}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primaryMid} />
                      <Text style={styles.historyDateText}>{item.date}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: item.isComplete ? colors.successLight : colors.errorLight }
                      ]}>
                        <Text style={[
                          styles.statusBadgeText,
                          { color: item.isComplete ? colors.success : colors.error }
                        ]}>
                          {item.isComplete ? 'เข้างานครบกำหนด' : 'เข้างานไม่ครบกำหนด'}
                        </Text>
                      </View>
                      <View style={[styles.historyDurationBadge, { marginLeft: 6 }]}>
                        <Ionicons name="timer-outline" size={14} color={colors.warning} />
                        <Text style={styles.historyDurationText}>{item.duration}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.historyCardDetails}>
                    <View style={styles.historyDetailCol}>
                      <View style={[styles.historyIconBg, { backgroundColor: colors.successLight }]}>
                        <Ionicons name="log-in" size={14} color={colors.success} />
                      </View>
                      <View>
                        <Text style={styles.historyDetailLabel}>เข้างาน</Text>
                        <Text style={styles.historyDetailValue}>{(item.checkIn || '--:--').split(' ')[0]}</Text>
                      </View>
                    </View>

                    <View style={styles.historyDetailSep} />

                    <View style={styles.historyDetailCol}>
                      <View style={[styles.historyIconBg, { backgroundColor: colors.errorLight }]}>
                        <Ionicons name="log-out" size={14} color={colors.error} />
                      </View>
                      <View>
                        <Text style={styles.historyDetailLabel}>ออกงาน</Text>
                        <Text style={styles.historyDetailValue}>{(item.checkOut || '--:--').split(' ')[0]}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Direct Full-Screen Time Correction Modal */}
      <Modal
        visible={isCorrectionModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsCorrectionModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <TopNavbar
            showBack
            title="ยื่นปรับปรุงเวลางาน"
            onBackPress={() => setIsCorrectionModalVisible(false)}
          />

          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Target Date Box */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>
                วันที่ยื่นขอปรับปรุงเวลา
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.title }}>{modalDateText}</Text>
              </View>
            </View>

            {/* Time Target Box */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.title, marginBottom: 12 }}>
                ⏰ ระบุเวลาที่ต้องการขอปรับปรุง
              </Text>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>
                    เวลาเข้างานใหม่
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 15,
                      fontWeight: '700',
                      color: colors.title,
                      backgroundColor: '#F8FAFC',
                    }}
                    value={modalInTime}
                    onChangeText={setModalInTime}
                    placeholder="09:00"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>
                    เวลาออกงานใหม่
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 15,
                      fontWeight: '700',
                      color: colors.title,
                      backgroundColor: '#F8FAFC',
                    }}
                    value={modalOutTime}
                    onChangeText={setModalOutTime}
                    placeholder="18:00"
                  />
                </View>
              </View>
            </View>

            {/* Reason Text Area */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.title, marginBottom: 8 }}>
                💬 เหตุผลการขอปรับปรุงเวลา
              </Text>
              <TextInput
                style={{
                  borderWidth: 1.5,
                  borderColor: '#CBD5E1',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 13,
                  height: 90,
                  textAlignVertical: 'top',
                  backgroundColor: '#FFFFFF',
                  color: colors.title,
                }}
                value={modalReason}
                onChangeText={setModalReason}
                placeholder="ระบุเหตุผล เช่น ระบบสแกนลายนิ้วมือขัดข้อง, ลืมสแกนบัตรลงเวลา..."
                multiline
              />
            </View>

            {/* Confirm Submit Button */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
                marginBottom: 30,
              }}
              onPress={handleConfirmCorrection}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                🚀 ส่งคำขอปรับปรุงเวลา
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: colors.backgroundSecondary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  historyTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  historyTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalHeaderIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 12,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  modalCloseButton: {
    padding: 4,
  },
  historyList: {
    paddingVertical: 16,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    paddingBottom: 8,
  },
  historyDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
    marginLeft: 6,
  },
  historyDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
    marginLeft: 4,
  },
  historyCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDetailCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyDetailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  historyDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    marginTop: 2,
  },
  historyDetailSep: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
    marginHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  calendarMonthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  monthArrow: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  calendarGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekHeaderCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A8F98',
    textAlign: 'center',
  },
  daysGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellWrapper: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    backgroundColor: colors.primaryLight,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  logDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  detailContainer: {
    paddingHorizontal: 4,
  },
  detailDateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
  },
  calendarDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 12,
  },
  detailTotalHoursLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  detailTotalHoursValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  holidayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: colors.errorLight,
    borderColor: colors.error + '20',
  },
  holidayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  holidaySubtitle: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  noDataCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#FAF9F6',
  },
  noDataTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  noDataSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  dayCellLeave: {
    backgroundColor: '#F5A623',
  },
  dayCellTextLeave: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  leaveDetailCard: {
    borderColor: '#FFB74D',
    borderWidth: 1,
  },
  dayCellWeekend: {
    backgroundColor: '#EAEAEA',
  },
  dayCellTextWeekend: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  dayCellHoliday: {
    backgroundColor: '#1E1E24',
  },
  dayCellTextHoliday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellIncomplete: {
    backgroundColor: '#EF4444',
  },
  dayCellTextIncomplete: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayUnderline: {
    position: 'absolute',
    bottom: 4,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
});
