import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';

const fmtEnd = (q) => `${q.endDate} ${q.endTime}`;

/** Quests (quizzes) the Admin assigned to this employee: open ones to do, finished ones already passed */
export default function QuestsScreen({ navigation }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await tryFetchApi('/my-quests');
      if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถโหลด Quest ได้');
      setQuests(data.quests || []);
      setError('');
    } catch (e) {
      setError(e.message || 'ไม่สามารถโหลด Quest ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // reload every time the screen comes back (after finishing a quiz the list must show it as passed)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView testID="screen-quests" style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      <TopNavbar navigation={navigation} title="ภารกิจ (Quest)" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryText}>ลองอีกครั้ง</Text>
            </TouchableOpacity>
          </View>
        ) : quests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>ยังไม่มี Quest ที่เปิดให้คุณทำ</Text>
            <Text style={styles.emptySub}>เมื่อ HR มอบหมาย Quest ใหม่ จะแสดงที่นี่</Text>
          </View>
        ) : (
          quests.map((q) => (
            <TouchableOpacity
              key={q.id}
              testID={`quest-card-${q.id}`}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('QuestPlay', { questId: q.id, title: q.title })}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>{q.title}</Text>
                {q.passed ? (
                  <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text style={[styles.badgeText, { color: '#16A34A' }]}>ผ่านแล้ว</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.badgeText, { color: '#B45309' }]}>ทำเลย</Text>
                  </View>
                )}
              </View>
              {!!q.description && <Text style={styles.desc} numberOfLines={2}>{q.description}</Text>}
              <View style={styles.metaRow}>
                <View style={styles.meta}>
                  <Ionicons name="help-circle-outline" size={15} color="#64748B" />
                  <Text style={styles.metaText}>ต้องตอบถูก {q.passCount}/{q.questionCount} ข้อ</Text>
                </View>
                <View style={styles.meta}>
                  <Ionicons name="star-outline" size={15} color="#D97706" />
                  <Text style={[styles.metaText, { color: '#D97706', fontWeight: '700' }]}>
                    {q.passed ? `ได้รับ ${q.pointsAwarded} แต้ม` : `${q.totalPoints} แต้ม`}
                  </Text>
                </View>
              </View>
              {!!q.rewardTitle && (
                <View style={styles.meta}>
                  <Ionicons name="gift-outline" size={15} color="#7C3AED" />
                  <Text style={[styles.metaText, { color: '#7C3AED' }]}>รางวัลฟรี: {q.rewardTitle}</Text>
                </View>
              )}
              {!q.passed && <Text style={styles.deadline}>หมดเขต {fmtEnd(q)}</Text>}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  desc: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  deadline: { fontSize: 11, color: '#94A3B8' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', textAlign: 'center', marginTop: 6 },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  retry: { marginTop: 10, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
