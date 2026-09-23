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
import { missionStorage } from '../services/missionStorage';
import { tryFetchApi } from '../services/apiClient';
import TopNavbar from '../components/TopNavbar';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const quickActions = [
  { id: '1', icon: 'calendar-number-outline', label: 'ปฏิทิน', color: '#3B82F6' },
  { id: '2', icon: 'calendar-outline', label: 'ลางาน', color: '#10B981' },
  { id: '3', icon: 'document-text-outline', label: 'สลิป\nเงินเดือน', color: '#F59E0B' },
  { id: '4', icon: 'people-outline', label: 'ทีมงาน', color: '#7C3AED' },
];

const announcements = [
  {
    id: 'ann_1',
    category: 'ประกาศสำคัญ',
    categoryColor: '#1F4C9C',
    title: '📢 ประชุมทีม Q3 Planning & Strategy',
    desc: 'ขอเชิญชวนทีมงานทุกคนเข้าร่วมประชุม Q3 Planning ในวันศุกร์ที่ 25 ก.ค. เวลา 10:00 น. ณ ห้อง Meeting A เพื่อร่วมวางแผนเป้าหมายและยุทธศาสตร์หลักสำหรับไตรมาสที่ 3',
    time: '25 ก.ค. 2026',
    isNew: true,
    author: 'ฝ่ายบริหารและวางแผน',
  },
  {
    id: 'ann_2',
    category: 'โปรโมชั่น & กิจกรรม',
    categoryColor: '#D93A8B',
    title: '🎉 กิจกรรม Team Building พัทยา 2026',
    desc: 'ขอเชิญชวนพนักงานทุกคนเข้าร่วมกิจกรรม Team Building ประจำปี ณ โรงแรมดุสิตธานี พัทยา วันที่ 15-16 ส.ค. นี้ ฟรีตลอดงาน! สามารถลงทะเบียนได้แล้ววันนี้',
    time: '24 ก.ค. 2026',
    isNew: false,
    author: 'ฝ่ายทรัพยากรบุคคล (HR)',
  },
  {
    id: 'ann_3',
    category: 'อัปเดตระบบ',
    categoryColor: '#3AAAE8',
    title: '📢 ประกาศปิดปรับปรุงระบบประจำเดือน',
    desc: 'ระบบจะทำการปิดปรับปรุงชั่วคราวเพื่ออัปเกรดประสิทธิภาพในวันเสาร์ที่ 2 สิงหาคม เวลา 22:00 - 02:00 น. กรุณาวางแผนการใช้งานล่วงหน้า',
    time: '26 ก.ค. 2026',
    isNew: false,
    author: 'ฝ่ายไอทีและระบบ',
  },
];

const menuItems = [
  { icon: 'calendar-outline', label: 'ปฏิทิน', color: '#27AE60', screen: 'TimeAttendance' },
  { icon: 'calendar-outline', label: 'ลางาน', color: '#F5A623', screen: 'LeaveRequest' },
  { icon: 'document-text-outline', label: 'สลิปเงินเดือน', color: '#9B59B6', screen: 'Payslip' },
  { icon: 'people-outline', label: 'ทีมงาน', color: '#7C3AED', screen: 'EmployeeDirectory' },
  { icon: 'sync-outline', label: 'ปรับเวลา', color: '#00B8D4', screen: 'TimeCorrection' },
];

export default function HomeScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendance, setAttendance] = useState(attendanceStorage.getState());
  const [unreadCount, setUnreadCount] = useState(notificationStorage.getUnreadCount());

  // Live mission data from shared storage — first 3 daily missions for home
  const [liveMissions, setLiveMissions] = useState(
    missionStorage.getMissions().filter((m) => m.category === 'daily').slice(0, 3)
  );

  useFocusEffect(
    useCallback(() => {
      setLiveMissions(
        missionStorage.getMissions().filter((m) => m.category === 'daily').slice(0, 3)
      );
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

    // Subscribe to mission storage
    const unsubscribeMission = missionStorage.subscribe((list) => {
      setLiveMissions((list || []).filter((m) => m.category === 'daily').slice(0, 3));
    });

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      unsubscribeAttendance();
      unsubscribeNotif();
      unsubscribeMission();
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

    const diff = Math.max(0, Math.floor((endDate - startDate) / 1000)); // seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateWorkRules = (checkInDateObj, checkOutDateObj) => {
    const checkIn = checkInDateObj instanceof Date ? checkInDateObj : new Date(checkInDateObj);
    const checkOut = checkOutDateObj instanceof Date ? checkOutDateObj : new Date(checkOutDateObj);

    // 1. Start counting at 08:00 AM of that day
    const effectiveStart = new Date(checkIn);
    if (effectiveStart.getHours() < 8) {
      effectiveStart.setHours(8, 0, 0, 0);
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
    const isLate = inHour > 9 || (inHour === 9 && inMin > 0);

    // 4. Incomplete Hours Check (Must be at least 8 hours minus 15 min tolerance = 27,900 seconds)
    const isIncompleteHours = diffInSeconds < (8 * 3600 - 900);

    let status = 'ลงเวลาเข้า-ออกครบถ้วน';
    let isIncomplete = false;
    let statusColor = '#27AE60'; // Green

    if (isLate && isIncompleteHours) {
      status = 'เข้างานสาย และ ทำงานไม่ครบเวลา';
      isIncomplete = true;
      statusColor = '#EF4444'; // Red
    } else if (isLate) {
      status = 'เข้างานสาย';
      isIncomplete = true;
      statusColor = '#EF4444'; // Red
    } else if (isIncompleteHours) {
      status = 'ทำงานไม่ครบเวลา (ออกก่อนกำหนด / น้อยกว่า 4 ชม.)';
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

  const handleCheckInOut = () => {
    const state = attendanceStorage.getState();
    const now = new Date();
    const formattedTimeStr = formatTime(now) + ' น.';
    const formattedDateStr = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const dateIsoStr = now.toISOString().split('T')[0];
    const dayThaiStr = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (!state.isCheckedIn) {
      // 🟢 กดเข้างาน (Check In หรือ กดเข้างานรอบใหม่ -> รีเซ็ตเวลาและเริ่มนับใหม่)
      attendanceStorage.addPunchLog('check_in', formattedTimeStr, formattedDateStr);

      attendanceStorage.setState({
        isCheckedIn: true,
        checkInTime: now,
        checkOutTime: null,
      });

      try {
        tryFetchApi('/attendance/clock-in', {
          method: 'POST',
          body: JSON.stringify({
            latitude: 13.7563,
            longitude: 100.5018,
            locationName: 'อาคารสำนักงานใหญ่ WellX989',
          }),
        });
      } catch (e) {}

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

      try {
        tryFetchApi('/attendance/clock-out', {
          method: 'POST',
          body: JSON.stringify({
            latitude: 13.7563,
            longitude: 100.5018,
            locationName: 'อาคารสำนักงานใหญ่ WellX989',
          }),
        });
      } catch (e) {}

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
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
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
          {/* Mockup Attendance Card */}
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
          <View style={styles.statusMockRow} className="flex-row w-full justify-around mt-4 bg-white/10 rounded-2xl p-3 m-3">
            <View style={styles.statusMockItem} className="items-center">
              <View style={styles.statusMockIconCircle} className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mb-1">
                <Ionicons name="log-in-outline" size={20} color="#10B981" />
              </View>
              <Text testID="home-checkin-time-text" style={styles.statusMockTime} className="text-sm font-bold text-slate-900">
                {checkInTime ? formatTime(checkInTime) : '--:--'}
              </Text>
              <Text style={styles.statusMockLabel} className="text-xs text-slate-500">เวลาเข้างาน</Text>
            </View>

            <View style={styles.statusMockItem} className="items-center">
              <View style={styles.statusMockIconCircle} className="w-10 h-10 rounded-full bg-rose-500/20 items-center justify-center mb-1">
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text testID="home-checkout-time-text" style={styles.statusMockTime} className="text-sm font-bold text-slate-900">
                {checkOutTime ? formatTime(checkOutTime) : '--:--'}
              </Text>
              <Text style={styles.statusMockLabel} className="text-xs text-slate-500">เวลาออกงาน</Text>
            </View>

            <View style={styles.statusMockItem} className="items-center">
              <View style={styles.statusMockIconCircle} className="w-10 h-10 rounded-full bg-sky-500/20 items-center justify-center mb-1">
                <Ionicons name="timer-outline" size={20} color="#0074C4" />
              </View>
              <Text testID="home-work-duration-text" style={styles.statusMockTime} className="text-sm font-bold text-[#0074C4]">
                {checkInTime ? getDuration() : '--:--:--'}
              </Text>
              <Text style={styles.statusMockLabel} className="text-xs text-slate-500">ระยะเวลาทำงาน</Text>
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

          {/* ประกาศ / โปรโมท */}
          <View testID="home-announcements-section" style={styles.sectionHeader} className="flex-row items-center justify-between mb-3 px-1">
            <Text style={styles.sectionTitle} className="text-base font-bold text-slate-800">📌 ประกาศ / โปรโมท</Text>
            <TouchableOpacity testID="home-announcements-see-all-btn" onPress={() => navigation.navigate('Announcements', { selectedAnnouncement: null })}>
              <Text style={styles.seeAll} className="text-xs font-semibold text-primary">ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {announcements.map((item) => (
            <TouchableOpacity
              testID={`home-announcement-item-${item.id}`}
              key={item.id}
              style={styles.announcementCard}
              className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 shadow-sm"
              onPress={() => navigation.navigate('Announcements', { selectedAnnouncement: item, openTimestamp: Date.now(), fromHome: true })}
              activeOpacity={0.85}
            >
              <View style={styles.announcementHeader} className="flex-row items-center justify-between mb-2">
                <Text style={styles.announcementTitle} className="text-sm font-bold text-slate-900 flex-1 mr-2">{item.title}</Text>
                {item.isNew && (
                  <View style={styles.newBadge} className="bg-pink-light border border-pink px-2 py-0.5 rounded-full">
                    <Text style={styles.newBadgeText} className="text-[10px] font-bold text-pink">ใหม่</Text>
                  </View>
                )}
              </View>
              <Text style={styles.announcementDesc} className="text-xs text-slate-500 mb-2 leading-4" numberOfLines={2}>{item.desc}</Text>
              <Text style={styles.announcementTime} className="text-[11px] text-slate-400">{item.time}</Text>
            </TouchableOpacity>
          ))}

          {/* 🎯 ภารกิจสะสมแต้มประจำวัน */}
          <View testID="home-missions-section" style={[styles.sectionHeader, { marginTop: 16 }]} className="flex-row items-center justify-between mb-3 px-1 mt-4">
            <Text style={styles.sectionTitle} className="text-base font-bold text-slate-800">🎯 ภารกิจสะสมแต้มประจำวัน</Text>
            <TouchableOpacity testID="home-missions-see-all-btn" onPress={() => navigation.navigate('Missions')}>
              <Text style={styles.seeAll} className="text-xs font-semibold text-primary">ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {liveMissions.map((item) => {
            const isCompleted = item.status === 'completed';
            const isReady = item.status === 'ready_to_claim';
            const statusLabel = isCompleted ? 'เสร็จสิ้น' : isReady ? 'รับรางวัล' : 'เริ่มทำ';
            const statusColor = isCompleted ? '#10B981' : isReady ? '#F5A623' : '#1F4C9C';
            return (
              <TouchableOpacity
                testID={`home-mission-item-${item.id}`}
                key={item.id}
                style={[styles.announcementCard, { paddingVertical: 12, opacity: isCompleted ? 0.7 : 1 }]}
                className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 shadow-sm"
                onPress={() => {
                  if (isCompleted) {
                    navigation.navigate('Missions');
                  } else {
                    navigation.navigate('Missions', { targetMissionId: item.id, openTimestamp: Date.now() });
                  }
                }}
                activeOpacity={isCompleted ? 0.9 : 0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item.bgColor, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={item.icon} size={22} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }} numberOfLines={1}>{item.subtitle}</Text>
                  </View>
                  <View style={{ backgroundColor: statusColor + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: statusColor + '40' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: statusColor }}>{statusLabel}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

        </Animated.View>
      </ScrollView>
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
  statusMockRow: {
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
  statusMockItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusMockIconCircle: {
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
  statusMockTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 2,
  },
  statusMockLabel: {
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
  // Announcements
  announcementCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
    flex: 1,
  },
  newBadge: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.error,
  },
  announcementDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  announcementTime: {
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
