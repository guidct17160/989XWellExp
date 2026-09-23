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

const { width } = Dimensions.get('window');

const hrMenuItems = [
  { icon: 'shield-checkmark-outline', label: 'อนุมัติคำขอ', color: '#3B82F6', screen: 'ManagerApproval', badge: 'อนุมัติ' },
  { icon: 'checkmark-circle-outline', label: 'สถานะคำขอ', color: '#F5A623', screen: 'RequestStatus' },
  { icon: 'calendar-outline', label: 'ลางาน', color: '#27AE60', screen: 'LeaveRequest' },
  { icon: 'document-text-outline', label: 'สลิปเงินเดือน', color: '#9B59B6', screen: 'Payslip' },
  { icon: 'heart-outline', label: 'ขอ OT / สวัสดิการ', color: '#E24C4B', screen: 'OtRequest' },
  { icon: 'sync-outline', label: 'ปรับปรุงเวลา', color: '#27AE60', screen: 'TimeCorrection' },
];

// const quickStats = [
//   { label: 'วันลาคงเหลือ', value: '12', unit: 'วัน', color: '#27AE60', icon: 'calendar' },
//   { label: 'สลิปเดือนนี้', value: 'พร้อม', color: '#4A90D9', icon: 'document-text' },
//   { label: 'รายการรออนุมัติ', value: '2', unit: 'รายการ', color: '#F5A623', icon: 'time' },
// ];

export default function HRDashboardScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.title,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: (width - 48) / 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  statUnit: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  // Menu Grid
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
  },
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
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  menuIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  menuBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  menuLabel: {
    fontSize: 15,
    color: colors.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Personal Info Button
  personalInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  personalInfoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
