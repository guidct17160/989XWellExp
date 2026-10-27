import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { notificationStorage } from '../services/notificationStorage';
import TopNavbar from '../components/TopNavbar';

export default function NotificationsScreen({ navigation }) {
  const [notifState, setNotifState] = useState(notificationStorage.getState());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const unsubscribe = notificationStorage.subscribe((state) => {
      setNotifState(state);
    });
    // Pull the latest notifications from the backend
    notificationStorage.clearAndSync();

    return () => {
      unsubscribe();
    };
  }, []);

  const notifications = notifState.notifications || [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    notificationStorage.markAllRead();
  };

  const handleNotifPress = (notif) => {
    if (!notif) return;
    if (notif.unread) {
      notificationStorage.toggleRead(notif.id);
    }
    if (navigation && typeof navigation.navigate === 'function') {
      const isRequestsTab =
        notif.tab === 'requests' ||
        notif.activeTab === 'requests' ||
        notif.openRequestsTab ||
        notif.screen === 'RequestStatus';

      if (isRequestsTab) {
        navigation.navigate('RequestStatus');
      } else if (notif.screen === 'TimeCorrection') {
        navigation.navigate('TimeCorrection', {
          issueData: notif.issueData,
          selectedIssueId: notif.issueId,
          timestamp: Date.now(),
        });
      } else if (notif.screen === 'TimeAttendance') {
        navigation.navigate('MainTabs', { screen: 'TimeAttendance' });
      } else if (notif.screen === 'LeaveRequest') {
        navigation.navigate('LeaveRequest');
      } else if (notif.screen === 'Announcements') {
        navigation.navigate('Announcements', { selectedAnnouncement: notif.announcement || null, openTimestamp: Date.now(), fromNotifications: true });
      } else if (notif.screen) {
        navigation.navigate(notif.screen);
      }
    }
  };

  return (
    <SafeAreaView testID="screen-notifications" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="การแจ้งเตือน" showBack />

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.topNotifBar}>
          <Text style={styles.topNotifTitle}>การแจ้งเตือนทั้งหมด</Text>
          {unreadCount > 0 && (
            <TouchableOpacity testID="notifications-mark-all-read-btn" style={styles.markAllBtn} onPress={markAllRead}>
              <Ionicons name="checkmark-done-outline" size={14} color="#1F4C9C" style={{ marginRight: 4 }} />
              <Text style={styles.markAllText}>อ่านทั้งหมด ({unreadCount})</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          testID="notifications-list"
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="notifications-off-outline" size={44} color="#94A3B8" />
              <Text style={{ marginTop: 10, fontSize: 14, color: '#64748B' }}>ยังไม่มีการแจ้งเตือน</Text>
            </View>
          )}
          {notifications.map((notif) => (
            <TouchableOpacity
              testID={`notifications-item-${notif.id}`}
              key={notif.id}
              style={[
                styles.notifCard,
                notif.unread && styles.notifCardUnread,
              ]}
              onPress={() => handleNotifPress(notif)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.notifIconBg,
                  { backgroundColor: (notif.iconColor || colors.primary) + '15' },
                ]}
              >
                <Ionicons name={notif.icon || 'notifications-outline'} size={22} color={notif.iconColor || colors.primary} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={[
                    styles.notifTitle,
                    notif.unread && styles.notifTitleUnread,
                  ]}>
                    {notif.title}
                  </Text>
                  {notif.unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMessage} numberOfLines={2}>
                  {notif.message}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                  {notif.screen && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginRight: 2 }}>
                        ไปยังหน้า {notif.tab === 'requests' || notif.activeTab === 'requests' ? 'สถานะคำขอ' : notif.screen === 'TimeCorrection' ? 'ปรับปรุงเวลา' : notif.screen === 'LeaveRequest' ? 'การลางาน' : notif.screen === 'Announcements' ? 'ประกาศ' : notif.screen === 'ManagerApproval' ? 'อนุมัติคำขอ' : 'รายละเอียด'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: { flex: 1 },
  topNotifBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topNotifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF2FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F4C9C',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.title,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  markAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  notifCardUnread: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  notifIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.title,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '700',
    color: colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.badgeRed,
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 11,
    color: colors.label,
  },
});
