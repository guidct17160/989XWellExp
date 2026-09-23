// MissionsScreen.js — Standardized Senior Mobile UX Mission Management & Reward Claiming
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
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';
import { missionStorage } from '../services/missionStorage';
import { pointsStorage } from '../services/pointsStorage';

export default function MissionsScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'daily' | 'weekly'
  const [missionsList, setMissionsList] = useState(missionStorage.getMissions());
  const [userPoints, setUserPoints] = useState(pointsStorage.getUserPoints());
  const [claimedModal, setClaimedModal] = useState({ visible: false, points: 0, title: '' });

  const [selectedQuest, setSelectedQuest] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchBackendMissions = async () => {
    try {
      await missionStorage.fetchMissions();
    } catch (e) {
      console.error('Failed to sync backend missions in mobile app', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        missionStorage.fetchMissions(),
        pointsStorage.syncWithBackend ? pointsStorage.syncWithBackend() : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Failed to pull-to-refresh missions and points', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackendMissions();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const unsubscribeMissions = missionStorage.subscribe((newList) => {
      setMissionsList(newList);
    });

    return () => unsubscribeMissions();
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    if (pointsStorage && typeof pointsStorage.subscribe === 'function') {
      unsubscribe = pointsStorage.subscribe(({ userPoints: newPoints }) => {
        setUserPoints(newPoints);
      });
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const targetId = route?.params?.targetMissionId;
    if (targetId) {
      const found = missionsList.find((m) => m.id === targetId || m.id === `m${targetId.replace(/\D/g, '')}` || targetId.includes(m.id));
      if (found && found.status !== 'completed' && found.status !== 'expired') {
        setSelectedQuest(found);
      }
    }
  }, [route?.params?.targetMissionId, route?.params?.openTimestamp]);

  const getSortedMissions = (list) => {
    return [...list].sort((a, b) => {
      const getPriority = (item) => {
        if (item.status === 'expired') return 2;
        if (item.status === 'completed') return 1;
        return 0; // 'pending' or 'ready_to_claim'
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const timeA = a.updatedAt || parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const timeB = b.updatedAt || parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return timeB - timeA;
    });
  };

  const filteredMissions = getSortedMissions(
    missionsList.filter((m) => {
      if (activeTab === 'daily') return m.category === 'daily';
      if (activeTab === 'weekly') return m.category === 'weekly';
      return true;
    })
  );

  const openQuestDetail = (item) => {
    if (!item || item.status === 'completed' || item.status === 'expired') return;
    setSelectedQuest(item);
    setAttachedFile(null);
    setUserAnswer('');
  };

  const handleAction = async (item) => {
    if (item.status === 'completed' || isClaiming) return;

    if (item.status === 'ready_to_claim') {
      setIsClaiming(true);
      try {
        const claimResult = await missionStorage.claimMission(item.id);
        
        const earned = claimResult?.pointsEarned || item.points;
        const { userPoints: updatedPoints } = pointsStorage.addTransaction(
          item.title,
          earned,
          'in',
          'ภารกิจ (Mission)'
        );
        if (claimResult?.newTotalPoints !== undefined) {
          setUserPoints(claimResult.newTotalPoints);
        } else {
          setUserPoints(updatedPoints);
        }

        setClaimedModal({
          visible: true,
          points: earned,
          title: item.title,
        });
      } catch (e) {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถรับรางวัลได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setIsClaiming(false);
      }
      return;
    }

    // Open detail quest execution view if not ready to claim
    openQuestDetail(item);
  };

  const handleBackFromQuest = () => {
    if (route?.params?.targetMissionId) {
      navigation.goBack();
    } else {
      setSelectedQuest(null);
    }
  };

  const handleSubmitQuest = async () => {
    if (!selectedQuest) return;

    const now = Date.now();
    const newProgress = Math.min(selectedQuest.total, selectedQuest.progress + 1);
    const isNowReady = newProgress >= selectedQuest.total;

    await missionStorage.updateMission(selectedQuest.id, {
      progress: newProgress,
      status: isNowReady ? 'ready_to_claim' : 'pending',
      updatedAt: now,
    });

    const questTitle = selectedQuest.title;

    if (route?.params?.targetMissionId) {
      Alert.alert(
        '🎉 ส่งเควสสำเร็จเรียบร้อย!',
        `บันทึกข้อมูลและหลักฐานการทำกิจกรรม "${questTitle}" สำเร็จเรียบร้อย สามารถกดปุ่ม "รับรางวัล" ได้เลย`,
        [{ text: 'ตกลง', onPress: () => navigation.goBack() }]
      );
    } else {
      setSelectedQuest(null);
      Alert.alert(
        '🎉 ส่งเควสสำเร็จเรียบร้อย!',
        `บันทึกข้อมูลและหลักฐานการทำกิจกรรม "${questTitle}" สำเร็จเรียบร้อย สามารถกดปุ่ม "รับรางวัล" ได้เลย`
      );
    }
  };

  const handleAttachFile = () => {
    setAttachedFile('หลักฐานการทำกิจกรรม_attached.jpg');
    Alert.alert('สำเร็จ 📎', 'แนบรูปภาพ/หลักฐานการทำเควสเรียบร้อยแล้ว');
  };

  // If a specific quest is selected (e.g. clicked directly from Home or Rewards Screen), render full screen Quest Detail View!
  if (selectedQuest) {
    return (
      <SafeAreaView style={styles.questSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#E11D48" />

        {/* Pink / Red Header Navbar */}
        <View style={styles.questHeaderBar}>
          <TouchableOpacity
            style={styles.questBackBtn}
            onPress={handleBackFromQuest}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.questHeaderTitle}>กิจกรรม</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.questScrollView} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Deep Blue Curved Header Card */}
          <View style={styles.blueCurvedCard}>
            <Text style={styles.questMainTitle}>
              {selectedQuest.descTitle || selectedQuest.title}
            </Text>

            {/* Description & Instruction Text 1 */}
            {selectedQuest.descText1 && (
              <Text style={styles.questDescText}>
                {selectedQuest.descText1}
              </Text>
            )}
            {selectedQuest.link1 && (
              <Text style={styles.questLinkText}>
                Link: <Text style={styles.questLinkUnderline}>{selectedQuest.link1}</Text>
              </Text>
            )}

            {/* Description & Instruction Text 2 */}
            {selectedQuest.descText2 && (
              <Text style={[styles.questDescText, { marginTop: 12 }]}>
                {selectedQuest.descText2}
              </Text>
            )}
            {selectedQuest.link2 && (
              <Text style={styles.questLinkText}>
                Link: <Text style={styles.questLinkUnderline}>{selectedQuest.link2}</Text>
              </Text>
            )}

            {/* Expiry Date */}
            <Text style={styles.expiryLabel}>วันที่หมดอายุ</Text>
            <Text style={styles.expiryVal}>{selectedQuest.expiry || '31 ก.ค. 2026 23:59'}</Text>

            {/* Points Earned Row */}
            <View style={styles.pointsEarnedRow}>
              <Text style={styles.pointsEarnedLabel}>พอยต์ที่ได้รับ</Text>
              <Text style={styles.pointsEarnedVal}>{selectedQuest.points} พอยต์</Text>
            </View>

            {/* Floating 3D Gold Trophy Icon Overlapping Edge */}
            <View style={styles.floatingTrophyBadge}>
              <Ionicons name="trophy" size={44} color="#F6B828" />
            </View>
          </View>

          {/* Quest Action Steps & Proof Submission */}
          <View style={styles.questStepsContainer}>
            {selectedQuest.step1 && (
              <View style={styles.stepCard}>
                <View style={styles.stepIconBg}>
                  <Ionicons name="document-text-outline" size={22} color="#1E293B" />
                </View>
                <Text style={styles.stepCardText}>{selectedQuest.step1}</Text>
              </View>
            )}

            <View style={styles.stepCard}>
              <View style={styles.stepIconBg}>
                <Ionicons name="document-text-outline" size={22} color="#1E293B" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.stepCardText}>
                  {selectedQuest.step2 || 'แคปหน้าจอหลักฐานการทำเควส และแนบไฟล์'}
                </Text>
                {attachedFile && (
                  <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 4 }}>
                    📎 {attachedFile}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={handleAttachFile}
                activeOpacity={0.85}
              >
                <Ionicons name="paperclip" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.attachBtnText}>แนบไฟล์</Text>
              </TouchableOpacity>
            </View>

            {selectedQuest.step3 && (
              <View style={styles.stepCard}>
                <View style={styles.stepIconBg}>
                  <Ionicons name="document-text-outline" size={22} color="#1E293B" />
                </View>
                <Text style={styles.stepCardText}>{selectedQuest.step3}</Text>
              </View>
            )}

            {selectedQuest.question && (
              <View style={styles.questionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={[styles.stepIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="help-circle-outline" size={22} color="#2563EB" />
                  </View>
                  <Text style={[styles.stepCardText, { fontWeight: '700' }]}>
                    {selectedQuest.question}
                  </Text>
                </View>
                <TextInput
                  style={styles.answerInput}
                  placeholder="พิมพ์คำตอบของคุณที่นี่..."
                  placeholderTextColor="#94A3B8"
                  value={userAnswer}
                  onChangeText={setUserAnswer}
                  multiline
                />
              </View>
            )}

            {/* Primary Submit Button */}
            <TouchableOpacity
              style={styles.submitQuestBtn}
              onPress={handleSubmitQuest}
              activeOpacity={0.88}
            >
              <Text style={styles.submitQuestBtnText}>เรียบร้อย</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="ภารกิจ (Missions)" points={userPoints} showBack />

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {/* Header Title & Points Banner */}
        <View style={styles.headerBanner}>
          <View style={styles.headerTextCol}>
            <Text style={styles.mainTitle}>ภารกิจสะสมแต้ม 🎯</Text>
            <Text style={styles.mainSubtitle}>ทำภารกิจให้ครบ เพื่อรับคะแนนพิเศษฟรีทุกวัน</Text>
          </View>
          <View style={styles.pointsPill}>
            <Ionicons name="star" size={16} color="#F6B828" style={{ marginRight: 6 }} />
            <Text style={styles.pointsPillVal}>{Number(userPoints || 0).toLocaleString()}</Text>
          </View>
        </View>

        {/* Tab Filter Bar (ทั้งหมด | รายวัน | รายสัปดาห์) */}
        <View testID="missions-tab-bar" style={styles.tabContainer} className="flex-row px-4 py-3 bg-white border-b border-slate-100">
          <TouchableOpacity
            testID="missions-tab-all"
            style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
            className={`px-4 py-2 rounded-full mr-2 ${activeTab === 'all' ? 'bg-primary' : 'bg-slate-100'}`}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]} className={`text-xs font-semibold ${activeTab === 'all' ? 'text-white' : 'text-slate-600'}`}>
              ทั้งหมด ({missionsList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="missions-tab-daily"
            style={[styles.tabButton, activeTab === 'daily' && styles.tabButtonActive]}
            className={`px-4 py-2 rounded-full mr-2 ${activeTab === 'daily' ? 'bg-primary' : 'bg-slate-100'}`}
            onPress={() => setActiveTab('daily')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]} className={`text-xs font-semibold ${activeTab === 'daily' ? 'text-white' : 'text-slate-600'}`}>
              รายวัน ({missionsList.filter((m) => m.category === 'daily').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="missions-tab-weekly"
            style={[styles.tabButton, activeTab === 'weekly' && styles.tabButtonActive]}
            className={`px-4 py-2 rounded-full mr-2 ${activeTab === 'weekly' ? 'bg-primary' : 'bg-slate-100'}`}
            onPress={() => setActiveTab('weekly')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'weekly' && styles.tabTextActive]} className={`text-xs font-semibold ${activeTab === 'weekly' ? 'text-white' : 'text-slate-600'}`}>
              รายสัปดาห์ ({missionsList.filter((m) => m.category === 'weekly').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Missions List View */}
        <ScrollView
          testID="missions-list"
          style={styles.scrollView}
          className="flex-1 bg-slate-50"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {filteredMissions.length === 0 ? (
            <View style={styles.emptyCard} className="items-center justify-center py-12">
              <Ionicons name="sparkles-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle} className="text-base font-medium text-slate-500">ไม่มีภารกิจในหมวดนี้</Text>
            </View>
          ) : (
            filteredMissions.map((item) => {
              const isCompleted = item.status === 'completed';
              const isReady = item.status === 'ready_to_claim';
              const isExpired = item.status === 'expired';
              const progressPercent = Math.min(100, Math.round((item.progress / item.total) * 100));

              return (
                <TouchableOpacity
                  testID={`missions-item-${item.id}`}
                  key={item.id}
                  style={[
                    styles.missionCard,
                    isCompleted && styles.missionCardCompleted,
                    isExpired && { opacity: 0.65, backgroundColor: '#F8FAFC' },
                  ]}
                  className="bg-white mx-4 my-2 p-4 rounded-2xl border border-slate-100 shadow-sm"
                  onPress={() => {
                    if (isCompleted || isExpired) return;
                    if (isReady) {
                      handleAction(item);
                    } else {
                      openQuestDetail(item);
                    }
                  }}
                  activeOpacity={isCompleted || isExpired ? 1 : 0.88}
                >
                  {/* Top Header Row */}
                  <View style={styles.cardHeaderRow} className="flex-row items-center mb-3">
                    <View style={[styles.iconBg, { backgroundColor: isExpired ? '#F1F5F9' : item.bgColor }]} className="w-12 h-12 rounded-xl items-center justify-center mr-3">
                      <Ionicons name={item.icon} size={24} color={isExpired ? '#94A3B8' : item.iconColor} />
                    </View>

                    <View style={styles.infoCol} className="flex-1 mr-2">
                      <Text style={[styles.missionTitle, isExpired && { color: '#64748B' }]} className="text-sm font-bold text-slate-900 mb-0.5" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.missionSubtitle} className="text-xs text-slate-500 mb-1" numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                      <Text style={[styles.pointsSubText, isExpired && { color: '#94A3B8' }]} className="text-xs font-semibold text-yellow-600">{item.points} คะแนน</Text>
                    </View>

                    {/* Reward Badge top right */}
                    <View style={[styles.rewardBadge, isReady && styles.rewardBadgeReady, isCompleted && styles.rewardBadgeCompleted, isExpired && { backgroundColor: '#F1F5F9' }]} className="flex-row items-center px-2.5 py-1 rounded-full bg-slate-100">
                      <Ionicons name="star" size={12} color={isReady ? '#F5A623' : '#64748B'} style={{ marginRight: 4 }} />
                      <Text style={[styles.rewardBadgeText, isReady && styles.rewardBadgeTextReady, isExpired && { color: '#94A3B8' }]} className="text-xs font-bold text-slate-700">
                        +{item.points}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar + Action Button Bottom Row */}
                  <View style={styles.cardFooterRow}>
                    <View style={styles.progressWrapper}>
                      <View style={styles.progressTextRow}>
                        <Ionicons name="ellipse" size={8} color={isCompleted ? '#10B981' : isReady ? '#F5A623' : isExpired ? '#94A3B8' : '#3B82F6'} style={{ marginRight: 4 }} />
                        <Text style={styles.progressValText}>
                          {item.progress}/{item.total}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${progressPercent}%`,
                              backgroundColor: isCompleted ? '#10B981' : isReady ? '#F5A623' : isExpired ? '#94A3B8' : '#1F4C9C',
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isReady && styles.actionBtnReady,
                        isCompleted && styles.actionBtnCompleted,
                        isExpired && { backgroundColor: '#E2E8F0', borderWidth: 0 },
                      ]}
                      onPress={() => handleAction(item)}
                      disabled={isCompleted || isExpired}
                      activeOpacity={0.85}
                    >
                      {isCompleted ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnTextCompleted}>เสร็จสิ้น</Text>
                        </View>
                      ) : isReady ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="gift" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnTextReady}>รับรางวัล</Text>
                        </View>
                      ) : isExpired ? (
                        <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '700' }}>หมดอายุ</Text>
                      ) : (
                        <Text style={styles.actionBtnText}>
                          {item.progress > 0 ? 'ทำต่อ' : 'เริ่มทำ'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* ------------------------------------------------------------- */}
        {/* QUEST DETAIL & EXECUTION FULL-SCREEN MODAL (ตรงตามรูปภาพอ้างอิง) */}
        {/* ------------------------------------------------------------- */}
        <Modal
          visible={!!selectedQuest}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSelectedQuest(null)}
        >
          {selectedQuest && (
            <SafeAreaView style={styles.questSafeArea}>
              <StatusBar barStyle="light-content" backgroundColor="#E11D48" />

              {/* Pink / Red Header Navbar */}
              <View style={styles.questHeaderBar}>
                <TouchableOpacity
                  style={styles.questBackBtn}
                  onPress={() => setSelectedQuest(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.questHeaderTitle}>กิจกรรม</Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView style={styles.questScrollView} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Curved Top Deep Blue Banner Card */}
                <View style={styles.blueCurvedCard}>
                  <Text style={styles.questMainTitle}>
                    {selectedQuest.descTitle || selectedQuest.title}
                  </Text>

                  {/* Description & Instruction Text 1 */}
                  {selectedQuest.descText1 && (
                    <Text style={styles.questDescText}>
                      {selectedQuest.descText1}
                    </Text>
                  )}
                  {selectedQuest.link1 && (
                    <Text style={styles.questLinkText}>
                      Link: <Text style={styles.questLinkUnderline}>{selectedQuest.link1}</Text>
                    </Text>
                  )}

                  {/* Description & Instruction Text 2 */}
                  {selectedQuest.descText2 && (
                    <Text style={[styles.questDescText, { marginTop: 12 }]}>
                      {selectedQuest.descText2}
                    </Text>
                  )}
                  {selectedQuest.link2 && (
                    <Text style={styles.questLinkText}>
                      Link: <Text style={styles.questLinkUnderline}>{selectedQuest.link2}</Text>
                    </Text>
                  )}

                  {/* Expiry Date */}
                  <Text style={styles.expiryLabel}>วันที่หมดอายุ</Text>
                  <Text style={styles.expiryVal}>{selectedQuest.expiry || '31 ก.ค. 2026 23:59'}</Text>

                  {/* Points Earned Row */}
                  <View style={styles.pointsEarnedRow}>
                    <Text style={styles.pointsEarnedLabel}>พอยต์ที่ได้รับ</Text>
                    <Text style={styles.pointsEarnedVal}>{selectedQuest.points} พอยต์</Text>
                  </View>

                  {/* Floating 3D Gold Trophy Icon Overlapping Edge */}
                  <View style={styles.floatingTrophyBadge}>
                    <Ionicons name="trophy" size={44} color="#F6B828" />
                  </View>
                </View>

                {/* Quest Action Checklist / Steps (วิธีทำเควส & แนบไฟล์) */}
                <View style={styles.questStepsContainer}>
                  {/* Step 1: Instruction Card */}
                  {selectedQuest.step1 && (
                    <View style={styles.stepCard}>
                      <View style={styles.stepIconBg}>
                        <Ionicons name="document-text-outline" size={22} color="#1E293B" />
                      </View>
                      <Text style={styles.stepCardText}>{selectedQuest.step1}</Text>
                    </View>
                  )}

                  {/* Step 2: Upload Proof Card */}
                  <View style={styles.stepCard}>
                    <View style={styles.stepIconBg}>
                      <Ionicons name="document-text-outline" size={22} color="#1E293B" />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.stepCardText}>
                        {selectedQuest.step2 || 'แคปหน้าจอหลักฐานการทำเควส และแนบไฟล์'}
                      </Text>
                      {attachedFile && (
                        <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 4 }}>
                          📎 {attachedFile}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.attachBtn}
                      onPress={handleAttachFile}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="paperclip" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.attachBtnText}>แนบไฟล์</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Step 3: Secondary Action (If available) */}
                  {selectedQuest.step3 && (
                    <View style={styles.stepCard}>
                      <View style={styles.stepIconBg}>
                        <Ionicons name="document-text-outline" size={22} color="#1E293B" />
                      </View>
                      <Text style={styles.stepCardText}>{selectedQuest.step3}</Text>
                    </View>
                  )}

                  {/* Step 4: Survey Question Box */}
                  {selectedQuest.question && (
                    <View style={styles.questionCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={[styles.stepIconBg, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="help-circle-outline" size={22} color="#2563EB" />
                        </View>
                        <Text style={[styles.stepCardText, { fontWeight: '700' }]}>
                          {selectedQuest.question}
                        </Text>
                      </View>
                      <TextInput
                        style={styles.answerInput}
                        placeholder="พิมพ์คำตอบของคุณที่นี่..."
                        placeholderTextColor="#94A3B8"
                        value={userAnswer}
                        onChangeText={setUserAnswer}
                        multiline
                      />
                    </View>
                  )}

                  {/* Primary Full Width Submit Button */}
                  <TouchableOpacity
                    style={styles.submitQuestBtn}
                    onPress={handleSubmitQuest}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.submitQuestBtnText}>เรียบร้อย</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          )}
        </Modal>

        {/* Reward Claimed Modal Celebration Popup */}
        <Modal
          visible={claimedModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setClaimedModal({ visible: false, points: 0, title: '' })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBg}>
                <Ionicons name="trophy" size={48} color="#F6B828" />
              </View>
              <Text style={styles.modalTitle}>🎉 รับรางวัลสำเร็จ!</Text>
              <Text style={styles.modalMessage}>
                คุณได้รับ +{claimedModal.points} คะแนน จากภารกิจ "{claimedModal.title}"
              </Text>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setClaimedModal({ visible: false, points: 0, title: '' })}
              >
                <Text style={styles.modalBtnText}>ตกลง (รับคะแนน)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  mainSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  pointsPillVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F5A623',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1F4C9C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1F4C9C',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  missionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  missionCardCompleted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.9,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
    marginRight: 8,
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  missionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  pointsSubText: {
    fontSize: 12,
    color: '#1F4C9C',
    fontWeight: '700',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rewardBadgeReady: {
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  rewardBadgeCompleted: {
    backgroundColor: '#E2E8F0',
  },
  rewardBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  rewardBadgeTextReady: {
    color: '#F5A623',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  progressWrapper: {
    flex: 1,
    marginRight: 16,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressValText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionBtn: {
    backgroundColor: '#1F4C9C',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  actionBtnReady: {
    backgroundColor: '#F5A623',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnCompleted: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnTextReady: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBtnTextCompleted: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },

  // -----------------------------------------------------------
  // STYLES FOR QUEST DETAIL & EXECUTION VIEW (ตรงตามรูปภาพอ้างอิง)
  // -----------------------------------------------------------
  questSafeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  questHeaderBar: {
    height: 52,
    backgroundColor: '#E11D48', // Pink/Magenta header bar matching screenshot
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  questBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  questScrollView: {
    flex: 1,
  },
  blueCurvedCard: {
    backgroundColor: '#1E3A8A', // Deep Blue card background
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    position: 'relative',
  },
  questMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  questDescText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    marginBottom: 4,
  },
  questLinkText: {
    fontSize: 13,
    color: '#93C5FD',
    marginBottom: 8,
  },
  questLinkUnderline: {
    textDecorationLine: 'underline',
  },
  expiryLabel: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 14,
  },
  expiryVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 16,
  },
  pointsEarnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsEarnedLabel: {
    fontSize: 14,
    color: '#E2E8F0',
    marginRight: 16,
  },
  pointsEarnedVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#34D399',
  },
  floatingTrophyBadge: {
    position: 'absolute',
    bottom: -24,
    right: 24,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  questStepsContainer: {
    paddingHorizontal: 16,
    paddingTop: 36,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  stepIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    lineHeight: 20,
  },
  attachBtn: {
    backgroundColor: '#3B49B8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  answerInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  submitQuestBtn: {
    backgroundColor: '#3B49B8', // Royal Deep Blue button matching screenshot
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#3B49B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitQuestBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF8E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalBtn: {
    backgroundColor: '#1F4C9C',
    borderRadius: 14,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
