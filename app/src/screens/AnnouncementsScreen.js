import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';
import { navigationHistory } from '../services/navigationHistory';
import { useTheme } from '../context/ThemeContext';

const getCategoryColor = (cat) => {
  if (cat?.includes('สำคัญ') || cat?.toLowerCase().includes('important')) return '#EF4444';
  if (cat?.includes('โปรโมชั่น') || cat?.toLowerCase().includes('promo')) return '#EC4899';
  if (cat?.includes('ระบบ') || cat?.toLowerCase().includes('system')) return '#3B82F6';
  return '#8B5CF6';
};

export default function AnnouncementsScreen({ navigation, route }) {
  const { theme, isDarkMode, t, language } = useTheme();
  const scrollViewRef = useRef(null);

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(language === 'en' ? 'All' : 'ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const categories = language === 'en'
    ? ['All', 'Announcements', 'Promotions & Events', 'System Updates']
    : ['ทั้งหมด', 'ประกาศสำคัญ', 'โปรโมชั่น & กิจกรรม', 'อัปเดตระบบ'];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    // Fetch from real PostgreSQL database API
    const fetchAnnouncements = async () => {
      setLoading(true);
      try {
        const res = await tryFetchApi('/announcements');
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.announcements)) {
            const mapped = data.announcements.map((a) => ({
              ...a,
              desc: a.desc || a.content,
              categoryColor: a.categoryColor || getCategoryColor(a.category),
              time: a.time || (a.createdAt ? new Date(a.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH') : ''),
            }));
            setAnnouncements(mapped);
          }
        }
      } catch (e) {
        console.error('Error fetching announcements:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [language]);

  useEffect(() => {
    if (route?.params?.selectedAnnouncement) {
      setSelectedItem(route.params.selectedAnnouncement);
    }
  }, [route?.params?.selectedAnnouncement, route?.params?.openTimestamp]);

  const handleCloseDetail = () => {
    setSelectedItem(null);
    if (route?.params?.fromHome) {
      navigationHistory.goBackSafe(navigation, 'MainTabs', { screen: 'Home' });
    }
  };

  const filteredItems = announcements.filter((item) => {
    const matchCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
    const matchSearch =
      String(item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.desc || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // If an announcement is selected, render full-screen detail view natively without Modal overlay
  if (selectedItem) {
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
          {/* Category & Time Badge Row */}
          <View style={styles.fullModalMetaBadgeRow}>
            <View style={[styles.badge, { backgroundColor: (selectedItem?.categoryColor || '#1F4C9C') + '18' }]}>
              <Text style={[styles.badgeText, { color: selectedItem?.categoryColor || '#1F4C9C' }]}>
                {selectedItem?.category}
              </Text>
            </View>
            <View style={styles.timeWrapper}>
              <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{selectedItem?.time}</Text>
            </View>
          </View>

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

  return (
    <SafeAreaView testID="screen-announcements" style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title={t('announcements')} showBack />

      <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: theme.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            testID="announcements-search-input"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={language === 'en' ? 'Search announcements...' : 'ค้นหาประกาศ หรือ โปรโมชั่น...'}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter */}
        <ScrollView
          testID="announcements-category-filter"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              testID={`announcements-category-${cat}`}
              key={cat}
              style={[
                styles.categoryChip,
                { backgroundColor: selectedCategory === cat ? colors.primary : theme.surface, borderColor: theme.border },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: selectedCategory === cat ? '#FFFFFF' : theme.text },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Announcements List */}
        <ScrollView
          testID="announcements-list"
          ref={scrollViewRef}
          style={[styles.listScroll, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('noAnnouncements')}</Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <TouchableOpacity
                testID={`announcement-item-${item.id}`}
                key={item.id}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                activeOpacity={0.88}
                onPress={() => setSelectedItem(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: (item.categoryColor || '#1F4C9C') + '18' }]}>
                    <Text style={[styles.badgeText, { color: item.categoryColor || '#1F4C9C' }]}>
                      {item.category}
                    </Text>
                  </View>

                  <View style={styles.timeWrapper}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>{item.time}</Text>
                  </View>
                </View>

                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>

                <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={3}>
                  {item.desc || item.content}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={[styles.authorText, { color: theme.textSecondary }]}>{language === 'en' ? 'By' : 'โดย'}: {item.author}</Text>
                  <View style={styles.readMoreBtn}>
                    <Text style={[styles.readMoreText, { color: colors.primary }]}>{language === 'en' ? 'Read more' : 'อ่านเพิ่มเติม'}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
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
