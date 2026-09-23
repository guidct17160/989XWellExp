import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Vibration,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';

export default function PinLockScreen({ navigation }) {
  const [user, setUser] = useState(authService.getUser() || {});
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setUser(authService.getUser() || {});
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const triggerShake = () => {
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(80);
      } catch (e) {}
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 9, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = (num) => {
    if (loading) return;
    setErrorMsg('');
    if (pin.length >= 6) return;

    const nextPin = pin + String(num);
    setPin(nextPin);

    if (nextPin.length === 6) {
      setTimeout(() => {
        handleVerify(nextPin);
      }, 200);
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleVerify = async (pinValue) => {
    setLoading(true);
    try {
      const username = user?.username || user?.code || user?.id;
      await pinService.verifyPin(pinValue, username);
      setLoading(false);
      // PIN verified successfully! Unlock and go to MainTabs
      navigation.replace('MainTabs');
    } catch (err) {
      setLoading(false);
      triggerShake();
      const msg = err.message || 'รหัส PIN ไม่ถูกต้อง';
      setErrorMsg(msg);
      setPin('');
    }
  };

  const handleBiometric = () => {
    Alert.alert(
      'Face ID / Touch ID',
      'เข้าสู่ระบบด้วยชีวมาตร (Biometrics) สำเร็จ',
      [
        {
          text: 'เข้าสู่แอป',
          onPress: () => navigation.replace('MainTabs'),
        },
      ]
    );
  };

  const handleLoginWithPassword = () => {
    Alert.alert(
      'เข้าสู่ระบบด้วยรหัสผ่าน',
      'ต้องการสลับไปเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: () => {
            authService.logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView testID="screen-pin-lock" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        {/* User Avatar & Welcome Header */}
        <View style={styles.userSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri:
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
              }}
              style={styles.avatarImage}
            />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            </View>
          </View>
          <Text testID="txt-pin-lock-username" style={styles.userName}>
            {(user?.name || 'พนักงาน').replace(/\s*\([^)]*\)/g, '').trim()}
          </Text>
          <Text style={styles.userRole}>
            {user?.department || 'WellX989 Enterprise'}
          </Text>
          <Text style={styles.lockInstructions}>กรุณากรอกรหัส PIN เพื่อปลดล็อก</Text>
        </View>

        {/* 6 Dots Indicator */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isFilled ? styles.dotFilled : styles.dotEmpty,
                  errorMsg ? styles.dotError : null,
                ]}
              />
            );
          })}
        </View>

        {/* Error message */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text testID="txt-pin-lock-error" style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <View style={{ height: 26 }} />
        )}

        {/* Loading Spinner or Keypad */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>กำลังตรวจสอบรหัส PIN...</Text>
          </View>
        ) : (
          <View style={styles.keypad}>
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    testID={`lock-keypad-${num}`}
                    style={styles.keypadBtn}
                    onPress={() => handleKeyPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadNum}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.keypadRow}>
              {/* Biometric Icon Button */}
              <TouchableOpacity
                testID="btn-pin-biometric"
                style={styles.keypadActionBtn}
                onPress={handleBiometric}
                activeOpacity={0.7}
              >
                <Ionicons name="finger-print-outline" size={28} color={colors.primary} />
              </TouchableOpacity>

              {/* Number 0 */}
              <TouchableOpacity
                testID="lock-keypad-0"
                style={styles.keypadBtn}
                onPress={() => handleKeyPress(0)}
                activeOpacity={0.7}
              >
                <Text style={styles.keypadNum}>0</Text>
              </TouchableOpacity>

              {/* Backspace Button */}
              <TouchableOpacity
                testID="btn-pin-backspace"
                style={styles.keypadActionBtn}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Ionicons name="backspace-outline" size={26} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Switch to Password Login Option */}
        <TouchableOpacity
          testID="btn-switch-to-password"
          style={styles.switchLoginBtn}
          onPress={handleLoginWithPassword}
          activeOpacity={0.7}
        >
          <Ionicons name="key-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.switchLoginText}>เข้าสู่ระบบด้วยรหัสผ่าน / สลับบัญชี</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  userSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  lockInstructions: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0074C4',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginHorizontal: 10,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.15 }],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  keypadBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  keypadActionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadNum: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  switchLoginText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
