import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useScrollToTop } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { attendanceStorage } from '../services/attendanceStorage';
import { notificationStorage } from '../services/notificationStorage';
import { tryFetchApi } from '../services/apiClient';
import TopNavbar from '../components/TopNavbar';
import PunchLocationModal from '../components/PunchLocationModal';
import { todayIsoBkk } from '../utils/bangkokDate';
import { workRules } from '../services/workRules';
import { pointsStorage } from '../services/pointsStorage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const quickActions = [
  { id: '1', icon: 'calendar-number-outline', label: 'ปฏิทิน', color: '#3B82F6' },
  { id: '2', icon: 'calendar-outline', label: 'ลางาน', color: '#10B981' },
  { id: '4', icon: 'people-outline', label: 'ทีมงาน', color: '#7C3AED' },
];

const menuItems = [
  { icon: 'calendar-outline', label: 'ปฏิทิน', color: '#27AE60', screen: 'TimeAttendance' },
  { icon: 'calendar-outline', label: 'ลางาน', color: '#F5A623', screen: 'LeaveRequest' },
  { icon: 'people-outline', label: 'ทีมงาน', color: '#7C3AED', screen: 'EmployeeDirectory' },
  { icon: 'sync-outline', label: 'ปรับเวลา', color: '#00B8D4', screen: 'TimeCorrection' },
];

export default function HomeScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const { theme, isDarkMode, t, language } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendance, setAttendance] = useState(attendanceStorage.getState());
  const [unreadCount, setUnreadCount] = useState(notificationStorage.getUnreadCount());
  // Quests the employee can still do (not passed / failed yet)
  const [quests, setQuests] = useState([]);

  const fetchQuests = async () => {
    try {
      const res = await tryFetchApi('/my-quests');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.quests)) {
          setQuests(data.quests.filter((q) => !q.passed && !q.failed));
        }
      }
    } catch (e) {}
  };

  // While the home screen is open: reload quests, and check every minute for a new announcement
  // (it lands in the notification bell, see notificationStorage.sync)
  useFocusEffect(
    useCallback(() => {
      fetchQuests();
      notificationStorage.sync();
      const timer = setInterval(() => notificationStorage.sync(), 60000);
      return () => clearInterval(timer);
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Subscribe to attendance storage
    const unsubscribeAttendance = attendanceStorage.subscribe((state) => {
      setAttendance(state);
    });

    // Subscribe to notification storage
    const unsubscribeNotif = notificationStorage.subscribe(() => {
      setUnreadCount(notificationStorage.getUnreadCount());
    });

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      attendanceStorage.getState(); // drops yesterday's punches from the card once midnight passes
    }, 1000);

    return () => {
      unsubscribeAttendance();
      unsubscribeNotif();
      clearInterval(timer);
    };
  }, []);

  const { isCheckedIn, checkInTime, checkOutTime } = attendance;

  // Format time HH:mm
  const formatTime = (date) => {
    if (!date) return '--:--';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '00:00:00';
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    const diff = Math.max(0, Math.floor((endDate - startDate) / 1000)); // seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate duration in hours, minutes, and seconds
  const getDuration = () => {
    if (!checkInTime) return '00:00:00';
    const startDate = checkInTime instanceof Date ? checkInTime : new Date(checkInTime);
    if (isNaN(startDate.getTime())) return '00:00:00';
    const endDate = checkOutTime ? (checkOutTime instanceof Date ? checkOutTime : new Date(checkOutTime)) : currentTime;

    // arriving before the work start time HR set (e.g. 08:00) still counts from that time
    const countFrom = new Date(startDate);
    countFrom.setHours(Math.floor(workRules.workStartMinutes() / 60), workRules.workStartMinutes() % 60, 0, 0);
    const effectiveStart = startDate < countFrom ? countFrom : startDate;

    const diff = Math.max(0, Math.floor((endDate - effectiveStart) / 1000)); // seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateWorkRules = (checkInDateObj, checkOutDateObj) => {
    const checkIn = checkInDateObj instanceof Date ? checkInDateObj : new Date(checkInDateObj);
    const checkOut = checkOutDateObj instanceof Date ? checkOutDateObj : new Date(checkOutDateObj);

    // 1. Start counting at the "count from" time (set by HR, default 08:00) of that day when the check-in is earlier
    const effectiveStart = new Date(checkIn);
    const countFrom = new Date(checkIn);
    countFrom.setHours(Math.floor(workRules.workStartMinutes() / 60), workRules.workStartMinutes() % 60, 0, 0);
    if (effectiveStart < countFrom) {
      effectiveStart.setTime(countFrom.getTime());
    }

    // 2. Total duration in seconds from effective start (08:00 AM)
    const diffInSeconds = Math.max(0, Math.floor((checkOut - effectiveStart) / 1000));
    const h = Math.floor(diffInSeconds / 3600);
    const m = Math.floor((diffInSeconds % 3600) / 60);
    const s = diffInSeconds % 60;
    const durationStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} ชม.`;

    // 3. Late Check (Must check in before 09:00 AM)
    const inHour = checkIn.getHours();
    const inMin = checkIn.getMinutes();
    const isLate = workRules.isLateAt(inHour, inMin);

    // 4. Incomplete Hours Check (must work at least the required hours HR set, default 9)
    const isIncompleteHours = diffInSeconds < workRules.requiredSeconds();

    let status = 'ลงเวลาเข้า-ออกครบถ้วน';
    let isIncomplete = false;
    let statusColor = '#27AE60'; // Green

    // late is checked first; only when on time are the worked hours checked
    if (isLate) {
      status = 'เข้างานสาย';
      isIncomplete = true;
      statusColor = '#EF4444'; // Red
    } else if (isIncompleteHours) {
      status = `ทำงานไม่ครบเวลา (ออกก่อนกำหนด / น้อยกว่า ${workRules.requiredHoursLabel()} ชม.)`;
      isIncomplete = true;
      statusColor = '#F5A623'; // Amber
    }

    return {
      durationStr,
      isLate,
      isIncompleteHours,
      isIncomplete,
      status,
      statusColor,
    };
  };

  const isPunchingRef = useRef(false);

  // กดเข้า/ออกงาน → เปิดหน้าเลือกสถานที่ (ค้นหาตำแหน่ง + แผนที่) แล้วค่อยบันทึกเวลาเมื่อเลือกสถานที่แล้ว
  const [pickerKind, setPickerKind] = useState(null);

  const handleCheckInOut = () => {
    if (isPunchingRef.current) return;
    setPickerKind(attendanceStorage.getState().isCheckedIn ? 'clock-out' : 'clock-in');
  };

  const onLocationSelected = (selection) => {
    setPickerKind(null);
    performCheckInOut(selection || {});
  };

  const performCheckInOut = async (locationExtra) => {
    if (isPunchingRef.current) return;
    const state = attendanceStorage.getState();

    // บันทึกลงเซิร์ฟเวอร์ก่อน — ถ้าไม่สำเร็จจะไม่บันทึกเวลาในเครื่อง (ไม่มีข้อมูลค้างเฉพาะบนอุปกรณ์)
    isPunchingRef.current = true;
    let punched = null;
    try {
      punched = await attendanceStorage.punch(state.isCheckedIn ? 'clock-out' : 'clock-in', locationExtra);
    } catch (e) {
      Alert.alert(state.isCheckedIn ? 'บันทึกเวลาออกงานไม่สำเร็จ' : 'บันทึกเวลาเข้างานไม่สำเร็จ', e.message);
      // the server may know something this screen does not (e.g. already clocked in): re-sync so the button is correct
      attendanceStorage.refresh();
      return;
    } finally {
      isPunchingRef.current = false;
    }

    // on-time bonus: HR gives points to everyone who checks in on time
    if (punched && punched.pointsAwarded > 0) {
      pointsStorage.syncWithBackend();
      Alert.alert('เข้างานตรงเวลาและทำงานครบเวลา 🎉', `คุณได้รับ ${punched.pointsAwarded} แต้ม`);
    }

    const now = new Date();
    const formattedTimeStr = formatTime(now) + ' น.';
    const formattedDateStr = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const dateIsoStr = todayIsoBkk();
    const dayThaiStr = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (!state.isCheckedIn) {
      // 🟢 กดเข้างาน (Check In หรือ กดเข้างานรอบใหม่ -> รีเซ็ตเวลาและเริ่มนับใหม่)
      attendanceStorage.addPunchLog('check_in', formattedTimeStr, formattedDateStr);

      attendanceStorage.setState({
        isCheckedIn: true,
        checkInTime: now,
        checkOutTime: null,
      });

      notificationStorage.addNotification({
        id: 'att_in_' + Date.now(),
        type: 'info',
        icon: 'log-in-outline',
        iconColor: '#0074C4',
        title: '🟢 บันทึกเวลาเข้างานสำเร็จ',
        message: `เข้างานเวลา ${formattedTimeStr} (เริ่มนับเวลาทำงานรอบใหม่)`,
        time: 'เมื่อครู่นี้',
        unread: true,
        screen: 'TimeAttendance',
      });
      attendanceStorage.refresh();
    } else {
      // 🔴 กดออกงาน (Check Out -> บันทึกเวลาออกและสรุประยะเวลาทำงาน)
      const checkoutTimeVal = now;
      attendanceStorage.addPunchLog('check_out', formattedTimeStr, formattedDateStr);

      const { durationStr, isIncomplete, status, statusColor } = calculateWorkRules(state.checkInTime, checkoutTimeVal);

      const currentHistory = state.history || [];
      const sameDayRecords = currentHistory.filter(
        (h) => h.dateIso === dateIsoStr || h.date === formattedDateStr
      );
      const roundNumber = sameDayRecords.length + 1;

      const newRecord = {
        id: Date.now().toString(),
        date: formattedDateStr,
        dateIso: dateIsoStr,
        dayThai: dayThaiStr,
        checkIn: formatTime(state.checkInTime) + ' น.',
        checkOut: formattedTimeStr,
        duration: durationStr,
        isIncomplete: isIncomplete,
        isComplete: !isIncomplete,
        status: status,
        statusColor: statusColor,
        round: roundNumber,
      };

      attendanceStorage.setState({
        isCheckedIn: false,
        checkInTime: state.checkInTime,
        checkOutTime: checkoutTimeVal,
        history: [newRecord, ...currentHistory],
      });

      notificationStorage.addNotification({
        id: 'att_out_' + Date.now(),
        type: 'success',
        icon: 'log-out-outline',
        iconColor: '#27AE60',
        title: '🔴 บันทึกเวลาออกงานสำเร็จ',
        message: `ออกงานเวลา ${formattedTimeStr} | รวมระยะเวลาทำงาน: ${durationStr}`,
        time: 'เมื่อครู่นี้',
        unread: true,
        screen: 'TimeAttendance',
      });
      attendanceStorage.refresh();
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    attendanceStorage.refresh();
    notificationStorage.clearAndSync();
    fetchQuests();
    setAttendance(attendanceStorage.getState());
    setUnreadCount(notificationStorage.getUnreadCount());
    setCurrentTime(new Date());
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  return (
    <SafeAreaView testID="screen-home" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      <TopNavbar navigation={navigation} />
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        className="flex-1 bg-slate-50"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary, '#FF8C00']}
            tintColor="#FFFFFF"
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerContainer} className="bg-primary px-4 pt-4 pb-14 rounded-b-3xl items-center ">
          {/* Attendance Card */}
          <View testID="home-attendance-card" style={styles.attendanceContainer} className="w-full bg-white rounded-2xl p-5 shadow-lg border border-slate-100 items-center ">
            {/* Top Card */}
            <View style={[
              styles.attendanceTopCard,
              { backgroundColor: isCheckedIn ? '#F59E0B' : '#7C3AED', borderColor: isCheckedIn ? '#F59E0B' : '#7C3AED' }
            ]} className="w-full rounded-xl p-4 items-center mb-4">
              <View style={styles.timeRow} className="flex-row items-baseline mb-1 ">
                <Text style={[styles.timeTextLarge, { color: '#FFFFFF' }]} className=" font-bold">
                  {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
                <Text style={[styles.timeTextSeconds, { color: 'rgba(255, 255, 255, 0.9)' }]} className="text-sm ml-1">
                  {currentTime.toLocaleTimeString('th-TH', { second: '2-digit' })}
                </Text>
              </View>

              <View style={[styles.dashedDivider, { borderColor: 'rgba(255, 255, 255, 0.35)' }]} className="w-full border-b border-dashed my-2" />

              <Text style={[styles.dateText, { color: '#FFFFFF' }]} className="text-sm font-medium">
                {currentTime.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>

            {/* Outer Circular Ring & Button */}
            <View style={styles.circularButtonOuterRing} className="w-32 h-32 rounded-full p-2 bg-slate-100 items-center justify-center mb-4">
              <TouchableOpacity
                testID="home-checkin-checkout-btn"
                style={[
                  styles.circularButton,
                  { backgroundColor: isCheckedIn ? '#E93B81' : '#3B82F6' }
                ]}
                className="w-full h-full rounded-full items-center justify-center shadow-md"
                onPress={handleCheckInOut}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="gesture-tap" size={32} color="#FFFFFF" />
                <Text style={styles.circularButtonText} className="text-white font-bold text-base mt-1">
                  {isCheckedIn ? 'ออกงาน' : 'เข้างาน'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Three status indicators below */}
          <View style={styles.statusRow} className="flex-row w-full justify-around mt-4 bg-white/10 rounded-2xl p-3 m-3">
            <View style={styles.statusItem} className="items-center">
              <View style={styles.statusIconCircle} className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mb-1">
                <Ionicons name="log-in-outline" size={20} color="#10B981" />
              </View>
              <Text testID="home-checkin-time-text" style={styles.statusTime} className="text-sm font-bold text-slate-900">
                {checkInTime ? formatTime(checkInTime) : '--:--'}
              </Text>
              <Text style={styles.statusLabel} className="text-xs text-slate-500">เวลาเข้างาน</Text>
            </View>

            <View style={styles.statusItem} className="items-center">
              <View style={styles.statusIconCircle} className="w-10 h-10 rounded-full bg-rose-500/20 items-center justify-center mb-1">
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text testID="home-checkout-time-text" style={styles.statusTime} className="text-sm font-bold text-slate-900">
                {checkOutTime ? formatTime(checkOutTime) : '--:--'}
              </Text>
              <Text style={styles.statusLabel} className="text-xs text-slate-500">เวลาออกงาน</Text>
            </View>

            <View style={styles.statusItem} className="items-center">
              <View style={styles.statusIconCircle} className="w-10 h-10 rounded-full bg-sky-500/20 items-center justify-center mb-1">
                <Ionicons name="timer-outline" size={20} color="#0074C4" />
              </View>
              <Text testID="home-work-duration-text" style={styles.statusTime} className="text-sm font-bold text-[#0074C4]">
                {checkInTime ? getDuration() : '--:--:--'}
              </Text>
              <Text style={styles.statusLabel} className="text-xs text-slate-500">ระยะเวลาทำงาน</Text>
            </View>
          </View>
        </View>

        <Animated.View
          style={[
            styles.body,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
          className="px-4 pt-6 pb-8"
        >
          {/* Quick Actions Header */}
          <Text style={styles.sectionTitle} className="text-sm font-bold text-slate-800 mb-3 px-1 tracking-wide">⚡ เมนูด่วน</Text>

          {/* Shortcut Menu Container - Clean, Spacious & Perfectly Padded */}
          <View testID="home-quick-actions-menu" style={styles.menuRow}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                testID={`home-menu-item-${item.screen}`}
                key={index}
                style={styles.menuItem}
                onPress={() => item.screen && navigation.navigate(item.screen)}
                activeOpacity={0.75}
              >
                <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.menuLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ภารกิจที่ทำได้ตอนนี้ */}
          <View testID="home-quests-section" style={styles.sectionHeader} className="flex-row items-center justify-between mb-3 px-1">
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🎯 ภารกิจ</Text>
            <TouchableOpacity testID="home-quests-see-all-btn" onPress={() => navigation.navigate('Quests')}>
              <Text style={styles.seeAll}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {quests.length === 0 ? (
            <View style={[styles.questCard, { backgroundColor: theme.surface, borderColor: theme.border, alignItems: 'center', paddingVertical: 18 }]}>
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>ยังไม่มีภารกิจที่เปิดให้ทำในขณะนี้</Text>
            </View>
          ) : (
            quests.slice(0, 3).map((q) => (
              <TouchableOpacity
                testID={`home-quest-item-${q.id}`}
                key={q.id}
                style={[styles.questCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => navigation.navigate('QuestPlay', { questId: q.id, title: q.title })}
                activeOpacity={0.85}
              >
                <View style={styles.questHeader}>
                  <Text style={[styles.questTitle, { color: theme.text }]} numberOfLines={1}>{q.title}</Text>
                  <View style={styles.questPointsBadge}>
                    <Ionicons name="star" size={11} color="#D97706" />
                    <Text style={styles.questPointsText}>{q.totalPoints} แต้ม</Text>
                  </View>
                </View>
                {!!q.description && (
                  <Text style={[styles.questDesc, { color: theme.textSecondary }]} numberOfLines={2}>{q.description}</Text>
                )}
                <Text style={[styles.questTime, { color: theme.textSecondary }]}>
                  ต้องตอบถูก {q.passCount}/{q.questionCount} ข้อ · หมดเขต {q.endDate} {q.endTime}
                </Text>
              </TouchableOpacity>
            ))
          )}

        </Animated.View>
      </ScrollView>
      <PunchLocationModal
        visible={!!pickerKind}
        kind={pickerKind}
        onClose={() => setPickerKind(null)}
        onSelect={onLocationSelected}
      />
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
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Header Section
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  attendanceContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 56,
    marginTop: 4,
  },
  attendanceTopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    paddingTop: 24,
    paddingBottom: 68,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  timeTextLarge: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1F4C9C',
    letterSpacing: -1,
  },
  timeTextSeconds: {
    fontSize: 20,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  dashedDivider: {
    width: '80%',
    height: 1,
    borderWidth: 1,
    borderColor: '#E8EEF5',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  circularButtonOuterRing: {
    position: 'absolute',
    bottom: -48,
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E8EEF5',
  },
  circularButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  circularButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    paddingVertical: 16,
    marginTop: 12,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF2FA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  arrowIconOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    fontSize: 13,
    color: colors.link,
    fontWeight: '500',
    marginBottom: 12,
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    width: (width - 64) / 4,
    alignItems: 'center',
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    color: colors.title,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
  // Menu Row
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  menuIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Quests
  questCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  questHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  questTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
    flex: 1,
    marginRight: 8,
  },
  questPointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  questPointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  questDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  questTime: {
    fontSize: 11,
    color: colors.label,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: (width - 56) / 3,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
