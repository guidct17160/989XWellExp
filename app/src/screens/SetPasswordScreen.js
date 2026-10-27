import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tryFetchApi } from '../services/apiClient';
import { navigationHistory } from '../services/navigationHistory';
import { authService } from '../services/authService';

export default function SetPasswordScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Extract email & token from route params or URL query string
    let initialEmail = route?.params?.email || '';
    let initialToken = route?.params?.token || '';

    if (typeof window !== 'undefined' && window.location) {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        if (!initialEmail) initialEmail = searchParams.get('email') || '';
        if (!initialToken) initialToken = searchParams.get('token') || '';
      } catch (e) {}
    }

    if (initialToken) setToken(initialToken);
    if (initialEmail) {
      const decodedEmail = decodeURIComponent(initialEmail);
      setEmail(decodedEmail);
    }
  }, [route]);

  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!token) return;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        const atobFn = typeof atob === 'function' ? atob : (input) => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let str = input.replace(/=+$/, '');
          let output = '';
          for (let bc = 0, bs = 0, buffer, i = 0;
            buffer = str.charAt(i++);
            ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
              bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
          ) {
            buffer = chars.indexOf(buffer);
          }
          return output;
        };
        const payload = JSON.parse(atobFn(base64));
        if (payload.exp) {
          const update = () => {
            const nowSec = Math.floor(Date.now() / 1000);
            const remaining = payload.exp - nowSec;
            if (remaining <= 0) {
              setSecondsRemaining(0);
              setIsExpired(true);
            } else {
              setSecondsRemaining(remaining);
            }
          };
          update();
          const timer = setInterval(update, 1000);
          return () => clearInterval(timer);
        }
      }
    } catch (e) {}
  }, [token]);

  // --- REAL-TIME VALIDATIONS ---

  // Password Checks
  const passLenValid = newPassword.length >= 6;
  const passHasLetter = /[a-zA-Z]/.test(newPassword);
  const passHasNumber = /[0-9]/.test(newPassword);
  const isPasswordValid = passLenValid && passHasLetter && passHasNumber;

  // Confirm Password Check
  const isConfirmValid = confirmPassword.length > 0 && confirmPassword === newPassword;

  const handleSetPassword = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = newPassword.trim();

    if (isExpired) {
      Alert.alert('ลิงก์หมดอายุ', 'ลิงก์ตั้งรหัสผ่านหมดอายุแล้ว (จำกัดเวลา 15 นาที) กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ');
      return;
    }

    if (!cleanEmail) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุอีเมลพนักงาน');
      return;
    }

    if (!isPasswordValid) {
      Alert.alert('ข้อกำหนดความปลอดภัย', 'กรุณากรอก Password ให้ถูกต้องครบตามเงื่อนไข (ติ๊กถูกครบถ้วน)');
      return;
    }

    if (!isConfirmValid) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่');
      return;
    }

    setLoading(true);
    try {
      const response = await tryFetchApi('/employees/set-password', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanEmail,
          password: cleanPassword,
          token: token.trim(),
        }),
      });

      setLoading(false);

      if (response && response.ok) {
        setSuccess(true);
      } else {
        const data = response ? await response.json().catch(() => null) : null;
        Alert.alert('เกิดข้อผิดพลาด', data?.message || 'ไม่สามารถตั้งรหัสผ่านได้ กรุณาตรวจสอบลิงก์หรือติดต่อฝ่าย HR');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('เกิดข้อผิดพลาด', error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // The Login screen sends anyone who is still signed in on this device to that person's PIN lock. When a new user has just
  // set a password (often on a device where someone else, e.g. another employee, is signed in), sign that session out first
  // so the Login screen really opens for the new user.
  const goToLogin = () => {
    if (authService.isLoggedIn()) authService.logout();
    navigation.navigate('Login');
  };

  const RequirementItem = ({ isMet, label }) => (
    <View style={styles.checkItemRow}>
      <Ionicons
        name={isMet ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={isMet ? '#10B981' : '#64748B'}
        style={styles.checkIcon}
      />
      <Text style={[styles.checkText, isMet && styles.checkTextMet]}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigationHistory.goBackSafe(navigation, 'Login')}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-sharp" size={32} color="#F43F5E" />
              </View>
              <Text style={styles.title}>ตั้งรหัสผ่านเข้าใช้งาน</Text>
              <Text style={styles.subtitle}>
                กำหนดรหัสผ่านสำหรับเข้าใช้งาน WellX989 Mobile App
              </Text>
            </View>

            {success ? (
              <View style={styles.successCard}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>ตั้งรหัสผ่านสำเร็จ!</Text>
                <Text style={styles.successSubtitle}>
                  ชื่อผู้ใช้ (Username): <Text style={{ color: '#F43F5E', fontWeight: 'bold' }}>{email}</Text>{'\n'}
                  บันทึกรหัสผ่านเรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วย Email นี้ได้ทันที
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={goToLogin}
                >
                  <Text style={styles.primaryButtonText}>ไปที่หน้าเข้าสู่ระบบ</Text>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                {/* Readonly Verified Email & Username Notice */}
                <Text style={styles.label}>อีเมลพนักงาน (ใช้เป็น Username สำหรับเข้าแอป)</Text>
                <View style={[styles.inputContainer, styles.readonlyInput]}>
                  <Ionicons name="mail-unread-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: '#94A3B8' }]}
                    value={email}
                    editable={false}
                  />
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                </View>
                <View style={styles.usernameNoticeBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
                  <Text style={styles.usernameNoticeText}>
                    ระบบใช้ Email นี้เป็นชื่อผู้ใช้งาน (Username) สำหรับเข้าสู่ระบบอัตโนมัติ
                  </Text>
                </View>

                {/* 15-Minute Expiration Countdown Badge */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  borderWidth: 1,
                  borderColor: isExpired ? '#EF4444' : '#10B981',
                  marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={16} color={isExpired ? '#EF4444' : '#10B981'} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: isExpired ? '#EF4444' : '#10B981' }}>
                      {isExpired ? 'ลิงก์หมดอายุแล้ว (เกิน 15 นาที)' : 'เวลาที่เหลือ (จำกัด 15 นาที):'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: isExpired ? '#EF4444' : '#10B981' }}>
                    {isExpired ? '00:00' : secondsRemaining !== null ? `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}` : '15:00'}
                  </Text>
                </View>

                {/* New Password Input */}
                <Text style={styles.label}>ตั้งรหัสผ่านใหม่ (New Password) *</Text>
                <View style={[
                  styles.inputContainer,
                  isPasswordValid && styles.inputSuccessBorder
                ]}>
                  <Ionicons name="key-outline" size={20} color={isPasswordValid ? '#10B981' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="อย่างน้อย 6 ตัวอักษร (มีอังกฤษและตัวเลข)"
                    placeholderTextColor="#64748B"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>

                {/* Password Interactive Checklist */}
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistHeader}>ข้อกำหนดรหัสผ่าน (Password Rules):</Text>
                  <RequirementItem
                    isMet={passLenValid}
                    label="ความยาวอย่างน้อย 6 ตัวอักษรขึ้นไป"
                  />
                  <RequirementItem
                    isMet={passHasLetter}
                    label="มีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว (A-Z, a-z)"
                  />
                  <RequirementItem
                    isMet={passHasNumber}
                    label="มีตัวเลขอย่างน้อย 1 ตัว (0-9)"
                  />
                </View>

                {/* Confirm Password Input */}
                <Text style={styles.label}>ยืนยันรหัสผ่านใหม่ (Confirm Password) *</Text>
                <View style={[
                  styles.inputContainer,
                  isConfirmValid && styles.inputSuccessBorder
                ]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={isConfirmValid ? '#10B981' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    placeholderTextColor="#64748B"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password Checklist */}
                <View style={styles.checklistCard}>
                  <RequirementItem
                    isMet={isConfirmValid}
                    label="รหัสผ่านทั้งสองช่องตรงกันเรียบร้อยแล้ว"
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (!isPasswordValid || !isConfirmValid || isExpired) && styles.disabledButton
                  ]}
                  onPress={handleSetPassword}
                  disabled={loading || !isPasswordValid || !isConfirmValid || isExpired}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>บันทึกบัญชีผู้ใช้และรหัสผ่าน</Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 48,
  },
  inputSuccessBorder: {
    borderColor: 'rgba(16, 185, 129, 0.6)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  readonlyInput: {
    backgroundColor: '#182234',
    borderColor: '#2D3B54',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  checklistCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  checklistHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2.5,
  },
  checkIcon: {
    marginRight: 8,
  },
  checkText: {
    fontSize: 12,
    color: '#64748B',
  },
  checkTextMet: {
    color: '#10B981',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#F43F5E',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successIconCircle: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  usernameNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: -8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  usernameNoticeText: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 16,
  },
});
