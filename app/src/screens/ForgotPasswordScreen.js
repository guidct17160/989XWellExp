import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { tryFetchApi } from '../services/apiClient';

export default function ForgotPasswordScreen({ navigation }) {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleReset = async () => {
    const cleanId = String(employeeId || '').trim();
    if (!cleanId) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกอีเมลหรือรหัสพนักงาน');
      return;
    }

    setLoading(true);
    try {
      const res = await tryFetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ employeeId: cleanId }),
      });

      setLoading(false);
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setResetEmail(data.maskedEmail || data.email || cleanId);
          setSent(true);
        } else {
          Alert.alert('แจ้งเตือน', data.message || 'ไม่พบบัญชีในระบบ');
        }
      } else if (res) {
        const data = await res.json().catch(() => null);
        Alert.alert('แจ้งเตือน', data?.message || 'ไม่พบบัญชีผู้ใช้หรืออีเมลนี้ในระบบ');
      } else {
        // Standalone/Offline mode fallback
        setResetEmail(cleanId);
        setSent(true);
      }
    } catch (err) {
      setLoading(false);
      // Standalone/Offline mode fallback
      setResetEmail(cleanId);
      setSent(true);
    }
  };

  return (
    <SafeAreaView testID="screen-forgot-password" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]} className="flex-1 px-6 pt-4">
          {/* Back button */}
          <TouchableOpacity
            testID="forgot-password-back-btn"
            style={styles.backButton}
            className="w-10 h-10 rounded-xl bg-primary-light items-center justify-center mb-6"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          {sent ? (
            // ✅ ส่งสำเร็จ
            <View testID="forgot-password-success-view" style={styles.successContainer} className="items-center pt-8">
              <View style={styles.successIcon} className="w-20 h-20 rounded-full bg-primary-light items-center justify-center mb-6">
                <Ionicons name="mail-outline" size={48} color={colors.primary} />
              </View>
              <Text testID="forgot-password-success-title" style={styles.successTitle} className="text-2xl font-bold text-primary mb-3">ส่งลิงก์รีเซ็ตแล้ว!</Text>
              <Text testID="forgot-password-success-text" style={styles.successText} className="text-base text-slate-600 text-center leading-6 mb-2">
                เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลที่ผูกกับรหัสพนักงาน{' '}
                <Text style={{ fontWeight: '700', color: colors.primary }}>{resetEmail || employeeId}</Text>
              </Text>
              <Text style={styles.successHint} className="text-sm text-slate-400 text-center mb-8">
                กรุณาตรวจสอบกล่องจดหมายของคุณ หรือกดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
              </Text>

              <TouchableOpacity
                testID="forgot-password-go-set-password-btn"
                style={[styles.backToLogin, { backgroundColor: '#10B981', marginBottom: 12 }]}
                className="flex-row items-center px-6 py-3.5 rounded-xl"
                onPress={() => navigation.navigate('SetPassword', { email: resetEmail || employeeId })}
              >
                <Ionicons name="key-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.backToLoginText} className="text-white font-semibold text-base">ไปที่หน้าตั้งรหัสผ่านใหม่</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="forgot-password-back-to-login-btn"
                style={styles.backToLogin}
                className="flex-row items-center bg-primary px-6 py-3.5 rounded-xl"
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={18} color={colors.buttonPrimaryText} style={{ marginRight: 6 }} />
                <Text style={styles.backToLoginText} className="text-white font-semibold text-base">กลับไปหน้าเข้าสู่ระบบ</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 📝 ฟอร์มกรอกรหัสพนักงาน
            <View testID="forgot-password-form">
              <View style={styles.iconContainer} className="items-center mb-6">
                <View style={styles.iconBg} className="w-20 h-20 rounded-2xl bg-primary-light items-center justify-center">
                  <Ionicons name="key-outline" size={40} color={colors.primary} />
                </View>
              </View>

              <Text testID="forgot-password-title" style={styles.title} className="text-2xl font-bold text-slate-900 text-center mb-2">ลืมรหัสผ่าน?</Text>
              <Text testID="forgot-password-subtitle" style={styles.subtitle} className="text-sm text-slate-500 text-center leading-5 mb-8">
                กรอกรหัสพนักงานหรืออีเมลของคุณ เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้
              </Text>

              <Text testID="forgot-password-employee-id-label" style={styles.label} className="text-sm font-semibold text-slate-700 mb-2">รหัสพนักงาน หรือ อีเมล</Text>
              <View style={[
                styles.inputWrapper,
                focused && styles.inputWrapperFocused,
              ]} className="flex-row items-center border border-slate-200 rounded-xl px-4 bg-slate-50 mb-6">
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={focused ? colors.primary : colors.textSecondary}
                  style={styles.inputIcon}
                  className="mr-3"
                />
                <TextInput
                  testID="forgot-password-employee-id-input"
                  style={styles.input}
                  className="flex-1 text-base text-slate-900"
                  value={employeeId}
                  onChangeText={setEmployeeId}
                  placeholder="เช่น emp_it หรือ demo@wellx989.com"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  includeFontPadding={false}
                  textAlignVertical="center"
                  multiline={false}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>

              <TouchableOpacity
                testID="forgot-password-submit-btn"
                style={styles.resetButton}
                className="bg-primary rounded-xl py-3.5 items-center justify-center mb-4"
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={colors.buttonPrimaryText} />
                ) : (
                  <View style={styles.buttonContent} className="flex-row items-center justify-center">
                    <Ionicons name="send-outline" size={18} color={colors.buttonPrimaryText} style={{ marginRight: 8 }} />
                    <Text style={styles.resetButtonText} className="text-white font-bold text-base">ส่งลิงก์รีเซ็ตรหัสผ่าน</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                testID="forgot-password-back-link"
                style={styles.backLink}
                className="flex-row items-center justify-center py-2"
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={16} color={colors.link} style={{ marginRight: 4 }} />
                <Text style={styles.backLinkText} className="text-primary font-semibold text-sm">กลับไปหน้าเข้าสู่ระบบ</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    color: colors.label,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputWrapperFocused: {
    borderColor: colors.inputBorderFocus,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.inputText,
  },
  resetButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  backLinkText: {
    color: colors.link,
    fontSize: 14,
    fontWeight: '500',
  },
  // Success state
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  successHint: {
    fontSize: 13,
    color: colors.label,
    textAlign: 'center',
    marginBottom: 32,
  },
  backToLogin: {
    flexDirection: 'row',
    backgroundColor: colors.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLoginText: {
    color: colors.buttonPrimaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});
