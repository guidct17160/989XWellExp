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
import { authService } from '../services/authService';

import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const hrMenuItems = [
  { icon: 'shield-checkmark-outline', labelKey: 'approval', label: 'อนุมัติคำขอ', color: '#3B82F6', screen: 'ManagerApproval' },
  { icon: 'checkmark-circle-outline', labelKey: 'requestStatus', label: 'สถานะคำขอ', color: '#F5A623', screen: 'RequestStatus' },
  { icon: 'people-outline', labelKey: 'team', label: 'สมุดรายชื่อทีมงาน', color: '#7C3AED', screen: 'EmployeeDirectory' },
  { icon: 'calendar-outline', labelKey: 'leave', label: 'ลางาน', color: '#27AE60', screen: 'LeaveRequest' },
  { icon: 'sync-outline', labelKey: 'timeCorrection', label: 'ปรับปรุงเวลา', color: '#27AE60', screen: 'TimeCorrection' },
];

// Mirrors backend requireApprover roles (backend/src/middlewares/authMiddleware.js)
const APPROVER_ROLES = new Set([
  'admin', 'super admin', 'superadmin', 'hr admin', 'system admin', 'sys admin',
  'hr', 'manager', 'boss', 'superboss', 'super boss', 'supervisor', 'head', 'ceo', 'director',
]);
const isApprover = (role) => APPROVER_ROLES.has(String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' '));

export default function HRDashboardScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);
  const { theme, t } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView testID="screen-hr-dashboard" className="flex-1" style={[styles.safeArea, { backgroundColor: theme.card }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBg} />
      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title={t('hr', 'HR Suite')} />
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        className="flex-1"
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
          {/* Section Divider & Menu Title */}
          <Text style={[styles.sectionHeaderTitle, { color: theme.text, marginTop: 4, marginBottom: 12 }]}>
            ⚡ {t('quickActions', 'บริการและฟังก์ชันการจัดการ')}
          </Text>

          {/* HR Menu Grid */}
          <View testID="hr-menu-grid" style={styles.menuGrid} className="flex-row flex-wrap justify-between">
            {hrMenuItems
              .filter((item) => item.screen !== 'ManagerApproval' || isApprover(authService.getUser()?.role))
              .map((item, index) => (
              <TouchableOpacity
                testID={`hr-menu-item-${item.screen}`}
                key={index}
                style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                className="w-[48%] rounded-2xl p-4 mb-4 items-center justify-center border shadow-sm"
                onPress={() => item.screen && navigation.navigate(item.screen, item.params)}
              >
                <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]} className="w-16 h-16 rounded-2xl items-center justify-center mb-3">
                  <Ionicons name={item.icon} size={32} color={item.color} />
                </View>
                <Text style={[styles.menuLabel, { color: theme.text }]} className="text-sm font-bold text-center">
                  {t(item.labelKey, item.label)}
                </Text>
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
