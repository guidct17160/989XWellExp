import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Image,
} from 'react-native';

import { colors } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../services/authService';
import { logoUri } from '../assets/logoBase64';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Check if user already has a persisted session (e.g. after page refresh)
    const existingSession = authService.restoreSession();
    if (existingSession && authService.isLoggedIn()) {
      // Skip splash/onboarding/login — go directly to MainTabs
      const skipTimer = setTimeout(() => {
        navigation.replace('MainTabs');
      }, 600); // Brief delay for smooth UX
      return () => clearTimeout(skipTimer);
    }

    // Normal first-time flow: animate then go to Onboarding
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto navigate after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View testID="screen-splash" className="flex-1" style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient
        colors={[colors.gradientStart, '#5B21B6', colors.gradientEnd]}
        style={styles.gradient}
        className="flex-1 items-center justify-center"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          className="items-center"
        >
          {/* Logo Card */}
          <View testID="splash-logo" style={styles.logoContainer} className="p-4 rounded-3xl  items-center justify-center mb-6 shadow-2xl">
            <Image
              source={{ uri: logoUri }}
              style={{ width: 180, height: 40 }}
              resizeMode="contain"
            />
          </View>

          <Text testID="splash-title" style={styles.title} className="text-3xl font-extrabold text-white tracking-widest text-center">EMPLOYEE</Text>
          <Text style={styles.title} className="text-3xl font-extrabold text-white tracking-widest text-center">EXPERIENCE</Text>

          <Animated.View testID="splash-subtitle" style={[styles.subtitleContainer, { opacity: subtitleFade }]} className="mt-3 items-center">
            <Text style={styles.subtitle} className="text-sm font-semibold text-white/80 tracking-wide">GO. TRACK. EARN.</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View testID="splash-footer" style={[styles.footer, { opacity: subtitleFade }]} className="absolute bottom-14">
          <Text style={styles.footerTag} className="text-xs text-white/50 tracking-widest font-semibold">HR • WELLNESS • REWARDS</Text>
        </Animated.View>
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
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  circle1: {
    width: 300,
    height: 300,
    top: -80,
    right: -80,
  },
  circle2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -60,
  },
  circle3: {
    width: 150,
    height: 150,
    bottom: -30,
    right: 40,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
    lineHeight: 44,
  },
  subtitleContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
  },
  footerTag: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    fontWeight: '600',
  },
});
