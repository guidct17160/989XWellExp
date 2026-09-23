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
  Alert,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { otStorage } from '../services/otStorage';
import TopNavbar from '../components/TopNavbar';

const { width } = Dimensions.get('window');

const pickerThaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function OtRequestScreen({ navigation, route }) {
  const [otState, setOtState] = useState(otStorage.getState());
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'balance');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Form State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('ot_normal');
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otHours, setOtHours] = useState(2);
  const [reason, setReason] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Pickers state
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [isHoursPickerVisible, setIsHoursPickerVisible] = useState(false);
  const [activeHistoryStatus, setActiveHistoryStatus] = useState('รออนุมัติ');
  const [activeHistoryMonth, setActiveHistoryMonth] = useState(new Date().getMonth());
  const [activeHistoryYear, setActiveHistoryYear] = useState(new Date().getFullYear());
  const [isMonthFilterPickerVisible, setIsMonthFilterPickerVisible] = useState(false);
  const [isYearFilterPickerVisible, setIsYearFilterPickerVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = otStorage.subscribe((state) => {
      setOtState(state);
    });

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  const { otBalances, otHistory } = otState;

  const filteredHistory = otHistory.filter(item => {
    if (item.status !== activeHistoryStatus) return false;
    if (!item.start) return false;
    const parts = item.start.split('-');
    const itemYear = parseInt(parts[0], 10);
    const itemMonth = parseInt(parts[1], 10) - 1;

    return itemYear === activeHistoryYear && itemMonth === activeHistoryMonth;
  });

  const uniqueYears = Array.from(new Set(
    otHistory.map(item => {
      if (!item.start) return null;
      return parseInt(item.start.split('-')[0], 10);
    }).filter(Boolean)
  ));
  if (!uniqueYears.includes(new Date().getFullYear())) {
    uniqueYears.push(new Date().getFullYear());
  }
  uniqueYears.sort((a, b) => b - a);

  const handleUploadFile = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setAttachedFile('อนุมัติ_OT_เอกสารแนบ.pdf');
    }, 800);
  };

  const handlePrevMonth = () => {
    if (activeHistoryMonth === 0) {
      setActiveHistoryMonth(11);
      setActiveHistoryYear(activeHistoryYear - 1);
    } else {
      setActiveHistoryMonth(activeHistoryMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (activeHistoryMonth === 11) {
      setActiveHistoryMonth(0);
      setActiveHistoryYear(activeHistoryYear + 1);
    } else {
      setActiveHistoryMonth(activeHistoryMonth + 1);
    }
  };

  const handleRequestOt = () => {
    if (!otDate) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุวันที่ทำ OT');
      return;
    }

    const balance = otBalances.find(b => b.id === selectedType);
    if (!balance) return;

    if (balance.remaining <= 0) {
      Alert.alert('ล้มเหลว', `คุณใช้สิทธิ์ ${balance.label} ครบตามกำหนดแล้ว`);
      return;
    }

    if (otHours > balance.remaining) {
      Alert.alert('ล้มเหลว', `จำนวนชั่วโมง OT (${otHours} ชม.) เกินสิทธิ์คงเหลือ (${balance.remaining} ชม.)`);
      return;
    }

    try {
      otStorage.addOtRequest(selectedType, otDate, otHours, reason);
      Alert.alert('สำเร็จ', 'ส่งคำขออนุมัติ OT เรียบร้อยแล้ว');
      setIsModalVisible(false);

      // Reset form
      setOtDate(new Date().toISOString().split('T')[0]);
      setOtHours(2);
      setReason('');
      setAttachedFile(null);
    } catch (error) {
      Alert.alert('ข้อผิดพลาด', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="ขอทำโอที / สวัสดิการ" showBack />

      {/* Main Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balance' && styles.tabActive]}
          onPress={() => setActiveTab('balance')}
        >
          <Text style={[styles.tabText, activeTab === 'balance' && styles.tabTextActive]}>สิทธิ์ OT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>สถานะคำขอ</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'balance' ? (
            <>
              {/* OT Balance Cards */}
              {otBalances.map((type) => {
                const used = type.total - type.remaining;
                const isExhausted = type.remaining <= 0;

                return (
                  <TouchableOpacity
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
                    onPress={() => {
                      if (isExhausted) return;
                      setSelectedType(type.id);
                      setOtDate(new Date().toISOString().split('T')[0]);
                      setOtHours(2);
                      setReason('');
                      setAttachedFile(null);
                      setIsModalVisible(true);
                    }}
                  >
                    <View style={styles.leaveCardHeader}>
                      <View
                        style={[
                          styles.leaveIconContainer,
                          { backgroundColor: isExhausted ? '#F1F5F9' : type.color + '12' },
                        ]}
                      >
                        <Ionicons
                          name={type.icon || 'time-outline'}
                          size={20}
                          color={isExhausted ? '#94A3B8' : type.color}
                        />
                      </View>
                      <Text
                        style={[
                          styles.leaveTypeName,
                          isExhausted && { color: '#94A3B8' },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </View>
                    <View style={styles.leaveCardBody}>
                      <View style={styles.leaveStatsRow}>
                        <View style={styles.leaveStatCol}>
                          <Text style={styles.leaveStatLabel}>สิทธิ์ทั้งหมด</Text>
                          <Text style={[styles.leaveStatValue, isExhausted && { color: '#94A3B8' }]}>{type.total} ชม.</Text>
                        </View>
                        <View style={styles.leaveStatCol}>
                          <Text style={styles.leaveStatLabel}>ใช้ไปแล้ว</Text>
                          <Text style={[styles.leaveStatValue, { color: colors.textSecondary }]}>{used} ชม.</Text>
                        </View>
                        <View style={styles.leaveStatCol}>
                          <Text style={styles.leaveStatLabel}>คงเหลือ</Text>
                          <Text style={[styles.leaveStatValue, { color: isExhausted ? '#94A3B8' : type.color, fontWeight: '800' }]}>{type.remaining} ชม.</Text>
                        </View>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${(type.remaining / type.total) * 100}%`,
                              backgroundColor: isExhausted ? '#CBD5E1' : type.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <>
              {/* Subtabs + Filter */}
              <View testID="ot-history-filter" style={styles.tabRowWithFilter} className="flex-row items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
                <View style={styles.subTabsContainerCustom} className="flex-row bg-slate-100 p-1 rounded-xl">
                  {['รออนุมัติ', 'อนุมัติ', 'ไม่อนุมัติ'].map(status => (
                    <TouchableOpacity
                      testID={`ot-history-status-${status}`}
                      key={status}
                      style={[
                        styles.subTabCustom,
                        activeHistoryStatus === status && styles.subTabActiveCustom
                      ]}
                      className={`px-3 py-1.5 rounded-lg ${activeHistoryStatus === status ? 'bg-white shadow-sm' : ''}`}
                      onPress={() => setActiveHistoryStatus(status)}
                    >
                      <Text
                        style={[
                          styles.subTabTextCustom,
                          activeHistoryStatus === status && styles.subTabTextActiveCustom
                        ]}
                        className={`text-xs ${activeHistoryStatus === status ? 'font-bold text-primary' : 'font-medium text-slate-500'}`}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  testID="ot-filter-btn"
                  style={styles.filterIconButton}
                  className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"
                  onPress={() => setIsMonthFilterPickerVisible(true)}
                >
                  <Ionicons name="options-outline" size={22} color={colors.title} />
                </TouchableOpacity>
              </View>

              {/* Month Navigator */}
              <View testID="ot-month-nav" style={styles.monthNavigatorContainer} className="flex-row items-center justify-between px-6 py-3 bg-slate-50">
                <TouchableOpacity
                  testID="ot-prev-month-btn"
                  style={styles.navArrowButton}
                  className="w-8 h-8 rounded-full bg-white items-center justify-center border border-slate-200"
                  onPress={handlePrevMonth}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </TouchableOpacity>

                <Text style={styles.navMonthText}>
                  {pickerThaiMonths[activeHistoryMonth]} {activeHistoryYear}
                </Text>

                <TouchableOpacity
                  style={styles.navArrowButton}
                  onPress={handleNextMonth}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* History Items */}
              {filteredHistory.length === 0 ? (
                <View style={styles.emptyStateCustomContainer}>
                  <View style={styles.documentIllustration}>
                    <View style={styles.docLineShort} />
                    <View style={styles.docLineLong} />
                    <View style={styles.docLineLong} />
                    <View style={styles.docLineLong} />
                    <View style={styles.questionCircle}>
                      <Text style={styles.questionMarkText}>?</Text>
                    </View>
                  </View>
                  <Text style={styles.emptyStateCustomText}>ไม่มีรายการ</Text>
                </View>
              ) : (
                filteredHistory.map(item => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyType}>{item.type}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: item.statusColor + '15' }]}>
                        <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
                      </View>
                    </View>
                    <View style={styles.historyDetail}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.historyDates}>{item.dates}</Text>
                    </View>
                    <View style={styles.historyDetail}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.historyDays}>{item.hours} ชั่วโมง</Text>
                    </View>
                    {item.reason ? (
                      <View style={[styles.historyDetail, { marginTop: 8 }]}>
                        <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.historyDates, { fontStyle: 'italic' }]}>เหตุผล: {item.reason}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Request OT Form Modal (Full Screen) */}
      <Modal
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
            title="ขออนุมัติ OT"
            showBack
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContentFull}>
            {/* Type Selection */}
            <Text style={styles.inputLabel}>ประเภท OT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {otBalances.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeChip,
                    selectedType === t.id && { backgroundColor: t.color, borderColor: t.color }
                  ]}
                  onPress={() => setSelectedType(t.id)}
                >
                  <Text style={[
                    styles.typeChipText,
                    selectedType === t.id && { color: '#FFFFFF', fontWeight: '700' }
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date Input */}
            <Text style={styles.inputLabel}>วันที่ทำ OT</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => {
                const parts = otDate.split('-');
                setPickerYear(parseInt(parts[0], 10));
                setPickerMonth(parseInt(parts[1], 10) - 1);
                setIsDatePickerVisible(true);
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <Text style={styles.inputText}>{otDate}</Text>
            </TouchableOpacity>

            {/* Hours Input */}
            <Text style={styles.inputLabel}>จำนวนชั่วโมง OT</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setIsHoursPickerVisible(true)}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <Text style={styles.inputText}>{otHours} ชั่วโมง</Text>
            </TouchableOpacity>

            {/* Reason */}
            <Text style={styles.inputLabel}>เหตุผล / ลักษณะงานที่ทำ</Text>
            <TextInput
              style={[styles.inputContainer, styles.textArea]}
              placeholder="ระบุเหตุผลในการขอ OT..."
              placeholderTextColor={colors.placeholder}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
            />

            {/* Attachment */}
            <Text style={styles.inputLabel}>เอกสารแนบ (ถ้ามี)</Text>
            {attachedFile ? (
              <View style={styles.attachedFileCard}>
                <Ionicons name="document-attach-outline" size={20} color={colors.success} />
                <Text style={styles.attachedFileName}>{attachedFile}</Text>
                <TouchableOpacity onPress={() => setAttachedFile(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={handleUploadFile}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.uploadButtonText}>{isUploading ? 'กำลังอัปโหลด...' : 'อัปโหลดเอกสารแนบ'}</Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity style={styles.submitButton} onPress={handleRequestOt}>
              <Text style={styles.submitButtonText}>ส่งคำขออนุมัติ OT</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={isDatePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setPickerMonth(pickerMonth === 0 ? 11 : pickerMonth - 1)}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>{pickerThaiMonths[pickerMonth]} {pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerMonth(pickerMonth === 11 ? 0 : pickerMonth + 1)}>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <Text key={d} style={styles.calendarDayHeader}>{d}</Text>
              ))}
              {(() => {
                const daysInM = new Date(pickerYear, pickerMonth + 1, 0).getDate();
                const startDay = new Date(pickerYear, pickerMonth, 1).getDay();
                const cells = [];
                for (let i = 0; i < startDay; i++) {
                  cells.push(<View key={`e-${i}`} style={styles.calendarCell} />);
                }
                for (let d = 1; d <= daysInM; d++) {
                  const mStr = String(pickerMonth + 1).padStart(2, '0');
                  const dStr = String(d).padStart(2, '0');
                  const fullStr = `${pickerYear}-${mStr}-${dStr}`;
                  const isSel = otDate === fullStr;

                  cells.push(
                    <TouchableOpacity
                      key={d}
                      style={[styles.calendarCell, isSel && styles.calendarCellSelected]}
                      onPress={() => {
                        setOtDate(fullStr);
                        setIsDatePickerVisible(false);
                      }}
                    >
                      <Text style={[styles.calendarCellText, isSel && styles.calendarCellTextSelected]}>{d}</Text>
                    </TouchableOpacity>
                  );
                }
                return cells;
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Hours Selector Modal */}
      <Modal
        visible={isHoursPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsHoursPickerVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={[styles.pickerTitle, { textAlign: 'center', marginBottom: 16 }]}>เลือกจำนวนชั่วโมง OT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.hourChip,
                    otHours === h && styles.hourChipSelected
                  ]}
                  onPress={() => {
                    setOtHours(h);
                    setIsHoursPickerVisible(false);
                  }}
                >
                  <Text style={[styles.hourChipText, otHours === h && styles.hourChipTextSelected]}>
                    {h} ชม.
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Month/Year Filter Modal */}
      <Modal
        visible={isMonthFilterPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMonthFilterPickerVisible(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.pickerTitle}>เลือกเดือน / ปีที่ต้องการดู</Text>
              <TouchableOpacity onPress={() => setIsMonthFilterPickerVisible(false)}>
                <Ionicons name="close" size={20} color={colors.title} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>ปี พ.ศ.</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              {uniqueYears.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[
                    styles.hourChip,
                    activeHistoryYear === y && styles.hourChipSelected,
                    { marginRight: 8 }
                  ]}
                  onPress={() => setActiveHistoryYear(y)}
                >
                  <Text style={[styles.hourChipText, activeHistoryYear === y && styles.hourChipTextSelected]}>
                    {y + 543}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>เดือน</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {pickerThaiMonths.map((mName, idx) => (
                <TouchableOpacity
                  key={mName}
                  style={[
                    styles.monthFilterChip,
                    activeHistoryMonth === idx && styles.hourChipSelected
                  ]}
                  onPress={() => {
                    setActiveHistoryMonth(idx);
                    setIsMonthFilterPickerVisible(false);
                  }}
                >
                  <Text style={[styles.hourChipText, activeHistoryMonth === idx && styles.hourChipTextSelected]}>
                    {mName}
                  </Text>
                </TouchableOpacity>
              ))}
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
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  leaveIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaveTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  leaveCardBody: {
    marginTop: 4,
  },
  leaveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  progressBarBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Subtabs & Filters
  tabRowWithFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  subTabsContainerCustom: {
    flexDirection: 'row',
    backgroundColor: '#EAEAEA',
    borderRadius: 10,
    padding: 3,
    flex: 1,
    marginRight: 10,
  },
  subTabCustom: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActiveCustom: {
    backgroundColor: '#FFFFFF',
  },
  subTabTextCustom: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subTabTextActiveCustom: {
    color: colors.title,
    fontWeight: '700',
  },
  filterIconButton: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  monthNavigatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  navArrowButton: {
    padding: 4,
  },
  navMonthText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  emptyStateCustomContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  documentIllustration: {
    width: 60,
    height: 70,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    position: 'relative',
  },
  docLineShort: {
    width: '40%',
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    marginBottom: 6,
  },
  docLineLong: {
    width: '100%',
    height: 4,
    backgroundColor: '#EEE',
    borderRadius: 2,
    marginBottom: 6,
  },
  questionCircle: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMarkText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCustomText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyDates: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  historyDays: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 6,
    marginTop: 10,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    marginRight: 8,
    backgroundColor: '#FAFAFA',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.title,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputText: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '600',
  },
  inputIcon: {
    marginRight: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  attachedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
  },
  attachedFileName: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Pickers Modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  calendarCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginVertical: 2,
  },
  calendarCellSelected: {
    backgroundColor: colors.primary,
  },
  calendarCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
  },
  calendarCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hourChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    margin: 4,
  },
  monthFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    margin: 4,
  },
  hourChipSelected: {
    backgroundColor: colors.primary,
  },
  hourChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
  },
  hourChipTextSelected: {
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
});
