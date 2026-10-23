// ManagerApprovalScreen.js — Manager/Boss Request Approval Management Screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';
import { attendanceStorage } from '../services/attendanceStorage';
import { authService } from '../services/authService';
import { openLeaveAttachment } from '../services/attachmentService';

export default function ManagerApprovalScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'leave' | 'time-correction'
  const [approvalMode, setApprovalMode] = useState('pending'); // 'pending' | 'history'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = authService.getUser();

  // Modal State for Reject Remark
  const [rejectModal, setRejectModal] = useState({ visible: false, request: null, remark: '' });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await tryFetchApi('/approvals/pending');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.approvals)) {
          setPendingRequests(data.approvals);
        }
      }
    } catch (e) {
      console.log('Error fetching pending approvals:', e);
    }
  }, []);

  const fetchApprovalHistory = useCallback(async () => {
    try {
      const res = await tryFetchApi('/approvals/history');
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.history)) {
          setApprovalHistory(data.history);
        }
      }
    } catch (e) {
      console.log('Error fetching approval history:', e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPendingApprovals(), fetchApprovalHistory()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchPendingApprovals, fetchApprovalHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const handleApprove = async (item) => {
    Alert.alert(
      'ยืนยันการอนุมัติ',
      `คุณต้องการอนุมัติคำขอของ "${item.employeeName || 'พนักงาน'}" ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'อนุมัติ',
          style: 'default',
          onPress: async () => {
            try {
              const reqType = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
              const res = await tryFetchApi(`/approvals/${reqType}/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  action: 'approved',
                  approverName: currentUser?.name || 'ผู้จัดการ',
                  approverRole: currentUser?.role || 'SuperBoss',
                  remark: 'อนุมัติผ่านแอปพลิเคชัน',
                }),
              });
              if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
              const resData = await res.json().catch(() => ({}));
              if (!res.ok || !resData.success) throw new Error(resData.message || 'เซิร์ฟเวอร์ไม่อนุญาตให้อนุมัติรายการนี้');

              Alert.alert('อนุมัติสำเร็จ', `ทำการอนุมัติคำขอเรียบร้อยแล้ว`);
              loadAll();
            } catch (e) {
              Alert.alert('เกิดข้อผิดพลาด', (e && e.message) || 'ไม่สามารถอนุมัติรายการได้ กรุณาลองอีกครั้ง');
            }
          },
        },
      ]
    );
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal.request) return;
    const item = rejectModal.request;
    const remarkText = rejectModal.remark.trim() || 'ไม่อนุมัติคำขอ';

    try {
      const reqType = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
      const res = await tryFetchApi(`/approvals/${reqType}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'rejected',
          approverName: currentUser?.name || 'ผู้จัดการ',
          approverRole: currentUser?.role || 'SuperBoss',
          remark: remarkText,
        }),
      });
      if (!res) throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.success) throw new Error(resData.message || 'เซิร์ฟเวอร์ไม่อนุญาตให้ปฏิเสธรายการนี้');

      Alert.alert('ปฏิเสธคำขอสำเร็จ', 'บันทึกการไม่อนุมัติคำขอเรียบร้อยแล้ว');
      setRejectModal({ visible: false, request: null, remark: '' });
      loadAll();
    } catch (e) {
      Alert.alert('เกิดข้อผิดพลาด', (e && e.message) || 'ไม่สามารถปฏิเสธรายการได้ กรุณาลองอีกครั้ง');
    }
  };

  const filteredRequests = pendingRequests.filter((item) => {
    const type = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
    if (activeTab === 'all') return true;
    if (activeTab === 'leave') return type === 'leave';
    if (activeTab === 'time-correction') return type === 'time-correction';
    return true;
  });

  const filteredHistory = approvalHistory.filter((item) => {
    const type = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
    if (activeTab === 'all') return true;
    if (activeTab === 'leave') return type === 'leave';
    if (activeTab === 'time-correction') return type === 'time-correction';
    return true;
  });

  return (
    <SafeAreaView testID="screen-manager-approval" style={styles.safeArea}>
      <TopNavbar
        navigation={navigation}
        title="อนุมัติคำขอพนักงาน"
        showBack={true}
        onBackPress={() => {
          if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
            navigation.goBack();
          } else if (navigation && typeof navigation.navigate === 'function') {
            navigation.navigate('MainTabs', { screen: 'HRDashboard' });
          }
        }}
      />

      <View style={styles.container}>
        {/* Mode Toggle: รออนุมัติ vs ประวัติที่อนุมัติแล้ว */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            testID="tab-approval-mode-pending"
            style={[styles.modeToggleBtn, approvalMode === 'pending' && styles.modeToggleBtnActive]}
            onPress={() => setApprovalMode('pending')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeToggleText, approvalMode === 'pending' && styles.modeToggleTextActive]}>
              ⏳ รออนุมัติ ({pendingRequests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-approval-mode-history"
            style={[styles.modeToggleBtn, approvalMode === 'history' && styles.modeToggleBtnActive]}
            onPress={() => setApprovalMode('history')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeToggleText, approvalMode === 'history' && styles.modeToggleTextActive]}>
              📜 ประวัติที่อนุมัติแล้ว ({approvalHistory.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'leave', label: 'ขอลางาน' },
            { key: 'time-correction', label: 'ปรับปรุงเวลา' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabChipText, activeTab === tab.key && styles.tabChipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Requests List */}
        <ScrollView
          style={styles.scrollView}
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
          {approvalMode === 'pending' ? (
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>กำลังโหลดรายการรออนุมัติ...</Text>
              </View>
            ) : filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#10B981" />
                </View>
                <Text style={styles.emptyTitle}>ไม่มีรายการรออนุมัติ</Text>
                <Text style={styles.emptySubtitle}>คำขอทั้งหมดได้รับการดำเนินการเรียบร้อยแล้ว</Text>
              </View>
            ) : (
              filteredRequests.map((item, index) => {
                const reqType = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
                let typeBadge = { label: 'คำร้อง', bg: '#EFF6FF', text: '#3B82F6', icon: 'document-text-outline' };
                if (reqType === 'leave') {
                  typeBadge = { label: item.leaveType || 'ขอลางาน', bg: '#FEF3C7', text: '#D97706', icon: 'umbrella-outline' };
                } else if (reqType === 'time-correction') {
                  typeBadge = { label: 'ปรับปรุงเวลา', bg: '#E0F2FE', text: '#0284C7', icon: 'sync-outline' };
                }

                return (
                  <View key={item.id || index} style={styles.requestCard}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.userInfo}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>
                            {(item.employeeName || 'EM')[0]}
                          </Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.userName}>{item.employeeName || 'พนักงานในแผนก'}</Text>
                            {(item.requesterRole === 'Boss' || item.role === 'Boss' || item.requesterRole === 'Manager') && (
                              <View style={{ backgroundColor: '#F3E8FF', borderColor: '#C084FC', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                <Text style={{ color: '#7E22CE', fontSize: 10, fontWeight: '700' }}>👔 Role Boss</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.userDept}>{item.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'}</Text>
                        </View>
                      </View>
                      <View style={[styles.typeTag, { backgroundColor: typeBadge.bg }]}>
                        <Ionicons name={typeBadge.icon} size={14} color={typeBadge.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.typeTagText, { color: typeBadge.text }]}>{typeBadge.label}</Text>
                      </View>
                    </View>

                    {/* Card Details */}
                    <View style={styles.cardBody}>
                      {reqType === 'leave' && (
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={16} color="#64748B" />
                          <Text style={styles.detailText}>
                            วันที่: <Text style={styles.boldText}>{item.startDate} – {item.endDate}</Text> ({item.totalDays || 1} วัน)
                          </Text>
                        </View>
                      )}


                      {reqType === 'time-correction' && (
                        <View style={styles.detailRow}>
                          <Ionicons name="time-outline" size={16} color="#64748B" />
                          <Text style={styles.detailText}>
                            เวลาเดิม: {item.oldCheckIn || '--:--'} - {item.oldCheckOut || '--:--'} ➔ ขอปรับเป็น: <Text style={styles.boldText}>{item.newCheckIn || '08:00 น.'} - {item.newCheckOut || '17:00 น.'}</Text>
                          </Text>
                        </View>
                      )}

                      <View style={styles.reasonBox}>
                        <Text style={styles.reasonLabel}>เหตุผล / รายละเอียดงาน:</Text>
                        <Text style={styles.reasonText}>{item.reason || item.taskDescription || 'ขออนุมัติตามขั้นตอนบริษัท'}</Text>
                      </View>

                      {item.attachmentUrl && (
                        <TouchableOpacity
                          style={styles.attachmentChip}
                          onPress={() =>
                            openLeaveAttachment(item.attachmentUrl).catch((e) =>
                              Alert.alert('เปิดไฟล์แนบไม่สำเร็จ', e.message || 'กรุณาลองใหม่อีกครั้ง')
                            )
                          }
                        >
                          <Ionicons name="attach" size={14} color="#0EA5E9" />
                          <Text style={styles.attachmentText}>ดูเอกสารแนบ</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => setRejectModal({ visible: true, request: item, remark: '' })}
                      >
                        <Ionicons name="close-circle" size={18} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.rejectBtnText}>ไม่อนุมัติ</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(item)}
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.approveBtnText}>อนุมัติคำขอ</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )
          ) : filteredHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>ไม่มีประวัติการอนุมัติ</Text>
              <Text style={styles.emptySubtitle}>รายการที่อนุมัติหรือปฏิเสธแล้วจะแสดงที่นี่</Text>
            </View>
          ) : (
            filteredHistory.map((item, index) => {
              const reqType = item.requestType || (item.leaveType ? 'leave' : 'time-correction');
              const isApproved = item.status === 'อนุมัติแล้ว' || item.status === 'approved';
              let typeBadge = { label: 'คำร้อง', bg: '#EFF6FF', text: '#3B82F6', icon: 'document-text-outline' };
              if (reqType === 'leave') {
                typeBadge = { label: item.leaveType || 'ขอลางาน', bg: '#FEF3C7', text: '#D97706', icon: 'umbrella-outline' };
              } else if (reqType === 'time-correction') {
                typeBadge = { label: 'ปรับปรุงเวลา', bg: '#E0F2FE', text: '#0284C7', icon: 'sync-outline' };
              }

              return (
                <View key={item.id || `hist-${index}`} style={styles.requestCard}>
                  {/* History Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                      <View style={[styles.avatarCircle, { backgroundColor: '#64748B' }]}>
                        <Text style={styles.avatarText}>
                          {(item.employeeName || 'EM')[0]}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.userName}>{item.employeeName || 'พนักงาน'}</Text>
                        <Text style={styles.userDept}>{item.department || item.employeeCode || 'ฝ่ายงาน'}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.historyBadge,
                        isApproved ? styles.historyBadgeSuccess : styles.historyBadgeDanger,
                      ]}
                    >
                      <Ionicons
                        name={isApproved ? 'checkmark-circle' : 'close-circle'}
                        size={14}
                        color={isApproved ? '#16A34A' : '#DC2626'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.historyBadgeText,
                          isApproved ? styles.historyBadgeTextSuccess : styles.historyBadgeTextDanger,
                        ]}
                      >
                        {item.status || (isApproved ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ')}
                      </Text>
                    </View>
                  </View>

                  {/* History Card Details */}
                  <View style={styles.cardBody}>
                    <View style={[styles.typeTag, { backgroundColor: typeBadge.bg, marginBottom: 8, alignSelf: 'flex-start' }]}>
                      <Ionicons name={typeBadge.icon} size={14} color={typeBadge.text} style={{ marginRight: 4 }} />
                      <Text style={[styles.typeTagText, { color: typeBadge.text }]}>{typeBadge.label}</Text>
                    </View>

                    {reqType === 'leave' && (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText}>
                          วันที่: <Text style={styles.boldText}>{item.startDate} – {item.endDate}</Text> ({item.days || item.totalDays || 1} วัน)
                        </Text>
                      </View>
                    )}


                    {reqType === 'time-correction' && (
                      <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={16} color="#64748B" />
                        <Text style={styles.detailText}>
                          เวลาเดิม: {item.oldCheckIn || '--:--'} ➔ ปรับเป็น: <Text style={styles.boldText}>{item.newCheckIn || '08:00 น.'} - {item.newCheckOut || '17:00 น.'}</Text>
                        </Text>
                      </View>
                    )}

                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonLabel}>เหตุผลคำขอ:</Text>
                      <Text style={styles.reasonText}>{item.reason || item.taskDescription || 'ไม่มีระบุ'}</Text>
                    </View>

                    {item.rejectReason && (
                      <View style={[styles.reasonBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, marginTop: 6 }]}>
                        <Text style={[styles.reasonLabel, { color: '#DC2626' }]}>เหตุผลการไม่อนุมัติ:</Text>
                        <Text style={[styles.reasonText, { color: '#B91C1C' }]}>{item.rejectReason}</Text>
                      </View>
                    )}
                  </View>

                  {/* History Footer */}
                  <View style={styles.historyFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="person-circle-outline" size={16} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.historyApproverText}>
                        ผู้อนุมัติ: {item.approverName || 'ผู้จัดการ'}
                      </Text>
                    </View>
                    <Text style={styles.historyTimeText}>
                      {item.actionTime || 'ดำเนินการแล้ว'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Reject Modal */}
      <Modal visible={rejectModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={28} color="#EF4444" />
              <Text style={styles.modalTitle}>ระบุเหตุผลการไม่อนุมัติ</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              คำขอของ: {rejectModal.request?.employeeName || 'พนักงาน'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ป้อนเหตุผลหรือข้อเสนอแนะ..."
              value={rejectModal.remark}
              onChangeText={(txt) => setRejectModal((prev) => ({ ...prev, remark: txt }))}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModal({ visible: false, request: null, remark: '' })}
              >
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleRejectSubmit}
              >
                <Text style={styles.modalConfirmText}>ยืนยันไม่อนุมัติ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.gradientStart,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  historyBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyBadgeTextSuccess: {
    color: '#16A34A',
  },
  historyBadgeTextDanger: {
    color: '#DC2626',
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyApproverText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  historyTimeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justify: 'center',
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justify: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justify: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  userDept: {
    fontSize: 12,
    color: '#64748B',
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#334155',
    marginLeft: 6,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: '#1E293B',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  attachmentText: {
    fontSize: 12,
    color: '#0369A1',
    marginLeft: 4,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justify: 'space-between',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 10,
  },
  rejectBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    marginBottom: 16,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justify: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
