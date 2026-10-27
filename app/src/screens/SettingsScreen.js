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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';
import { notificationStorage } from '../services/notificationStorage';
import { useTheme } from '../context/ThemeContext';

export default function SettingsScreen({ navigation }) {
  const { isDarkMode, language, setLanguage, t, theme } = useTheme();

  // saved on this device per user; read by notificationStorage (banner + bell counter)
  const [toggles, setToggles] = useState(() => notificationStorage.getPrefs());

  // Modals state
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

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
      t('disablePin') || 'ปิดการใช้งาน PIN',
      t('disablePinConfirm') || 'คุณต้องการปิดการใช้งานรหัส PIN สำหรับบัญชีนี้ใช่หรือไม่? หลังจากปิดแล้วจะเข้าสู่ระบบด้วยรหัสผ่านตามปกติ',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('disablePin') || 'ปิดการใช้งาน',
          style: 'destructive',
          onPress: async () => {
            try {
              await pinService.removePin();
              setHasPin(false);
              Alert.alert(t('success') || 'สำเร็จ', 'ปิดการใช้งานรหัส PIN เรียบร้อยแล้ว');
            } catch (e) {
              Alert.alert(t('error') || 'เกิดข้อผิดพลาด', e.message || 'ไม่สามารถปิดการใช้งาน PIN ได้');
            }
          },
        },
      ]
    );
  };

  const handleToggle = (key) => {
    setToggles(notificationStorage.setPrefs({ [key]: !toggles[key] }));
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout') || 'ออกจากระบบ',
      'คุณต้องการออกจากระบบใช่หรือไม่?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
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
      title: t('accountSecurity') || 'บัญชีและการรักษาความปลอดภัย',
      items: [
        {
          icon: 'keypad-outline',
          label: t('pinSettings') || 'รหัส PIN เข้าใช้งาน (6 หลัก)',
          type: 'value',
          value: hasPin ? (language === 'en' ? 'Enabled' : 'เปิดใช้งานแล้ว') : (language === 'en' ? 'Not Set' : 'ยังไม่ได้ตั้งค่า'),
          valueColor: hasPin ? '#10B981' : '#F59E0B',
          onPress: () => {
            if (!hasPin) {
              navigation.navigate('SetPin', { mode: 'setup' });
            } else {
              Alert.alert(
                t('pinSettings') || 'การจัดการรหัส PIN 6 หลัก',
                'เลือกการดำเนินการที่ต้องการสำหรับรหัส PIN ของบัญชีนี้',
                [
                  { text: t('cancel'), style: 'cancel' },
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
      ],
    },
    {
      title: t('notifications') || 'การแจ้งเตือน',
      items: [
        { icon: 'notifications-outline', label: 'การแจ้งเตือนทั่วไป', type: 'toggle', key: 'general' },
        { icon: 'chatbubble-outline', label: 'แจ้งเตือนข้อความและข่าวสาร', type: 'toggle', key: 'news' },
      ],
    },
    {
      title: t('appPreferences') || 'การใช้งานและภาษา',
      items: [
        {
          icon: 'language-outline',
          label: t('language') || 'ภาษา (Language)',
          type: 'value',
          value: language === 'en' ? 'English' : 'ไทย',
          onPress: () => setShowLanguageModal(true),
        },
      ],
    },
    {
      title: t('aboutApp') || 'เกี่ยวกับระบบ',
      items: [
        {
          icon: 'information-circle-outline',
          label: t('aboutApp') || 'เกี่ยวกับ WellX989',
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
    <SafeAreaView testID="screen-settings" style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.headerBackground} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title={t('settings') || 'การตั้งค่าระบบ'} showBack />

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={[styles.scrollView, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* App Version Card */}
          <View testID="settings-version-card" style={[styles.versionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.versionIconBg, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.versionAppName}>WellX989 Suite</Text>
              <Text style={[styles.versionText, { color: theme.textSecondary }]}>เวอร์ชัน 1.0.0 (Build 1) • Enterprise HR</Text>
            </View>
          </View>

          {/* Settings Sections */}
          {settingsSections.map((section, sIndex) => (
            <View testID={`settings-section-${sIndex}`} key={sIndex} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {section.items.map((item, iIndex) => (
                  <TouchableOpacity
                    testID={`settings-item-${sIndex}-${iIndex}`}
                    key={iIndex}
                    style={[
                      styles.settingItem,
                      iIndex < section.items.length - 1 && [styles.settingItemBorder, { borderBottomColor: theme.border }],
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
                      <View style={[styles.settingIconBg, { backgroundColor: isDarkMode ? '#1E293B' : colors.primaryLight }]}>
                        <Ionicons name={item.icon} size={18} color={colors.primary} />
                      </View>
                      <Text style={[styles.settingLabel, { color: theme.text }]}>{item.label}</Text>
                    </View>


                    {item.type === 'toggle' && (
                      <Switch
                        testID={`settings-toggle-${item.key}`}
                        value={toggles[item.key]}
                        onValueChange={() => handleToggle(item.key)}
                        trackColor={{
                          false: '#CBD5E1',
                          true: colors.primary + '80',
                        }}
                        thumbColor={toggles[item.key] ? colors.primary : '#FFFFFF'}
                      />
                    )}

                    {item.type === 'value' && (
                      <View style={styles.settingRight}>
                        <Text
                          style={[
                            styles.settingValue,
                            { color: theme.textSecondary },
                            item.valueColor && { color: item.valueColor, fontWeight: '700' },
                          ]}
                        >
                          {item.value}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                      </View>
                    )}

                    {item.type === 'nav' && (
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <TouchableOpacity testID="settings-logout-btn" style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>{t('logout') || 'ออกจากระบบ'}</Text>
          </TouchableOpacity>

          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            WellX989 Enterprise HRM
          </Text>
        </ScrollView>
      </Animated.View>

      {/* LANGUAGE SELECTOR MODAL */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('selectLanguage') || 'เลือกภาษา (Language)'}
              </Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { id: 'th', label: 'ภาษาไทย (Thai)' },
              { id: 'en', label: 'English (อังกฤษ)' },
            ].map((lang) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.optionItem,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' },
                  language === lang.id && styles.optionItemSelected,
                ]}
                onPress={() => {
                  setLanguage(lang.id);
                  setShowLanguageModal(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: theme.text },
                    language === lang.id && styles.optionTextSelected,
                  ]}
                >
                  {lang.label}
                </Text>
                {language === lang.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* ABOUT APP MODAL */}
      <Modal visible={showAboutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('aboutApp') || 'เกี่ยวกับ WellX989'}
              </Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={[styles.largeIconBg, { backgroundColor: isDarkMode ? '#1E293B' : colors.primaryLight }]}>
                <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 10 }}>
                WellX989 Application
              </Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                เวอร์ชัน 1.0.0 (Build 1)
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 16 }}>
              WellX989 คือแพลตฟอร์มบริหารจัดการทรัพยากรบุคคลและบันทึกเวลาทำงานแบบครบวงจร รองรับการลงเวลาผ่าน GPS, การขออนุมัติการลา และระบบสวัสดิการรางวัลพนักงาน โดยเชื่อมต่อกับ PostgreSQL Real DB
            </Text>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowAboutModal(false)}>
              <Text style={styles.saveBtnText}>{t('close') || 'ตกลง'}</Text>
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
  },
  flex: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  versionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 13,
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
    marginBottom: 20,
  },
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
    borderRadius: 24,
    padding: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  largeIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
