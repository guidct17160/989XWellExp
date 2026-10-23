import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';
import { pointsStorage } from '../services/pointsStorage';

/** Take a quest quiz. The server grades it; passing inside the open period pays the points (and the free reward) at once. */
export default function QuestPlayScreen({ navigation, route }) {
  const { questId, title } = route.params || {};
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({}); // { [questionId]: [choiceId] }
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tryFetchApi(`/my-quests/${encodeURIComponent(questId)}`);
      if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สามารถโหลด Quest ได้');
      setQuest(data.quest);
      setError('');
    } catch (e) {
      setError(e.message || 'ไม่สามารถโหลด Quest ได้');
    } finally {
      setLoading(false);
    }
  }, [questId]);

  useEffect(() => {
    load();
  }, [load]);

  const questions = quest ? quest.sections.flatMap((s) => s.questions) : [];
  const answeredCount = questions.filter((q) => (answers[q.id] || []).length > 0).length;

  const pick = (q, choiceId) => {
    setAnswers((prev) => {
      const current = prev[q.id] || [];
      if (q.type === 'multi') {
        return { ...prev, [q.id]: current.includes(choiceId) ? current.filter((x) => x !== choiceId) : [...current, choiceId] };
      }
      return { ...prev, [q.id]: [choiceId] };
    });
  };

  const submit = async () => {
    if (answeredCount < questions.length) {
      Alert.alert('ตอบไม่ครบ', `คุณตอบแล้ว ${answeredCount}/${questions.length} ข้อ กรุณาตอบให้ครบทุกข้อก่อนส่ง`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await tryFetchApi(`/my-quests/${encodeURIComponent(questId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ คำตอบยังไม่ถูกส่ง');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'ส่งคำตอบไม่สำเร็จ');
      setResult(data.result);
      if (data.result.passed && pointsStorage && typeof pointsStorage.syncWithBackend === 'function') {
        pointsStorage.syncWithBackend(); // the new points show up everywhere
      }
    } catch (e) {
      Alert.alert('ส่งคำตอบไม่สำเร็จ', e.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const closeResult = () => {
    const passed = result && result.passed;
    setResult(null);
    if (passed) navigation.goBack();
    else setAnswers({}); // try again from a clean sheet
  };

  return (
    <SafeAreaView testID="screen-quest-play" style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      <TopNavbar navigation={navigation} title={title || 'Quest'} showBack />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color="#94A3B8" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={load}>
            <Text style={styles.primaryText}>ลองอีกครั้ง</Text>
          </TouchableOpacity>
        </View>
      ) : quest.passed ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          <Text style={styles.doneTitle}>คุณผ่าน Quest นี้แล้ว</Text>
          <Text style={styles.errorText}>ได้รับ {quest.pointsAwarded} แต้มเรียบร้อยแล้ว</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {!!quest.description && <Text style={styles.intro}>{quest.description}</Text>}
            <View style={styles.rule}>
              <Ionicons name="information-circle-outline" size={18} color="#0369A1" />
              <Text style={styles.ruleText}>
                ต้องตอบถูกอย่างน้อย {quest.passCount} จาก {quest.questionCount} ข้อ จึงจะผ่านและได้รับ {quest.totalPoints} แต้ม
                {quest.rewardTitle ? ` พร้อมรางวัลฟรี "${quest.rewardTitle}"` : ''} • หมดเขต {quest.endDate} {quest.endTime}
              </Text>
            </View>

            {questions.map((q, i) => (
              <View key={q.id} style={styles.qCard}>
                <Text style={styles.qTitle}>{i + 1}. {q.title}</Text>
                {!!q.description && <Text style={styles.qDesc}>{q.description}</Text>}
                <Text style={styles.qHint}>{q.type === 'multi' ? 'เลือกได้หลายข้อ (เลือกให้ครบทุกข้อที่ถูก)' : 'เลือกได้ 1 ข้อ'}</Text>
                {q.choices.map((c) => {
                  const on = (answers[q.id] || []).includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      testID={`quest-choice-${c.id}`}
                      style={[styles.choice, on && styles.choiceOn]}
                      activeOpacity={0.8}
                      onPress={() => pick(q, c.id)}
                    >
                      <Ionicons
                        name={q.type === 'multi' ? (on ? 'checkbox' : 'square-outline') : on ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={on ? colors.primary : '#94A3B8'}
                      />
                      <Text style={[styles.choiceText, on && { color: '#0F172A', fontWeight: '700' }]}>{c.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerCount}>ตอบแล้ว {answeredCount}/{questions.length}</Text>
            <TouchableOpacity testID="quest-submit-btn" style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>ส่งคำตอบ</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal visible={!!result} transparent animationType="fade" onRequestClose={closeResult}>
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            {result && (
              <>
                <Ionicons name={result.passed ? 'trophy' : 'close-circle'} size={56} color={result.passed ? '#F59E0B' : '#EF4444'} />
                <Text style={styles.resultTitle}>{result.passed ? 'ยินดีด้วย คุณผ่าน!' : 'ยังไม่ผ่าน'}</Text>
                <Text style={styles.resultLine}>ตอบถูก {result.correctCount}/{result.totalQuestions} ข้อ (ต้องถูกอย่างน้อย {result.passCount} ข้อ)</Text>
                {result.passed && <Text style={styles.resultPoints}>+{result.pointsAwarded} แต้ม</Text>}
                {result.passed && result.reward && (
                  <View style={styles.rewardBox}>
                    <Ionicons name="gift" size={20} color="#7C3AED" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardTitle}>ได้รับรางวัลฟรี: {result.reward.title}</Text>
                      <Text style={styles.rewardCode}>โค้ดคูปอง {result.reward.couponCode}</Text>
                    </View>
                  </View>
                )}
                {result.passed && result.rewardSkipped && (
                  <Text style={styles.resultLine}>รางวัลหมดสต็อกแล้ว แต่ได้รับแต้มครบถ้วน</Text>
                )}
                <TouchableOpacity style={[styles.primaryBtn, { alignSelf: 'stretch', marginTop: 16 }]} onPress={closeResult}>
                  <Text style={styles.primaryText}>{result.passed ? 'เสร็จสิ้น' : 'ลองใหม่อีกครั้ง'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  doneTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  intro: { fontSize: 14, color: '#475569', lineHeight: 21, marginBottom: 12 },
  rule: { flexDirection: 'row', gap: 8, backgroundColor: '#E0F2FE', borderRadius: 12, padding: 12, marginBottom: 14 },
  ruleText: { flex: 1, fontSize: 12, color: '#075985', lineHeight: 18, fontWeight: '600' },
  qCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  qTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  qDesc: { fontSize: 12, color: '#64748B', marginTop: 4 },
  qHint: { fontSize: 11, color: '#94A3B8', marginTop: 4, marginBottom: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 },
  choiceOn: { borderColor: colors.primary, backgroundColor: '#F0F9FF' },
  choiceText: { flex: 1, fontSize: 14, color: '#475569' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF', gap: 8 },
  footerCount: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultCard: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, alignItems: 'center', gap: 6 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  resultLine: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  resultPoints: { fontSize: 26, fontWeight: '800', color: '#D97706', marginVertical: 4 },
  rewardBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, alignSelf: 'stretch', marginTop: 6 },
  rewardTitle: { fontSize: 13, fontWeight: '700', color: '#5B21B6' },
  rewardCode: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
});
