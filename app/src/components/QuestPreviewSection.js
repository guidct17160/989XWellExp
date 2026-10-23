import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { tryFetchApi } from '../services/apiClient';

/**
 * "ภารกิจ (Quest)" block shown on the Rewards tab: the open quests assigned to the employee
 * (tap one to start it, "ดูทั้งหมด" opens the full list).
 */
export default function QuestPreviewSection({ navigation }) {
  const [quests, setQuests] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const res = await tryFetchApi('/my-quests');
          const data = res ? await res.json().catch(() => ({})) : {};
          if (!alive) return;
          if (res && res.ok && data.success) {
            setQuests(data.quests || []);
            setState('ready');
          } else {
            setState('error');
          }
        } catch (e) {
          if (alive) setState('error');
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const open = quests.filter((q) => !q.passed);
  const shown = open.slice(0, 3);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 ภารกิจ (Quest)</Text>
        <TouchableOpacity testID="rewards-quests-see-all-btn" onPress={() => navigation.navigate('Quests')}>
          <Text style={styles.seeAll}>ดูทั้งหมด</Text>
        </TouchableOpacity>
      </View>

      {state === 'loading' ? null : shown.length === 0 ? (
        <TouchableOpacity style={styles.empty} activeOpacity={0.8} onPress={() => navigation.navigate('Quests')}>
          <Ionicons name="trophy-outline" size={22} color="#94A3B8" />
          <Text style={styles.emptyText}>
            {state === 'error' ? 'โหลดภารกิจไม่สำเร็จ แตะเพื่อลองใหม่' : quests.length > 0 ? 'คุณทำภารกิจครบแล้ว 🎉' : 'ยังไม่มีภารกิจที่เปิดให้ทำ'}
          </Text>
        </TouchableOpacity>
      ) : (
        shown.map((q) => (
          <TouchableOpacity
            key={q.id}
            testID={`rewards-quest-${q.id}`}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('QuestPlay', { questId: q.id, title: q.title })}
          >
            <View style={styles.iconBg}>
              <Ionicons name="trophy" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{q.title}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                ตอบถูก {q.passCount}/{q.questionCount} ข้อ • หมดเขต {q.endDate}
                {q.rewardTitle ? ` • 🎁 ${q.rewardTitle}` : ''}
              </Text>
            </View>
            <View style={styles.points}>
              <Ionicons name="star" size={12} color="#D97706" />
              <Text style={styles.pointsText}>{q.totalPoints}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  seeAll: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  iconBg: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardMeta: { fontSize: 11, color: '#64748B', marginTop: 3 },
  points: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  pointsText: { fontSize: 12, fontWeight: '800', color: '#B45309' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { flex: 1, fontSize: 12, color: '#64748B' },
});
