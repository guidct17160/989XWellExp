import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { waveLogoUri } from '../assets/logoBase64';
import { authService } from '../services/authService';
import { pinService } from '../services/pinService';
import { navigationHistory } from '../services/navigationHistory';

const KEYPAD_LETTERS = {
  1: '',
  2: 'ABC',
  3: 'DEF',
  4: 'GHI',
  5: 'JKL',
  6: 'MNO',
  7: 'PQRS',
  8: 'TUV',
  9: 'WXYZ',
  0: '+',
};

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
        setTimeout(() => {
          setStep('new');
        }, 200);
      }
    } else if (step === 'new') {
      setNewPin(nextCode);
      if (nextCode.length === 6) {
        setTimeout(() => {
          setStep('confirm');
        }, 200);
      }
    } else if (step === 'confirm') {
      setConfirmPin(nextCode);
      if (nextCode.length === 6) {
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
        'ตั้งรหัส PIN สำเร็จ',
        'บัญชีของคุณได้รับการตั้งรหัส PIN 6 หลักเรียบร้อยแล้ว สามารถใช้ปลดล็อกเพื่อเข้าใช้งานได้อย่างสะดวกรวดเร็ว',
        [
          {
            text: 'ตกลง',
            onPress: () => {
              if (isSetupPrompt || initialMode === 'setup' || !navigation.canGoBack()) {
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

  

  const activeCode = getActiveCode();

  return (
    <SafeAreaView testID="screen-set-pin" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Modern Top Bar */}
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
              navigationHistory.goBackSafe(navigation, 'MainTabs', { screen: 'Profile' });
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
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
        {/* Step Progress Pill Indicator */}
        <View style={styles.stepBadgeContainer}>
          <View style={[styles.stepPill, step === 'current' || step === 'new' ? styles.stepPillActive : styles.stepPillInactive]}>
            <Text style={[styles.stepPillText, step === 'current' || step === 'new' ? styles.stepPillTextActive : styles.stepPillTextInactive]}>
              {initialMode === 'change' ? '1. PIN ใหม่' : '1. ตั้งรหัส PIN'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={12} color="#94A3B8" style={{ marginHorizontal: 4 }} />
          <View style={[styles.stepPill, step === 'confirm' ? styles.stepPillActive : styles.stepPillInactive]}>
            <Text style={[styles.stepPillText, step === 'confirm' ? styles.stepPillTextActive : styles.stepPillTextInactive]}>
              2. ยืนยันรหัส PIN
            </Text>
          </View>
        </View>

        {/* App logo (wave) badge with glowing aura */}
        <View style={styles.iconOuterRing}>
          <View style={styles.iconGradient}>
            <Image source={{ uri: waveLogoUri }} style={styles.logoImage} resizeMode="contain" />
          </View>
        </View>

        {/* Title & Instructions */}
        <Text testID="txt-set-pin-title" style={styles.title}>{getStepTitle()}</Text>
        

        {/* 6 Modern PIN Indicator Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < activeCode.length;
            return (
              <View
                key={index}
                style={[
                  styles.dotContainer,
                  errorMsg ? styles.dotContainerError : isFilled ? styles.dotContainerFilled : styles.dotContainerEmpty,
                ]}
              >
                {isFilled && !errorMsg && (
                  <LinearGradient
                    colors={['#7C3AED', '#3B82F6']}
                    style={styles.dotFilledCore}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Error Message Display */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text testID="txt-pin-error" style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <View style={{ height: 28 }} />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>กำลังบันทึกรหัส PIN...</Text>
          </View>
        ) : (
          /* Modern Fintech Keypad */
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
                    activeOpacity={0.65}
                  >
                    <Text style={styles.keypadNum}>{num}</Text>
                    {KEYPAD_LETTERS[num] ? (
                      <Text style={styles.keypadLetter}>{KEYPAD_LETTERS[num]}</Text>
                    ) : null}
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
                activeOpacity={0.65}
              >
                <View style={styles.actionIconCircle}>
                  <Ionicons name="refresh-outline" size={19} color="#64748B" />
                </View>
                <Text style={styles.actionText}>ล้าง</Text>
              </TouchableOpacity>

              {/* Number 0 */}
              <TouchableOpacity
                testID="keypad-btn-0"
                style={styles.keypadBtn}
                onPress={() => handleKeyPress(0)}
                activeOpacity={0.65}
              >
                <Text style={styles.keypadNum}>0</Text>
                <Text style={styles.keypadLetter}>+</Text>
              </TouchableOpacity>

              {/* Backspace Button */}
              <TouchableOpacity
                testID="keypad-btn-backspace"
                style={styles.keypadActionBtn}
                onPress={handleDelete}
                activeOpacity={0.65}
              >
                <View style={styles.actionIconCircle}>
                  <Ionicons name="backspace-outline" size={20} color="#475569" />
                </View>
                <Text style={styles.actionText}>ลบ</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  stepBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stepPillActive: {
    backgroundColor: '#EDE9FE',
  },
  stepPillInactive: {
    backgroundColor: 'transparent',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepPillTextActive: {
    color: '#7C3AED',
  },
  stepPillTextInactive: {
    color: '#94A3B8',
  },
  iconOuterRing: {
    padding: 4,
    borderRadius: 34,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    marginBottom: 6,
  },
  iconGradient: {
    width: 76,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: 52,
    height: 28,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 16,
    marginBottom: 10,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  dotContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotContainerEmpty: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  dotContainerFilled: {
    backgroundColor: '#7C3AED',
    transform: [{ scale: 1.15 }],
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  dotContainerError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  dotFilledCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  keypad: {
    width: '100%',
    maxWidth: 296,
    alignSelf: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keypadBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  keypadNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 27,
  },
  keypadLetter: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  keypadActionBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
});
