import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { navigationHistory } from '../services/navigationHistory';
import { useTheme } from '../context/ThemeContext';

/**
 * Announcement detail. There is no announcement list any more: an announcement reaches the employee as an item
 * in the notification bell (NotificationsScreen / the banner open this screen with it).
 */
export default function AnnouncementsScreen({ navigation, route }) {
  const { theme, isDarkMode, language } = useTheme();
  const selectedItem = route?.params?.selectedAnnouncement || null;

  // opened without an announcement (e.g. the web page was refreshed): nothing to show, go to the notifications
  useEffect(() => {
    if (!selectedItem) navigation.navigate('Notifications');
  }, [selectedItem, navigation]);

  const handleCloseDetail = () => {
    // back and "รับทราบ" return to the notification list. This must go through the history (not a plain
    // navigate('Notifications')), otherwise the notification list's own back button returns here again.
    navigationHistory.goBackSafe(navigation, 'Notifications', {});
  };

  if (!selectedItem) return null;

  return (
    <SafeAreaView testID="screen-announcement-detail" style={[styles.fullModalSafeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Full Screen Header */}
      <View style={[styles.fullModalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          testID="announcement-detail-back-btn"
          style={[styles.fullModalBackBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
          onPress={handleCloseDetail}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.fullModalHeaderTitle, { color: theme.text }]} numberOfLines={1}>
          {language === 'en' ? 'Announcement Details' : 'รายละเอียดประกาศ'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Modal Content ScrollView */}
      <ScrollView
        style={[styles.fullModalScroll, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.fullModalContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date */}
        <View style={styles.fullModalMetaBadgeRow}>
          <View style={styles.timeWrapper}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>{selectedItem?.time || selectedItem?.createdDate}</Text>
          </View>
        </View>

        {/* Picture uploaded by the admin */}
        {!!selectedItem?.imageUrl && (
          <Image source={{ uri: selectedItem.imageUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 14, backgroundColor: theme.border }} resizeMode="cover" />
        )}

        {/* Title */}
        <Text style={[styles.fullModalTitle, { color: theme.text }]}>{selectedItem?.title}</Text>

        {/* Author info card */}
        <View style={[styles.authorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.authorAvatar}>
            <Ionicons name="person" size={18} color={colors.primary} />
          </View>
          <View style={styles.authorInfo}>
            <Text style={[styles.authorLabel, { color: theme.textSecondary }]}>{language === 'en' ? 'Announcer' : 'ผู้ออกประกาศ'}</Text>
            <Text style={[styles.authorName, { color: theme.text }]}>{selectedItem?.author}</Text>
          </View>
        </View>

        <View style={[styles.fullModalDivider, { backgroundColor: theme.border }]} />

        {/* Body Description */}
        <Text style={[styles.fullModalBodyText, { color: theme.text }]}>{selectedItem?.desc || selectedItem?.content}</Text>
      </ScrollView>

      {/* Bottom Action Footer */}
      <View style={[styles.fullModalFooter, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity
          testID="announcement-detail-close-btn"
          style={styles.fullModalConfirmBtn}
          onPress={handleCloseDetail}
          activeOpacity={0.88}
        >
          <Text style={styles.fullModalConfirmText}>{language === 'en' ? 'Acknowledge & Close' : 'รับทราบ / ปิดหน้าต่าง'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  categoryScroll: {
    maxHeight: 46,
    marginBottom: 6,
  },
  categoryContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#1F4C9C',
    borderColor: '#1F4C9C',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8EEF5',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  authorText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F4C9C',
    marginRight: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  fullModalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullModalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  fullModalBackBtn: {
    padding: 4,
  },
  fullModalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
  },
  fullModalScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fullModalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fullModalMetaBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 28,
    marginBottom: 16,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EEF5',
    marginBottom: 16,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EBF2FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  fullModalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  fullModalBodyText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 25,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF5',
  },
  fullModalFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fullModalConfirmBtn: {
    backgroundColor: '#1F4C9C',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  fullModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
