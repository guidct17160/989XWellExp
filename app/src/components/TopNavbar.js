import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { notificationStorage } from '../services/notificationStorage';
import { pointsStorage } from '../services/pointsStorage';

import { authService } from '../services/authService';
import { navigationHistory } from '../services/navigationHistory';

export default function TopNavbar({
  navigation,
  title,
  points,
  showBack = false,
  onBackPress,
  onPointsPress,
  onNamePress,
}) {
  const [unreadCount, setUnreadCount] = useState(notificationStorage.getUnreadCount());
  const [livePoints, setLivePoints] = useState(pointsStorage.getUserPoints());
  const [bannerNotif, setBannerNotif] = useState(null);
  const [authUser, setAuthUser] = useState(authService.getUser());
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const autoDismissTimer = useRef(null);

  const displayTitle = title || authUser?.name || 'พนักงาน';

  const showBanner = (notifItem) => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }
    setBannerNotif(notifItem);
    slideAnim.setValue(-140);

    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    autoDismissTimer.current = setTimeout(() => {
      hideBanner();
    }, 4500);
  };

  const hideBanner = () => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
    }
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setBannerNotif(null);
    });
  };

  useEffect(() => {
    const unsubAuth = authService.subscribe((u) => setAuthUser(u));

    const unsubscribeCount = notificationStorage.subscribe(() => {
      setUnreadCount(notificationStorage.getUnreadCount());
    });

    const unsubscribeBanner = notificationStorage.subscribeBanner((item) => {
      showBanner(item);
    });

    let unsubscribePoints = () => {};
    if (pointsStorage && typeof pointsStorage.subscribe === 'function') {
      unsubscribePoints = pointsStorage.subscribe(({ userPoints }) => {
        setLivePoints(userPoints);
      });
    }

    return () => {
      unsubAuth();
      unsubscribeCount();
      unsubscribeBanner();
      unsubscribePoints();
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, []);

  const textColor = colors.primary || '#1F4C9C';
  const iconColor = colors.primary || '#1F4C9C';
  const btnBgColor = colors.primaryLight || '#EBF2FA';
  const pointsBg = colors.yellowLight || '#FFF8E6';
  const pointsTextColor = colors.yellow || '#F6B828';

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    navigationHistory.goBackSafe(navigation, 'MainTabs', { screen: 'Home' });
  };

  const handleNamePress = () => {
    if (onNamePress) {
      onNamePress();
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('MainTabs', { screen: 'Profile' });
    }
  };

  const handlePointsPress = () => {
    if (onPointsPress) {
      onPointsPress();
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('PointHistory');
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Sliding In-App Push Notification Banner from Top */}
      {bannerNotif && (
        <Animated.View
          testID="top-navbar-banner-notification"
          style={[
            styles.bannerContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity
            testID="top-navbar-banner-card"
            style={styles.bannerCard}
            activeOpacity={0.92}
            onPress={() => {
              if (!bannerNotif) return;
              const targetScreen = bannerNotif.screen || 'Notifications';
              const isRequestsTab =
                bannerNotif.tab === 'requests' ||
                bannerNotif.activeTab === 'requests' ||
                bannerNotif.openRequestsTab ||
                targetScreen === 'RequestStatus';

              hideBanner();
              if (navigation && typeof navigation.navigate === 'function') {
                if (isRequestsTab) {
                  navigation.navigate('RequestStatus');
                } else if (targetScreen === 'TimeCorrection') {
                  navigation.navigate('TimeCorrection', {
                    issueData: bannerNotif.issueData,
                    selectedIssueId: bannerNotif.issueId,
                    timestamp: Date.now(),
                  });
                } else if (targetScreen === 'TimeAttendance') {
                  navigation.navigate('MainTabs', { screen: 'TimeAttendance' });
                } else {
                  navigation.navigate(targetScreen);
                }
              }
            }}
          >
            <View
              style={[
                styles.bannerIconBg,
                { backgroundColor: bannerNotif.iconColor ? bannerNotif.iconColor + '18' : '#EBF2FA' }
              ]}
            >
              <Ionicons
                name={bannerNotif.icon || (bannerNotif.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline')}
                size={22}
                color={bannerNotif.iconColor || (bannerNotif.type === 'success' ? '#27AE60' : colors.pink)}
              />
            </View>
            <View style={styles.bannerTextWrapper}>
              <Text testID="top-navbar-banner-title" style={styles.bannerTitle} numberOfLines={1}>
                {bannerNotif.title}
              </Text>
              <Text testID="top-navbar-banner-message" style={styles.bannerMessage} numberOfLines={2}>
                {bannerNotif.message}
              </Text>
            </View>
            <TouchableOpacity testID="top-navbar-banner-close-btn" onPress={hideBanner} style={styles.bannerCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Header Render */}
      {showBack ? (
        <View testID="top-navbar-subpage-header" style={styles.subPageHeader}>
          <TouchableOpacity
            testID="top-navbar-back-btn"
            style={[styles.subBackBtn, { backgroundColor: btnBgColor }]}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={iconColor} />
          </TouchableOpacity>
          <Text testID="top-navbar-subpage-title" style={[styles.subPageTitle, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      ) : (
        <View testID="top-navbar" style={styles.outerHeader}>
          <View style={styles.container}>
            {/* Left side: User Name */}
            <TouchableOpacity
              testID="top-navbar-name-btn"
              style={styles.leftContainer}
              onPress={handleNamePress}
              activeOpacity={0.7}
            >
                <Text testID="top-navbar-title" style={[styles.nameText, { color: textColor }]} numberOfLines={1}>
                  {displayTitle}
                </Text>
            </TouchableOpacity>

            {/* Right side: Points Badge + Notification Bell Icon */}
            <View style={styles.rightContainer}>
              {/* Points Badge */}
              <TouchableOpacity
                testID="top-navbar-points-badge"
                style={[styles.pointsBadge, { backgroundColor: pointsBg }]}
                onPress={handlePointsPress}
                activeOpacity={0.85}
              >
                <Ionicons name="star" size={14} color={pointsTextColor} style={{ marginRight: 4 }} />
                <Text testID="top-navbar-points-text" style={[styles.pointsText, { color: pointsTextColor }]}>
                  {Number((typeof points === 'number' ? points : livePoints) || 0).toLocaleString()}
                </Text>
              </TouchableOpacity>

              {/* Notification Bell */}
              <TouchableOpacity
                testID="top-navbar-notification-btn"
                style={[styles.notifBtn, { backgroundColor: btnBgColor }]}
                onPress={() => {
                  if (navigation && typeof navigation.navigate === 'function') {
                    navigation.navigate('Notifications');
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="notifications-outline" size={20} color={iconColor} />
                {unreadCount > 0 && (
                  <View testID="top-navbar-notification-badge" style={[styles.badge, { backgroundColor: colors.pink }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // In-App Notification Banner
  bannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 46,
    left: 14,
    right: 14,
    zIndex: 99999,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  bannerCardSuccess: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
  },
  bannerIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  bannerMessage: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  bannerCloseBtn: {
    padding: 6,
  },
  subPageHeader: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF5',
    zIndex: 100,
  },
  subBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F4C9C',
    textAlign: 'center',
    flex: 1,
  },
  outerHeader: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF5',
    zIndex: 100,
  },
  darkHeader: {
    backgroundColor: 'transparent',
  },
  lightHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  container: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  titleTextWrapper: {
    justifyContent: 'center',
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  subtitleText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#E24C4B',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
