import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { authService } from '../services/authService';
import { logoUri } from '../assets/logoBase64';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [employeeFocused, setEmployeeFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const employeeInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    const cleanUser = employeeId.trim();
    const cleanPass = password.trim();

    setErrorMsg('');

    if (!cleanUser && !cleanPass) {
      const msg = 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน';
      setErrorMsg(msg);
      Alert.alert('แจ้งเตือน', msg);
      return;
    }
    if (!cleanUser) {
      const msg = 'กรุณากรอกชื่อผู้ใช้ (Username) หรืออีเมล';
      setErrorMsg(msg);
      Alert.alert('แจ้งเตือน', msg);
      return;
    }
    if (!cleanPass) {
      const msg = 'กรุณากรอกรหัสผ่าน (Password)';
      setErrorMsg(msg);
      Alert.alert('แจ้งเตือน', msg);
      return;
    }

    setLoading(true);
    try {
      const res = await authService.login(cleanUser, cleanPass);
      setLoading(false);
      Alert.alert('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับคุณ ${res.user?.name || cleanUser} (${res.user?.role || 'User'})`, [
        {
          text: 'เข้าสู่แอปพลิเคชัน',
          onPress: () => navigation?.replace('MainTabs'),
        },
      ]);
    } catch (err) {
      setLoading(false);
      const msg = err.message || 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง';
      setErrorMsg(msg);
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', msg);
    }
  };

  const handleFaceId = () => {
    Alert.alert('Face ID', 'เชื่อมต่อ Face ID SDK ตรงนี้');
  };

  return (
    <SafeAreaView testID="screen-login" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { justifyContent: 'center', alignItems: 'center', minHeight: '100%' }]}
          className="flex-grow px-6 py-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                width: '100%',
                maxWidth: 420,
                alignSelf: 'center',
              },
            ]}
            className="w-full justify-center items-stretch"
          >
            {/* Header with WellX989 Branding */}
            <View style={styles.headerSection} className="mb-6 items-center justify-center">
              <View className="items-center justify-center">
                <Image
                  source={{ uri: logoUri }}
                  style={{ width: 120, height: 80 }}
                  resizeMode="contain"
                />
              </View>
              <Text testID="login-header-title" style={styles.headerTitle} className="text-2xl font-extrabold text-slate-800 mb-1 text-center">Login</Text>
              <Text testID="login-header-subtitle" style={styles.headerSubtitle} className="text-xs text-slate-500 text-center">
                Welcome to WellX989 2 in 1 Application
              </Text>
            </View>

            {/* Error Alert Banner (Shown in Web & App) */}
            {errorMsg ? (
              <View style={styles.errorBanner} className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex-row items-center">
                <Ionicons name="alert-circle" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText} className="text-red-700 text-xs font-bold flex-1">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* อีเมล (Email) */}
            <Text testID="login-employee-id-label" style={styles.label} className="text-sm font-semibold text-slate-700 mb-2"></Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => employeeInputRef.current?.focus()}
              style={[
                styles.inputWrapper,
                employeeFocused && styles.inputWrapperFocused,
              ]}
              className="flex-row items-center border border-slate-200 rounded-xl px-4 bg-slate-50 mb-5"
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={employeeFocused ? colors.primary : colors.textSecondary}
                style={styles.inputIcon}
                className="mr-3"
              />
              <TextInput
                ref={employeeInputRef}
                testID="login-employee-id-input"
                style={styles.input}
                className="flex-1 text-slate-900"
                value={employeeId}
                onChangeText={setEmployeeId}
                placeholder="Username"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                includeFontPadding={false}
                textAlignVertical="center"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={true}
                onFocus={() => setEmployeeFocused(true)}
                onBlur={() => setEmployeeFocused(false)}
              />
            </TouchableOpacity>

            {/* รหัสผ่าน */}
            <Text testID="login-password-label" style={styles.label} className="text-sm font-semibold text-slate-700 mb-2"></Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => passwordInputRef.current?.focus()}
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}
              className="flex-row items-center border border-slate-200 rounded-xl px-4 bg-slate-50 mb-4"
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={passwordFocused ? colors.primary : colors.textSecondary}
                style={styles.inputIcon}
                className="mr-3"
              />
              <TextInput
                ref={passwordInputRef}
                testID="login-password-input"
                style={styles.input}
                className="flex-1 text-slate-900"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                includeFontPadding={false}
                textAlignVertical="center"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={true}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                testID="login-toggle-password-visibility-btn"
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* ลืมรหัสผ่าน (ชิดขวา) */}
            <View style={[styles.row, { justifyContent: 'flex-end' }]} className="flex-row items-center justify-end mb-6">
              <TouchableOpacity
                testID="login-forgot-password-link"
                onPress={() => navigation?.navigate('ForgotPassword')}
              >
                <Text style={styles.link} className="text-sm font-semibold text-primary">Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* ปุ่มเข้าสู่ระบบ */}
            <TouchableOpacity
              testID="login-submit-btn"
              style={styles.loginButton}
              className="bg-primary rounded-xl py-3.5 items-center justify-center mb-6"
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.buttonPrimaryText} />
              ) : (
                <Text style={styles.loginButtonText} className="text-white font-bold text-base">Login</Text>
              )}
            </TouchableOpacity>

            {/* เส้นคั่น "หรือ" */}
            <View style={styles.dividerRow} className="flex-row items-center mb-6">
              <View style={styles.dividerLine} className="flex-1 h-px bg-slate-200" />
              <Text style={styles.dividerText} className="px-4 text-xs text-slate-400 font-medium">or continue with</Text>
              <View style={styles.dividerLine} className="flex-1 h-px bg-slate-200" />
            </View>

            {/* ปุ่ม Face ID */}
            <TouchableOpacity
              testID="login-face-id-btn"
              style={styles.faceIdButton}
              className="flex-row items-center justify-center border border-primary rounded-xl py-3.5 mb-6"
              onPress={handleFaceId}
            >
              <Ionicons
                name="scan-outline"
                size={22}
                color={colors.faceIdText}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.faceIdText} className="text-primary font-semibold text-base">Log in with Face ID</Text>
            </TouchableOpacity>

            

            
          </Animated.View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerSection: {
    marginTop: 70,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 6,
    marginTop: 30,
  },
  headerSubtitle: {
    paddingTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 13,
    color: colors.label,
    marginBottom: 6,
    marginTop: 14,
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
    height: 52,
    paddingVertical: 0,
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
    height: 44,
    maxHeight: 44,
    paddingVertical: 0,
    fontSize: 15,
    color: colors.inputText,
    textAlignVertical: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.checkboxBorder,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.checkboxChecked,
    borderColor: colors.checkboxChecked,
  },
  rememberText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  link: {
    fontSize: 13,
    color: colors.link,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  faceIdButton: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.faceIdBorder,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceIdText: {
    color: colors.faceIdText,
    fontSize: 14,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  registerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  demoHint: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
