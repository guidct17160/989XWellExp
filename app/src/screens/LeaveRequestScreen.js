import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { leaveStorage } from '../services/leaveStorage';
import { notificationStorage } from '../services/notificationStorage';
import TopNavbar from '../components/TopNavbar';

const { width } = Dimensions.get('window');

export default function LeaveRequestScreen({ navigation }) {
  const [leaveState, setLeaveState] = useState(leaveStorage.getState());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Request Leave Form state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('annual');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Popup / Picker state variables
  const [selectedDays, setSelectedDays] = useState(1);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState('start'); // 'start' | 'end'
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [isDaysPickerVisible, setIsDaysPickerVisible] = useState(false);

  const getCalculatedEndDate = (startStr, daysCount) => {
    if (!startStr) return '';
    const parts = startStr.split('-');
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    start.setDate(start.getDate() + daysCount - 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getCalculatedDaysCount = (startStr, endStr) => {
    if (!startStr || !endStr) return 1;
    const sParts = startStr.split('-');
    const eParts = endStr.split('-');
    const start = new Date(sParts[0], sParts[1] - 1, sParts[2]);
    const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);
    if (end < start) return 1;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleUploadFile = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setAttachedFile('ใบรับรองแพทย์_สมบูรณ์.pdf');
    }, 1000);
  };

  const activePolicy = leaveStorage.getPolicyForType(selectedType);

  const isDateOutsidePolicy = (dateStr) => {
    if (!activePolicy || !activePolicy.dateRangeEnabled) return false;
    if (activePolicy.allowedStartDate && dateStr < activePolicy.allowedStartDate) return true;
    if (activePolicy.allowedEndDate && dateStr > activePolicy.allowedEndDate) return true;
    return false;
  };

  const onSelectDate = (dateStr) => {
    if (isDateOutsidePolicy(dateStr)) {
      Alert.alert(
        'ไม่สามารถเลือกวันที่นี้ได้',
        `ประเภทการลานี้เปิดให้ยื่นได้เฉพาะช่วงวันที่ ${activePolicy.allowedStartDate} ถึง ${activePolicy.allowedEndDate} เท่านั้น หากเกินวันที่กำหนดจะไม่สามารถลาได้`
      );
      return;
    }

    if (datePickerTarget === 'start') {
      setStartDate(dateStr);
      // Auto-update End Date using selectedDays
      const newEndDate = getCalculatedEndDate(dateStr, selectedDays);
      setEndDate(newEndDate);
    } else {
      // setting end date
      const start = new Date(startDate);
      const chosenEnd = new Date(dateStr);
      if (chosenEnd < start) {
        Alert.alert('ข้อผิดพลาด', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
        return;
      }
      setEndDate(dateStr);
      // Recalculate days count
      const daysCount = getCalculatedDaysCount(startDate, dateStr);
      setSelectedDays(daysCount);
    }
    setIsDatePickerVisible(false);
  };

  const onSelectDays = (daysCount) => {
    setSelectedDays(daysCount);
    const newEndDate = getCalculatedEndDate(startDate, daysCount);
    setEndDate(newEndDate);
    setIsDaysPickerVisible(false);
  };

  const getPickerDays = (month, year) => {
    const date = new Date(year, month, 1);
    const days = [];
    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const pickerThaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = leaveStorage.subscribe((state) => {
      setLeaveState(state);
    });

    leaveStorage.clearAndSync();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await leaveStorage.clearAndSync();
    setRefreshing(false);
  }, []);

  const { leaveBalances } = leaveState;

  const handleRequestLeave = async () => {
    if (!startDate || !endDate) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุวันเริ่มต้นและสิ้นสุด');
      return;
    }

    // Check YYYY-MM-DD pattern
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('ข้อผิดพลาด', 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Alert.alert('ข้อผิดพลาด', 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD');
      return;
    }
    if (end < start) {
      Alert.alert('ข้อผิดพลาด', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
      return;
    }

    // Check policy date range constraint
    if (activePolicy && activePolicy.dateRangeEnabled) {
      if (activePolicy.allowedStartDate && startDate < activePolicy.allowedStartDate) {
        Alert.alert(
          'ไม่สามารถยื่นขอลาได้',
          `วันที่เริ่มต้น (${startDate}) อยู่นอกช่วงเวลาที่องค์กรกำหนด (เปิดให้ลาได้ตั้งแต่วันที่ ${activePolicy.allowedStartDate})`
        );
        return;
      }
      if (activePolicy.allowedEndDate && endDate > activePolicy.allowedEndDate) {
        Alert.alert(
          'ไม่สามารถยื่นขอลาได้',
          `วันที่สิ้นสุด (${endDate}) เกินวันที่กำหนดให้ลาได้ (สิ้นสุดวันที่ ${activePolicy.allowedEndDate}) หากเกินกำหนดจะไม่สามารถลาได้`
        );
        return;
      }
    }

    const requestedDays = selectedDays;

    // Find the leave type balance
    const balance = leaveBalances.find(bal => bal.id === selectedType);
    if (!balance) return;

    if (balance.remaining <= 0) {
      Alert.alert('ล้มเหลว', `คุณใช้สิทธิ์ ${balance.label} ครบตามกำหนดแล้ว ไม่สามารถลาเพิ่มได้อีก`);
      return;
    }

    if (requestedDays > balance.remaining) {
      Alert.alert(
        'ล้มเหลว',
        `จำนวนวันลาที่ระบุ (${requestedDays} วัน) เกินสิทธิ์คงเหลือของคุณ (เหลือ ${balance.remaining} วัน)`
      );
      return;
    }

    try {
      await leaveStorage.addLeaveRequest(selectedType, startDate, endDate, reason);

      // 🔔 Push real-time GREEN success notification banner
      notificationStorage.addNotification({
        id: 'leave_succ_' + Date.now(),
        type: 'success',
        icon: 'checkmark-circle',
        iconColor: '#10B981',
        title: '✅ ส่งใบลาหยุดงานสำเร็จ',
        message: `ส่งใบลาหยุดงานตั้งแต่วันที่ ${startDate} ถึง ${endDate} เรียบร้อยแล้ว`,
        time: 'เมื่อครู่นี้',
        unread: true,
        screen: 'LeaveRequest',
      });

      setIsModalVisible(false);

      // Reset form
      const todayStr = new Date().toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
      setSelectedDays(1);
      setReason('');
      setAttachedFile(null);
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', error.message);
    }
  };

  return (
    <SafeAreaView testID="screen-leave-request" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="ขอลาหยุดงาน" showBack />

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]} className="flex-1">
        <ScrollView
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
          {/* Leave Balance Cards */}
          {leaveBalances.map((type) => {
            const used = type.total - type.remaining;
            const isExhausted = type.remaining <= 0;

            return (
              <TouchableOpacity
                testID={`leave-balance-card-${type.id}`}
                key={type.id}
                disabled={isExhausted}
                activeOpacity={isExhausted ? 1 : 0.7}
                style={[
                  styles.leaveCard,
                  isExhausted && {
                    backgroundColor: '#F8FAFC',
                    opacity: 0.65,
                    borderColor: '#E2E8F0',
                  },
                ]}
                className="bg-white mx-4 my-2 p-4 rounded-2xl border border-slate-100 shadow-sm"
                onPress={() => {
                  if (isExhausted) return;
                  const todayStr = new Date().toISOString().split('T')[0];
                  setSelectedType(type.id);
                  setStartDate(todayStr);
                  setSelectedDays(1);
                  setEndDate(todayStr);
                  setReason('');
                  setAttachedFile(null);
                  setIsModalVisible(true);
                }}
              >
                <View style={styles.leaveCardHeader} className="flex-row items-center mb-3">
                  <View
                    style={[
                      styles.leaveIconContainer,
                      { backgroundColor: isExhausted ? '#F1F5F9' : type.color + '12' },
                    ]}
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  >
                    <Ionicons
                      name={type.icon || 'calendar-outline'}
                      size={20}
                      color={isExhausted ? '#94A3B8' : type.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.leaveTypeName, isExhausted && { color: '#94A3B8' }]}
                      className="text-base font-bold text-slate-900"
                    >
                      {type.label}
                    </Text>
                    {type.dateRangeEnabled && type.allowedStartDate && type.allowedEndDate ? (
                      <Text style={{ fontSize: 11, color: isExhausted ? '#94A3B8' : '#D97706', fontWeight: '600', marginTop: 2 }}>
                        📅 ยื่นลาได้: {type.allowedStartDate} ถึง {type.allowedEndDate}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.leaveCardBody}>
                  <View style={styles.leaveStatsRow} className="flex-row justify-between mb-2">
                    <View style={styles.leaveStatCol}>
                      <Text style={styles.leaveStatLabel} className="text-xs text-slate-400">สิทธิ์ทั้งหมด</Text>
                      <Text style={[styles.leaveStatValue, isExhausted && { color: '#94A3B8' }]} className="text-sm font-semibold text-slate-700">{type.total} วัน</Text>
                    </View>
                    <View style={styles.leaveStatCol}>
                      <Text style={styles.leaveStatLabel} className="text-xs text-slate-400">ใช้ไปแล้ว</Text>
                      <Text style={[styles.leaveStatValue, { color: colors.textSecondary }]} className="text-sm font-semibold text-slate-500">{used} วัน</Text>
                    </View>
                    <View style={styles.leaveStatCol}>
                      <Text style={styles.leaveStatLabel} className="text-xs text-slate-400">คงเหลือ</Text>
                      <Text style={[styles.leaveStatValue, { color: isExhausted ? '#94A3B8' : type.color, fontWeight: '800' }]} className="text-sm font-bold">{type.remaining} วัน</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarBg} className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${(type.remaining / type.total) * 100}%`,
                          backgroundColor: isExhausted ? '#CBD5E1' : type.color,
                        },
                      ]}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Leave Request Form Modal (Full Screen) */}
      <Modal
        testID="leave-request-modal"
        animationType="slide"
        transparent={false}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.fullScreenModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
          <TopNavbar
            navigation={navigation}
            onBackPress={() => setIsModalVisible(false)}
            title={`ขอ${leaveBalances.find(b => b.id === selectedType)?.label || 'ลางาน'}`}
            showBack
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContentFull}>
            {/* Locked Leave Type Display */}
            <Text style={styles.formLabel}>ประเภทการลา</Text>
            {(() => {
              const currentBal = leaveBalances.find(b => b.id === selectedType);
              if (!currentBal) return null;
              return (
                <View style={styles.lockedTypeContainer}>
                  <View style={[styles.leaveIconContainer, { backgroundColor: currentBal.color + '18' }]}>
                    <Ionicons name={currentBal.icon || 'calendar-outline'} size={20} color={currentBal.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedTypeName}>{currentBal.label}</Text>
                    <Text style={styles.lockedTypeRemaining}>คงเหลือ {currentBal.remaining} วัน / สิทธิ์ทั้งหมด {currentBal.total} วัน</Text>
                  </View>
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                  </View>
                </View>
              );
            })()}

            {/* Policy Allowed Date Range Banner */}
            {activePolicy && activePolicy.dateRangeEnabled && activePolicy.allowedStartDate && activePolicy.allowedEndDate && (
              <View style={{
                backgroundColor: '#FEF3C7',
                borderColor: '#F59E0B',
                borderWidth: 1.5,
                borderRadius: 16,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
              }}>
                <Ionicons name="alert-circle" size={22} color="#D97706" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                    กำหนดช่วงวันเวลาที่อนุญาตให้ลา
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309', marginTop: 2, lineHeight: 16 }}>
                    เปิดให้ยื่นได้เฉพาะช่วงวันที่ {activePolicy.allowedStartDate} ถึง {activePolicy.allowedEndDate} เท่านั้น (หากเกินวันที่กำหนดจะไม่สามารถลาได้)
                  </Text>
                </View>
              </View>
            )}

            {/* Start Date */}
            <Text style={styles.formLabel}>วันที่เริ่มต้น</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => {
                setDatePickerTarget('start');
                const parts = startDate.split('-');
                setPickerMonth(parseInt(parts[1], 10) - 1);
                setPickerYear(parseInt(parts[0], 10));
                setIsDatePickerVisible(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <Text style={styles.textInput}>{startDate}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* End Date */}
            <Text style={styles.formLabel}>วันที่สิ้นสุด</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => {
                setDatePickerTarget('end');
                const parts = endDate.split('-');
                setPickerMonth(parseInt(parts[1], 10) - 1);
                setPickerYear(parseInt(parts[0], 10));
                setIsDatePickerVisible(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <Text style={styles.textInput}>{endDate}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Days Select Dropdown */}
            <Text style={styles.formLabel}>จำนวนวัน</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setIsDaysPickerVisible(true)}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <Text style={styles.textInput}>{selectedDays} วัน</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Reason */}
            <Text style={styles.formLabel}>เหตุผลการลา</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={reason}
                onChangeText={setReason}
                placeholder="ระบุเหตุผลในการลา..."
                placeholderTextColor="#A0A0A0"
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Attachment */}
            <Text style={styles.formLabel}>เอกสารแนบ (ถ้ามี)</Text>
            <View style={styles.attachmentContainer}>
              {isUploading ? (
                <View style={styles.uploadingState}>
                  <Text style={styles.uploadingText}>กำลังอัปโหลด...</Text>
                </View>
              ) : attachedFile ? (
                <View style={styles.attachedFileRow}>
                  <Ionicons name="document-attach-outline" size={20} color={colors.success} />
                  <Text style={styles.attachedFileName}>{attachedFile}</Text>
                  <TouchableOpacity onPress={() => setAttachedFile(null)} style={styles.removeAttachmentBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadFile}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.uploadBtnText}>อัปโหลดไฟล์</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.submitFormButton} onPress={handleRequestLeave}>
              <Text style={styles.submitFormButtonText}>ส่งใบลา</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelFormButton} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.cancelFormButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Calendar Date Picker Inline Overlay */}
          {isDatePickerVisible && (
            <View style={styles.inlineOverlayCenter}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      if (pickerMonth === 0) {
                        setPickerMonth(11);
                        setPickerYear(pickerYear - 1);
                      } else {
                        setPickerMonth(pickerMonth - 1);
                      }
                    }}
                    style={styles.pickerArrow}
                  >
                    <Ionicons name="chevron-back" size={20} color={colors.title} />
                  </TouchableOpacity>

                  <Text style={styles.pickerMonthTitle}>
                    {pickerThaiMonths[pickerMonth]} {pickerYear + 543}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      if (pickerMonth === 11) {
                        setPickerMonth(0);
                        setPickerYear(pickerYear + 1);
                      } else {
                        setPickerMonth(pickerMonth + 1);
                      }
                    }}
                    style={styles.pickerArrow}
                  >
                    <Ionicons name="chevron-forward" size={20} color={colors.title} />
                  </TouchableOpacity>
                </View>

                {/* Week Headers */}
                <View style={styles.pickerWeekRow}>
                  <Text style={[styles.pickerWeekText, { color: colors.error }]}>อา</Text>
                  <Text style={styles.pickerWeekText}>จ</Text>
                  <Text style={styles.pickerWeekText}>อ</Text>
                  <Text style={styles.pickerWeekText}>พ</Text>
                  <Text style={styles.pickerWeekText}>พฤ</Text>
                  <Text style={styles.pickerWeekText}>ศ</Text>
                  <Text style={[styles.pickerWeekText, { color: colors.warning }]}>ส</Text>
                </View>

                {/* Grid */}
                <View style={styles.pickerGrid}>
                  {getPickerDays(pickerMonth, pickerYear).map((day, idx) => {
                    if (!day) {
                      return <View key={`empty-${idx}`} style={styles.pickerDayCellEmpty} />;
                    }
                    const dayVal = day.getDate();
                    const y = day.getFullYear();
                    const m = String(day.getMonth() + 1).padStart(2, '0');
                    const d = String(day.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;
                    const isDaySelected = dateStr === (datePickerTarget === 'start' ? startDate : endDate);
                    const isDayDisabled = isDateOutsidePolicy(dateStr);

                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.pickerDayCell,
                          isDaySelected && styles.pickerDayCellSelected,
                          isDayDisabled && { opacity: 0.25, backgroundColor: '#F1F5F9' },
                        ]}
                        onPress={() => onSelectDate(dateStr)}
                      >
                        <Text style={[
                          styles.pickerDayText,
                          isDaySelected && styles.pickerDayTextSelected,
                          isDayDisabled && { color: '#94A3B8', textDecorationLine: 'line-through' },
                        ]}>
                          {dayVal}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.pickerCloseBtn}
                  onPress={() => setIsDatePickerVisible(false)}
                >
                  <Text style={styles.pickerCloseBtnText}>ปิด</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Days Count Dropdown Sheet Inline Overlay */}
          {isDaysPickerVisible && (
            <View style={styles.inlineOverlay}>
              <TouchableOpacity
                style={styles.modalDismissArea}
                activeOpacity={1}
                onPress={() => setIsDaysPickerVisible(false)}
              />
              <View style={styles.daysPickerContent}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerMonthTitle}>เลือกจำนวนวันลา</Text>
                  <TouchableOpacity onPress={() => setIsDaysPickerVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.title} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.daysOptionsList}>
                  {(() => {
                    const bal = leaveBalances.find(b => b.id === selectedType);
                    const maxDays = bal ? bal.remaining : 15;
                    const options = Array.from({ length: maxDays }, (_, i) => i + 1);

                    if (options.length === 0) {
                      return (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                          <Text style={{ color: colors.textSecondary }}>ไม่มีจำนวนวันเหลือให้เลือก</Text>
                        </View>
                      );
                    }

                    return options.map(daysVal => (
                      <TouchableOpacity
                        key={`days-${daysVal}`}
                        style={[styles.daysOptionItem, selectedDays === daysVal && styles.daysOptionItemSec]}
                        onPress={() => onSelectDays(daysVal)}
                      >
                        <Text style={[styles.daysOptionText, selectedDays === daysVal && styles.daysOptionTextSec]}>
                          {daysVal} วัน
                        </Text>
                        {selectedDays === daysVal && (
                          <Ionicons name="checkmark" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: 4,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Leave Balance
  leaveCard: {
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
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  leaveTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  leaveCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 16,
  },
  leaveRemaining: {
    fontSize: 28,
    fontWeight: '800',
  },
  leaveTotal: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  // Request Button
  requestButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // History
  historyCard: {
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
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyDates: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyDays: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Form Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalHeaderIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 12,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  modalCloseButton: {
    padding: 4,
  },
  formScrollContent: {
    paddingVertical: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
    marginTop: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
    marginBottom: 8,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.title,
  },
  textAreaContainer: {
    height: 80,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  submitFormButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitFormButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelFormButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelFormButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  leaveIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  leaveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    marginRight: 16,
  },
  leaveStatCol: {
    alignItems: 'flex-start',
  },
  leaveStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  leaveStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  attachmentContainer: {
    marginBottom: 14,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  uploadingState: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6FA',
  },
  uploadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  attachedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#E8F5E9',
  },
  attachedFileName: {
    flex: 1,
    fontSize: 14,
    color: colors.success,
    marginLeft: 8,
    fontWeight: '600',
  },
  removeAttachmentBtn: {
    padding: 2,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width - 40,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pickerArrow: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F6FA',
  },
  pickerMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  pickerWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pickerWeekText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerDayCellEmpty: {
    width: '14.28%',
    height: 36,
  },
  pickerDayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 18,
  },
  pickerDayCellSelected: {
    backgroundColor: colors.primary,
  },
  pickerDayText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.title,
  },
  pickerDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerCloseBtn: {
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  pickerCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  daysPickerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  daysOptionsList: {
    paddingVertical: 8,
  },
  daysOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  daysOptionItemSec: {
    backgroundColor: '#F5F6FA',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  daysOptionText: {
    fontSize: 15,
    color: colors.title,
    fontWeight: '500',
  },
  daysOptionTextSec: {
    color: colors.primary,
    fontWeight: '700',
  },
  inlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  inlineOverlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  subTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F6FA',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  subTabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  monthSection: {
    marginBottom: 20,
  },
  monthSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabRowWithFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  subTabsContainerCustom: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F6',
    borderRadius: 12,
    padding: 3,
    flex: 1,
    marginRight: 10,
  },
  subTabCustom: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  subTabActiveCustom: {
    backgroundColor: '#3B82F6',
  },
  subTabTextCustom: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  subTabTextActiveCustom: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F0F2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavigatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  navArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMonthText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  emptyStateCustomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    flex: 1,
  },
  documentIllustration: {
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#B0B5C0',
    paddingTop: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    marginBottom: 16,
  },
  docLineShort: {
    width: '40%',
    height: 3,
    backgroundColor: '#D1D5DB',
    borderRadius: 1.5,
    marginBottom: 6,
  },
  docLineLong: {
    width: '100%',
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    marginBottom: 6,
  },
  questionCircle: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyStateCustomText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  yearOptionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F6FA',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  yearOptionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearOptionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yearOptionChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  formScrollContentFull: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  lockedTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  lockedTypeName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 2,
  },
  lockedTypeRemaining: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  lockBadge: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
});
