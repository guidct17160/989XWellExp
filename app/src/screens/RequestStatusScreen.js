import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { leaveStorage } from '../services/leaveStorage';
import { tryFetchApi } from '../services/apiClient';
import TopNavbar from '../components/TopNavbar';

const { width } = Dimensions.get('window');

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function RequestStatusScreen({ navigation }) {
  const [leaveState, setLeaveState] = useState(leaveStorage.getState());
  const [refreshing, setRefreshing] = useState(false);

  const [activeStatus, setActiveStatus] = useState('all'); // 'all' | 'รออนุมัติ' | 'อนุมัติ' | 'ไม่อนุมัติ'
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());

  const syncAllRequests = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        leaveStorage.clearAndSync ? leaveStorage.clearAndSync() : Promise.resolve(),
      ]);
      setLeaveState(leaveStorage.getState());
    } catch (e) {
      console.log('Error syncing requests:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      syncAllRequests();
    }, [])
  );

  useEffect(() => {
    const unsubLeave = leaveStorage.subscribe((state) => setLeaveState(state));
    return () => {
      unsubLeave();
    };
  }, []);

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

  // Leave and time-correction history
  const leaveList = (leaveState.leaveHistory || []).map(item => ({
    ...item,
    categoryKey: item.typeId === 'time_correction' || item.type === 'ปรับปรุงเวลางาน' || item.categoryKey === 'correction' ? 'correction' : 'leave',
    categoryName: item.typeId === 'time_correction' || item.type === 'ปรับปรุงเวลางาน' || item.categoryKey === 'correction' ? 'ปรับปรุงเวลา' : 'ลางาน',
  }));

  const combinedList = [...leaveList];

  const parseItemDate = (item) => {
    const dateStr = item.start || item.end || item.createdAt;
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length >= 3) {
        return { month: parseInt(parts[1], 10) - 1, year: parseInt(parts[0], 10) };
      }
    }
    return { month: activeMonth, year: activeYear };
  };

  const matchesStatus = (itemStatus, targetFilter) => {
    const s = String(itemStatus || 'รออนุมัติ').trim();
    if (targetFilter === 'all') return true;
    if (targetFilter === 'รออนุมัติ') return s.includes('รอ');
    if (targetFilter === 'อนุมัติ') return s.includes('อนุมัติ') && !s.includes('รอ') && !s.includes('ไม่');
    if (targetFilter === 'ไม่อนุมัติ') return s.includes('ไม่อนุมัติ') || s.includes('ปฏิเสธ');
    return true;
  };

  const filteredList = combinedList.filter(item => {
    // Status filter
    if (!matchesStatus(item.status, activeStatus)) {
      return false;
    }

    // Month & Year filter
    const { month, year } = parseItemDate(item);
    return month === activeMonth && year === activeYear;
  });

  return (
    <SafeAreaView testID="screen-request-status" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="สถานะคำขอ" showBack />

      <View style={styles.container} className="flex-1 bg-slate-50">
        {/* Status Sub-tabs (iOS-style Segmented Controller) */}
        <View testID="request-status-status-filter" style={styles.statusTabRow}>
          {[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'รออนุมัติ', label: 'รออนุมัติ' },
            { key: 'อนุมัติ', label: 'อนุมัติ' },
            { key: 'ไม่อนุมัติ', label: 'ไม่อนุมัติ' },
          ].map(st => {
            const isActive = activeStatus === st.key;
            return (
              <TouchableOpacity
                testID={`request-status-st-${st.key}`}
                key={st.key}
                style={[
                  styles.statusTab,
                  isActive && styles.statusTabActive
                ]}
                onPress={() => setActiveStatus(st.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    isActive && styles.statusTabTextActive
                  ]}
                >
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Month Navigator Header */}
        <View testID="request-status-month-nav" style={styles.monthNavigator}>
          <TouchableOpacity
            testID="request-status-prev-month-btn"
            style={styles.navArrow}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.monthLabel}>
            <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.navMonthText}>{thaiMonths[activeMonth]} {activeYear + 543}</Text>
          </View>

          <TouchableOpacity
            testID="request-status-next-month-btn"
            style={styles.navArrow}
            onPress={handleNextMonth}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <ScrollView
          testID="request-status-list"
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={syncAllRequests}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {filteredList.length === 0 ? (
            <View style={styles.emptyContainer} className="items-center justify-center py-12">
              <View style={styles.documentIllustration}>
                <View style={styles.docLineShort} />
                <View style={styles.docLineLong} />
                <View style={styles.docLineLong} />
                <View style={styles.docLineLong} />
                <View style={styles.questionCircle}>
                  <Text style={styles.questionMarkText}>?</Text>
                </View>
              </View>
              <Text style={styles.emptyText}>ไม่มีรายการคำขอในเดือนนี้</Text>
            </View>
          ) : (
            filteredList.map((item, index) => {
              const rawStatus = item.status || 'รออนุมัติ';
              const isApproved = rawStatus.includes('อนุมัติ') && !rawStatus.includes('รอ') && !rawStatus.includes('ไม่');
              const isRejected = rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('ปฏิเสธ');
              const statusLabel = isApproved ? 'อนุมัติแล้ว' : isRejected ? 'ไม่อนุมัติ' : rawStatus;

              const statusBg = isApproved
                ? '#10B98118'
                : isRejected
                ? '#EF444418'
                : '#F5A62318';
              const statusColor = isApproved
                ? '#10B981'
                : isRejected
                ? '#EF4444'
                : '#F5A623';

              const isTimeCorrection =
                item.categoryKey === 'correction' ||
                item.typeId === 'time_correction' ||
                item.type === 'ปรับปรุงเวลางาน' ||
                item.type === 'ปรับปรุงเวลาเข้า-ออกงาน';

              return (
                <View key={`req_${item.categoryKey || item.typeId || 'cat'}_${item.id}_${index}`} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: isTimeCorrection ? '#E0F7FA' : colors.primaryLight },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryBadgeText,
                            { color: isTimeCorrection ? '#00838F' : colors.primary },
                          ]}
                        >
                          {isTimeCorrection ? 'ปรับปรุงเวลา' : item.categoryName}
                        </Text>
                      </View>
                      <Text style={styles.cardType}>
                        {isTimeCorrection ? 'ปรับปรุงเวลาเข้า-ออกงาน' : item.type}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDetail}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.detailText}>{item.dates}</Text>
                  </View>

                  {isTimeCorrection ? (
                    <View style={styles.cardDetail}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.detailText, { fontWeight: '700', color: colors.title }]}>
                        เวลาเข้า: {item.inTime || '09:00 น.'}  |  เวลาออก: {item.outTime || '18:00 น.'}
                      </Text>
                    </View>
                  ) : item.days ? (
                    <View style={styles.cardDetail}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.detailText}>
                        {typeof item.days === 'number' ? `${item.days} วัน` : item.days}
                      </Text>
                    </View>
                  ) : item.hours ? (
                    <View style={styles.cardDetail}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.detailText}>{item.hours} ชั่วโมง</Text>
                    </View>
                  ) : null}

                  {item.reason ? (
                    <View style={[styles.cardDetail, { marginTop: 6 }]}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.detailText, { fontStyle: 'italic' }]}>
                        {isTimeCorrection ? `เหตุผลการขอปรับปรุง: ${item.reason}` : `เหตุผล: ${item.reason}`}
                      </Text>
                    </View>
                  ) : null}

                  {item.approver ? (
                    <View style={[styles.cardDetail, { marginTop: 6 }]}>
                      <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailText, { color: '#10B981', fontWeight: '600' }]}>
                        ผู้อนุมัติ: {item.approver}
                      </Text>
                    </View>
                  ) : null}

                  {item.remark ? (
                    <View style={[styles.cardDetail, { marginTop: 4 }]}>
                      <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        หมายเหตุ: {item.remark}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  statusTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  statusTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMonthText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 100,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  cardType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  documentIllustration: {
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#B0B5C0',
    paddingTop: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    marginBottom: 16,
  },
  docLineShort: {
    width: '40%',
    height: 3,
    backgroundColor: '#D1D5DB',
    borderRadius: 1.5,
    marginBottom: 6,
  },
  docLineLong: {
    width: '100%',
    height: 3,
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#3B82F6',
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
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});
