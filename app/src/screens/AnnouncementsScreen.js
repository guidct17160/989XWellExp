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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';

const initialAnnouncements = [
  {
    id: '1',
    category: 'อัปเดตระบบ',
    categoryColor: '#3AAAE8',
    title: '📢 ประกาศปิดปรับปรุงระบบประจำเดือน',
    desc: 'ระบบจะทำการปิดปรับปรุงชั่วคราวเพื่ออัปเกรดประสิทธิภาพในวันเสาร์ที่ 2 สิงหาคม เวลา 22:00 - 02:00 น. กรุณาวางแผนการใช้งานล่วงหน้า',
    time: '26 ก.ค. 2026',
    isNew: true,
    author: 'ฝ่ายไอทีและระบบบริหาร',
  },
  {
    id: '2',
    category: 'โปรโมชั่น & กิจกรรม',
    categoryColor: '#D93A8B',
    title: '🎉 กิจกรรม Team Building พัทยา 2026',
    desc: 'ขอเชิญชวนพนักงานทุกคนเข้าร่วมกิจกรรม Team Building ประจำปี ณ โรงแรมดุสิตธานี พัทยา วันที่ 15-16 ส.ค. นี้ ฟรีตลอดงาน! สามารถลงทะเบียนได้แล้ววันนี้',
    time: '24 ก.ค. 2026',
    isNew: true,
    author: 'ฝ่ายทรัพยากรบุคคล (HR)',
  },
  {
    id: '3',
    category: 'ประกาศสำคัญ',
    categoryColor: '#1F4C9C',
    title: '⚠️ แจ้งเปลี่ยนแปลงระเบียบการเบิกค่ารักษาพยาบาล',
    desc: 'ฝ่าย HR ขอแจ้งปรับปรุงขั้นตอนการยื่นเอกสารเบิกค่ารักษาพยาบาลรูปแบบใหม่ ผ่านระบบดิจิทัล เริ่มใช้งานตั้งแต่วันที่ 1 ส.ค. เป็นต้นไป',
    time: '20 ก.ค. 2026',
    isNew: false,
    author: 'ฝ่ายสวัสดิการและสิทธิประโยชน์',
  },
];

const categories = ['ทั้งหมด', 'ประกาศสำคัญ', 'โปรโมชั่น & กิจกรรม', 'อัปเดตระบบ'];

export default function AnnouncementsScreen({ navigation, route }) {
  const scrollViewRef = useRef(null);

  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    // Fetch from backend database API
    const fetchAnnouncements = async () => {
      try {
        const res = await tryFetchApi('/announcements');
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.announcements) && data.announcements.length > 0) {
            setAnnouncements(data.announcements);
          }
        }
      } catch (e) {}
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (route?.params?.selectedAnnouncement) {
      setSelectedItem(route.params.selectedAnnouncement);
    }
  }, [route?.params?.selectedAnnouncement, route?.params?.openTimestamp]);

  const handleCloseDetail = () => {
    setSelectedItem(null);
    if (route?.params?.fromHome) {
      navigation.goBack();
    }
  };

  const filteredItems = announcements.filter((item) => {
    const matchCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // If an announcement is selected, render full-screen detail view natively without Modal overlay
  if (selectedItem) {
    return (
      <SafeAreaView testID="screen-announcement-detail" className="flex-1 bg-white" style={styles.fullModalSafeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Full Screen Header */}
        <View style={styles.fullModalHeader} className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100">
          <TouchableOpacity
            testID="announcement-detail-back-btn"
            style={styles.fullModalBackBtn}
            className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
            onPress={handleCloseDetail}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.fullModalHeaderTitle} className="text-base font-bold text-slate-900" numberOfLines={1}>
            รายละเอียดประกาศ
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Modal Content ScrollView */}
        <ScrollView
          style={styles.fullModalScroll}
          className="flex-1 bg-white p-6"
          contentContainerStyle={styles.fullModalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Category & Time Badge Row */}
          <View style={styles.fullModalMetaBadgeRow} className="flex-row items-center justify-between mb-4">
            <View style={[styles.badge, { backgroundColor: (selectedItem?.categoryColor || '#1F4C9C') + '18' }]} className="px-3 py-1 rounded-full">
              <Text style={[styles.badgeText, { color: selectedItem?.categoryColor || '#1F4C9C' }]} className="text-xs font-bold">
                {selectedItem?.category}
              </Text>
            </View>
            <View style={styles.timeWrapper} className="flex-row items-center">
              <Ionicons name="calendar-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.timeText} className="text-xs text-slate-500">{selectedItem?.time}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.fullModalTitle} className="text-xl font-bold text-slate-900 mb-4 leading-7">{selectedItem?.title}</Text>

          {/* Author info card */}
          <View style={styles.authorCard} className="flex-row items-center bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
            <View style={styles.authorAvatar} className="w-8 h-8 rounded-full bg-primary-light items-center justify-center mr-3">
              <Ionicons name="person" size={18} color="#1F4C9C" />
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorLabel} className="text-[10px] text-slate-400">ผู้ออกประกาศ</Text>
              <Text style={styles.authorName} className="text-xs font-semibold text-slate-700">{selectedItem?.author}</Text>
            </View>
          </View>

          <View style={styles.fullModalDivider} className="h-px bg-slate-100 my-4" />

          {/* Body Description */}
          <Text style={styles.fullModalBodyText} className="text-base text-slate-700 leading-6">{selectedItem?.desc}</Text>
        </ScrollView>

        {/* Bottom Action Footer */}
        <View style={styles.fullModalFooter} className="p-4 bg-white border-t border-slate-100">
          <TouchableOpacity
            testID="announcement-detail-close-btn"
            style={styles.fullModalConfirmBtn}
            className="w-full bg-primary rounded-xl py-3.5 items-center justify-center"
            onPress={handleCloseDetail}
            activeOpacity={0.88}
          >
            <Text style={styles.fullModalConfirmText} className="text-white font-bold text-base">รับทราบ / ปิดหน้าต่าง</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="screen-announcements" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="ประกาศ / โปรโมท" showBack />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]} className="flex-1 bg-slate-50">
        {/* Search Bar */}
        <View style={styles.searchContainer} className="flex-row items-center bg-white m-4 px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
          <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} className="mr-3" />
          <TextInput
            testID="announcements-search-input"
            style={styles.searchInput}
            className="flex-1 text-base text-slate-900"
            placeholder="ค้นหาประกาศ หรือ โปรโมชั่น..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter */}
        <ScrollView
          testID="announcements-category-filter"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          className="px-4 mb-3"
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              testID={`announcements-category-${cat}`}
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              className={`px-4 py-2 rounded-full mr-2 ${selectedCategory === cat ? 'bg-primary' : 'bg-white border border-slate-200'}`}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat && styles.categoryChipTextActive,
                ]}
                className={`text-xs font-semibold ${selectedCategory === cat ? 'text-white' : 'text-slate-600'}`}
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
          style={styles.listScroll}
          className="flex-1 bg-slate-50"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer} className="items-center justify-center py-12">
              <Ionicons name="newspaper-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText} className="text-sm font-medium text-slate-400">ไม่พบประกาศหรือโปรโมชั่นในหมวดหมู่นี้</Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <TouchableOpacity
                testID={`announcement-item-${item.id}`}
                key={item.id}
                style={styles.card}
                className="bg-white mx-4 my-2 p-4 rounded-2xl border border-slate-100 shadow-sm"
                activeOpacity={0.88}
                onPress={() => setSelectedItem(item)}
              >
                <View style={styles.cardHeader} className="flex-row items-center justify-between mb-2">
                  <View style={[styles.badge, { backgroundColor: item.categoryColor + '18' }]} className="px-2.5 py-0.5 rounded-full">
                    <Text style={[styles.badgeText, { color: item.categoryColor }]} className="text-[11px] font-bold">
                      {item.category}
                    </Text>
                  </View>

                  <View style={styles.timeWrapper}>
                    <Ionicons name="calendar-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                <Text style={styles.cardDesc} numberOfLines={3}>
                  {item.desc}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.authorText}>โดย: {item.author}</Text>
                  <View style={styles.readMoreBtn}>
                    <Text style={styles.readMoreText}>อ่านเพิ่มเติม</Text>
                    <Ionicons name="chevron-forward" size={14} color="#1F4C9C" />
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
