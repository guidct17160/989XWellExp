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
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { leaveStorage } from '../services/leaveStorage';
import TopNavbar from '../components/TopNavbar';

import { authService } from '../services/authService';
import { tryFetchApi } from '../services/apiClient';

const API_BASE = 'http://localhost:5000/api';

export default function ProfileScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const [leaveState, setLeaveState] = useState(leaveStorage.getState());
  const [authUser, setAuthUser] = useState(authService.getUser());
  const [profile, setProfile] = useState({
    code: authUser.code || authUser.id || 'EMP-001',
    name: (authUser.name || 'พนักงาน').replace(/\s*\([^)]*\)/g, '').trim(),
    position: authUser.position || 'Software Engineer',
    department: authUser.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
    email: authUser.email || 'employee@wellx989.com',
    phone: authUser.phone || '-',
    role: authUser.role || 'Employee',
    avatarUrl: authUser.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    attendanceRate: '98%',
    kpiScore: '4.8',
    projects: '15',
    tenure: '3 ปี 2 เดือน',
    workHours: '132 ชม.',
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showSwitchRoleModal, setShowSwitchRoleModal] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
  });

  const fetchProfileData = async () => {
    try {
      const current = authService.getUser();
      const targetId = current.id || current.code || current.username;
      const res = await tryFetchApi(targetId ? `/employees/${targetId}` : '/auth/profile');
      if (res && res.ok) {
        const json = await res.json();
        const u = json.user || json.employee;
        if (u) {
          const cleanName = (u.name || '').replace(/\s*\([^)]*\)/g, '').trim();
          const merged = {
            ...current,
            ...u,
            name: cleanName || u.name || current.name,
          };
          authService.setUser(merged);

          // Calculate dynamic tenure from real start_date
          let dynamicTenure = '1 ปี';
          const empStartDate = merged.startDate || merged.start_date;
          if (empStartDate) {
            const start = new Date(empStartDate);
            if (!isNaN(start.getTime())) {
              const diffDays = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
              const years = Math.floor(diffDays / 365);
              const months = Math.floor((diffDays % 365) / 30);
              dynamicTenure = years > 0 ? `${years} ปี ${months} เดือน` : `${months || 1} เดือน`;
            }
          }

          setProfile((prev) => ({
            ...prev,
            code: merged.code || merged.id || prev.code,
            name: merged.name || prev.name,
            position: merged.position || prev.position,
            department: merged.department || prev.department,
            email: merged.email || prev.email,
            phone: merged.phone || prev.phone,
            role: merged.role || 'Employee',
            avatarUrl: merged.avatarUrl || prev.avatarUrl,
            startDate: empStartDate || prev.startDate,
            tenure: dynamicTenure,
          }));

          // Fetch dynamic live metrics from PostgreSQL
          try {
            const [attSummaryRes, kpiRes] = await Promise.all([
              tryFetchApi('/attendance/summary'),
              tryFetchApi('/kpi/evaluations'),
            ]);

            if (attSummaryRes && attSummaryRes.ok) {
              const attJson = await attSummaryRes.json();
              if (attJson.summary) {
                setProfile((prev) => ({
                  ...prev,
                  attendanceRate: attJson.summary.rate || prev.attendanceRate,
                  workHours: attJson.summary.totalHours || prev.workHours,
                }));
              }
            }

            if (kpiRes && kpiRes.ok) {
              const kpiJson = await kpiRes.json();
              if (Array.isArray(kpiJson.evaluations)) {
                const myEval = kpiJson.evaluations.find(e => e.employeeId === targetId || e.employeeCode === targetId);
                if (myEval && myEval.kpiScore) {
                  const score5 = (Number(myEval.kpiScore) / 20).toFixed(1);
                  setProfile((prev) => ({
                    ...prev,
                    kpiScore: score5,
                  }));
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('Failed to sync profile from backend', e);
    }
  };

  useEffect(() => {
    fetchProfileData();

    const unsubAuth = authService.subscribe((u) => {
      setAuthUser(u);
      const cleanName = (u.name || '').replace(/\s*\([^)]*\)/g, '').trim();
      setProfile((prev) => ({
        ...prev,
        code: u.code || u.id || prev.code,
        name: cleanName || u.name || prev.name,
        position: u.position || prev.position,
        department: u.department || prev.department,
        email: u.email || prev.email,
        phone: u.phone || prev.phone,
        role: u.role || 'Employee',
        avatarUrl: u.avatarUrl || prev.avatarUrl,
      }));
    });

    const unsubscribe = leaveStorage.subscribe((state) => {
      setLeaveState(state);
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData();
    setLeaveState(leaveStorage.getState());
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const annualBalance = leaveState.leaveBalances.find((b) => b.id === 'annual')?.remaining || 6;

  // Handle Edit Profile Open
  const handleOpenEdit = () => {
    setEditForm({
      name: profile.name,
      position: profile.position,
      phone: profile.phone,
      email: profile.email,
    });
    setShowEditModal(true);
  };

  // Handle Edit Profile Save
  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.email) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อและอีเมลให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      const current = authService.getUser();
      const targetEmpId = current.id || current.code || profile.code || 'EMP-001';
      
      await tryFetchApi(`/employees/${targetEmpId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const updatedUser = {
        ...current,
        name: editForm.name,
        position: editForm.position,
        phone: editForm.phone,
        email: editForm.email,
      };

      authService.setUser(updatedUser);

      setProfile((prev) => ({
        ...prev,
        ...editForm,
      }));

      Alert.alert('สำเร็จ', 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว');
      setShowEditModal(false);
    } catch (err) {
      console.error('Save profile error:', err);
      const current = authService.getUser();
      const updatedUser = {
        ...current,
        name: editForm.name,
        position: editForm.position,
        phone: editForm.phone,
        email: editForm.email,
      };
      authService.setUser(updatedUser);
      setProfile((prev) => ({
        ...prev,
        ...editForm,
      }));
      Alert.alert('สำเร็จ', 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว');
      setShowEditModal(false);
    } finally {
      setLoading(false);
    }
  };

  const avatarPresets = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  ];

  const profileMenuItems = [
    {
      section: 'ข้อมูลส่วนตัวและองค์กร',
      items: [
        { icon: 'person-outline', label: 'แก้ไขข้อมูลส่วนตัว', chevron: true, onPress: handleOpenEdit },
        { icon: 'call-outline', label: 'เบอร์โทรศัพท์', value: profile.phone || '-' },
        { icon: 'mail-outline', label: 'อีเมลองค์กร', value: profile.email },
        { icon: 'business-outline', label: 'สังกัดฝ่าย/แผนก', value: profile.department },
        { icon: 'shield-checkmark-outline', label: 'บทบาทและสิทธิ์', value: profile.role || 'Employee' },
        { icon: 'calendar-outline', label: 'วันที่เริ่มงาน', value: profile.startDate || '26 ส.ค. 2569' },
      ],
    },
    {
      section: 'การใช้งานบัญชี',
      items: [
        {
          icon: 'qr-code-outline',
          label: 'บัตรพนักงานดิจิทัล & QR Code',
          chevron: true,
          onPress: () => setShowQrModal(true),
        },
        {
          icon: 'settings-outline',
          label: 'การตั้งค่าระบบและแอปพลิเคชัน',
          chevron: true,
          onPress: () => navigation.navigate('Settings'),
        },
        {
          icon: 'log-out-outline',
          label: 'ออกจากระบบ',
          isLogout: true,
          chevron: true,
          onPress: () => {
            Alert.alert('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', [
              { text: 'ยกเลิก', style: 'cancel' },
              {
                text: 'ออกจากระบบ',
                style: 'destructive',
                onPress: () => {
                  authService.logout();
                  const rootNav = navigation?.getParent?.() || navigation;
                  if (rootNav?.reset) {
                    rootNav.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    });
                  } else if (navigation?.navigate) {
                    navigation.navigate('Login');
                  }
                },
              },
            ]);
          },
        },
      ],
    },
  ];

  const displayPosition =
    profile.role === 'SuperBoss'
      ? 'ผู้อำนวยการฝ่ายเทคโนโลยี (SuperBoss)'
      : profile.role === 'Boss'
      ? 'ผู้จัดการฝ่าย (Boss)'
      : (profile.position || 'พนักงาน');

  return (
    <SafeAreaView testID="screen-profile" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      <TopNavbar navigation={navigation} title={profile.name} />

      <ScrollView
        ref={scrollViewRef}
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
        {/* Profile Card Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => setShowAvatarModal(true)}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.nameText}>{profile.name}</Text>
          <Text style={styles.positionText}>{displayPosition}</Text>

          <TouchableOpacity style={styles.idBadge} onPress={() => setShowQrModal(true)}>
            <Ionicons name="id-card-outline" size={16} color="#0074C4" />
            <Text style={styles.idText}>รหัส: {profile.code}</Text>
            <Ionicons name="qr-code-outline" size={14} color="#0074C4" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        {/* Stats Summary Bar */}
        <Animated.View style={[styles.statsCard, { opacity: fadeAnim }]}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{annualBalance} วัน</Text>
            <Text style={styles.statLabel}>วันลาพักร้อน</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.role || 'Employee'}</Text>
            <Text style={styles.statLabel}>บทบาทระบบ</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{profile.status || 'Active'}</Text>
            <Text style={styles.statLabel}>สถานะบัญชี</Text>
          </View>
        </Animated.View>

        {/* Menu Sections */}
        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {profileMenuItems.map((section, sIndex) => (
            <View key={sIndex} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.section}</Text>
              <View style={styles.menuCard}>
                {section.items.map((item, iIndex) => (
                  <TouchableOpacity
                    key={iIndex}
                    style={[
                      styles.menuItem,
                      iIndex < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={item.onPress}
                    activeOpacity={item.onPress ? 0.7 : 1}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.menuIconBg,
                          item.isLogout && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.isLogout ? '#DC2626' : colors.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.menuLabel,
                          item.isLogout && { color: '#DC2626', fontWeight: '700' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </View>

                    <View style={styles.menuItemRight}>
                      {item.value && (
                        <Text
                          style={[
                            styles.menuValue,
                            item.valueColor && { color: item.valueColor },
                          ]}
                        >
                          {item.value}
                        </Text>
                      )}
                      {item.chevron && (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={item.isLogout ? '#DC2626' : colors.textSecondary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>แก้ไขข้อมูลโปรไฟล์</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ชื่อ-นามสกุล</Text>
              <TextInput
                style={styles.input}
                value={editForm.name}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, name: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ตำแหน่งงาน</Text>
              <TextInput
                style={styles.input}
                value={editForm.position}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, position: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>เบอร์โทรศัพท์</Text>
              <TextInput
                style={styles.input}
                value={editForm.phone}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, phone: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>อีเมล</Text>
              <TextInput
                style={styles.input}
                value={editForm.email}
                onChangeText={(t) => setEditForm((prev) => ({ ...prev, email: t }))}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveEdit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>บันทึกข้อมูล</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DIGITAL ID CARD & QR CODE MODAL */}
      <Modal visible={showQrModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.cardModalContainer}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={24} color="#0074C4" />
                <Text style={styles.cardHeaderTitle}>WellX989 Digital ID</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.cardBody}>
              <Image source={{ uri: profile.avatarUrl }} style={styles.cardAvatar} />
              <Text style={styles.cardName}>{profile.name}</Text>
              <Text style={styles.cardPos}>{profile.position}</Text>
              <Text style={styles.cardDept}>{profile.department}</Text>

              {/* QR Code Placeholder Graphic */}
              <View style={styles.qrContainer}>
                <Ionicons name="qr-code" size={140} color="#0F172A" />
                <Text style={styles.qrCodeText}>{profile.code}</Text>
              </View>
              <Text style={styles.cardFooterText}>สแกนเพื่อยืนยันตัวตนหรือบันทึกเวลาเข้างาน</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* AVATAR SELECTOR MODAL */}
      <Modal visible={showAvatarModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกรูปโปรไฟล์</Text>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 16, flexWrap: 'wrap' }}>
              {avatarPresets.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setProfile((p) => ({ ...p, avatarUrl: url }));
                    setShowAvatarModal(false);
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      borderWidth: profile.avatarUrl === url ? 3 : 1,
                      borderColor: profile.avatarUrl === url ? colors.primary : '#E2E8F0',
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowAvatarModal(false)}>
              <Text style={styles.saveBtnText}>ปิด</Text>
            </TouchableOpacity>
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
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#0074C4',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0074C4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  positionText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 10,
    fontWeight: '500',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  idText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0074C4',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  menuSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginRight: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Card Modal Styles
  cardModalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardBody: {
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  cardAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardPos: {
    fontSize: 13,
    color: '#0074C4',
    fontWeight: '600',
    marginTop: 2,
  },
  cardDept: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  qrContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0074C4',
    marginTop: 8,
    letterSpacing: 1,
  },
  cardFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
