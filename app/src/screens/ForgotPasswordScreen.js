import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { navigationHistory } from '../services/navigationHistory';

/**
 * หน้า "ลืมรหัสผ่าน" ของแอปพนักงาน
 * นโยบาย: พนักงานรีเซ็ตรหัสผ่านเองไม่ได้ ต้องแจ้งผู้ดูแลระบบ (Admin) ให้รีเซ็ตให้
 * Admin จะกด Reset Password ที่เว็บ เมนู All Employees แล้วระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของพนักงาน
 * หน้านี้จึงเป็นหน้าให้ข้อมูลเท่านั้น ไม่มีการเรียก API
 */
export default function ForgotPasswordScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const goBack = () => navigationHistory.goBackSafe(navigation, 'Login');

  return (
    <SafeAreaView testID="screen-forgot-password" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <TouchableOpacity testID="forgot-password-back-btn" style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.iconBg}>
          <Ionicons name="shield-checkmark-outline" size={44} color={colors.primary} />
        </View>

        <Text testID="forgot-password-title" style={styles.title}>ลืมรหัสผ่าน?</Text>
        <Text testID="forgot-password-subtitle" style={styles.subtitle}>
          พนักงานไม่สามารถรีเซ็ตรหัสผ่านด้วยตัวเองได้{'\n'}
          กรุณาแจ้งผู้ดูแลระบบ (Admin) ให้รีเซ็ตรหัสผ่านให้
        </Text>

        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>ขั้นตอน</Text>
          <Text style={styles.step}>1. แจ้ง Admin หรือฝ่าย HR ว่าต้องการรีเซ็ตรหัสผ่าน (บอกชื่อและรหัสพนักงาน)</Text>
          <Text style={styles.step}>2. Admin กดรีเซ็ตรหัสผ่านให้จากระบบ Web Admin</Text>
          <Text style={styles.step}>3. คุณจะได้รับอีเมลลิงก์ตั้งรหัสผ่านใหม่ (ลิงก์ใช้ได้ 15 นาที)</Text>
          <Text style={styles.step}>4. เปิดลิงก์ ตั้งรหัสผ่านใหม่ แล้วกลับมาเข้าสู่ระบบ</Text>
        </View>

        <TouchableOpacity testID="forgot-password-back-to-login-btn" style={styles.button} onPress={goBack}>
          <Text style={styles.buttonText}>กลับไปหน้าเข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.title, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  stepsBox: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
  },
  stepsTitle: { fontSize: 14, fontWeight: '700', color: colors.title, marginBottom: 8 },
  step: { fontSize: 13, color: colors.textSecondary, lineHeight: 21, marginBottom: 4 },
  button: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.buttonPrimaryText, fontSize: 15, fontWeight: '700' },
});
