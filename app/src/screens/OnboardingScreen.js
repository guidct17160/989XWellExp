import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const onboardingData = [
  {
    icon: 'briefcase',
    title: 'จัดการ HR\nได้ง่ายขึ้น',
    desc: 'ดูข้อมูลส่วนตัว ลางาน ลงเวลา\nเช็คประวัติย้อนหลังได้ทุกที่',
    illustration: 'business',
  },
  {
    icon: 'gift',
    title: 'รับคะแนนและสิทธิพิเศษ\nมากมาย',
    desc: 'สะสมคะแนนจากการทำกิจกรรม แลกของรางวัล\nร่วมสนุกกับ missions พิเศษ',
    illustration: 'trophy',
  },
  {
    icon: 'apps',
    title: 'ทุกอย่างครบจบ\nในแอปเดียว',
    desc: 'เวลาเข้า-ออก ลางาน สวัสดิการ\nแจ้งเตือนและอื่นๆ รวมอยู่ในที่เดียว',
    illustration: 'phone-portrait',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (nextIndex) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIndex(nextIndex);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      animateTransition(currentIndex + 1);
    } else {
      navigation.replace('Login');
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  const current = onboardingData[currentIndex];
  const isLast = currentIndex === onboardingData.length - 1;

  return (
    <View testID="screen-onboarding" className="flex-1" style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd, '#3A5BA0']}
        style={styles.gradient}
        className="flex-1 justify-between px-6 pt-12 pb-10"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Skip button */}
        <TouchableOpacity testID="onboarding-skip-btn" style={styles.skipButton} className="self-end px-3 py-1.5 rounded-full bg-white/20" onPress={handleSkip}>
          <Text style={styles.skipText} className="text-white font-medium text-sm">ข้าม</Text>
        </TouchableOpacity>

        {/* Illustration */}
        <Animated.View
          style={[
            styles.illustrationContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
          className="items-center justify-center my-6"
        >
          <View style={styles.illustrationBg} className="w-48 h-48 rounded-full bg-white/10 items-center justify-center border border-white/20">
            <Ionicons
              name={current.illustration}
              size={100}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
          className="items-center mb-6"
        >
          <Text testID="onboarding-title" style={styles.title} className="text-2xl font-bold text-white text-center leading-8 mb-3">{current.title}</Text>
          <Text testID="onboarding-desc" style={styles.desc} className="text-base text-white/80 text-center leading-6">{current.desc}</Text>
        </Animated.View>

        {/* Dots */}
        <View testID="onboarding-dots-container" style={styles.dotsContainer} className="flex-row justify-center items-center mb-8">
          {onboardingData.map((_, index) => (
            <View
              testID={`onboarding-dot-${index}`}
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
              className={`h-2 rounded-full mx-1 ${index === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity testID="onboarding-next-btn" style={styles.nextButton} className="flex-row bg-white rounded-xl py-4 px-6 items-center justify-center shadow-lg" onPress={handleNext}>
          <Text style={styles.nextButtonText} className="text-primary font-bold text-base">
            {isLast ? 'เริ่มใช้งาน' : 'ถัดไป'}
          </Text>
          <Ionicons
            name={isLast ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={colors.primary}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 50,
  },
  skipButton: {
    position: 'absolute',
    top: 54,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationBg: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 14,
  },
  desc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    width: width - 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
