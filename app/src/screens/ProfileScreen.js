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
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useScrollToTop } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { leaveStorage } from '../services/leaveStorage';
import TopNavbar from '../components/TopNavbar';
import { authService } from '../services/authService';
import { tryFetchApi } from '../services/apiClient';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const { isDarkMode, language, t, theme } = useTheme();

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
    attendanceRate: '-',
    status: authUser.status || 'Active',
    tenure: '-',
  });

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Modals state

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
          let dynamicTenure = '-';
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
            status: merged.status || 'Active',
            avatarUrl: merged.avatarUrl || prev.avatarUrl,
            startDate: empStartDate || prev.startDate,
            tenure: dynamicTenure,
          }));

          // Fetch dynamic live metrics from PostgreSQL
          try {
            const attSummaryRes = await tryFetchApi('/attendance/summary');
            if (attSummaryRes && attSummaryRes.ok) {
              const attJson = await attSummaryRes.json();
              const sum = attJson.summary;
              if (sum) {
                // Backend summary = { totalWorkDays, onTimeDays, lateDays, absentDays, totalHours }
                const total = Number(sum.totalWorkDays) || 0;
                const rateText = sum.rate
                  ? String(sum.rate)
                  : total > 0
                    ? `${Math.round(((total - (Number(sum.absentDays) || 0)) / total) * 100)}%`
                    : null;
                setProfile((prev) => ({
                  ...prev,
                  attendanceRate: rateText || prev.attendanceRate,
                }));
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
        status: u.status || 'Active',
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

  // Change the profile picture: pick (camera or gallery), crop to a square, shrink, send to the server first,
  // then update the picture shown in the app. No Admin needed.
  const [avatarSaving, setAvatarSaving] = useState(false);

  const uploadAvatar = async (pickerResult) => {
    if (!pickerResult || pickerResult.canceled || !pickerResult.assets || !pickerResult.assets[0]) return;
    setAvatarSaving(true);
    try {
      const small = await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 320 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const avatarUrl = `data:image/jpeg;base64,${small.base64}`;
      const res = await tryFetchApi('/auth/profile/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl }),
      });
      if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ รูปโปรไฟล์ยังไม่ถูกเปลี่ยน');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถเปลี่ยนรูปโปรไฟล์ได้');
      authService.setAvatar(avatarUrl);
      setProfile((prev) => ({ ...prev, avatarUrl }));
      Alert.alert('สำเร็จ', 'เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว');
    } catch (e) {
      Alert.alert('เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ', e.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setAvatarSaving(false);
    }
  };

  const pickAvatar = async (source) => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'ไม่ได้รับอนุญาต',
          source === 'camera' ? 'กรุณาอนุญาตการใช้กล้องในตั้งค่าของเครื่อง' : 'กรุณาอนุญาตการเข้าถึงรูปภาพในตั้งค่าของเครื่อง'
        );
        return;
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      await uploadAvatar(result);
    } catch (e) {
      Alert.alert('เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ', e.message || 'กรุณาลองใหม่อีกครั้ง');
    }
  };

  const changeAvatar = () => {
    if (avatarSaving) return;
    Alert.alert('เปลี่ยนรูปโปรไฟล์', 'เลือกรูปภาพของคุณเอง', [
      { text: 'ถ่ายรูป', onPress: () => pickAvatar('camera') },
      { text: 'เลือกจากคลังรูปภาพ', onPress: () => pickAvatar('library') },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData();
    setLeaveState(leaveStorage.getState());
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const profileMenuItems = [
    {
      section: t('personalInfo', 'ข้อมูลส่วนตัวและองค์กร (จัดการโดย Web Admin)'),
      items: [
        { icon: 'call-outline', label: t('phone', 'เบอร์โทรศัพท์'), value: profile.phone || '-' },
        { icon: 'mail-outline', label: t('email', 'อีเมลองค์กร'), value: profile.email },
        { icon: 'business-outline', label: t('department', 'สังกัดฝ่าย/แผนก'), value: profile.department },
        { icon: 'shield-checkmark-outline', label: t('role', 'บทบาทและสิทธิ์'), value: profile.role || 'Employee' },
        { icon: 'calendar-outline', label: t('startDate', 'วันที่เริ่มงาน'), value: profile.startDate || '15 ม.ค. 2567' },
      ],
    },
    {
      section: t('appPreferences', 'การใช้งานบัญชี'),
      items: [
        {
          icon: 'settings-outline',
          label: t('settings', 'การตั้งค่าระบบและแอปพลิเคชัน'),
          chevron: true,
          onPress: () => navigation.navigate('Settings'),
        },
        {
          icon: 'log-out-outline',
          label: t('logout', 'ออกจากระบบ'),
          isLogout: true,
          chevron: true,
          onPress: () => {
            Alert.alert(t('logout', 'ออกจากระบบ'), 'คุณต้องการออกจากระบบใช่หรือไม่?', [
              { text: t('cancel', 'ยกเลิก'), style: 'cancel' },
              {
                text: t('logout', 'ออกจากระบบ'),
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

  return (
    <SafeAreaView testID="screen-profile" style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBackground} />

      <TopNavbar navigation={navigation} title={profile.name} />

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.background }]}
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
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            testID="profile-change-avatar-btn"
            style={styles.avatarContainer}
            onPress={changeAvatar}
            activeOpacity={0.8}
            accessibilityLabel="เปลี่ยนรูปโปรไฟล์"
          >
            <Image source={{ uri: profile.avatarUrl }} style={[styles.avatarImage, avatarSaving && { opacity: 0.5 }]} />
            <View style={styles.avatarEditBadge}>
              {avatarSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={[styles.nameText, { color: theme.text }]}>{profile.name}</Text>
        </View>

        {/* Menu Sections */}
        <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
          {profileMenuItems.map((section, sIndex) => (
            <View key={sIndex} style={styles.menuSection}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.section}</Text>
              <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {section.items.map((item, iIndex) => (
                  <TouchableOpacity
                    key={iIndex}
                    style={[
                      styles.menuItem,
                      iIndex < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: theme.border }],
                    ]}
                    onPress={item.onPress}
                    activeOpacity={item.onPress ? 0.7 : 1}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.menuIconBg,
                          { backgroundColor: isDarkMode ? '#1E293B' : colors.primaryLight },
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
                          { color: theme.text },
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
                            { color: theme.textSecondary },
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
                          color={item.isLogout ? '#DC2626' : theme.textSecondary}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  positionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  menuSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
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
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    fontSize: 13,
    marginRight: 6,
  },
});
