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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';
import { attendanceStorage } from '../services/attendanceStorage';
import { authService } from '../services/authService';
import { openLeaveAttachment } from '../services/attachmentService';

// same list as the server's requireApprover (backend/src/middlewares/authMiddleware.js)
const APPROVER_ROLES = new Set([
  'admin', 'super admin', 'superadmin', 'hr admin', 'system admin', 'sys admin',
  'hr', 'manager', 'boss', 'superboss', 'super boss', 'supervisor', 'head', 'ceo', 'director',
]);
const isApproverRole = (role) => APPROVER_ROLES.has(String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, ' '));

const dash = (v) => (v && String(v).trim() && String(v).trim() !== '-' ? String(v).trim() : '--:--');

// "2026-10-22 – 2026-10-22" -> "2026-10-22" when it is a single day
const dateRange = (a, b) => (!b || a === b ? a || '-' : `${a} – ${b}`);

const isBossRole = (item) => item.requesterRole === 'Boss' || item.role === 'Boss' || item.requesterRole === 'Manager';

// One labelled line of a request card: icon | label | value
function InfoRow({ icon, label, children }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBg}>
        <Ionicons name={icon} size={15} color="#6D28D9" />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>{children}</View>
    </View>
  );
}

// What the request is about (leave dates / time change), the reason and the attachment. Same layout for pending and history.
function RequestDetails({ item, reqType, reasonLabel }) {
  return (
    <View style={styles.cardBody}>
      {reqType === 'leave' && (
        <InfoRow icon="calendar-outline" label="วันที่ลา">
          <Text style={styles.infoValue}>{dateRange(item.startDate, item.endDate)}</Text>
          <View style={styles.daysPill}>
            <Text style={styles.daysPillText}>{item.totalDays || item.days || 1} วัน</Text>
          </View>
        </InfoRow>
      )}

      {reqType === 'time-correction' && !!item.dateIso && (
        <InfoRow icon="calendar-outline" label="วันที่แก้">
          <Text style={styles.infoValue}>{String(item.dateIso).slice(0, 10)}</Text>
        </InfoRow>
      )}

      {reqType === 'time-correction' && (
        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <Text style={styles.compareLabel}>เวลาเดิม</Text>
            <Text style={styles.compareValue}>{dash(item.oldCheckIn)} - {dash(item.oldCheckOut)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
          <View style={[styles.compareCol, styles.compareColNew]}>
            <Text style={[styles.compareLabel, { color: '#7C3AED' }]}>ขอปรับเป็น</Text>
            <Text style={[styles.compareValue, { color: '#5B21B6' }]}>{dash(item.newCheckIn)} - {dash(item.newCheckOut)}</Text>
          </View>
        </View>
      )}

      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>{reasonLabel}</Text>
        <Text style={styles.reasonText}>{item.reason || item.taskDescription || 'ไม่มีระบุ'}</Text>
      </View>

      {!!item.attachmentUrl && (
        <TouchableOpacity
          style={styles.attachmentChip}
          onPress={() =>
            openLeaveAttachment(item.attachmentUrl).catch((e) =>
              Alert.alert('เปิดไฟล์แนบไม่สำเร็จ', e.message || 'กรุณาลองใหม่อีกครั้ง')
            )
          }
        >
          <Ionicons name="attach" size={14} color="#0369A1" />
          <Text style={styles.attachmentText}>ดูเอกสารแนบ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ManagerApprovalScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'leave' | 'time-correction'
  const [approvalMode, setApprovalMode] = useState('pending'); // 'pending' | 'history'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = authService.getUser();
  const canApprove = isApproverRole(currentUser?.role);

  // Modal State for Reject Remark
  const [rejectModal, setRejectModal] = useState({ visible: false, request: null, remark: '' });
  const [remarkFocused, setRemarkFocused] = useState(false);

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

  if (!canApprove) {
    return (
      <SafeAreaView testID="screen-manager-approval" style={styles.safeArea}>
        <TopNavbar navigation={navigation} title="อนุมัติคำขอพนักงาน" showBack={true} />
        <View style={[styles.container, styles.emptyContainer, { flex: 1, justifyContent: 'center' }]}>
          <View style={[styles.emptyIconBg, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="lock-closed-outline" size={40} color="#7C3AED" />
          </View>
          <Text style={styles.emptyTitle}>หน้านี้สำหรับผู้อนุมัติเท่านั้น</Text>
          <Text style={styles.emptySubtitle}>ดูผลคำขอของคุณได้ที่ "สถานะคำขอ" ในแท็บ HR</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            รออนุมัติ 
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-approval-mode-history"
            style={[styles.modeToggleBtn, approvalMode === 'history' && styles.modeToggleBtnActive]}
            onPress={() => setApprovalMode('history')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeToggleText, approvalMode === 'history' && styles.modeToggleTextActive]}>
              ประวัติ
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
                    {/* Card Header: person on the left, request type on the right */}
                    <View style={styles.cardHeader}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{(item.employeeName || 'EM')[0]}</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.userName} numberOfLines={1}>{item.employeeName || 'พนักงานในแผนก'}</Text>
                          {isBossRole(item) && (
                            <View style={styles.roleBadge}>
                              <Text style={styles.roleBadgeText}>Boss</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.userDept} numberOfLines={1}>{item.department || 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'}</Text>
                      </View>
                      <View style={[styles.typeTag, { backgroundColor: typeBadge.bg }]}>
                        <Ionicons name={typeBadge.icon} size={14} color={typeBadge.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.typeTagText, { color: typeBadge.text }]}>{typeBadge.label}</Text>
                      </View>
                    </View>

                    <RequestDetails item={item} reqType={reqType} reasonLabel="เหตุผล / รายละเอียดงาน" />

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
              const isForwarded = String(item.status || '').startsWith('รออนุมัติ');
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
                    <View style={[styles.avatarCircle, { backgroundColor: '#64748B' }]}>
                      <Text style={styles.avatarText}>{(item.employeeName || 'EM')[0]}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>{item.employeeName || 'พนักงาน'}</Text>
                      <Text style={styles.userDept} numberOfLines={1}>{item.department || item.employeeCode || 'ฝ่ายงาน'}</Text>
                    </View>
                    <View style={[styles.historyBadge, isForwarded ? styles.historyBadgeForwarded : isApproved ? styles.historyBadgeSuccess : styles.historyBadgeDanger]}>
                      <Ionicons
                        name={isForwarded ? 'arrow-redo-circle' : isApproved ? 'checkmark-circle' : 'close-circle'}
                        size={14}
                        color={isForwarded ? '#B45309' : isApproved ? '#16A34A' : '#DC2626'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.historyBadgeText, isForwarded ? styles.historyBadgeTextForwarded : isApproved ? styles.historyBadgeTextSuccess : styles.historyBadgeTextDanger]}>
                        {isForwarded ? 'ส่งต่อ Superboss แล้ว' : item.status || (isApproved ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ')}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.typeTag, { backgroundColor: typeBadge.bg, marginBottom: 12, alignSelf: 'flex-start' }]}>
                    <Ionicons name={typeBadge.icon} size={14} color={typeBadge.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.typeTagText, { color: typeBadge.text }]}>{typeBadge.label}</Text>
                  </View>

                  <RequestDetails item={item} reqType={reqType} reasonLabel="เหตุผลคำขอ" />

                  {!!item.rejectReason && (
                    <View style={[styles.reasonBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, marginBottom: 12 }]}>
                      <Text style={[styles.reasonLabel, { color: '#DC2626' }]}>เหตุผลการไม่อนุมัติ</Text>
                      <Text style={[styles.reasonText, { color: '#B91C1C' }]}>{item.rejectReason}</Text>
                    </View>
                  )}

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
      <Modal
        visible={rejectModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal({ visible: false, request: null, remark: '' })}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="close" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>ไม่อนุมัติคำขอนี้</Text>
            <Text style={styles.modalSubtitle}>ระบุเหตุผลเพื่อแจ้งให้ผู้ยื่นคำขอทราบ</Text>

            <View style={styles.modalRequester}>
              <View style={styles.modalRequesterAvatar}>
                <Text style={styles.modalRequesterAvatarText}>{(rejectModal.request?.employeeName || 'พ')[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalRequesterName} numberOfLines={1}>{rejectModal.request?.employeeName || 'พนักงาน'}</Text>
                <Text style={styles.modalRequesterDept} numberOfLines={1}>{rejectModal.request?.department || '-'}</Text>
              </View>
            </View>

            <Text style={styles.modalFieldLabel}>
              เหตุผลการไม่อนุมัติ <Text style={styles.modalFieldHint}>(ไม่บังคับ)</Text>
            </Text>
            <TextInput
              style={[styles.modalInput, remarkFocused && styles.modalInputFocused]}
              placeholder="เช่น ช่วงนั้นมีงานเร่งด่วน กรุณาเลือกวันอื่น"
              placeholderTextColor="#94A3B8"
              value={rejectModal.remark}
              onChangeText={(txt) => setRejectModal((prev) => ({ ...prev, remark: txt }))}
              onFocus={() => setRemarkFocused(true)}
              onBlur={() => setRemarkFocused(false)}
              maxLength={300}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.modalCounter}>{rejectModal.remark.length}/300</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRejectModal({ visible: false, request: null, remark: '' })}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleRejectSubmit} activeOpacity={0.85}>
                <Ionicons name="close-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmText}>ยืนยันไม่อนุมัติ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flexShrink: 0,
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
  historyBadgeForwarded: {
    backgroundColor: '#FEF3C7',
  },
  historyBadgeTextForwarded: {
    color: '#B45309',
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
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#F3E8FF',
    borderColor: '#C084FC',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#7E22CE',
    fontSize: 10,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  infoLabel: {
    width: 56,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  daysPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  daysPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  compareCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  compareColNew: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  compareLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  compareValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexShrink: 0,
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
    borderRadius: 10,
    padding: 12,
    marginTop: 2,
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
    justifyContent: 'space-between',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    flex: 1.4,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconCircle: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalRequester: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
  },
  modalRequesterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalRequesterAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalRequesterName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalRequesterDept: {
    fontSize: 12,
    color: '#64748B',
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalFieldHint: {
    fontWeight: '500',
    color: '#94A3B8',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 96,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}), // web: use our violet focus border, not the browser outline
  },
  modalInputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  modalCounter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1.5,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
