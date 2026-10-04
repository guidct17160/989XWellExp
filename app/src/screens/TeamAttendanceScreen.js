import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { tryFetchApi } from '../services/apiClient';

const { width } = Dimensions.get('window');

const MOCK_ATTENDANCE = [
  {
    id: 'EMP-001',
    code: 'EMP-001',
    name: 'สมชาย พัฒนาการ',
    position: 'Senior Software Engineer',
    department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
    clockInTime: '08:42 น.',
    clockOutTime: null,
    status: 'ปกติ',
    statusColor: '#10B981',
    location: 'อาคารสำนักงานใหญ่ (HQ)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'EMP-002',
    code: 'EMP-002',
    name: 'กานดา วงศ์สุวรรณ',
    position: 'HR Specialist',
    department: 'ฝ่ายทรัพยากรบุคคล (HR)',
    clockInTime: '08:15 น.',
    clockOutTime: null,
    status: 'ปกติ',
    statusColor: '#10B981',
    location: 'อาคารสำนักงานใหญ่ (HQ)',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
  {
    id: 'EMP-003',
    code: 'EMP-003',
    name: 'วรพจน์ จิตเที่ยง',
    position: 'Mobile Developer',
    department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
    clockInTime: '09:28 น.',
    clockOutTime: null,
    status: 'เข้างานสาย',
    statusColor: '#EF4444',
    location: 'อาคารสำนักงานใหญ่ (HQ)',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    id: 'EMP-004',
    code: 'EMP-004',
    name: 'พัชรี เลิศปัญญา',
    position: 'Marketing Specialist',
    department: 'ฝ่ายการตลาด (Marketing)',
    clockInTime: '-',
    clockOutTime: null,
    status: 'ลางาน (ลาพักร้อน)',
    statusColor: '#3B82F6',
    location: 'ลางานเต็มวัน',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
  },
  {
    id: 'EMP-005',
    code: 'EMP-005',
    name: 'ธีรศักดิ์ มั่งคั่ง',
    position: 'Senior Accountant',
    department: 'ฝ่ายบัญชีและการเงิน (Finance)',
    clockInTime: '08:50 น.',
    clockOutTime: null,
    status: 'ปกติ',
    statusColor: '#10B981',
    location: 'Work From Home (WFH)',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  },
  {
    id: 'EMP-006',
    code: 'EMP-006',
    name: 'สุภาวดี ชูใจ',
    position: 'Operations Officer',
    department: 'ฝ่ายปฏิบัติการ (Operations)',
    clockInTime: '-',
    clockOutTime: null,
    status: 'ยังไม่ลงเวลา',
    statusColor: '#94A3B8',
    location: 'รอดำเนินการ',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
];

const STATUS_FILTERS = ['ทั้งหมด', 'เข้างานแล้ว', 'สาย', 'ลางาน', 'ยังไม่ลงเวลา'];

export default function TeamAttendanceScreen({ navigation }) {
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    fetchTeamAttendance();
  }, []);

  const fetchTeamAttendance = async () => {
    setLoading(true);
    try {
      const res = await tryFetchApi('/hr/reports/attendance');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.report)) {
          if (data.report.length > 0) {
            const mapped = data.report.map((item, idx) => ({
              id: item.employeeId || `EMP-${idx}`,
              code: item.employeeCode || `EMP-${idx}`,
              name: item.employeeName || item.name || 'พนักงาน',
              position: item.position || 'พนักงาน',
              department: item.department || 'ทั่วไป',
              clockInTime: item.clockIn || item.time || '-',
              clockOutTime: item.clockOut || null,
              status: item.isLate ? 'เข้างานสาย' : (item.clockIn ? 'ปกติ' : 'ยังไม่ลงเวลา'),
              statusColor: item.isLate ? '#EF4444' : (item.clockIn ? '#10B981' : '#94A3B8'),
              location: item.location || 'อาคารสำนักงานใหญ่ (HQ)',
              avatarUrl: item.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            }));
            setAttendanceList(mapped);
          } else {
            setAttendanceList([]);
          }
        }
      }
    } catch (e) {
      console.log('Error fetching team attendance from Real DB:', e);
      if (attendanceList.length === 0) {
        setAttendanceList(MOCK_ATTENDANCE);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTeamAttendance();
  }, []);

  const onTimeCount = attendanceList.filter((a) => a.status === 'ปกติ').length;
  const lateCount = attendanceList.filter((a) => a.status === 'เข้างานสาย').length;
  const leaveCount = attendanceList.filter((a) => a.status.includes('ลางาน')).length;
  const missingCount = attendanceList.filter((a) => a.status === 'ยังไม่ลงเวลา').length;

  const filteredList = attendanceList.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q)) ||
      (item.position && item.position.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (selectedStatus === 'ทั้งหมด') return true;
    if (selectedStatus === 'เข้างานแล้ว') return item.status === 'ปกติ' || item.status === 'เข้างานสาย';
    if (selectedStatus === 'สาย') return item.status === 'เข้างานสาย';
    if (selectedStatus === 'ลางาน') return item.status.includes('ลางาน');
    if (selectedStatus === 'ยังไม่ลงเวลา') return item.status === 'ยังไม่ลงเวลา';
    return true;
  });

  const todayStr = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaView testID="screen-team-attendance" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="btn-back-team-attendance"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>เวลาเข้างานของทีม</Text>
          <Text style={styles.headerSubtitle}>{todayStr}</Text>
        </View>
      </View>

      {/* KPI Stats Summary Card Row */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.kpiNumber}>{onTimeCount}</Text>
          <Text style={styles.kpiLabel}>ตรงเวลา</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.kpiNumber, { color: '#EF4444' }]}>{lateCount}</Text>
          <Text style={styles.kpiLabel}>สาย</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={[styles.kpiNumber, { color: '#3B82F6' }]}>{leaveCount}</Text>
          <Text style={styles.kpiLabel}>ลางาน</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiDot, { backgroundColor: '#94A3B8' }]} />
          <Text style={[styles.kpiNumber, { color: '#64748B' }]}>{missingCount}</Text>
          <Text style={styles.kpiLabel}>ยังไม่ลง</Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            testID="team-attendance-search-input"
            style={styles.searchInput}
            placeholder="ค้นหาชื่อ, ตำแหน่ง หรือฝ่าย..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {STATUS_FILTERS.map((status) => {
            const isSelected = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                testID={`status-filter-${status}`}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedStatus(status)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Attendance Records List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {filteredList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={56} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>ไม่พบข้อมูลการลงเวลา</Text>
            <Text style={styles.emptyDesc}>ไม่มีรายชื่อตามเงื่อนไขตัวกรองที่คุณเลือก</Text>
          </View>
        ) : (
          filteredList.map((item) => (
            <View key={item.id || item.code} style={styles.attendanceCard}>
              <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              <View style={styles.infoCol}>
                <View style={styles.nameHeader}>
                  <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.statusColor + '18' }]}>
                    <Text style={[styles.statusBadgeText, { color: item.statusColor }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.posText} numberOfLines={1}>{item.position} • {item.department}</Text>
                
                <View style={styles.footerRow}>
                  <View style={styles.timeTag}>
                    <Ionicons name="log-in-outline" size={14} color="#0F172A" />
                    <Text style={styles.timeTagText}>เข้างาน: {item.clockInTime}</Text>
                  </View>
                  <View style={styles.locTag}>
                    <Ionicons name="location-outline" size={13} color="#64748B" />
                    <Text style={styles.locTagText} numberOfLines={1}>{item.location}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  header: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  kpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  attendanceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  nameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  posText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  locTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '45%',
  },
  locTagText: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});
