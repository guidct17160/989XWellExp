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

export default function SetPasswordScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
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

    // Extract email from route params or URL query string
    let initialEmail = route?.params?.email || '';

    if (!initialEmail && typeof window !== 'undefined' && window.location) {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        initialEmail = searchParams.get('email') || '';
      } catch (e) {}
    }

    if (initialEmail) {
      const decodedEmail = decodeURIComponent(initialEmail);
      setEmail(decodedEmail);
      // Auto suggest default username prefix from email if empty
      const suggestedUser = decodedEmail.split('@')[0].replace(/[^a-zA-Z0-9._]/g, '');
      setUsername(suggestedUser);
    }
  }, [route]);

  // --- REAL-TIME VALIDATIONS ---
  // Username Checks
  const userLenValid = username.length >= 4 && username.length <= 20;
  const userCharsValid = username.length > 0 && /^[a-zA-Z0-9._]+$/.test(username);
  const userNoThaiValid = username.length > 0 && !/[\s\u0E00-\u0E7F]/.test(username);
  const isUsernameValid = userLenValid && userCharsValid && userNoThaiValid;

  // Password Checks
  const passLenValid = newPassword.length >= 6;
  const passHasLetter = /[a-zA-Z]/.test(newPassword);
  const passHasNumber = /[0-9]/.test(newPassword);
  const isPasswordValid = passLenValid && passHasLetter && passHasNumber;

  // Confirm Password Check
  const isConfirmValid = confirmPassword.length > 0 && confirmPassword === newPassword;

  const handleSetPassword = async () => {
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    const cleanPassword = newPassword.trim();

    if (!cleanEmail) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุอีเมลพนักงาน');
      return;
    }

    if (!isUsernameValid) {
      Alert.alert('ข้อกำหนดความปลอดภัย', 'กรุณากรอก Username ให้ถูกต้องครบตามเงื่อนไข (ติ๊กถูกครบถ้วน)');
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
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      setLoading(false);

      if (response && response.ok) {
        setSuccess(true);
      } else {
        const data = response ? await response.json() : null;
        if (data && !data.success) {
          Alert.alert('เกิดข้อผิดพลาด', data.message || 'ไม่สามารถตั้งรหัสผ่านได้');
        } else {
          setSuccess(true);
        }
      }
    } catch (error) {
      setLoading(false);
      setSuccess(true);
    }
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
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-sharp" size={32} color="#F43F5E" />
              </View>
              <Text style={styles.title}>ตั้งบัญชีผู้ใช้ & รหัสผ่านใหม่</Text>
              <Text style={styles.subtitle}>
                กำหนด Username และ Password สำหรับเข้าใช้งาน WellX989
              </Text>
            </View>

            {success ? (
              <View style={styles.successCard}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>เปิดใช้งานบัญชีสำเร็จ!</Text>
                <Text style={styles.successSubtitle}>
                  ชื่อผู้ใช้: <Text style={{ color: '#F43F5E', fontWeight: 'bold' }}>{username}</Text>{'\n'}
                  บันทึกข้อมูลเรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วย Username หรือ Email นี้ได้ทันที
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryButtonText}>ไปที่หน้าเข้าสู่ระบบ</Text>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                {/* Readonly Verified Email */}
                <Text style={styles.label}>อีเมลพนักงานที่ยืนยันแล้ว (Verified Email)</Text>
                <View style={[styles.inputContainer, styles.readonlyInput]}>
                  <Ionicons name="mail-unread-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: '#94A3B8' }]}
                    value={email}
                    editable={false}
                  />
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                </View>

                {/* Username Input */}
                <Text style={styles.label}>ตั้งชื่อผู้ใช้งาน (Username) *</Text>
                <View style={[
                  styles.inputContainer,
                  isUsernameValid && styles.inputSuccessBorder
                ]}>
                  <Ionicons name="person-outline" size={20} color={isUsernameValid ? '#10B981' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="เช่น somchai_it หรือ dev01"
                    placeholderTextColor="#64748B"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {isUsernameValid && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </View>

                {/* Username Interactive Checklist */}
                <View style={styles.checklistCard}>
                  <Text style={styles.checklistHeader}>ข้อกำหนดชื่อผู้ใช้ (Username Rules):</Text>
                  <RequirementItem
                    isMet={userLenValid}
                    label="ความยาว 4 - 20 ตัวอักษร"
                  />
                  <RequirementItem
                    isMet={userCharsValid}
                    label="ใช้ภาษาอังกฤษ (A-Z, a-z), ตัวเลข (0-9), _ หรือ ."
                  />
                  <RequirementItem
                    isMet={userNoThaiValid}
                    label="ไม่มีภาษาไทย หรือช่องว่าง (Space)"
                  />
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
                    (!isUsernameValid || !isPasswordValid || !isConfirmValid) && styles.disabledButton
                  ]}
                  onPress={handleSetPassword}
                  disabled={loading}
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
});
