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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';

export default function SetPinScreen({ navigation, route }) {
  const isSetupPrompt = route?.params?.fromSetupPrompt || false;
  const initialMode = route?.params?.mode || (authService.hasPin() ? 'change' : 'setup');

  // Stages:
  // For 'change': 'current' -> 'new' -> 'confirm'
  // For 'setup': 'new' -> 'confirm'
  const [step, setStep] = useState(initialMode === 'change' ? 'current' : 'new');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
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
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const getActiveCode = () => {
    if (step === 'current') return currentPin;
    if (step === 'new') return newPin;
    return confirmPin;
  };

  const handleKeyPress = (num) => {
    setErrorMsg('');
    const active = getActiveCode();
    if (active.length >= 6) return;

    const nextCode = active + String(num);

    if (step === 'current') {
      setCurrentPin(nextCode);
      if (nextCode.length === 6) {
        // Move to 'new' step
        setTimeout(() => {
          setStep('new');
        }, 200);
      }
    } else if (step === 'new') {
      setNewPin(nextCode);
      if (nextCode.length === 6) {
        // Move to 'confirm' step
        setTimeout(() => {
          setStep('confirm');
        }, 200);
      }
    } else if (step === 'confirm') {
      setConfirmPin(nextCode);
      if (nextCode.length === 6) {
        // Evaluate confirmation
        setTimeout(() => {
          handleSubmit(newPin, nextCode);
        }, 250);
      }
    }
  };

  const handleDelete = () => {
    setErrorMsg('');
    if (step === 'current') {
      setCurrentPin((prev) => prev.slice(0, -1));
    } else if (step === 'new') {
      setNewPin((prev) => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = async (pinVal, confirmVal) => {
    if (pinVal !== confirmVal) {
      triggerShake();
      setErrorMsg('รหัส PIN ทั้ง 2 ครั้งไม่ตรงกัน กรุณาลองใหม่อีกครั้ง');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      const res = await pinService.setPin(
        pinVal,
        step === 'confirm' && currentPin ? currentPin : null
      );
      setLoading(false);

      Alert.alert(
        'ตั้งรหัส PIN สำเร็จ 🎉',
        'บัญชีของคุณได้รับการตั้งรหัส PIN 6 หลักเรียบร้อยแล้ว สามารถใช้ปลดล็อกเพื่อเข้าใช้งานได้อย่างสะดวกรวดเร็ว',
        [
          {
            text: 'ตกลง',
            onPress: () => {
              if (isSetupPrompt) {
                navigation.replace('MainTabs');
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    } catch (err) {
      setLoading(false);
      triggerShake();
      const msg = err.message || 'เกิดข้อผิดพลาดในการตั้งรหัส PIN';
      setErrorMsg(msg);
      if (step === 'confirm' && initialMode === 'change') {
        // If current PIN was rejected by backend, reset to current step
        setConfirmPin('');
        setNewPin('');
        setCurrentPin('');
        setStep('current');
      } else {
        setConfirmPin('');
      }
    }
  };

  const getStepTitle = () => {
    if (step === 'current') return 'กรอกรหัส PIN เดิม';
    if (step === 'new') return initialMode === 'change' ? 'กำหนดรหัส PIN ใหม่ 6 หลัก' : 'กำหนดรหัส PIN 6 หลัก';
    return 'ยืนยันรหัส PIN 6 หลักอีกครั้ง';
  };

  const getStepSubtitle = () => {
    if (step === 'current') return 'เพื่อความปลอดภัย กรุณายืนยันรหัส PIN ปัจจุบันของคุณก่อนเปลี่ยน';
    if (step === 'new') return 'เลือกตัวเลข 6 หลักที่คุณจำได้ง่ายและปลอดภัยสำหรับบัญชีนี้';
    return 'กรุณากรอกรหัส PIN 6 หลักตัวเดิมเพื่อยืนยันความถูกต้อง';
  };

  const activeCode = getActiveCode();

  return (
    <SafeAreaView testID="screen-set-pin" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="btn-back-set-pin"
          style={styles.backButton}
          onPress={() => {
            if (step === 'confirm') {
              setConfirmPin('');
              setStep('new');
            } else if (step === 'new' && initialMode === 'change') {
              setNewPin('');
              setStep('current');
            } else if (isSetupPrompt) {
              navigation.replace('MainTabs');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>
          {initialMode === 'change' ? 'เปลี่ยนรหัส PIN' : 'ตั้งรหัส PIN บัญชี'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        {/* Shield Icon Badge */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={[colors.gradientStart, colors.primary]}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* Title & Instructions */}
        <Text testID="txt-set-pin-title" style={styles.title}>{getStepTitle()}</Text>
        <Text style={styles.subtitle}>{getStepSubtitle()}</Text>

        {/* 6 PIN Indicator Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < activeCode.length;
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

        {/* Error Message Display */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text testID="txt-pin-error" style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <View style={{ height: 26 }} />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>กำลังบันทึกรหัส PIN...</Text>
          </View>
        ) : (
          /* Numeric Keypad */
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
                    testID={`keypad-btn-${num}`}
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
              {/* Reset / Clear Button */}
              <TouchableOpacity
                testID="keypad-btn-clear"
                style={styles.keypadActionBtn}
                onPress={() => {
                  if (step === 'current') setCurrentPin('');
                  else if (step === 'new') setNewPin('');
                  else setConfirmPin('');
                  setErrorMsg('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.actionText}>ล้าง</Text>
              </TouchableOpacity>

              {/* Number 0 */}
              <TouchableOpacity
                testID="keypad-btn-0"
                style={styles.keypadBtn}
                onPress={() => handleKeyPress(0)}
                activeOpacity={0.7}
              >
                <Text style={styles.keypadNum}>0</Text>
              </TouchableOpacity>

              {/* Backspace Button */}
              <TouchableOpacity
                testID="keypad-btn-backspace"
                style={styles.keypadActionBtn}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Ionicons name="backspace-outline" size={26} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    marginBottom: 12,
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
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
});
