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
  Dimensions,
  TextInput,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { tryFetchApi } from '../services/apiClient';

const { width } = Dimensions.get('window');

const payslipsData = [
  {
    id: '1',
    month: 'กรกฎาคม 2568',
    income: [
      { label: 'เงินเดือน', amount: 45000 },
      { label: 'ค่าตำแหน่ง', amount: 5000 },
      { label: 'ค่าล่วงเวลา (OT)', amount: 3500 },
      { label: 'โบนัส', amount: 0 },
    ],
    deductions: [
      { label: 'ประกันสังคม', amount: 750 },
      { label: 'ภาษี ณ ที่จ่าย', amount: 2100 },
      { label: 'กองทุนสำรองเลี้ยงชีพ', amount: 2250 },
    ],
  },
];

export default function PayslipScreen({ navigation }) {
  const [isVerified, setIsVerified] = useState(false);
  const [dobInput, setDobInput] = useState('');
  const [payslipsList, setPayslipsList] = useState(payslipsData);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const fetchPayslips = async () => {
      try {
        const res = await tryFetchApi('/payslips');
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.payslips) && data.payslips.length > 0) {
            setPayslipsList(data.payslips);
          }
        }
      } catch (e) {}
    };
    fetchPayslips();
  }, [isVerified, selectedPayslip]);

  const handleVerify = () => {
    if (dobInput === '010197') {
      setIsVerified(true);
      setDobInput('');
    } else {
      Alert.alert('ยืนยันตัวตนล้มเหลว', 'วันเดือนปีเกิดไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handlePrevMonth = () => {
    if (!selectedPayslip) return;
    const currentIndex = payslipsList.findIndex(p => p.id === selectedPayslip.id);
    if (currentIndex < payslipsList.length - 1) {
      setSelectedPayslip(payslipsList[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (!selectedPayslip) return;
    const currentIndex = payslipsList.findIndex(p => p.id === selectedPayslip.id);
    if (currentIndex > 0) {
      setSelectedPayslip(payslipsList[currentIndex - 1]);
    }
  };

  const formatMoney = (n) => Number(n || 0).toLocaleString('th-TH');

  // --- SCREEN 1: DOB Verification Gate ---
  if (!isVerified) {
    return (
      <SafeAreaView testID="screen-payslip-lock" className="flex-1 bg-white" style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
        
        <TopNavbar navigation={navigation} title="สลิปเงินเดือน" showBack />

          <View testID="payslip-lock-container" style={styles.lockContainer} className="flex-1 items-center justify-center px-6 pb-12">
            <View style={styles.lockIconCircle} className="w-24 h-24 rounded-full bg-primary-light items-center justify-center mb-6">
              <Ionicons name="lock-closed" size={48} color={colors.primary} />
            </View>
            
            <Text style={styles.lockTitle} className="text-xl font-bold text-slate-900 text-center mb-2">กรอกวันเดือนปีเกิดเพื่อดูข้อมูล</Text>
            <Text style={styles.lockSubtitle} className="text-sm text-slate-500 text-center mb-8 px-4">ระบุตัวเลข 6 หลัก เช่น 010197 สำหรับวันที่ 1 มกราคม 2540</Text>

            <TextInput
              testID="payslip-dob-input"
              style={styles.lockInput}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-center text-xl font-bold tracking-widest text-slate-900 mb-6"
              value={dobInput}
              onChangeText={(text) => {
                setDobInput(text);
                if (text.length === 6) {
                  Keyboard.dismiss();
                }
              }}
              placeholder="DDMMYY"
              placeholderTextColor="#A0A0A0"
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry={true}
            />

            <TouchableOpacity testID="payslip-verify-btn" style={styles.verifyButton} className="w-full bg-primary rounded-xl py-4 items-center justify-center shadow-md" onPress={handleVerify}>
              <Text style={styles.verifyButtonText} className="text-white font-bold text-base">ยืนยัน</Text>
            </TouchableOpacity>
          </View>
      </SafeAreaView>
    );
  }

  // --- SCREEN 2: Payslips List View ---
  if (!selectedPayslip) {
    return (
      <SafeAreaView testID="screen-payslip-list" className="flex-1 bg-white" style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
        
        <TopNavbar navigation={navigation} title="สลิปเงินเดือน" showBack />

        <ScrollView testID="payslip-history-list" style={styles.scrollView} className="flex-1 bg-slate-50" contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle} className="text-base font-bold text-slate-800 p-4 pb-2">ประวัติสลิปเงินเดือน</Text>
          
          {payslipsList.map((slip) => {
            const totalIncome = slip.income.reduce((sum, i) => sum + i.amount, 0);
            const totalDeductions = slip.deductions.reduce((sum, d) => sum + d.amount, 0);
            const netPay = totalIncome - totalDeductions;

            return (
              <TouchableOpacity
                testID={`payslip-item-${slip.id}`}
                key={slip.id}
                style={styles.pastSlipCard}
                className="flex-row items-center justify-between bg-white mx-4 my-2 p-4 rounded-2xl border border-slate-100 shadow-sm"
                onPress={() => setSelectedPayslip(slip)}
              >
                <View>
                  <Text style={styles.pastSlipMonth} className="text-base font-bold text-slate-900 mb-1">{slip.month}</Text>
                  <View style={styles.pastSlipStatus} className="flex-row items-center">
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} className="w-2 h-2 rounded-full mr-1.5" />
                    <Text style={styles.pastSlipStatusText} className="text-xs font-semibold text-emerald-600">จ่ายแล้ว</Text>
                  </View>
                </View>
                <View style={styles.pastSlipRight} className="flex-row items-center">
                  {/* <Text style={styles.pastSlipAmount}>฿{formatMoney(netPay)}</Text> */}
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- SCREEN 3: Detailed Month View ---
  const totalIncome = selectedPayslip.income.reduce((sum, i) => sum + i.amount, 0);
  const totalDeductions = selectedPayslip.deductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = totalIncome - totalDeductions;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedPayslip(null)}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดสลิป</Text>
        <TouchableOpacity onPress={() => Alert.alert('ดาวน์โหลดสำเร็จ', 'สลิปเงินเดือนของคุณถูกดาวน์โหลดเรียบร้อยแล้ว')}>
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Month Selector Navigator */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={handlePrevMonth}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthText}>{selectedPayslip.month}</Text>
            <TouchableOpacity onPress={handleNextMonth}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Net Pay Card (Mockup 3 blue card layout) */}
          <View style={styles.netPayCard}>
            <Text style={styles.netPayLabel}>เงินเดือนสุทธิ</Text>
            <Text style={styles.netPayAmount}>฿{formatMoney(netPay)}</Text>
            
            <View style={styles.netPayRow}>
              <View style={styles.netPayItem}>
                <View style={styles.badgeRow}>
                  <Ionicons name="arrow-up-circle" size={16} color={colors.success} />
                  <Text style={styles.netPayItemLabel}>รายได้</Text>
                </View>
                <Text style={[styles.netPayItemValue, { color: colors.success }]}>
                  ฿{formatMoney(totalIncome)}
                </Text>
              </View>
              
              <View style={styles.netPaySep} />
              
              <View style={styles.netPayItem}>
                <View style={styles.badgeRow}>
                  <Ionicons name="arrow-down-circle" size={16} color={colors.error} />
                  <Text style={styles.netPayItemLabel}>หัก</Text>
                </View>
                <Text style={[styles.netPayItemValue, { color: colors.error }]}>
                  ฿{formatMoney(totalDeductions)}
                </Text>
              </View>
            </View>
          </View>

          {/* รายได้ */}
          <Text style={styles.sectionTitle}>รายได้</Text>
          <View style={styles.detailCard}>
            {selectedPayslip.income.map((item, i) => (
              <View
                key={i}
                style={[styles.detailRow, i < selectedPayslip.income.length - 1 && styles.detailRowBorder]}
              >
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={[styles.detailAmount, { color: item.amount > 0 ? colors.success : colors.textSecondary }]}>
                  {item.amount > 0 ? `+฿${formatMoney(item.amount)}` : '-'}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>รวมรายได้</Text>
              <Text style={[styles.totalAmount, { color: colors.success }]}>฿{formatMoney(totalIncome)}</Text>
            </View>
          </View>

          {/* หักเงิน */}
          <Text style={styles.sectionTitle}>รายการหัก</Text>
          <View style={styles.detailCard}>
            {selectedPayslip.deductions.map((item, i) => (
              <View
                key={i}
                style={[styles.detailRow, i < selectedPayslip.deductions.length - 1 && styles.detailRowBorder]}
              >
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={[styles.detailAmount, { color: item.amount > 0 ? colors.error : colors.textSecondary }]}>
                  {item.amount > 0 ? `-฿${formatMoney(item.amount)}` : '-'}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>รวมหัก</Text>
              <Text style={[styles.totalAmount, { color: colors.error }]}>฿{formatMoney(totalDeductions)}</Text>
            </View>
          </View>
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
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Verification Gate lock screen
  lockContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  lockIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 18,
  },
  lockInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    width: '100%',
    height: 54,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: colors.title,
    marginBottom: 24,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Month Selector Navigator
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  // Net Pay Card
  netPayCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  netPayLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  netPayAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  netPayRow: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
  },
  netPayItem: {
    flex: 1,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  netPaySep: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  netPayItemLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
    fontWeight: '600',
  },
  netPayItemValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 12,
    marginTop: 8,
  },
  // Detail Card
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  detailAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  // Past Payslips List
  pastSlipCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  pastSlipMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  pastSlipStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  pastSlipStatusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pastSlipRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastSlipAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    marginRight: 8,
  },
});
