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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { tryFetchApi } from '../services/apiClient';
import { navigationHistory } from '../services/navigationHistory';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

// Colours for the initials circle of people without a profile picture (stable per employee code)
const AVATAR_COLORS = ['#7C3AED', '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4'];
const colorFor = (key) => {
  const text = String(key || '');
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) sum += text.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

// What to show under the name: the position when HR set one, otherwise the role in plain words
const ROLE_LABEL = { Employee: 'พนักงาน', Boss: 'Boss', SuperBoss: 'SuperBoss', 'HR Admin': 'HR Admin' };
const roleLabel = (emp) => emp.position || ROLE_LABEL[emp.role] || emp.role || 'พนักงาน';
const isLeader = (emp) => emp.role === 'Boss' || emp.role === 'SuperBoss';

// The real profile picture, or the first letter of the name when there is none (no stock photos of strangers)
function Avatar({ emp, size = 52 }) {
  const [failed, setFailed] = useState(false);
  const uri = emp.avatarUrl;
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E2E8F0' }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(emp.code || emp.id), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.4 }}>{String(emp.name || '?').trim()[0]}</Text>
    </View>
  );
}

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
            avatarUrl: emp.avatarUrl || emp.avatar_url || null,
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

  const isMe = (emp) => !!currentUser && (emp.id === currentUser.id || (emp.code && emp.code === currentUser.code));

  // Filter strictly by the current user's department (only members of our department are shown)
  const filteredEmployees = employees
    .filter((emp) => {
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
    })
    // leaders first, then by employee code
    .sort((a, b) => Number(isLeader(b)) - Number(isLeader(a)) || String(a.code || '').localeCompare(String(b.code || '')));

  return (
    <SafeAreaView testID="screen-employee-directory" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity
          testID="btn-back-directory"
          style={styles.backButton}
          onPress={() => navigationHistory.goBackSafe(navigation, 'MainTabs', { screen: 'HRDashboard' })}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('myDepartmentTeam', 'ทีมงานแผนก')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {userDept} · {filteredEmployees.length} คน
          </Text>
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#7C3AED" style={styles.searchIcon} />
          <TextInput
            testID="employee-search-input"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="ค้นหาชื่อ หรือรหัสพนักงาน"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
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
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={40} color="#A78BFA" />
            </View>
            <Text style={styles.emptyTitle}>{t('noTeamMembers', 'ไม่พบสมาชิกในแผนกนี้')}</Text>
            <Text style={styles.emptyDesc}>พนักงานจะแสดงเฉพาะผู้ที่อยู่ในแผนก {userDept} เท่านั้น</Text>
          </View>
        ) : (
          filteredEmployees.map((emp) => (
            <TouchableOpacity
              key={emp.id || emp.code}
              testID={`employee-card-${emp.id || emp.code}`}
              style={styles.employeeCard}
              onPress={() => setSelectedEmp(emp)}
              activeOpacity={0.85}
            >
              <Avatar emp={emp} />
              <View style={styles.empInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.empName} numberOfLines={1}>{emp.name}</Text>
                  {isMe(emp) && (
                    <View style={styles.meTag}>
                      <Text style={styles.meTagText}>คุณ</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <View style={[styles.roleTag, isLeader(emp) && styles.roleTagLeader]}>
                    <Text style={[styles.roleTagText, isLeader(emp) && styles.roleTagTextLeader]} numberOfLines={1}>{roleLabel(emp)}</Text>
                  </View>
                  <Text style={styles.empCode}>{emp.code || emp.id}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  testID={`btn-email-${emp.code || emp.id}`}
                  style={[styles.circleActionBtn, { backgroundColor: '#EEF2FF' }]}
                  onPress={() => handleEmail(emp.email)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail" size={18} color="#4F46E5" />
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
                  <View style={{ marginBottom: 12 }}>
                    <Avatar emp={selectedEmp} size={76} />
                  </View>
                  <Text style={styles.modalName}>{selectedEmp.name}</Text>
                  <Text style={styles.modalPosition}>{roleLabel(selectedEmp)}</Text>
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{selectedEmp.department || 'ไม่ระบุฝ่าย'}</Text>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                <View style={styles.modalDetailsList}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBg}>
                      <Ionicons name="card-outline" size={18} color="#7C3AED" />
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
                    <View style={[styles.detailIconBg, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="mail-outline" size={18} color="#4F46E5" />
                    </View>
                    <View style={styles.detailTextCol}>
                      <Text style={styles.detailLabel}>อีเมล</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{selectedEmp.email || '-'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.inlineCallBtn, { backgroundColor: '#4F46E5' }]}
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
    backgroundColor: '#7C3AED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  // the search box overlaps the bottom of the header
  searchWrap: {
    marginTop: -26,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    marginTop: -26,
    paddingTop: 26,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 40,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#4C1D95',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  empInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 6,
  },
  meTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
  },
  meTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 1,
  },
  roleTagLeader: {
    backgroundColor: '#EDE9FE',
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleTagTextLeader: {
    color: '#6D28D9',
  },
  empCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  circleActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  modalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
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
    backgroundColor: '#F5F3FF',
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
