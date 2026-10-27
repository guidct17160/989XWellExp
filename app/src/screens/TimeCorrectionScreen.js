import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { attendanceStorage } from '../services/attendanceStorage';
import { leaveStorage } from '../services/leaveStorage';
import { notificationStorage } from '../services/notificationStorage';
import TopNavbar from '../components/TopNavbar';
import { useTheme } from '../context/ThemeContext';
import { tryFetchApi } from '../services/apiClient';
import { workRules } from '../services/workRules';
import { todayIsoBkk } from '../utils/bangkokDate';

const attendanceIssues = [];

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export default function TimeCorrectionScreen({ navigation, route }) {
  const [activeMonth, setActiveMonth] = useState(6); // Default to July (0-indexed) where attendance issues exist
  const [activeYear, setActiveYear] = useState(2026);

  const todayObj = new Date();
  const defaultDayObj = route?.params?.issueData || {
    id: 'default_' + todayObj.getTime(),
    date: todayObj.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    dayThai: todayObj.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    type: 'ปรับปรุงเวลาเข้า-ออกงาน',
    inTime: '09:00',
    outTime: '18:00',
    month: todayObj.getMonth(),
    year: todayObj.getFullYear(),
  };

  const [selectedDay, setSelectedDay] = useState(route?.params?.issueData || null);
  const [attendance, setAttendance] = useState(attendanceStorage.getState());
  const [leaveState, setLeaveState] = useState(leaveStorage.getState());

  // Form states
  const [correctionType, setCorrectionType] = useState('in'); // 'in' | 'out' | 'both'
  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('18:00');
  const [remark, setRemark] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [photos, setPhotos] = useState([null, null, null]);

  // Time Picker Modal states for Numeric Input (HH : MM)
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState('in'); // 'in' | 'out'
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('30');

  const openTimePicker = (mode) => {
    setPickerMode(mode);
    const timeVal = mode === 'in' ? inTime : outTime;
    if (timeVal && timeVal.includes(':')) {
      const parts = timeVal.split(':');
      setSelectedHour(parts[0].padStart(2, '0'));
      setSelectedMinute(parts[1].padStart(2, '0'));
    } else {
      setSelectedHour(mode === 'in' ? '08' : '17');
      setSelectedMinute('30');
    }
    setIsTimePickerVisible(true);
  };

  const handleConfirmTimePicker = () => {
    const formatted = `${selectedHour}:${selectedMinute}`;
    if (pickerMode === 'in') {
      setInTime(formatted);
    } else {
      setOutTime(formatted);
    }
    setIsTimePickerVisible(false);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [selectedDay]);

  useEffect(() => {
    const unsubscribeAttendance = attendanceStorage.subscribe((state) => {
      setAttendance(state);
    });
    const unsubscribeLeave = leaveStorage.subscribe((state) => {
      setLeaveState(state);
    });
    return () => {
      unsubscribeAttendance();
      unsubscribeLeave();
    };
  }, []);

  // 🎯 Auto open correction form OR switch tab when navigating from notification
  useEffect(() => {
    if (route?.params?.tab === 'requests' || route?.params?.activeTab === 'requests' || route?.params?.openRequestsTab) {
      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('RequestStatus', { categoryKey: 'correction' });
      }
    } else if (route?.params?.autoOpenModal || route?.params?.selectedIssueId || route?.params?.timestamp || route?.params?.issueData) {
      const issueDataPayload = route.params?.issueData;
      const targetId = route.params?.selectedIssueId;

      let targetIssue = null;
      if (issueDataPayload) {
        targetIssue = issueDataPayload;
      } else {
        targetIssue = dynamicIssues.find(i => i.id === targetId) || attendanceIssues.find(i => i.id === targetId) || dynamicIssues[0] || attendanceIssues[0];
      }

      if (targetIssue) {
        setSelectedDay(targetIssue);
        setInTime(targetIssue.inTime && targetIssue.inTime !== '-' ? targetIssue.inTime.substring(0, 5) : '09:00');
        setOutTime(targetIssue.outTime && targetIssue.outTime !== '-' ? targetIssue.outTime.substring(0, 5) : '18:00');
        if (typeof targetIssue.month === 'number') {
          setActiveMonth(targetIssue.month);
        }
        if (typeof targetIssue.year === 'number') {
          setActiveYear(targetIssue.year);
        }
      }
    }
  }, [route?.params?.timestamp, route?.params?.selectedIssueId, route?.params?.issueData, route?.params?.tab, route?.params?.activeTab, route?.params?.openRequestsTab]);

  const handlePrevMonth = () => {
    if (activeMonth === 0) {
      setActiveMonth(11);
      setActiveYear(activeYear - 1);
    } else {
      setActiveMonth(activeMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (activeMonth === 11) {
      setActiveMonth(0);
      setActiveYear(activeYear + 1);
    } else {
      setActiveMonth(activeMonth + 1);
    }
  };

  // Get list of submitted time correction requests from leaveHistory
  const correctionHistoryList = (leaveState.leaveHistory || []).filter(
    h => h.typeId === 'time_correction' || h.type === 'ปรับปรุงเวลางาน' || h.categoryKey === 'correction' || h.type === 'ปรับปรุงเวลาเข้า-ออกงาน'
  );

  const submittedIssueIds = new Set(
    correctionHistoryList.map(item => item.issueId).filter(Boolean)
  );

  const submittedDateStrings = new Set();
  correctionHistoryList.forEach(item => {
    if (item.dates) submittedDateStrings.add(item.dates);
    if (item.rawDate) submittedDateStrings.add(item.rawDate);
    if (item.dayThai) submittedDateStrings.add(item.dayThai);
    if (item.start) submittedDateStrings.add(item.start);
    if (item.end) submittedDateStrings.add(item.end);
  });

  (attendance.history || []).forEach(record => {
    if (record.isCorrected || record.approvalStatus === 'รออนุมัติ' || record.status?.includes('รออนุมัติ') || record.status?.includes('ปรับปรุงเวลา')) {
      if (record.id) submittedIssueIds.add(record.id);
      if (record.dayThai) submittedDateStrings.add(record.dayThai);
      if (record.date) submittedDateStrings.add(record.date);
      if (record.dateIso) submittedDateStrings.add(record.dateIso);
    }
  });

  const isDateSubmitted = (item) => {
    if (!item) return false;
    if (item.id && submittedIssueIds.has(item.id)) return true;
    if (item.dayThai && submittedDateStrings.has(item.dayThai)) return true;
    if (item.date && submittedDateStrings.has(item.date)) return true;
    if (item.dateIso && submittedDateStrings.has(item.dateIso)) return true;

    for (const submittedStr of submittedDateStrings) {
      if (!submittedStr) continue;
      if (item.date && (submittedStr.includes(item.date) || item.date.includes(submittedStr))) return true;
      if (item.dayThai && (submittedStr.includes(item.dayThai) || item.dayThai.includes(submittedStr))) return true;
      if (item.dateIso && (submittedStr.includes(item.dateIso) || item.dateIso.includes(submittedStr))) return true;
    }
    return false;
  };

  // Build all potential incomplete issues from punchLogs, history, and attendanceIssues (preserving EVERY round)
  const allIssues = [];

  // 1. Helper to parse punchLogs per date into multi-round sessions
  const punchLogs = attendance.punchLogs || [];
  const datesMap = new Map();
  punchLogs.forEach((p) => {
    if (!p || !p.timestamp) return;
    const d = new Date(p.timestamp);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!datesMap.has(iso)) datesMap.set(iso, []);
    datesMap.get(iso).push(p);
  });

  const processedPunchDates = new Set();

  datesMap.forEach((punches, iso) => {
    processedPunchDates.add(iso);
    const sorted = [...punches].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let currentIn = null;
    let roundNum = 1;
    const sessions = [];

    sorted.forEach((punch) => {
      if (punch.type === 'check_in') {
        if (currentIn) {
          sessions.push({ round: roundNum++, inPunch: currentIn, outPunch: null });
        }
        currentIn = punch;
      } else if (punch.type === 'check_out') {
        sessions.push({ round: roundNum++, inPunch: currentIn, outPunch: punch });
        currentIn = null;
      }
    });

    if (currentIn) {
      sessions.push({ round: roundNum++, inPunch: currentIn, outPunch: null });
    }

    const totalRoundsOnDate = sessions.length;

    sessions.forEach((sess) => {
      const inPunch = sess.inPunch;
      const outPunch = sess.outPunch;
      if (!inPunch && !outPunch) return;

      const inTimeStr = inPunch ? (inPunch.time || '').replace(' น.', '').trim() : '09:00';
      const outTimeStr = outPunch ? (outPunch.time || '').replace(' น.', '').trim() : '--:--';

      let diffSec = 0;
      if (inPunch && outPunch && inPunch.timestamp && outPunch.timestamp) {
        diffSec = Math.max(0, Math.floor((outPunch.timestamp - inPunch.timestamp) / 1000));
      }

      const inDate = inPunch ? new Date(inPunch.timestamp) : new Date(outPunch.timestamp);
      const isLate = workRules.isLateAt(inDate.getHours(), inDate.getMinutes());
      const isShort = outPunch ? diffSec < 14400 : false;
      const isMissingOut = !outPunch;

      const isIncomplete = isLate || isShort || isMissingOut;

      if (isIncomplete) {
        const dayNum = inDate.getDate();
        const m = inDate.getMonth();
        const y = inDate.getFullYear();
        const dd = String(dayNum).padStart(2, '0');
        const mm = String(m + 1).padStart(2, '0');
        const dayName = inDate.toLocaleDateString('th-TH', { weekday: 'long' });
        const monthName = thaiMonths[m];
        const dayThai = `${dayName.replace('วัน', '')}, ${dayNum} ${monthName} ${y + 543}`;

        let statusText = 'ทำงานไม่ครบเวลา';
        let statusColor = colors.warning;
        if (isLate && isShort) {
          statusText = 'เข้างานสาย และ ทำงานไม่ครบเวลา';
          statusColor = colors.error;
        } else if (isLate) {
          statusText = 'เข้างานสาย';
          statusColor = colors.error;
        }

        allIssues.push({
          id: `punch_sess_${iso}_r${sess.round}`,
          date: `${dd}/${mm}/${y}`,
          dateIso: iso,
          dayThai: dayThai,
          round: sess.round,
          totalRounds: totalRoundsOnDate,
          type: statusText,
          typeColor: statusColor,
          inTime: inTimeStr.substring(0, 5),
          outTime: outTimeStr === '--:--' ? '18:00' : outTimeStr.substring(0, 5),
          month: m,
          year: y,
          dayNum: dayNum,
        });
      }
    });
  });

  // 2. Parse attendance.history
  (attendance.history || []).forEach((record) => {
    if (!record) return;
    if (record.isComplete || record.status === 'ลงเวลาเข้า-ออกครบถ้วน') return;
    if (record.dateIso && processedPunchDates.has(record.dateIso)) return;
    // Still clocked in today (no check-out yet) is not an issue to correct
    if (!record.checkOut && record.dateIso === todayIsoBkk()) return;

    if (record.isIncomplete || record.status?.includes('สาย') || record.status?.includes('ไม่ครบ') || record.status?.includes('ออกก่อน')) {
      let recordDate = new Date();
      if (record.dateIso) {
        const parts = record.dateIso.split('-');
        if (parts.length === 3) {
          recordDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
      }

      const dayNum = recordDate.getDate();
      const m = recordDate.getMonth();
      const y = recordDate.getFullYear();
      const dd = String(dayNum).padStart(2, '0');
      const mm = String(m + 1).padStart(2, '0');
      const dayName = recordDate.toLocaleDateString('th-TH', { weekday: 'long' });
      const monthName = thaiMonths[m];
      const dayThai = record.dayThai || `${dayName.replace('วัน', '')}, ${dayNum} ${monthName} ${y + 543}`;

      allIssues.push({
        id: record.id || `issue_hist_${recordDate.getTime()}`,
        date: `${dd}/${mm}/${y}`,
        dateIso: record.dateIso || `${y}-${mm}-${dd}`,
        dayThai: dayThai,
        round: record.round || 1,
        totalRounds: 1,
        type: record.status || 'เข้างานไม่ครบ',
        typeColor: record.statusColor || colors.warning,
        inTime: record.checkIn ? record.checkIn.replace(' น.', '').substring(0, 5) : '08:00',
        outTime: record.checkOut ? record.checkOut.replace(' น.', '').substring(0, 5) : '17:00',
        month: m,
        year: y,
        dayNum: dayNum,
      });
    }
  });

  // 3. Include sample predefined issues from attendanceIssues
  attendanceIssues.forEach((item) => {
    if (!allIssues.some((i) => i.id === item.id || (i.date === item.date && !i.round))) {
      allIssues.push({
        ...item,
        round: item.round || 1,
        totalRounds: 1,
      });
    }
  });

  // 4. Include routeIssueData if provided
  const routeIssueData = route?.params?.issueData;
  if (routeIssueData && !allIssues.some((i) => i.id === routeIssueData.id)) {
    allIssues.unshift(routeIssueData);
  }

  // 5. Deduplicate by unique ID so every round is preserved
  const seenIds = new Set();
  const combinedIssues = [];
  allIssues.forEach((item) => {
    if (item && item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      combinedIssues.push(item);
    }
  });

  // 6. Filter out any issue whose date has been submitted
  const remainingIssues = combinedIssues.filter((item) => !isDateSubmitted(item));

  // 7. Filter issues for the active month and year
  const filteredIssues = remainingIssues.filter(
    (item) => item.month === activeMonth && item.year === activeYear
  );

  const dynamicIssues = allIssues;

  // Auto-switch to most recent month with issues if current selected month is empty
  useEffect(() => {
    if (remainingIssues && remainingIssues.length > 0) {
      const hasIssuesInActiveMonth = remainingIssues.some(
        i => i.month === activeMonth && i.year === activeYear
      );
      if (!hasIssuesInActiveMonth) {
         // Sort issues by date descending
         const sorted = [...remainingIssues].sort((a,b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
         if (sorted.length > 0) {
            setActiveMonth(sorted[0].month);
            setActiveYear(sorted[0].year);
         }
      }
    }
  }, [remainingIssues.length]);

  const selectDayIssue = (day) => {
    setSelectedDay(day);

    // Pre-populate with actual recorded times for that occurrence
    const actualInTime = (day.inTime && day.inTime !== '-' && day.inTime !== '--:--') ? day.inTime : '08:00';
    const actualOutTime = (day.outTime && day.outTime !== '-' && day.outTime !== '--:--') ? day.outTime : '17:00';

    setInTime(actualInTime);
    setOutTime(actualOutTime);

    if (day.type?.includes('สาย')) {
      setCorrectionType('in');
    } else if (day.type?.includes('ไม่ครบ')) {
      setCorrectionType('out');
    } else {
      setCorrectionType('both');
    }

    setRemark('');
    setPhotos([null, null, null]);
    setAttachedFiles([]);
  };

  const validateWorkTimeRules = (inStr, outStr) => {
    const cleanIn = (inStr || '09:00').replace('น.', '').trim();
    const cleanOut = (outStr || '18:00').replace('น.', '').trim();

    const inParts = cleanIn.split(':');
    const outParts = cleanOut.split(':');

    let inH = parseInt(inParts[0], 10) || 0;
    let inM = parseInt(inParts[1], 10) || 0;
    let outH = parseInt(outParts[0], 10) || 0;
    let outM = parseInt(outParts[1], 10) || 0;

    // counted from the "count from" time HR set (default 08:00) when the employee came earlier
    const startSec = Math.max(inH * 3600 + inM * 60, workRules.workStartMinutes() * 60);
    const endSec = outH * 3600 + outM * 60;
    const diffSec = endSec - startSec;

    if (diffSec <= 0) {
      return {
        isValid: false,
        errorMsg: 'เวลาออกงานต้องมากกว่าเวลาเข้างาน',
      };
    }

    const minRequiredSec = workRules.requiredSeconds();
    if (diffSec < minRequiredSec) {
      const currentH = Math.floor(diffSec / 3600);
      const currentM = Math.floor((diffSec % 3600) / 60);
      return {
        isValid: false,
        errorMsg: `เวลาทำงานรวมต้องไม่น้อยกว่า ${workRules.requiredHoursLabel()} ชั่วโมง (เริ่มนับจาก ${workRules.get().workStartTime} น.) ปัจจุบันคำนวณได้เพียง ${currentH} ชม. ${currentM} นาที`,
      };
    }

    return { isValid: true };
  };

  const handleSubmitRequest = async () => {
    if (!remark.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุหมายเหตุการขอปรับปรุงเวลา');
      return;
    }

    const validation = validateWorkTimeRules(inTime, outTime);
    if (!validation.isValid) {
      Alert.alert('เงื่อนไขไม่ถูกต้อง', validation.errorMsg);
      return;
    }

    const dateText = selectedDay?.dayThai || selectedDay?.date || 'วันนี้';
    const targetId = selectedDay?.id || null;
    const targetRawDate = selectedDay?.dateIso || selectedDay?.date || null;

    try {
      await leaveStorage.addTimeCorrectionRequest(dateText, inTime, outTime, remark, targetId, targetRawDate);
    } catch (error) {
      Alert.alert('ส่งคำขอไม่สำเร็จ', error.message);
      return;
    }
    attendanceStorage.updateCorrection(dateText, inTime, outTime, remark);

    // 🔔 Push top sliding Alert notification banner (matching incomplete check-in alert style)
    notificationStorage.addNotification({
      id: 'corr_succ_' + Date.now(),
      type: 'success',
      icon: 'checkmark-circle-outline',
      iconColor: '#27AE60',
      title: '✅ ส่งคำขอปรับปรุงเวลาสำเร็จ',
      message: `คำขอปรับปรุงเวลาประจำวันที่ ${dateText} ถูกส่งไปยังฝ่ายบุคคลเรียบร้อยแล้ว`,
      time: 'เมื่อครู่นี้',
      unread: true,
      screen: 'TimeCorrection',
      tab: 'requests',
      activeTab: 'requests',
      openRequestsTab: true,
    });

    if (route?.params?.issueData) {
      if (navigation && typeof navigation.goBack === 'function' && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        setSelectedDay(null);
      }
    } else {
      setSelectedDay(null);
    }
  };

  const handleAddPhoto = (index) => {
    const newPhotos = [...photos];
    newPhotos[index] = 'photo_attached.jpg';
    setPhotos(newPhotos);
    Alert.alert('สำเร็จ', 'แนบรูปถ่ายเรียบร้อยแล้ว');
  };

  const handleAddFile = () => {
    Alert.alert('สำเร็จ', 'แนบเอกสารรับรองเรียบร้อยแล้ว');
  };

  const getItemDateInfo = (item) => {
    if (typeof item.dayNum === 'number' && typeof item.month === 'number' && typeof item.year === 'number') {
      return { month: item.month, year: item.year };
    }

    if (item.date && item.date.includes('/')) {
      const parts = item.date.split('/');
      if (parts.length === 3) {
        let m = parseInt(parts[1], 10) - 1;
        let y = parseInt(parts[2], 10);
        if (y > 2500) y -= 543;
        if (!isNaN(m) && !isNaN(y)) {
          return { month: m, year: y };
        }
      }
    }

    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  };

  // --- SCREEN 1: Attendance Discrepancies List & Request History ---
  if (!selectedDay) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

        {/* Top Navbar */}
        <TopNavbar navigation={navigation} title="ยื่นปรับปรุงเวลา" showBack />

        <View style={styles.container}>
          {/* Month Navigator Header */}
          <View testID="time-correction-month-nav" style={styles.monthNavigator}>
            <TouchableOpacity testID="time-correction-prev-month-btn" onPress={handlePrevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.monthText}>{thaiMonths[activeMonth]} {activeYear + 543}</Text>
            </View>
            <TouchableOpacity testID="time-correction-next-month-btn" onPress={handleNextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>


          <ScrollView testID="time-correction-issues-list" style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {filteredIssues.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>ข้อมูลเวลาเข้าออกงานของเดือนนี้สมบูรณ์เรียบร้อย</Text>
              </View>
            ) : (
              filteredIssues.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.issueCard}
                  onPress={() => selectDayIssue(item)}
                >
                  <View style={styles.issueHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.issueDateText}>{item.dayThai}</Text>
                      {item.round && (
                        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8, borderWidth: 1, borderColor: '#C7D2FE' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#4F46E5' }}>
                            รอบที่ {item.round}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: item.typeColor + '15' }]}>
                      <Text style={[styles.typeBadgeText, { color: item.typeColor }]}>{item.type}</Text>
                    </View>
                  </View>

                  <View style={styles.issueDetailRow}>
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeBlockLabel}>เข้างาน</Text>
                      <Text style={styles.timeBlockVal}>{item.inTime}</Text>
                    </View>
                    <View style={styles.timeBlockSep} />
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeBlockLabel}>ออกงาน</Text>
                      <Text style={styles.timeBlockVal}>{item.outTime}</Text>
                    </View>
                    <View style={styles.clickToEdit}>
                      <Text style={styles.clickToEditText}>ปรับปรุง</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // --- SCREEN 2: Attendance Correction Form ---
  const isInDisabled = correctionType === 'out';
  const isOutDisabled = correctionType === 'in';

  const handleFormBack = () => {
    if (route?.params?.issueData) {
      if (navigation && typeof navigation.goBack === 'function' && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        setSelectedDay(null);
      }
    } else {
      setSelectedDay(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleFormBack}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ปรับปรุงเวลาทำงาน</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.formContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Selected Day card */}
          <View style={styles.daySelectorCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.daySelectorLabel}>วันที่เข้า-ออกงาน</Text>
              <Text style={styles.daySelectorDate}>{selectedDay.dayThai}</Text>
            </View>
          </View>

          {/* ประเภทการเพิ่ม Radio options */}
          <Text style={styles.formLabel}>ประเภทการเพิ่ม</Text>
          <View style={styles.radioRow}>
            <TouchableOpacity
              style={styles.radioItem}
              onPress={() => setCorrectionType('in')}
            >
              <View style={[styles.radioOutline, correctionType === 'in' && styles.radioOutlineActive]}>
                {correctionType === 'in' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioText}>เข้างาน</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioItem}
              onPress={() => setCorrectionType('out')}
            >
              <View style={[styles.radioOutline, correctionType === 'out' && styles.radioOutlineActive]}>
                {correctionType === 'out' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioText}>ออกงาน</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioItem}
              onPress={() => setCorrectionType('both')}
            >
              <View style={[styles.radioOutline, correctionType === 'both' && styles.radioOutlineActive]}>
                {correctionType === 'both' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioText}>เข้า-ออกงาน</Text>
            </TouchableOpacity>
          </View>

          {/* Check-in fields */}
          <View style={styles.dateTimeFieldsRow}>
            <View style={[styles.fieldBlock, { marginRight: 12 }]}>
              <Text style={styles.fieldLabel}>วันที่เข้างาน</Text>
              <View style={[styles.fieldInputMock, isInDisabled && styles.fieldInputMockDisabled]}>
                <Text style={[styles.inputTextMock, isInDisabled && styles.inputTextMockDisabled]}>
                  {selectedDay.date}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={isInDisabled ? '#94A3B8' : '#64748B'} />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>เวลา</Text>
              <TouchableOpacity
                disabled={isInDisabled}
                style={[styles.fieldInputMock, isInDisabled && styles.fieldInputMockDisabled]}
                onPress={() => openTimePicker('in')}
              >
                <Text style={[styles.inputTextMock, isInDisabled && styles.inputTextMockDisabled]}>
                  {inTime}
                </Text>
                <Ionicons name="time-outline" size={16} color={isInDisabled ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Check-out fields */}
          <View style={styles.dateTimeFieldsRow}>
            <View style={[styles.fieldBlock, { marginRight: 12 }]}>
              <Text style={styles.fieldLabel}>วันที่ออกงาน</Text>
              <View style={[styles.fieldInputMock, isOutDisabled && styles.fieldInputMockDisabled]}>
                <Text style={[styles.inputTextMock, isOutDisabled && styles.inputTextMockDisabled]}>
                  {selectedDay.date}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={isOutDisabled ? '#94A3B8' : '#64748B'} />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>เวลา</Text>
              <TouchableOpacity
                disabled={isOutDisabled}
                style={[styles.fieldInputMock, isOutDisabled && styles.fieldInputMockDisabled]}
                onPress={() => openTimePicker('out')}
              >
                <Text style={[styles.inputTextMock, isOutDisabled && styles.inputTextMockDisabled]}>
                  {outTime}
                </Text>
                <Ionicons name="time-outline" size={16} color={isOutDisabled ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* หมายเหตุ */}
          <Text style={styles.formLabel}>หมายเหตุ<Text style={{ color: colors.error }}>*</Text></Text>
          <TextInput
            style={styles.remarkInput}
            value={remark}
            onChangeText={setRemark}
            placeholder="กรุณากรอกเหตุผลที่ขอปรับปรุงเวลางาน..."
            placeholderTextColor="#94A3B8"
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
            scrollEnabled={true}
            editable={true}
            focusable={true}
          />

          {/* รูปภาพ */}
          <Text style={styles.formLabel}>รูปภาพ</Text>
          <View style={styles.photosRow}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={index}
                style={styles.photoBox}
                onPress={() => handleAddPhoto(index)}
              >
                {photo ? (
                  <View style={styles.photoAttached}>
                    <Ionicons name="image" size={24} color={colors.primary} />
                    <Text style={styles.photoBoxText}>แนบแล้ว</Text>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="add" size={24} color="#00B8D4" />
                    <Text style={styles.photoBoxText}>เพิ่มรูป</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* ไฟล์แนบ */}
          <Text style={styles.formLabel}>ไฟล์แนบ</Text>
          {attachedFiles.length > 0 ? (
            <View style={styles.fileAttachedRow}>
              <Ionicons name="document" size={20} color={colors.primary} />
              <Text style={styles.fileName}>{attachedFiles[0]}</Text>
              <TouchableOpacity onPress={() => setAttachedFiles([])}>
                <Ionicons name="close" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={handleAddFile}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#00B8D4" style={{ marginRight: 8 }} />
              <Text style={styles.uploadButtonText}>อัปโหลดไฟล์</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRequest}>
            <Text style={styles.submitButtonText}>ส่งคำขอ</Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>

      {/* Custom Scrollable Time Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTimePickerVisible}
        onRequestClose={() => setIsTimePickerVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <TouchableOpacity
            style={styles.pickerModalDismiss}
            activeOpacity={1}
            onPress={() => setIsTimePickerVisible(false)}
          />
          <View style={styles.pickerModalCard}>
            {/* Modal Header */}
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerMode === 'in' ? '⏰ เลือกเวลาเข้างาน' : '⏰ เลือกเวลาออกงาน'}
              </Text>
              <Text style={styles.pickerTimeDisplay}>
                {selectedHour} : {selectedMinute} น.
              </Text>
            </View>

            {/* Column Headers */}
            <View style={styles.pickerColumnLabelsRow}>
              <View style={styles.pickerColumnLabelCol}>
                <Text style={styles.pickerColumnLabelText}>ชั่วโมง (ข้างหน้า)</Text>
              </View>
              <View style={styles.pickerColumnLabelCol}>
                <Text style={styles.pickerColumnLabelText}>นาที (ข้างหลัง)</Text>
              </View>
            </View>

            {/* Dual Scroll Columns */}
            <View style={styles.pickerColumnsContainer}>
              {/* Left Column: Hours */}
              <View style={styles.pickerColumn}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                  {hoursList.map((h) => {
                    const isSelected = h === selectedHour;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                        onPress={() => setSelectedHour(h)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.pickerColumnDivider} />

              {/* Right Column: Minutes */}
              <View style={styles.pickerColumn}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                  {minutesList.map((m) => {
                    const isSelected = m === selectedMinute;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                        onPress={() => setSelectedMinute(m)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.pickerActionRow}>
              <TouchableOpacity
                style={styles.pickerCancelButton}
                onPress={() => setIsTimePickerVisible(false)}
              >
                <Text style={styles.pickerCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerConfirmButton}
                onPress={handleConfirmTimePicker}
              >
                <Text style={styles.pickerConfirmText}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  // Month Navigator
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  // Discrepancy Card
  issueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  issueDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  issueDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    flex: 1,
  },
  timeBlockLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  timeBlockVal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  timeBlockSep: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  clickToEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clickToEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Form Screen Styles
  formContainer: {
    padding: 16,
    paddingBottom: 80,
    backgroundColor: colors.backgroundSecondary,
  },
  daySelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  daySelectorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  daySelectorDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
    marginTop: 8,
  },
  radioRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  radioOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7CAD1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  radioOutlineActive: {
    borderColor: '#00B8D4',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B8D4',
  },
  radioText: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '600',
  },
  dateTimeFieldsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  fieldBlock: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  fieldInputMock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  fieldInputMockDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  inputTextMock: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '600',
  },
  inputTextMockDisabled: {
    color: '#94A3B8',
  },
  remarkInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.title,
    minHeight: 100,
    marginBottom: 20,
  },
  photosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  photoBox: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C7CAD1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAttached: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  fileAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 24,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: colors.title,
    marginLeft: 8,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00B8D4',
    borderRadius: 12,
    height: 48,
    marginBottom: 24,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#00B8D4',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#1A2B6D',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Scrollable Time Picker Modal Styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalDismiss: {
    flex: 1,
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '65%',
  },
  pickerHeader: {
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 4,
  },
  pickerTimeDisplay: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  pickerColumnLabelsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  pickerColumnLabelCol: {
    flex: 1,
    alignItems: 'center',
  },
  pickerColumnLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pickerColumnsContainer: {
    flexDirection: 'row',
    height: 200,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.title,
  },
  pickerItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pickerActionRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  pickerCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginRight: 8,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pickerConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginLeft: 8,
  },
  pickerConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Top Tabs & Request History Styles (Format เดียวกันกับหน้าลางาน)
  topTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 4,
  },
  topTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  topTabBtnActive: {
    backgroundColor: colors.primary,
  },
  topTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  topTabTextActive: {
    color: '#FFFFFF',
  },
  tabRowWithFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 6,
  },
  subTabsContainerCustom: {
    flexDirection: 'row',
    backgroundColor: '#E8EEF5',
    borderRadius: 14,
    padding: 3,
    flex: 1,
    marginRight: 10,
  },
  subTabCustom: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  subTabActiveCustom: {
    backgroundColor: '#1F4C9C',
  },
  subTabTextCustom: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  subTabTextActiveCustom: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavigatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  navArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF2FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMonthText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  emptyStateCustomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    flex: 1,
  },
  documentIllustration: {
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#CBD5E1',
    paddingTop: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    marginBottom: 16,
  },
  docLineShort: {
    width: '40%',
    height: 3,
    backgroundColor: '#CBD5E1',
    borderRadius: 1.5,
    marginBottom: 6,
  },
  docLineLong: {
    width: '100%',
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
    marginBottom: 6,
  },
  questionCircle: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1F4C9C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyStateCustomText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F4C9C',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyDates: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  historyDays: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  monthChipsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  monthChipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  monthChipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
  },
  monthChipActive: {
    backgroundColor: '#1F4C9C',
    borderColor: '#1F4C9C',
  },
  monthChipInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  monthChipTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monthChipTextInactive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
});
