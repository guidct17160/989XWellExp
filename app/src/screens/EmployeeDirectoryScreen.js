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
  Linking,
  Modal,
  RefreshControl,
  Animated,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { tryFetchApi } from '../services/apiClient';
import { navigationHistory } from '../services/navigationHistory';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export default function EmployeeDirectoryScreen({ navigation }) {
  const { theme, t } = useTheme();
  const currentUser = authService.getUser();
  const userDept = currentUser?.department || 'IT';

  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await tryFetchApi('/employees');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.employees)) {
          const serverList = data.employees.map((emp) => ({
            ...emp,
            avatarUrl: emp.avatarUrl || emp.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            phone: emp.phone || '-',
            email: emp.email || '-',
          }));
          setEmployees(serverList);
        }
      }
    } catch (e) {
      console.log('Error fetching employees:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEmployees();
  }, []);

  const handleCall = (phone) => {
    if (!phone || phone === '-') {
      Alert.alert('แจ้งเตือน', 'ไม่พบหมายเลขโทรศัพท์ของพนักงานท่านนี้');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('แจ้งเตือน', `ไม่สามารถโทรออกไปยังหมายเลข ${phone} ได้`);
    });
  };

  const handleEmail = (email) => {
    if (!email || email === '-') {
      Alert.alert('แจ้งเตือน', 'ไม่พบอีเมลของพนักงานท่านนี้');
      return;
    }
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('แจ้งเตือน', `ไม่สามารถเปิดแอปอีเมลสำหรับ ${email} ได้`);
    });
  };

  // Filter strictly by the current user's department (only members of our department are shown)
  const filteredEmployees = employees.filter((emp) => {
    const empDept = String(emp.department || '').toLowerCase().trim();
    const targetDept = String(userDept).toLowerCase().trim();
    const isSameDept = !!empDept && !!targetDept && (empDept.includes(targetDept) || targetDept.includes(empDept) || empDept === targetDept);
    if (!isSameDept) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = emp.name && emp.name.toLowerCase().includes(q);
    const codeMatch = emp.code && emp.code.toLowerCase().includes(q);
    const posMatch = emp.position && emp.position.toLowerCase().includes(q);
    return nameMatch || codeMatch || posMatch;
  });

  return (
    <SafeAreaView testID="screen-employee-directory" style={[styles.safeArea, { backgroundColor: theme.card }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="btn-back-directory"
          style={styles.backButton}
          onPress={() => navigationHistory.goBackSafe(navigation, 'MainTabs', { screen: 'HRDashboard' })}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {t('myDepartmentTeam', 'ทีมงานแผนก')} {userDept}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('myDepartmentTeam', 'สมาชิกภายในแผนกเดียวกัน')} ({filteredEmployees.length} คน)
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{filteredEmployees.length}</Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={[styles.searchSection, { backgroundColor: theme.background }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            testID="employee-search-input"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t('search', 'ค้นหาชื่อ, รหัสพนักงานในแผนก...')}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Employee List */}
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
        {filteredEmployees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={56} color="#CBD5E1" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t('noTeamMembers', 'ไม่พบสมาชิกในแผนกนี้')}
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              พนักงานจะแสดงเฉพาะผู้ที่อยู่ในแผนก {userDept} เท่านั้น
            </Text>
          </View>
        ) : (
          filteredEmployees.map((emp) => (
            <TouchableOpacity
              key={emp.id || emp.code}
              testID={`employee-card-${emp.id || emp.code}`}
              style={[styles.employeeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setSelectedEmp(emp)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: emp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                style={styles.avatar}
              />
              <View style={styles.empInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.empName, { color: theme.text }]} numberOfLines={1}>{emp.name}</Text>
                  <View style={styles.codeTag}>
                    <Text style={styles.codeTagText}>{emp.code || emp.id}</Text>
                  </View>
                </View>
                <Text style={[styles.empPosition, { color: theme.textSecondary }]} numberOfLines={1}>{emp.position || 'พนักงาน'}</Text>
                <View style={styles.deptRow}>
                  <Ionicons name="business-outline" size={13} color="#64748B" />
                  <Text style={styles.empDept} numberOfLines={1}>{emp.department || userDept}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  testID={`btn-call-${emp.code || emp.id}`}
                  style={styles.circleActionBtn}
                  onPress={() => handleCall(emp.phone)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={18} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`btn-email-${emp.code || emp.id}`}
                  style={[styles.circleActionBtn, { backgroundColor: '#EEF2FF' }]}
                  onPress={() => handleEmail(emp.email)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail" size={18} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Employee Detail Modal */}
      <Modal
        visible={!!selectedEmp}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedEmp(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedEmp(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>

            {selectedEmp && (
              <>
                <View style={styles.modalHeader}>
                  <Image
                    source={{ uri: selectedEmp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }}
                    style={styles.modalAvatar}
                  />
                  <Text style={styles.modalName}>{selectedEmp.name}</Text>
                  <Text style={styles.modalPosition}>{selectedEmp.position || 'พนักงาน'}</Text>
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{selectedEmp.department || 'ไม่ระบุฝ่าย'}</Text>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                <View style={styles.modalDetailsList}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBg}>
                      <Ionicons name="card-outline" size={18} color="#3B82F6" />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>รหัสพนักงาน</Text>
                      <Text style={styles.detailValue}>{selectedEmp.code || selectedEmp.id}</Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBg, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="call-outline" size={18} color="#10B981" />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>เบอร์โทรศัพท์</Text>
                      <Text style={styles.detailValue}>{selectedEmp.phone || '-'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.inlineCallBtn}
                      onPress={() => handleCall(selectedEmp.phone)}
                    >
                      <Ionicons name="call" size={16} color="#FFFFFF" />
                      <Text style={styles.inlineCallBtnText}>โทร</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBg, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="mail-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>อีเมล</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{selectedEmp.email || '-'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.inlineCallBtn, { backgroundColor: '#2563EB' }]}
                      onPress={() => handleEmail(selectedEmp.email)}
                    >
                      <Ionicons name="mail" size={16} color="#FFFFFF" />
                      <Text style={styles.inlineCallBtnText}>ส่ง</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBg, { backgroundColor: '#FDF4FF' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#A855F7" />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>วันที่เริ่มงาน</Text>
                      <Text style={styles.detailValue}>{selectedEmp.startDate || '-'}</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 16,
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
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
    height: 46,
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
    paddingTop: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
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
    fontSize: 13,
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
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    marginRight: 14,
  },
  empInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 6,
  },
  codeTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  empPosition: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 4,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  empDept: {
    fontSize: 11,
    color: '#64748B',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 8,
  },
  modalAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  modalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalPosition: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  modalBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 18,
  },
  modalDetailsList: {
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 1,
  },
  inlineCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  inlineCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
