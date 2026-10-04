import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Animated,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,

} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tryFetchApi } from '../services/apiClient';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';



export default function SettingsScreen({ navigation }) {
  const [toggles, setToggles] = useState({
    biometric: true,
    notifications: true,
    messages: true,
    timeReminder: false,
    darkMode: false,
  });

  const [language, setLanguage] = useState('ไทย');
  const [fontSize, setFontSize] = useState('ปกติ');

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const [hasPin, setHasPin] = useState(authService.hasPin());

  useFocusEffect(
    React.useCallback(() => {
      setHasPin(authService.hasPin());
    }, [])
  );

  const handleRemovePin = () => {
    Alert.alert(
      'ปิดการใช้งาน PIN',
      'คุณต้องการปิดการใช้งานรหัส PIN สำหรับบัญชีนี้ใช่หรือไม่? หลังจากปิดแล้วจะเข้าสู่ระบบด้วยรหัสผ่านตามปกติ',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ปิดการใช้งาน',
          style: 'destructive',
          onPress: async () => {
            try {
              const u = authService.getUser();
              const pass = u?.username === 'demo' ? 'demo' : '1234';
              await pinService.removePin(pass);
              setHasPin(false);
              Alert.alert('สำเร็จ', 'ปิดการใช้งานรหัส PIN เรียบร้อยแล้ว');
            } catch (e) {
              Alert.alert('ข้อผิดพลาด', e.message || 'ไม่สามารถปิดการใช้งาน PIN ได้');
            }
          },
        },
      ]
    );
  };

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePasswordSubmit = async () => {
    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    if (passwords.newPassword.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await tryFetchApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      if (res) {
        const data = await res.json();
        if (data.success) {
          Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
          setShowPasswordModal(false);
          setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } else {
          Alert.alert('ข้อผิดพลาด', data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
        }
      } else {
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบใช่หรือไม่?',
      [
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
      ]
    );
  };

  const settingsSections = [
    {
      title: 'บัญชีและการรักษาความปลอดภัย',
      items: [
        {
          icon: 'keypad-outline',
          label: 'รหัส PIN เข้าใช้งาน (6 หลัก)',
          type: 'value',
          value: hasPin ? 'เปิดใช้งานแล้ว' : 'ยังไม่ได้ตั้งค่า',
          valueColor: hasPin ? '#10B981' : '#F59E0B',
          onPress: () => {
            if (!hasPin) {
              navigation.navigate('SetPin', { mode: 'setup' });
            } else {
              Alert.alert(
                'การจัดการรหัส PIN 6 หลัก',
                'เลือกการดำเนินการที่ต้องการสำหรับรหัส PIN ของบัญชีนี้',
                [
                  { text: 'ยกเลิก', style: 'cancel' },
                  {
                    text: 'เปลี่ยนรหัส PIN',
                    onPress: () => navigation.navigate('SetPin', { mode: 'change' }),
                  },
                  {
                    text: 'ปิดการใช้งาน PIN',
                    style: 'destructive',
                    onPress: () => handleRemovePin(),
                  },
                ]
              );
            }
          },
        },
        {
          icon: 'lock-closed-outline',
          label: 'เปลี่ยนรหัสผ่าน',
          type: 'nav',
          onPress: () => setShowPasswordModal(true),
        },
        {
          icon: 'finger-print-outline',
          label: 'Face ID / ลายนิ้วมือ',
          type: 'toggle',
          key: 'biometric',
        },
      ],
    },
    {
      title: 'การแจ้งเตือน',
      items: [
        { icon: 'notifications-outline', label: 'การแจ้งเตือนทั่วไป', type: 'toggle', key: 'notifications' },
        { icon: 'chatbubble-outline', label: 'แจ้งเตือนข้อความและข่าวสาร', type: 'toggle', key: 'messages' },
        { icon: 'alarm-outline', label: 'เตือนบันทึกเวลาเข้า-ออกงาน', type: 'toggle', key: 'timeReminder' },
      ],
    },
    {
      title: 'การใช้งานและภาษา',
      items: [
        {
          icon: 'language-outline',
          label: 'ภาษา (Language)',
          type: 'value',
          value: language,
          onPress: () => setShowLanguageModal(true),
        },
        { icon: 'moon-outline', label: 'โหมดมืด (Dark Mode)', type: 'toggle', key: 'darkMode' },
        {
          icon: 'text-outline',
          label: 'ขนาดตัวอักษร',
          type: 'value',
          value: fontSize,
          onPress: () => setShowFontSizeModal(true),
        },
      ],
    },
    {
      title: 'เกี่ยวกับระบบ',
      items: [
        {
          icon: 'information-circle-outline',
          label: 'เกี่ยวกับ WellX989',
          type: 'nav',
          onPress: () => setShowAboutModal(true),
        },
        {
          icon: 'document-text-outline',
          label: 'ข้อกำหนดและนโยบายความเป็นส่วนตัว',
          type: 'nav',
          onPress: () => setShowAboutModal(true),
        },
      ],
    },
  ];

  return (
    <SafeAreaView testID="screen-settings" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="การตั้งค่าระบบ" showBack />

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Version Card */}
          <View testID="settings-version-card" style={styles.versionCard}>
            <View style={styles.versionIconBg}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.versionAppName}>WellX989 Suite</Text>
              <Text style={styles.versionText}>เวอร์ชัน 1.0.0 (Build 1) • Enterprise HR</Text>
            </View>
          </View>

          {/* Settings Sections */}
          {settingsSections.map((section, sIndex) => (
            <View testID={`settings-section-${sIndex}`} key={sIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, iIndex) => (
                  <TouchableOpacity
                    testID={`settings-item-${sIndex}-${iIndex}`}
                    key={iIndex}
                    style={[
                      styles.settingItem,
                      iIndex < section.items.length - 1 && styles.settingItemBorder,
                    ]}
                    onPress={() => {
                      if (item.type === 'toggle') {
                        handleToggle(item.key);
                      } else if (item.onPress) {
                        item.onPress();
                      }
                    }}
                    activeOpacity={item.type === 'toggle' ? 1 : 0.7}
                  >
                    <View style={styles.settingLeft}>
                      <View style={styles.settingIconBg}>
                        <Ionicons name={item.icon} size={18} color={colors.primary} />
                      </View>
                      <Text style={styles.settingLabel}>{item.label}</Text>
                    </View>

                    {item.type === 'toggle' && (
                      <Switch
                        testID={`settings-toggle-${item.key}`}
                        value={toggles[item.key]}
                        onValueChange={() => handleToggle(item.key)}
                        trackColor={{
                          false: '#E2E8F0',
                          true: colors.primary + '60',
                        }}
                        thumbColor={toggles[item.key] ? colors.primary : '#FFFFFF'}
                      />
                    )}

                    {item.type === 'value' && (
                      <View style={styles.settingRight}>
                        <Text
                          style={[
                            styles.settingValue,
                            item.valueColor && { color: item.valueColor, fontWeight: '700' },
                          ]}
                        >
                          {item.value}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                      </View>
                    )}

                    {item.type === 'nav' && (
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <TouchableOpacity
            testID="settings-logout-btn"
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            WellX989 Mobile Solution © 2026 - All rights reserved
          </Text>
        </ScrollView>
      </Animated.View>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เปลี่ยนรหัสผ่าน</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รหัสผ่านปัจจุบัน</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="กรอกรหัสผ่านปัจจุบัน"
                value={passwords.currentPassword}
                onChangeText={(t) => setPasswords((p) => ({ ...p, currentPassword: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รหัสผ่านใหม่</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={passwords.newPassword}
                onChangeText={(t) => setPasswords((p) => ({ ...p, newPassword: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ยืนยันรหัสผ่านใหม่</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                value={passwords.confirmPassword}
                onChangeText={(t) => setPasswords((p) => ({ ...p, confirmPassword: t }))}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPasswordModal(false)}>
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handlePasswordSubmit}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>บันทึกรหัสผ่าน</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* LANGUAGE SELECTOR MODAL */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกภาษา (Language)</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {['ไทย', 'English'].map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.optionItem,
                  language === lang && styles.optionItemSelected,
                ]}
                onPress={() => {
                  setLanguage(lang);
                  setShowLanguageModal(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    language === lang && styles.optionTextSelected,
                  ]}
                >
                  {lang}
                </Text>
                {language === lang && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* FONT SIZE MODAL */}
      <Modal visible={showFontSizeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ขนาดตัวอักษร</Text>
              <TouchableOpacity onPress={() => setShowFontSizeModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {['เล็ก', 'ปกติ', 'ใหญ่'].map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.optionItem,
                  fontSize === size && styles.optionItemSelected,
                ]}
                onPress={() => {
                  setFontSize(size);
                  setShowFontSizeModal(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    fontSize === size && styles.optionTextSelected,
                  ]}
                >
                  {size}
                </Text>
                {fontSize === size && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ABOUT APP MODAL */}
      <Modal visible={showAboutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เกี่ยวกับ WellX989</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={styles.largeIconBg}>
                <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.title, marginTop: 10 }}>
                WellX989 Application
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                เวอร์ชัน 1.0.0 (Build 1)
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 16 }}>
              WellX989 คือแพลตฟอร์มบริหารจัดการทรัพยากรบุคคลและบันทึกเวลาทำงานแบบครบวงจร รองรับการลงเวลาผ่าน GPS, การขออนุมัติการลา, การขอทำงานล่วงเวลา (OT) และระบบสวัสดิการรางวัลพนักงาน
            </Text>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowAboutModal(false)}>
              <Text style={styles.saveBtnText}>ตกลง</Text>
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
  flex: { flex: 1 },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  versionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  versionAppName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  versionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.label,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '500',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.label,
    marginBottom: 20,
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
    marginTop: 20,
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
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  largeIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
