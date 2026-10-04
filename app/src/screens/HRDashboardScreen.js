import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';

const { width } = Dimensions.get('window');

const hrMenuItems = [
  { icon: 'shield-checkmark-outline', label: 'อนุมัติคำขอ', color: '#3B82F6', screen: 'ManagerApproval', badge: 'อนุมัติ' },
  { icon: 'checkmark-circle-outline', label: 'สถานะคำขอ', color: '#F5A623', screen: 'RequestStatus' },
  { icon: 'people-outline', label: 'สมุดรายชื่อทีมงาน', color: '#7C3AED', screen: 'EmployeeDirectory', badge: 'ใหม่' },
  { icon: 'time-outline', label: 'เวลาของทีม', color: '#0EA5E9', screen: 'TeamAttendance', badge: 'สด' },
  { icon: 'calendar-outline', label: 'ลางาน', color: '#27AE60', screen: 'LeaveRequest' },
  { icon: 'document-text-outline', label: 'สลิปเงินเดือน', color: '#9B59B6', screen: 'Payslip' },
  { icon: 'heart-outline', label: 'ขอ OT / สวัสดิการ', color: '#E24C4B', screen: 'OtRequest' },
  { icon: 'sync-outline', label: 'ปรับปรุงเวลา', color: '#27AE60', screen: 'TimeCorrection' },
];

export default function HRDashboardScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 6,
    onTimeRate: '98%',
    pendingCount: 0,
    leaveBalance: 12,
  });

  const fetchLiveStats = async () => {
    try {
      const [dashRes, leaveRes, pendingRes] = await Promise.all([
        tryFetchApi('/hr/dashboard/stats'),
        tryFetchApi('/leaves/balances'),
        tryFetchApi('/approvals/pending'),
      ]);

      const updates = {};

      if (dashRes && dashRes.ok) {
        const dData = await dashRes.json();
        if (dData && dData.stats) {
          if (dData.stats.totalEmployees) updates.totalEmployees = dData.stats.totalEmployees;
          if (dData.stats.onTimeRate) updates.onTimeRate = dData.stats.onTimeRate;
        }
      }

      if (leaveRes && leaveRes.ok) {
        const lData = await leaveRes.json();
        if (lData && lData.balances) {
          const annual = lData.balances.find((b) => b.type === 'annual' || b.type === 'พักร้อน');
          if (annual) updates.leaveBalance = annual.remaining || annual.quota || 12;
        }
      }

      if (pendingRes && pendingRes.ok) {
        const pData = await pendingRes.json();
        if (pData && Array.isArray(pData.approvals)) {
          updates.pendingCount = pData.approvals.length;
        }
      }

      if (Object.keys(updates).length > 0) {
        setStats((prev) => ({ ...prev, ...updates }));
      }
    } catch (e) {
      console.log('Error fetching HR live stats:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLiveStats();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    fetchLiveStats();
  }, []);

  return (
    <SafeAreaView testID="screen-hr-dashboard" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      {/* Top Navbar */}
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
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        <Animated.View style={[styles.body, { opacity: fadeAnim }]} className="p-4">
          {/* HR Live Overview Stats Header */}
          <Text style={styles.sectionHeaderTitle}>📊 สรุปภาพรวม HR & สถิติ</Text>
          <View testID="hr-live-stats-row" style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people" size={18} color="#2563EB" />
              </View>
              <Text style={styles.statValue}>{stats.totalEmployees}</Text>
              <Text style={styles.statLabel}>พนักงานทั้งหมด</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-done" size={18} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.onTimeRate}</Text>
              <Text style={styles.statLabel}>ตรงเวลาวันนี้</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="hourglass" size={18} color="#D97706" />
              </View>
              <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.pendingCount}</Text>
              <Text style={styles.statLabel}>รอการอนุมัติ</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBadge, { backgroundColor: '#FDF4FF' }]}>
                <Ionicons name="calendar" size={18} color="#A855F7" />
              </View>
              <Text style={[styles.statValue, { color: '#A855F7' }]}>{stats.leaveBalance}</Text>
              <Text style={styles.statLabel}>วันลาพักร้อน</Text>
            </View>
          </View>

          {/* Section Divider & Menu Title */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 12 }]}>⚡ บริการและฟังก์ชันการจัดการ</Text>

          {/* HR Menu Grid */}
          <View testID="hr-menu-grid" style={styles.menuGrid} className="flex-row flex-wrap justify-between">
            {hrMenuItems.map((item, index) => (
              <TouchableOpacity
                testID={`hr-menu-item-${item.screen}`}
                key={index}
                style={styles.menuCard}
                className="w-[48%] bg-white rounded-2xl p-4 mb-4 items-center justify-center border border-slate-100 shadow-sm"
                onPress={() => item.screen && navigation.navigate(item.screen, item.params)}
              >
                <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]} className="w-16 h-16 rounded-2xl items-center justify-center mb-3">
                  <Ionicons name={item.icon} size={32} color={item.color} />
                  {item.badge && (
                    <View style={styles.menuBadge} className="absolute -top-1 -right-1 bg-pink px-1.5 py-0.5 rounded-full">
                      <Text style={styles.menuBadgeText} className="text-[10px] font-bold text-white">{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuLabel} className="text-sm font-bold text-slate-800 text-center">{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  // Menu Grid
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  menuIconBg: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  menuBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  menuLabel: {
    fontSize: 13,
    color: colors.title,
    fontWeight: '700',
    textAlign: 'center',
  },
});
