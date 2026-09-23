import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  Modal,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';
import { pointsStorage } from '../services/pointsStorage';
import { missionStorage } from '../services/missionStorage';
import { tryFetchApi } from '../services/apiClient';

const { width } = Dimensions.get('window');

// pointTransactions now comes from pointsStorage (shared singleton)

// 2. ประวัติแลกรางวัล (Redeemed Rewards Data - เอาแค่รางวัลที่เราแลกไป)
const redeemedRewards = [
  {
    id: 'r1',
    title: 'Starbucks (เครื่องดื่ม 1 แก้ว)',
    subtitle: 'รหัสคูปอง: STB-883921',
    points: 500,
    date: '22 ก.ย. 2026 • 12:15 น.',
    status: 'ใช้งานแล้ว',
    color: '#00704A',
    icon: 'cafe',
  },
  {
    id: 'r2',
    title: 'Shopee Voucher 100 THB',
    subtitle: 'รหัสคูปอง: SHP-991204',
    points: 900,
    date: '15 ก.ย. 2026 • 14:20 น.',
    status: 'พร้อมใช้งาน',
    color: '#FF6B35',
    icon: 'gift',
  },
];

// missions now comes from missionStorage (shared singleton)

const rewardsCatalog = [
  {
    id: 'rw_shopee_100',
    title: 'Shopee Voucher 100 THB',
    brandName: 'Shopee Voucher',
    subtitle: '100 THB',
    points: 900,
    category: 'popular',
    icon: 'bag-handle',
    color: '#FF5722',
    bannerGradient: ['#FF5722', '#FF8A65'],
    desc: 'Shopee Voucher มูลค่า 100 บาท สำหรับใช้เป็นส่วนลดการสั่งซื้อสินค้าทุกหมวดหมู่บน Shopee แอปพลิเคชัน',
    terms: [
      'ใช้กับการสั่งซื้อขั้นต่ำ 300 บาทขึ้นไป',
      'รหัสส่วนลดมีอายุใช้งานถึง 31 ธ.ค. 2026',
      'ไม่สามารถแลกเปลี่ยน หรือทอนเป็นเงินสดได้',
    ],
  },
  {
    id: 'rw_lazada_100',
    title: 'Lazada Voucher 100 THB',
    brandName: 'Lazada Voucher',
    subtitle: '100 THB',
    points: 900,
    category: 'popular',
    icon: 'heart',
    color: '#0F146D',
    bannerGradient: ['#0F146D', '#2A34B6'],
    desc: 'Lazada Voucher มูลค่า 100 บาท สำหรับใช้เป็นส่วนลดในการซื้อสินค้าที่ร่วมรายการบน Lazada',
    terms: [
      'ใช้กับการสั่งซื้อขั้นต่ำ 300 บาทขึ้นไป',
      'รหัสส่วนลดมีอายุใช้งานถึง 31 ธ.ค. 2026',
      'ไม่สามารถแลกเปลี่ยน หรือทอนเป็นเงินสดได้',
    ],
  },
  {
    id: 'rw_villa_100',
    title: 'Villa Market 100 THB',
    brandName: 'Villa Market',
    subtitle: '100 THB',
    points: 900,
    category: 'lifestyle',
    icon: 'cart',
    color: '#1A2B6D',
    bannerGradient: ['#1A2B6D', '#3B4D9D'],
    desc: 'บัตรส่วนลด Villa Market มูลค่า 100 บาท ใช้ชำระค่าสินค้าได้ทุกสาขาทั่วประเทศ',
    terms: [
      'แสดงรหัสคูปองกับพนักงานก่อนชำระเงิน',
      'ใช้ได้ถึง 31 ธ.ค. 2026',
      'ไม่สามารถทอนเป็นเงินสดได้',
    ],
  },
  {
    id: 'rw_starbucks_100',
    title: 'Starbucks 100 THB',
    brandName: 'Starbucks',
    subtitle: '100 THB',
    points: 900,
    category: 'food',
    icon: 'cafe',
    color: '#00704A',
    bannerGradient: ['#00704A', '#00A862'],
    desc: 'คูปองแลกเครื่องดื่ม Starbucks ฟรี 1 แก้ว มูลค่าสูงสุด 100 บาท ทุกสาขา',
    terms: [
      'ยื่นสแกน QR Code หน้าเคาน์เตอร์ก่อนสั่งซื้อ',
      'ใช้ได้กับเครื่องดื่มทุกประเภท',
      'รหัสคูปองมีอายุ 30 วันนับจากวันที่กดแลก',
    ],
  },
  {
    id: 'rw_leave_1day',
    title: 'เพิ่มวันลาพักร้อน +1 วัน',
    brandName: 'สิทธิพิเศษ HR',
    subtitle: '+1 วันลา',
    points: 1500,
    category: 'lifestyle',
    icon: 'calendar',
    color: '#1F4C9C',
    bannerGradient: ['#1F4C9C', '#3B82F6'],
    desc: 'สิทธิพิเศษแลกวันลาพักร้อนเพิ่ม 1 วัน โดยระบบจะอนุมัติเพิ่มสิทธิ์วันลาให้อัตโนมัติ',
    terms: [
      'ระบบจะเพิ่มวันลาพักร้อนให้ในโควต้าประจำปีทันที',
      'ต้องยื่นใบลาก่อนวันหยุดอย่างน้อย 2 วัน',
    ],
  },
  {
    id: 'rw_grabfood_100',
    title: 'GrabFood Voucher 100 THB',
    brandName: 'GrabFood',
    subtitle: '100 THB',
    points: 900,
    category: 'food',
    icon: 'restaurant',
    color: '#00B14F',
    bannerGradient: ['#00B14F', '#20D672'],
    desc: 'GrabFood Voucher ส่วนลดค่าอาหาร 100 บาท เมื่อสั่งซื้อผ่าน GrabApp',
    terms: [
      'ใช้เป็นส่วนลดค่าอาหารขั้นต่ำ 200 บาท',
      'ใช้ได้ถึง 31 ธ.ค. 2026',
    ],
  },
];

const rewards = rewardsCatalog;

// Base leaderboard data (other people's points are static, user's points will be dynamic)
const baseLeaderboard = [
  { name: 'พี่นิ้ง', basePoints: 5000, dept: 'PR' },
  { name: 'พี่ฟิล์ม', basePoints: 4700, dept: 'UV Design' },
  { name: 'กุยช่าย', basePoints: 4580, dept: 'Super Developer', isMe: true },
];

export default function RewardsScreen({ navigation, route }) {
  const scrollViewRef = useRef(null);
  useScrollToTop(scrollViewRef);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Full Screen View Visibility States
  const [showPointHistoryModal, setShowPointHistoryModal] = useState(false);
  const [showRedeemHistoryModal, setShowRedeemHistoryModal] = useState(false);

  // Screen 18 & 19 Modal States (Redeem Rewards & Reward Detail)
  const [showRedeemCatalogModal, setShowRedeemCatalogModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all' | 'popular' | 'lifestyle' | 'food'

  // Dynamic Catalog Rewards List State
  const [catalogRewards, setCatalogRewards] = useState(rewardsCatalog);

  // Dynamic Redeemed History List State
  const [redeemedHistoryList, setRedeemedHistoryList] = useState(redeemedRewards);

  const fetchBackendRewards = async () => {
    try {
      const res = await tryFetchApi('/rewards');
      if (res && res.ok) {
        const json = await res.json();
        if (json.success && json.rewards && json.rewards.length > 0) {
          const formatted = json.rewards.map((r) => ({
            id: r.id,
            title: r.title,
            brandName: r.title.split(' ')[0] || 'Reward',
            subtitle: `${r.pointsCost || r.pointsRequired || 500} Points`,
            points: r.pointsCost || r.pointsRequired || 500,
            category: r.category ? r.category.toLowerCase() : 'popular',
            icon: 'gift',
            color: '#FF5722',
            bannerGradient: ['#FF5722', '#FF8A65'],
            desc: r.description || 'ของรางวัลพนักงานสิทธิพิเศษ',
            terms: [
              'แสดงรหัสคูปองกับพนักงานก่อนชำระเงิน',
              'ไม่สามารถแลกเปลี่ยน หรือทอนเป็นเงินสดได้',
            ],
            stockQuantity: r.stockQuantity || 10,
          }));
          setCatalogRewards(formatted);
        }
      }
    } catch (e) {
      console.error('Failed to sync backend rewards in mobile app', e);
    }
  };

  useEffect(() => {
    fetchBackendRewards();
  }, []);

  // Success, Warning & Confirm Popups
  const [confirmRedeemPopup, setConfirmRedeemPopup] = useState({ visible: false, reward: null });
  const [redeemSuccessPopup, setRedeemSuccessPopup] = useState({ visible: false, reward: null, voucherCode: '' });
  const [insufficientPopup, setInsufficientPopup] = useState({ visible: false, required: 0, current: 0, rewardTitle: '' });
  // Selected Redeemed Coupon Detail View State
  const [selectedRedeemedCoupon, setSelectedRedeemedCoupon] = useState(null);

  // Full Screen Leaderboard Modal States
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('week'); // 'week' | 'month' | 'year'
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('activity'); // 'activity' | 'transfer'

  // Dynamically hide Bottom Tab Bar when any Popup or Fullscreen Modal is active
  useEffect(() => {
    const isPopupActive =
      confirmRedeemPopup.visible ||
      redeemSuccessPopup.visible ||
      insufficientPopup.visible ||
      showRedeemCatalogModal ||
      !!selectedReward ||
      showPointHistoryModal ||
      showRedeemHistoryModal ||
      showLeaderboardModal ||
      !!selectedRedeemedCoupon;

    if (navigation && navigation.setOptions) {
      navigation.setOptions({
        tabBarStyle: isPopupActive
          ? { display: 'none' }
          : {
            backgroundColor: colors.tabBarBackground,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 10,
          },
      });
    }
  }, [
    confirmRedeemPopup.visible,
    redeemSuccessPopup.visible,
    insufficientPopup.visible,
    showRedeemCatalogModal,
    selectedReward,
    showPointHistoryModal,
    showRedeemHistoryModal,
    showLeaderboardModal,
    selectedRedeemedCoupon,
    navigation,
  ]);

  // Filter state for Point History: 'all', 'in', 'out'
  const [pointFilter, setPointFilter] = useState('all');

  // Live transaction data from pointsStorage (shared with MissionsScreen)
  const [liveTransactions, setLiveTransactions] = useState(pointsStorage.getTransactions());
  const [liveUserPoints, setLiveUserPoints] = useState(pointsStorage.getUserPoints());

  // Live mission data from missionStorage
  const [liveMissions, setLiveMissions] = useState(
    missionStorage.getMissions().filter((m) => m.status !== 'expired').slice(0, 4)
  );

  // Claimed mission reward modal
  const [claimedModal, setClaimedModal] = useState({ visible: false, points: 0, title: '' });

  // Refresh missions and points whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      const currentList = missionStorage.getMissions();
      if (currentList && currentList.length > 0) {
        setLiveMissions(currentList.filter((m) => m.status !== 'expired').slice(0, 4));
      }
      setLiveUserPoints(pointsStorage.getUserPoints());
      setLiveTransactions(pointsStorage.getTransactions());
    }, [])
  );

  // Subscribe to live mission & points updates in real-time
  useEffect(() => {
    const unsubscribeMissions = missionStorage.subscribe((updatedMissions) => {
      if (updatedMissions && updatedMissions.length > 0) {
        setLiveMissions(updatedMissions.filter((m) => m.status !== 'expired').slice(0, 4));
      }
    });
    const unsubscribePoints = pointsStorage.subscribe?.((state) => {
      if (state?.userPoints !== undefined) {
        setLiveUserPoints(state.userPoints);
      }
    });
    return () => {
      if (typeof unsubscribeMissions === 'function') unsubscribeMissions();
      if (typeof unsubscribePoints === 'function') unsubscribePoints();
    };
  }, []);

  const handleClaimMission = async (item) => {
    if (!item || item.status !== 'ready_to_claim') return;
    try {
      const claimResult = await missionStorage.claimMission(item.id);
      const earned = claimResult?.pointsEarned || item.points || 50;

      const { userPoints: updatedPoints, transactions: newTxs } = pointsStorage.addTransaction(
        item.title,
        earned,
        'in',
        'ภารกิจ (Mission)'
      );

      const finalPts = claimResult?.newTotalPoints !== undefined ? claimResult.newTotalPoints : updatedPoints;
      setLiveUserPoints(finalPts);
      if (newTxs) setLiveTransactions(newTxs);

      setClaimedModal({
        visible: true,
        points: earned,
        title: item.title,
      });
    } catch (e) {
      console.error('Error claiming mission in RewardsScreen:', e);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถรับรางวัลได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // Coupon redemption tab state: 'code' | 'qr' | 'barcode'
  const [couponRedeemTab, setCouponRedeemTab] = useState('code');

  // Full Screen Enlarged QR / Barcode modal state
  const [enlargedMedia, setEnlargedMedia] = useState({ visible: false, type: 'qr', couponCode: '', title: '' });

  // Mark coupon as used
  const handleMarkCouponUsed = (coupon) => {
    Alert.alert(
      'ยืนยันการใช้คูปอง',
      `คุณต้องการใช้คูปอง "${coupon.title}" ใช่หรือไม่?\n\nเมื่อใช้แล้วจะไม่สามารถใช้ซ้ำได้อีก`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันใช้คูปอง',
          style: 'destructive',
          onPress: () => {
            setRedeemedHistoryList((prev) =>
              prev.map((item) =>
                item.id === coupon.id ? { ...item, status: 'ใช้งานแล้ว' } : item
              )
            );
            setSelectedRedeemedCoupon({ ...coupon, status: 'ใช้งานแล้ว' });
            Alert.alert('สำเร็จ ✅', 'คูปองถูกใช้งานเรียบร้อยแล้ว');
          },
        },
      ]
    );
  };

  // Shared coupon detail content renderer (used in both overlay & standalone modal)
  const renderCouponDetailContent = () => {
    if (!selectedRedeemedCoupon) return null;
    const couponCode = (selectedRedeemedCoupon.subtitle || '').replace('รหัสคูปอง: ', '');
    const isUsed = selectedRedeemedCoupon.status === 'ใช้งานแล้ว';
    const couponColor = selectedRedeemedCoupon.color || '#D93A8B';

    // Enhanced dynamic QR Code generator (Standard 21x21 matrix pattern with finder patterns)
    const generateQRPattern = (pixelSize = 12, showCenterBadge = true) => {
      const seed = couponCode.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
      const gridSize = 21;
      const rows = [];

      for (let r = 0; r < gridSize; r++) {
        const cols = [];
        for (let c = 0; c < gridSize; c++) {
          // 1. Top-Left Finder (0..6 x 0..6), Top-Right (0..6 x 14..20), Bottom-Left (14..20 x 0..6)
          const isTopLeft = r < 7 && c < 7;
          const isTopRight = r < 7 && c >= 14;
          const isBottomLeft = r >= 14 && c < 7;

          let isDark = false;

          if (isTopLeft || isTopRight || isBottomLeft) {
            // Normalize relative row/col inside 7x7 pattern
            const pr = isTopLeft ? r : isTopRight ? r : r - 14;
            const pc = isTopLeft ? c : isTopRight ? c - 14 : c;
            // 7x7 outer border OR 3x3 inner square
            isDark = (pr === 0 || pr === 6 || pc === 0 || pc === 6) || (pr >= 2 && pr <= 4 && pc >= 2 && pc <= 4);
          } else if (r === 6 || c === 6) {
            // 2. Timing lines on row 6 and col 6 (alternating)
            isDark = (r + c) % 2 === 0;
          } else if (showCenterBadge && r >= 8 && r <= 12 && c >= 8 && c <= 12) {
            // 3. Center badge area (reserved for logo)
            isDark = false;
          } else {
            // 4. Data Modules (deterministic hash pattern based on coupon code)
            const moduleHash = (seed * (r + 1) + c * 31 + (r * c * 13)) % 100;
            isDark = moduleHash > 45;
          }

          cols.push(
            <View
              key={c}
              style={{
                width: pixelSize,
                height: pixelSize,
                backgroundColor: isDark ? (isUsed ? '#94A3B8' : '#0F172A') : '#FFFFFF',
              }}
            />
          );
        }
        rows.push(<View key={r} style={{ flexDirection: 'row' }}>{cols}</View>);
      }

      return (
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', borderRadius: 4 }}>
            {rows}
          </View>
          {showCenterBadge && (
            <View
              style={{
                position: 'absolute',
                width: pixelSize * 5,
                height: pixelSize * 5,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                alignItems: 'center',
                justify: 'center',
                borderWidth: 2,
                borderColor: couponColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name={selectedRedeemedCoupon.icon || 'gift'} size={pixelSize * 2.8} color={couponColor} />
            </View>
          )}
        </View>
      );
    };

    // Enhanced dynamic Barcode generator (Code 128 / EAN style with Start/Stop Guard Bars)
    const generateBarcodePattern = (barHeight = 75, scale = 1) => {
      const seed = couponCode.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7), 0);
      const bars = [];
      const totalWidth = 64;

      for (let i = 0; i < totalWidth; i++) {
        // Start guard (0..2 -> 101), Stop guard (totalWidth-4..totalWidth-1 -> 1011)
        const isStartGuard = i === 0 || i === 2;
        const isStartGap = i === 1;
        const isStopGuard = i === totalWidth - 4 || i === totalWidth - 2 || i === totalWidth - 1;
        const isStopGap = i === totalWidth - 3;

        let width = 1.5 * scale;
        let isBlack = false;

        if (isStartGuard || isStopGuard) {
          isBlack = true;
          width = 2 * scale;
        } else if (isStartGap || isStopGap) {
          isBlack = false;
          width = 1.5 * scale;
        } else {
          // Inner bar pattern derived from hash
          const val = (seed * (i + 3) + i * 19) % 17;
          isBlack = val % 2 === 0 || val % 5 === 0;
          width = (val % 3 === 0 ? 3 : val % 2 === 0 ? 2 : 1) * scale;
        }

        bars.push(
          <View
            key={i}
            style={{
              width: width,
              height: barHeight,
              backgroundColor: isBlack ? (isUsed ? '#94A3B8' : '#0F172A') : '#FFFFFF',
              marginRight: scale * 0.8,
            }}
          />
        );
      }

      return (
        <View style={{ alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barHeight }}>
            {bars}
          </View>
          <Text style={{ fontSize: 14 * scale, fontWeight: '800', color: isUsed ? '#94A3B8' : '#0F172A', marginTop: 8, letterSpacing: 3, fontFamily: 'monospace' }}>
            {couponCode}
          </Text>
        </View>
      );
    };

    return (
      <>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 54, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
          <TouchableOpacity onPress={() => setSelectedRedeemedCoupon(null)} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color="#1E293B" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>รายละเอียดคูปอง</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 16, paddingBottom: isUsed ? 40 : 100 }} showsVerticalScrollIndicator={false}>
          {/* Coupon Info Card */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: couponColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name={selectedRedeemedCoupon.icon || 'gift'} size={28} color={couponColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: isUsed ? '#94A3B8' : '#0F172A', marginBottom: 4 }}>{selectedRedeemedCoupon.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: isUsed ? '#F1F5F9' : '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isUsed ? '#64748B' : '#10B981' }}>
                      {selectedRedeemedCoupon.status}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>{selectedRedeemedCoupon.date}</Text>
                </View>
              </View>
            </View>

            <View style={{ borderBottomWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', marginVertical: 14 }} />

            {/* Used coupon overlay message */}
            {isUsed && (
              <View style={{ backgroundColor: '#FEF2F2', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>คูปองนี้ถูกใช้งานแล้ว</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>ไม่สามารถใช้ซ้ำได้อีก</Text>
              </View>
            )}

            {/* Redemption Method Tabs */}
            {!isUsed && (
              <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 16 }}>
                {[
                  { id: 'code', label: 'คัดลอกโค้ด', icon: 'copy-outline' },
                  { id: 'qr', label: 'QR Code', icon: 'qr-code-outline' },
                  { id: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
                ].map((tab) => {
                  const active = couponRedeemTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        borderRadius: 11,
                        backgroundColor: active ? '#FFFFFF' : 'transparent',
                        shadowColor: active ? '#000' : 'transparent',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: active ? 0.08 : 0,
                        shadowRadius: 3,
                        elevation: active ? 2 : 0,
                      }}
                      onPress={() => setCouponRedeemTab(tab.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={tab.icon} size={14} color={active ? '#1F4C9C' : '#94A3B8'} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, fontWeight: active ? '700' : '600', color: active ? '#1F4C9C' : '#94A3B8' }}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Tab Content */}
            {couponRedeemTab === 'code' || isUsed ? (
              <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 6 }}>รหัสคูปองส่วนลดของคุณ</Text>
                <Text style={{ fontSize: 24, color: isUsed ? '#CBD5E1' : '#1F4C9C', fontWeight: '800', letterSpacing: 2, marginBottom: 12, textDecorationLine: isUsed ? 'line-through' : 'none' }}>
                  {couponCode}
                </Text>
                {!isUsed && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F4C9C', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}
                    onPress={() => Alert.alert('สำเร็จ 📋', 'คัดลอกรหัสคูปองเรียบร้อยแล้ว!')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>คัดลอกรหัสคูปอง</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : couponRedeemTab === 'qr' ? (
              <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 12 }}>สแกน QR Code เพื่อใช้ส่วนลด</Text>

                <TouchableOpacity
                  style={{ padding: 14, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
                  onPress={() => setEnlargedMedia({ visible: true, type: 'qr', couponCode, title: selectedRedeemedCoupon.title })}
                  activeOpacity={0.85}
                >
                  {generateQRPattern(11, true)}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                    <Ionicons name="scan-outline" size={14} color="#1F4C9C" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1F4C9C' }}>🔍 แตะเพื่อขยายใหญ่</Text>
                  </View>
                </TouchableOpacity>

                <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>แสดง QR Code นี้ให้พนักงานสแกนก่อนชำระเงิน</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 12 }}>สแกน Barcode เพื่อใช้ส่วนลด</Text>

                <TouchableOpacity
                  style={{ padding: 14, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, width: '100%' }}
                  onPress={() => setEnlargedMedia({ visible: true, type: 'barcode', couponCode, title: selectedRedeemedCoupon.title })}
                  activeOpacity={0.85}
                >
                  {generateBarcodePattern(70, 1)}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                    <Ionicons name="scan-outline" size={14} color="#1F4C9C" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1F4C9C' }}>🔍 แตะเพื่อขยายใหญ่</Text>
                  </View>
                </TouchableOpacity>

                <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>แสดง Barcode นี้ที่จุดชำระเงินให้พนักงานสแกน</Text>
              </View>
            )}
          </View>

          {/* Points Used */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF8E6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="star" size={20} color="#F6B828" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>ใช้คะแนน: <Text style={{ color: '#E11D48' }}>-{selectedRedeemedCoupon.points}</Text> คะแนน</Text>
          </View>

          {/* Usage Instructions */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>วิธีใช้งานคูปอง</Text>
            {[
              { icon: 'copy-outline', text: 'คัดลอกโค้ด — กดคัดลอกรหัสคูปอง แล้วนำไปกรอกในช่องส่วนลดก่อนชำระเงิน' },
              { icon: 'qr-code-outline', text: 'QR Code — แสดง QR Code ให้พนักงานสแกนที่หน้าเคาน์เตอร์' },
              { icon: 'barcode-outline', text: 'Barcode — แสดง Barcode ให้สแกนที่จุดชำระเงิน' },
            ].map((item, idx) => (
              <View key={idx} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
                  <Ionicons name={item.icon} size={14} color="#3B82F6" />
                </View>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, flex: 1 }}>{item.text}</Text>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8, paddingTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#94A3B8', lineHeight: 18 }}>• คูปองนี้ใช้ได้ 1 ครั้งเท่านั้น{"\n"}• รหัสมีอายุถึง 31 ธ.ค. 2026{"\n"}• ไม่สามารถทอน/เปลี่ยนเป็นเงินสดได้</Text>
            </View>
          </View>

          <TouchableOpacity
            style={{ backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
            onPress={() => setSelectedRedeemedCoupon(null)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>ย้อนกลับ</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom: Use Coupon Button (only for active coupons) */}
        {!isUsed && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <TouchableOpacity
              style={{ backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 14, alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              onPress={() => handleMarkCouponUsed(selectedRedeemedCoupon)}
              activeOpacity={0.88}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>✅ ใช้คูปองนี้</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FULL SCREEN ENLARGED QR / BARCODE OVERLAY — inside coupon detail for instant display without Android Modal stacking issues */}
        {enlargedMedia.visible && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: '#0F172A' }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A' }}>
              <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

              {/* Modal Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                <TouchableOpacity
                  onPress={() => setEnlargedMedia({ visible: false, type: 'qr', couponCode: '', title: '' })}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                  {enlargedMedia.type === 'qr' ? '📱 QR Code สแกนส่วนลด' : '📊 Barcode สแกนชำระเงิน'}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                {/* Title & Guidance */}
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 6 }}>
                  {enlargedMedia.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 166, 35, 0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: '#F5A623' }}>
                  <Ionicons name="sunny" size={16} color="#F5A623" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, color: '#FFD700', fontWeight: '700' }}>แนะนำ: ปรับความสว่างหน้าจอให้สูงสุดเพื่อสแกนง่ายขึ้น</Text>
                </View>

                {/* Enlarge Card */}
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: 24,
                    alignItems: 'center',
                    justify: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.3,
                    shadowRadius: 20,
                    elevation: 10,
                    width: '100%',
                    maxWidth: 340,
                  }}
                >
                  {enlargedMedia.type === 'qr' ? (
                    <View style={{ alignItems: 'center' }}>
                      {/* Generate 21x21 QR pattern with pixelSize=14 for large crisp rendering */}
                      {(() => {
                        const seed = enlargedMedia.couponCode.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
                        const gridSize = 21;
                        const pixelSize = 14;
                        const rows = [];
                        for (let r = 0; r < gridSize; r++) {
                          const cols = [];
                          for (let c = 0; c < gridSize; c++) {
                            const isTopLeft = r < 7 && c < 7;
                            const isTopRight = r < 7 && c >= 14;
                            const isBottomLeft = r >= 14 && c < 7;
                            let isDark = false;
                            if (isTopLeft || isTopRight || isBottomLeft) {
                              const pr = isTopLeft ? r : isTopRight ? r : r - 14;
                              const pc = isTopLeft ? c : isTopRight ? c - 14 : c;
                              isDark = (pr === 0 || pr === 6 || pc === 0 || pc === 6) || (pr >= 2 && pr <= 4 && pc >= 2 && pc <= 4);
                            } else if (r === 6 || c === 6) {
                              isDark = (r + c) % 2 === 0;
                            } else if (r >= 8 && r <= 12 && c >= 8 && c <= 12) {
                              isDark = false;
                            } else {
                              const moduleHash = (seed * (r + 1) + c * 31 + (r * c * 13)) % 100;
                              isDark = moduleHash > 45;
                            }
                            cols.push(
                              <View key={c} style={{ width: pixelSize, height: pixelSize, backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }} />
                            );
                          }
                          rows.push(<View key={r} style={{ flexDirection: 'row' }}>{cols}</View>);
                        }
                        return (
                          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ borderWidth: 6, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', borderRadius: 4 }}>
                              {rows}
                            </View>
                            <View
                              style={{
                                position: 'absolute',
                                width: pixelSize * 5,
                                height: pixelSize * 5,
                                backgroundColor: '#FFFFFF',
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 3,
                                borderColor: '#D93A8B',
                              }}
                            >
                              <Ionicons name="gift" size={pixelSize * 2.8} color="#D93A8B" />
                            </View>
                          </View>
                        );
                      })()}
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 16, letterSpacing: 2 }}>
                        {enlargedMedia.couponCode}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', width: '100%' }}>
                      {/* Generate Code-128 Barcode pattern with scale=1.3 */}
                      {(() => {
                        const seed = enlargedMedia.couponCode.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7), 0);
                        const bars = [];
                        const totalWidth = 64;
                        const scale = 1.3;
                        for (let i = 0; i < totalWidth; i++) {
                          const isStartGuard = i === 0 || i === 2;
                          const isStartGap = i === 1;
                          const isStopGuard = i === totalWidth - 4 || i === totalWidth - 2 || i === totalWidth - 1;
                          const isStopGap = i === totalWidth - 3;
                          let width = 1.5 * scale;
                          let isBlack = false;
                          if (isStartGuard || isStopGuard) {
                            isBlack = true;
                            width = 2.2 * scale;
                          } else if (isStartGap || isStopGap) {
                            isBlack = false;
                            width = 1.5 * scale;
                          } else {
                            const val = (seed * (i + 3) + i * 19) % 17;
                            isBlack = val % 2 === 0 || val % 5 === 0;
                            width = (val % 3 === 0 ? 3.2 : val % 2 === 0 ? 2.2 : 1.2) * scale;
                          }
                          bars.push(
                            <View
                              key={i}
                              style={{
                                width: width,
                                height: 100,
                                backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
                                marginRight: scale * 0.7,
                              }}
                            />
                          );
                        }
                        return (
                          <View style={{ alignItems: 'center', width: '100%' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100 }}>
                              {bars}
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 14, letterSpacing: 3, fontFamily: 'monospace' }}>
                              {enlargedMedia.couponCode}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={{ marginTop: 24, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
                  onPress={() => setEnlargedMedia({ visible: false, type: 'qr', couponCode: '', title: '' })}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>ปิดหน้าต่าง</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        )}
      </>
    );
  };

  const reloadMissions = () => {
    setLiveMissions(
      missionStorage.getMissions().filter((m) => m.status !== 'expired').slice(0, 4)
    );
    setLiveTransactions(pointsStorage.getTransactions());
    setLiveUserPoints(pointsStorage.getUserPoints());
  };

  // Dynamic leaderboard for main screen
  const leaderboard = useMemo(() => {
    const updated = baseLeaderboard.map((person) => ({
      ...person,
      points: person.isMe ? liveUserPoints : person.basePoints,
    }));
    updated.sort((a, b) => b.points - a.points);
    return updated.map((person, index) => ({
      ...person,
      rank: index + 1,
    }));
  }, [liveUserPoints]);

  // Dynamic Full-Screen Leaderboard Data computed DIRECTLY from real liveUserPoints (4,500+ pt)
  const dynamicLeaderboardData = useMemo(() => {
    const colleagues = [
      { name: 'พี่นิ้ง', weekPoints: 5200, monthPoints: 5100, yearPoints: 5000, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
      { name: 'พี่ฟิล์ม', weekPoints: 4800, monthPoints: 4750, yearPoints: 4700, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
      { name: 'กุยช่าย', isMe: true, weekPoints: liveUserPoints, monthPoints: liveUserPoints, yearPoints: liveUserPoints, avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
      { name: 'Wanatsanun L.', weekPoints: 2400, monthPoints: 2400, yearPoints: 2400, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
      { name: 'ฐิตีรัตน์ ภ.', weekPoints: 1850, monthPoints: 1850, yearPoints: 1850, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
      { name: 'Wilas C.', weekPoints: 1200, monthPoints: 1200, yearPoints: 1200, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
      { name: 'Pureepon S.', weekPoints: 950, monthPoints: 950, yearPoints: 950, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
      { name: 'Yodsaphorn T.', weekPoints: 600, monthPoints: 600, yearPoints: 600, avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150' },
      { name: 'ธนพล ใ.', weekPoints: 300, monthPoints: 300, yearPoints: 300, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' },
      { name: 'Pragasit T.', weekPoints: 100, monthPoints: 100, yearPoints: 100, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' },
    ];

    const calculateRankings = (periodKey) => {
      const listWithPeriodPoints = colleagues.map((c) => ({
        name: c.name,
        avatar: c.avatar,
        isMe: c.isMe || false,
        points: c.isMe ? liveUserPoints : c[periodKey],
      }));

      // Real dynamic sorting by points
      listWithPeriodPoints.sort((a, b) => b.points - a.points);

      // Real dynamic rank assignment
      const ranked = listWithPeriodPoints.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

      const top1 = ranked[0] || {};
      const top2 = ranked[1] || {};
      const top3 = ranked[2] || {};
      const myRank = ranked.find((item) => item.isMe) || ranked[0];
      const list = ranked.filter((item) => item.rank >= 4);

      return { top1, top2, top3, myRank, list, all: ranked };
    };

    return {
      week: calculateRankings('weekPoints'),
      month: calculateRankings('monthPoints'),
      year: calculateRankings('yearPoints'),
    };
  }, [liveUserPoints]);

  const handlePerformRedeem = (targetReward) => {
    const rewardToRedeem = targetReward || selectedReward;
    if (!rewardToRedeem) return;

    if (liveUserPoints < rewardToRedeem.points) {
      setInsufficientPopup({
        visible: true,
        required: rewardToRedeem.points,
        current: liveUserPoints,
        rewardTitle: rewardToRedeem.title,
      });
      return;
    }

    // Open Custom Confirmation Popup Modal (styled like success popup)
    setConfirmRedeemPopup({
      visible: true,
      reward: rewardToRedeem,
    });
  };

  const executeRedeemReward = (rewardToRedeem) => {
    if (!rewardToRedeem) return;

    // Process point deduction
    const { userPoints: newPoints, transactions: newTxs } = pointsStorage.addTransaction(
      rewardToRedeem.title,
      rewardToRedeem.points,
      'out',
      'แลกของรางวัล'
    );
    setLiveUserPoints(newPoints);
    setLiveTransactions(newTxs);

    // Generate Coupon Voucher Code
    const prefix = rewardToRedeem.id.includes('shopee')
      ? 'SHP'
      : rewardToRedeem.id.includes('starbucks')
        ? 'STB'
        : rewardToRedeem.id.includes('lazada')
          ? 'LAZ'
          : 'VOU';
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newRedeemedItem = {
      id: `r_${Date.now()}`,
      title: rewardToRedeem.title,
      subtitle: `รหัสคูปอง: ${code}`,
      points: rewardToRedeem.points,
      date: 'วันนี้ • เพิ่งกดแลก',
      status: 'พร้อมใช้งาน',
      color: rewardToRedeem.color || '#D93A8B',
      icon: rewardToRedeem.icon || 'gift',
    };

    setRedeemedHistoryList((prev) => [newRedeemedItem, ...prev]);

    // Close confirm popup, detail view & catalog modal -> open success modal
    setConfirmRedeemPopup({ visible: false, reward: null });
    setSelectedReward(null);
    setShowRedeemCatalogModal(false);
    setRedeemSuccessPopup({
      visible: true,
      reward: rewardToRedeem,
      voucherCode: code,
    });
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const unsubscribeMissions = missionStorage.subscribe((list) => {
      setLiveMissions((list || []).filter((m) => m.status !== 'expired').slice(0, 4));
    });

    return () => unsubscribeMissions();
  }, []);

  useEffect(() => {
    let unsubscribe = () => { };
    if (pointsStorage && typeof pointsStorage.subscribe === 'function') {
      unsubscribe = pointsStorage.subscribe(({ userPoints, transactions }) => {
        setLiveUserPoints(userPoints);
        setLiveTransactions(transactions);
      });
    }
    return () => unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLiveTransactions(pointsStorage.getTransactions());
      setLiveUserPoints(pointsStorage.getUserPoints());
      missionStorage.fetchMissions();
    }, [])
  );

  useEffect(() => {
    if (route?.params?.showPointHistory) {
      setShowPointHistoryModal(true);
    }
  }, [route?.params?.showPointHistory, route?.params?.timestamp]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLiveTransactions(pointsStorage.getTransactions());
      setLiveUserPoints(pointsStorage.getUserPoints());
      setRefreshing(false);
    }, 1200);
  }, []);

  const filteredPointTransactions = liveTransactions.filter((item) => {
    if (pointFilter === 'in') return item.type === 'in';
    if (pointFilter === 'out') return item.type === 'out';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />
      <TopNavbar
        navigation={navigation}
        onPointsPress={() => setShowPointHistoryModal(true)}
      />
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF8C00', '#1A2B6D']}
            tintColor="#FFFFFF"
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Top Header Buttons Container */}
        <View style={styles.twoIconsContainer} className="flex-row justify-around p-4 bg-white border-b border-slate-100">
          {/* Icon 1: ประวัติสะสมแต้ม */}
          <TouchableOpacity
            testID="rewards-point-history-btn"
            style={styles.mainIconButton}
            className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl items-center mr-2 shadow-sm"
            activeOpacity={0.8}
            onPress={() => setShowPointHistoryModal(true)}
          >
            <View style={[styles.mainIconBg, { backgroundColor: '#FFF8E1' }]} className="w-12 h-12 rounded-2xl bg-amber-50 items-center justify-center mb-2">
              <Ionicons name="time-sharp" size={24} color="#D97706" />
            </View>
            <Text style={styles.mainIconLabel} className="text-sm font-bold text-slate-800">ประวัติสะสมแต้ม</Text>
            <Text style={styles.mainIconSubtext} className="text-[11px] text-slate-400">ดูคะแนนเข้า - ออก</Text>
          </TouchableOpacity>

          {/* Icon 2: ประวัติแลกรางวัล */}
          <TouchableOpacity
            testID="rewards-redeem-history-btn"
            style={styles.mainIconButton}
            className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl items-center ml-2 shadow-sm"
            activeOpacity={0.8}
            onPress={() => setShowRedeemHistoryModal(true)}
          >
            <View style={[styles.mainIconBg, { backgroundColor: '#E8F5E9' }]} className="w-12 h-12 rounded-2xl bg-emerald-50 items-center justify-center mb-2">
              <Ionicons name="gift-sharp" size={24} color="#27AE60" />
            </View>
            <Text style={styles.mainIconLabel} className="text-sm font-bold text-slate-800">ประวัติแลกรางวัล</Text>
            <Text style={styles.mainIconSubtext} className="text-[11px] text-slate-400">รางวัลที่แลกแล้ว</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content Body (No Inline Transactions) */}
        <Animated.View style={[styles.body, { opacity: fadeAnim }]} className="p-4">
          {/* Missions */}
          <View testID="rewards-missions-section" style={styles.sectionHeader} className="flex-row items-center justify-between mb-3 px-1">
            <Text style={styles.sectionTitle} className="text-base font-bold text-slate-800">🎯 ภารกิจสะสมแต้ม (Missions)</Text>
            <TouchableOpacity testID="rewards-missions-see-all-btn" onPress={() => navigation && navigation.navigate('Missions')}>
              <Text style={styles.seeAll} className="text-xs font-semibold text-primary">ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {liveMissions.map((mission) => {
            const isCompleted = mission.status === 'completed';
            const isReady = mission.status === 'ready_to_claim';
            return (
              <TouchableOpacity
                key={mission.id}
                style={[styles.missionCard, isCompleted && { opacity: 0.6 }]}
                onPress={() => {
                  if (isCompleted) return;
                  if (isReady) {
                    handleClaimMission(mission);
                  } else {
                    navigation && navigation.navigate('Missions', { targetMissionId: mission.id, openTimestamp: Date.now() });
                  }
                }}
                activeOpacity={isCompleted ? 1 : 0.85}
              >
                <View style={styles.missionLeft}>
                  <View style={[styles.missionIconBg, { backgroundColor: mission.bgColor || colors.primaryLight }]}>
                    <Ionicons name={mission.icon} size={20} color={mission.iconColor || colors.primary} />
                  </View>
                  <View style={styles.missionInfo}>
                    <Text style={styles.missionTitle}>{mission.title}</Text>
                    <View style={styles.missionProgressRow}>
                      <View style={styles.missionProgressBg}>
                        <View
                          style={[
                            styles.missionProgressFill,
                            {
                              width: `${(mission.progress / mission.total) * 100}%`,
                              backgroundColor: isCompleted ? '#10B981' : isReady ? '#F5A623' : colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.missionProgressText}>
                        {mission.progress}/{mission.total}
                      </Text>
                    </View>
                  </View>
                </View>
                {isCompleted ? (
                  <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#10B98130' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>เสร็จสิ้น</Text>
                  </View>
                ) : isReady ? (
                  <TouchableOpacity
                    onPress={() => handleClaimMission(mission)}
                    style={{ backgroundColor: '#F5A623', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>🎁 รับรางวัล</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.missionPoints}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.missionPointsText}>+{mission.points}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Redeem Rewards Carousel */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎁 แลกของรางวัล (สิทธิพิเศษ)</Text>
            <TouchableOpacity testID="rewards-see-all-catalog-btn" onPress={() => setShowRedeemCatalogModal(true)}>
              <Text style={styles.seeAll}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewardsRow}
          >
            {rewardsCatalog.map((reward) => (
              <TouchableOpacity
                testID={`rewards-item-card-${reward.id}`}
                key={reward.id}
                style={styles.rewardCard}
                onPress={() => setSelectedReward(reward)}
                activeOpacity={0.85}
              >
                <View style={[styles.rewardIconBg, { backgroundColor: reward.color + '15' }]}>
                  <Ionicons name={reward.icon} size={28} color={reward.color} />
                </View>
                <Text style={styles.rewardTitle} numberOfLines={1}>{reward.title}</Text>
                <Text style={styles.rewardSubtitle} numberOfLines={1}>{reward.subtitle}</Text>
                <View style={styles.rewardPointsBadge}>
                  <Ionicons name="star" size={10} color="#FFD700" />
                  <Text style={styles.rewardPointsText}>{reward.points} คะแนน</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Leaderboard Header */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 12 }}
            onPress={() => setShowLeaderboardModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.sectionTitle}>🏆 Leaderboard รวม</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#1F4C9C', marginRight: 2 }}>ดูอันดับทั้งหมด</Text>
              <Ionicons name="chevron-forward" size={14} color="#1F4C9C" />
            </View>
          </TouchableOpacity>

          {leaderboard.map((person) => (
            <TouchableOpacity
              key={person.rank}
              style={[styles.leaderCard, person.isMe && styles.leaderCardMe]}
              onPress={() => setShowLeaderboardModal(true)}
              activeOpacity={0.85}
            >
              <View style={styles.leaderLeft}>
                <Text
                  style={[
                    styles.leaderRank,
                    person.rank === 1 && { color: '#FFD700' },
                    person.rank === 2 && { color: '#C0C0C0' },
                    person.rank === 3 && { color: '#CD7F32' },
                  ]}
                >
                  #{person.rank}
                </Text>
                <View>
                  <Text style={[styles.leaderName, person.isMe && { color: colors.primary }]}>
                    {person.name} {person.isMe && '(คุณ)'}
                  </Text>
                  <Text style={styles.leaderDept}>{person.dept}</Text>
                </View>
              </View>
              <View style={styles.leaderPoints}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.leaderPointsText}>{Number(person.points || 0).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* FULL SCREEN MODAL 1: ประวัติสะสมแต้ม (หน้าจอเต็ม) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={showPointHistoryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPointHistoryModal(false)}
      >
        <SafeAreaView style={styles.fullScreenContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Navigation Bar */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowPointHistoryModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.title} />
            </TouchableOpacity>
            <Text style={styles.fullScreenHeaderTitle}>ประวัติสะสมแต้ม</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Filter Tabs: ทั้งหมด | คะแนนเข้า | คะแนนออก */}
          <View style={styles.fullScreenFilterBar}>
            <TouchableOpacity
              style={[
                styles.modalFilterChip,
                pointFilter === 'all' && styles.modalFilterChipActive,
              ]}
              onPress={() => setPointFilter('all')}
            >
              <Text
                style={[
                  styles.modalFilterText,
                  pointFilter === 'all' && styles.modalFilterTextActive,
                ]}
              >
                ทั้งหมด
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalFilterChip,
                pointFilter === 'in' && styles.modalFilterChipActiveIn,
              ]}
              onPress={() => setPointFilter('in')}
            >
              <Ionicons
                name="arrow-down-circle"
                size={14}
                color={pointFilter === 'in' ? '#FFFFFF' : '#27AE60'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.modalFilterText,
                  pointFilter === 'in' && styles.modalFilterTextActive,
                ]}
              >
                คะแนนเข้า
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalFilterChip,
                pointFilter === 'out' && styles.modalFilterChipActiveOut,
              ]}
              onPress={() => setPointFilter('out')}
            >
              <Ionicons
                name="arrow-up-circle"
                size={14}
                color={pointFilter === 'out' ? '#FFFFFF' : '#E24C4B'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.modalFilterText,
                  pointFilter === 'out' && styles.modalFilterTextActive,
                ]}
              >
                คะแนนออก
              </Text>
            </TouchableOpacity>
          </View>

          {/* Point Transactions Full Screen List */}
          <ScrollView
            style={styles.fullScreenBody}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredPointTransactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>ไม่มีรายการในหมวดหมู่นี้</Text>
              </View>
            ) : (
              filteredPointTransactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View
                    style={[
                      styles.txIconBg,
                      { backgroundColor: tx.type === 'in' ? '#E8F5E9' : '#FFEBEE' },
                    ]}
                  >
                    <Ionicons
                      name={tx.type === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={24}
                      color={tx.type === 'in' ? '#27AE60' : '#E24C4B'}
                    />
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle}>{tx.title}</Text>
                    <View style={styles.txMetaRow}>
                      <Text style={styles.txCategory}>{tx.category}</Text>
                      <Text style={styles.txDot}>•</Text>
                      <Text style={styles.txDate}>{tx.date}</Text>
                    </View>
                  </View>

                  <View style={styles.txPointsRight}>
                    <Ionicons
                      name={tx.type === 'in' ? 'add' : 'remove'}
                      size={12}
                      color={tx.type === 'in' ? '#27AE60' : '#E24C4B'}
                    />
                    <Ionicons name="star" size={12} color="#FFD700" style={{ marginRight: 2 }} />
                    <Text
                      style={[
                        styles.txPointsText,
                        { color: tx.type === 'in' ? '#27AE60' : '#E24C4B' },
                      ]}
                    >
                      {tx.points}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* FULL SCREEN MODAL 2: ประวัติแลกรางวัล (หน้าจอเต็ม) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={showRedeemHistoryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowRedeemHistoryModal(false)}
      >
        <SafeAreaView style={styles.fullScreenContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Navigation Bar */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowRedeemHistoryModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.title} />
            </TouchableOpacity>
            <Text style={styles.fullScreenHeaderTitle}>ประวัติแลกรางวัล</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Redeemed Rewards Full Screen List */}
          <ScrollView
            style={styles.fullScreenBody}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalSubHeader}>🎁 รายการของรางวัลที่คุณเคยแลกรับ</Text>

            {redeemedHistoryList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="gift-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>คุณยังไม่มีประวัติการแลกของรางวัล</Text>
              </View>
            ) : (
              redeemedHistoryList.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.redeemedCard}
                  onPress={() => setSelectedRedeemedCoupon(item)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.redeemedIconBg, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={26} color={item.color} />
                  </View>

                  <View style={styles.redeemedInfo}>
                    <Text style={styles.redeemedTitle}>{item.title}</Text>
                    <Text style={styles.redeemedSubtitle}>{item.subtitle}</Text>
                    <Text style={styles.redeemedDate}>{item.date}</Text>
                  </View>

                  <View style={styles.redeemedRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'พร้อมใช้งาน'
                          ? styles.statusBadgeReady
                          : styles.statusBadgeUsed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.status === 'พร้อมใช้งาน'
                            ? styles.statusTextReady
                            : styles.statusTextUsed,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                    <View style={styles.redeemedPointsRow}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.redeemedPointsText}>-{item.points} pt</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* COUPON DETAIL OVERLAY — rendered INSIDE history modal for correct stacking on Android */}
          {selectedRedeemedCoupon && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 100 }}>
              <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                {renderCouponDetailContent()}
              </SafeAreaView>
            </View>
          )}

        </SafeAreaView>
      </Modal>



      {/* ---------------------------------------------------- */}
      {/* SCREEN 18: REDEEM REWARDS FULL SCREEN MODAL (แลกสิทธิพิเศษ) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={showRedeemCatalogModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowRedeemCatalogModal(false)}
      >
        <SafeAreaView style={styles.fullScreenContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

          {/* Navigation Bar */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowRedeemCatalogModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.title} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#D93A8B' }}>แลกสิทธิพิเศษ</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Filter Tabs: ทั้งหมด | ยอดนิยม | ไลฟ์สไตล์ | อาหาร */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'popular', label: 'ยอดนิยม' },
              { id: 'lifestyle', label: 'ไลฟ์สไตล์' },
              { id: 'food', label: 'อาหาร' },
            ].map((tab) => {
              const active = catalogFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                    backgroundColor: active ? '#1F4C9C' : '#F1F5F9',
                  }}
                  onPress={() => setCatalogFilter(tab.id)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 12, fontWeight: active ? '700' : '600', color: active ? '#FFFFFF' : '#64748B' }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Catalog List matching Screen 18 Reference Image */}
          <ScrollView style={styles.fullScreenBody} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {rewardsCatalog
              .filter((item) => catalogFilter === 'all' || item.category === catalogFilter)
              .map((reward) => (
                <TouchableOpacity
                  key={reward.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={() => setSelectedReward(reward)}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: reward.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Ionicons name={reward.icon} size={24} color={reward.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 }}>{reward.title}</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>{reward.subtitle}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="star" size={14} color="#F5A623" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#D97706' }}>{reward.points} คะแนน</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </ScrollView>

          {/* REWARD DETAIL OVERLAY — rendered INSIDE catalog modal for correct stacking on Android */}
          {selectedReward && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 100 }}>
              <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

                {/* Header Navbar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 54, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <TouchableOpacity onPress={() => setSelectedReward(null)} style={{ padding: 4 }}>
                    <Ionicons name="chevron-back" size={26} color="#1E293B" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>รายละเอียดสิทธิพิเศษ</Text>
                  <View style={{ width: 28 }} />
                </View>

                <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                  {/* Top Gradient Banner */}
                  <LinearGradient
                    colors={selectedReward.bannerGradient || ['#D93A8B', '#E11D48']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 24, margin: 16, borderRadius: 20, minHeight: 140, justifyContent: 'flex-end', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}
                  >
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 }}>
                      {selectedReward.title}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      {selectedReward.brandName || selectedReward.subtitle}
                    </Text>
                  </LinearGradient>

                  {/* Points Badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF8E6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Ionicons name="star" size={20} color="#F6B828" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F4C9C' }}>
                      {selectedReward.points} <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>คะแนน</Text>
                    </Text>
                  </View>

                  {/* Details */}
                  <View style={{ backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>รายละเอียด</Text>
                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                      {selectedReward.desc}
                    </Text>
                  </View>

                  {/* Terms */}
                  <View style={{ backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>เงื่อนไขการใช้งาน</Text>
                    {selectedReward.terms.map((term, index) => (
                      <View key={index} style={{ flexDirection: 'row', marginBottom: 6 }}>
                        <Text style={{ fontSize: 13, color: '#64748B', marginRight: 6 }}>•</Text>
                        <Text style={{ fontSize: 13, color: '#475569', flex: 1, lineHeight: 18 }}>{term}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Bottom Redeem Button */}
                {(() => {
                  const hasEnoughPoints = liveUserPoints >= selectedReward.points;
                  return (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                      <TouchableOpacity
                        testID="reward-detail-submit-btn-catalog"
                        style={{
                          backgroundColor: hasEnoughPoints ? '#D93A8B' : '#94A3B8',
                          borderRadius: 16,
                          paddingVertical: 14,
                          alignItems: 'center',
                          shadowColor: hasEnoughPoints ? '#D93A8B' : '#94A3B8',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 4,
                        }}
                        onPress={() => handlePerformRedeem(selectedReward)}
                        activeOpacity={0.88}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                          {hasEnoughPoints
                            ? 'แลกสิทธิพิเศษ'
                            : `คะแนนไม่เพียงพอ (ขาด ${(selectedReward.points - liveUserPoints).toLocaleString()} คะแนน)`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Instant Confirmation Popup Overlay inside detail screen */}
                {confirmRedeemPopup.visible && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 24,
                        padding: 24,
                        width: '100%',
                        maxWidth: 340,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.25,
                        shadowRadius: 20,
                        elevation: 10,
                      }}
                    >
                      {/* Header Gift Icon */}
                      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Ionicons name="gift" size={42} color="#1F4C9C" />
                      </View>

                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 }}>
                        ยืนยันการแลกสิทธิพิเศษ
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
                        คุณแน่ใจหรือไม่ว่าต้องการใช้คะแนนเพื่อแลกรับรางวัลนี้?
                      </Text>

                      {/* Reward Summary Card */}
                      {confirmRedeemPopup.reward && (
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, alignItems: 'center' }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4, textAlign: 'center' }}>
                            {confirmRedeemPopup.reward.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="star" size={16} color="#F6B828" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 15, color: '#E11D48', fontWeight: '800' }}>
                              ใช้คะแนน -{confirmRedeemPopup.reward.points.toLocaleString()} คะแนน
                            </Text>
                          </View>
                          <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                            คะแนนคงเหลือของคุณ: {liveUserPoints.toLocaleString()} คะแนน
                          </Text>
                        </View>
                      )}

                      {/* Action Buttons */}
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#1F4C9C',
                          borderRadius: 14,
                          paddingVertical: 14,
                          width: '100%',
                          alignItems: 'center',
                          marginBottom: 10,
                          shadowColor: '#1F4C9C',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 3,
                        }}
                        onPress={() => executeRedeemReward(confirmRedeemPopup.reward)}
                        activeOpacity={0.85}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>✅ ยืนยันแลกรับ</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#F1F5F9',
                          borderRadius: 14,
                          paddingVertical: 12,
                          width: '100%',
                          alignItems: 'center',
                        }}
                        onPress={() => setConfirmRedeemPopup({ visible: false, reward: null })}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>ยกเลิก</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </SafeAreaView>
            </View>
          )}

        </SafeAreaView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* SCREEN 19: REWARD DETAIL — INDEPENDENT MODAL (accessible from both carousel & catalog) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={!!selectedReward && !showRedeemCatalogModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedReward(null)}
      >
        {selectedReward && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header Navbar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 54, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <TouchableOpacity onPress={() => setSelectedReward(null)} style={{ padding: 4 }}>
                <Ionicons name="chevron-back" size={26} color="#1E293B" />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1E293B' }}>รายละเอียดสิทธิพิเศษ</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {/* Top Gradient Banner */}
              <LinearGradient
                colors={selectedReward.bannerGradient || ['#D93A8B', '#E11D48']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 24, margin: 16, borderRadius: 20, minHeight: 140, justifyContent: 'flex-end', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}
              >
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 }}>
                  {selectedReward.title}
                </Text>
                <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                  {selectedReward.brandName || selectedReward.subtitle}
                </Text>
              </LinearGradient>

              {/* Points Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF8E6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="star" size={20} color="#F6B828" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F4C9C' }}>
                  {selectedReward.points} <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>คะแนน</Text>
                </Text>
              </View>

              {/* Details */}
              <View style={{ backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>รายละเอียด</Text>
                <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                  {selectedReward.desc}
                </Text>
              </View>

              {/* Terms */}
              <View style={{ backgroundColor: '#FFFFFF', marginHorizontal: 16, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>เงื่อนไขการใช้งาน</Text>
                {selectedReward.terms.map((term, index) => (
                  <View key={index} style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#64748B', marginRight: 6 }}>•</Text>
                    <Text style={{ fontSize: 13, color: '#475569', flex: 1, lineHeight: 18 }}>{term}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Bottom Redeem Button */}
            {(() => {
              const hasEnoughPoints = liveUserPoints >= selectedReward.points;
              return (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <TouchableOpacity
                    testID="reward-detail-submit-btn"
                    style={{
                      backgroundColor: hasEnoughPoints ? '#D93A8B' : '#94A3B8',
                      borderRadius: 16,
                      paddingVertical: 14,
                      alignItems: 'center',
                      shadowColor: hasEnoughPoints ? '#D93A8B' : '#94A3B8',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                    onPress={() => handlePerformRedeem(selectedReward)}
                    activeOpacity={0.88}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                      {hasEnoughPoints
                        ? 'แลกสิทธิพิเศษ'
                        : `คะแนนไม่เพียงพอ (ขาด ${(selectedReward.points - liveUserPoints).toLocaleString()} คะแนน)`}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Instant Confirmation Popup Overlay inside detail screen */}
            {confirmRedeemPopup.visible && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: 24,
                    width: '100%',
                    maxWidth: 340,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25,
                    shadowRadius: 20,
                    elevation: 10,
                  }}
                >
                  {/* Header Gift Icon */}
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="gift" size={42} color="#1F4C9C" />
                  </View>

                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 }}>
                    ยืนยันการแลกสิทธิพิเศษ
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
                    คุณแน่ใจหรือไม่ว่าต้องการใช้คะแนนเพื่อแลกรับรางวัลนี้?
                  </Text>

                  {/* Reward Summary Card */}
                  {confirmRedeemPopup.reward && (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4, textAlign: 'center' }}>
                        {confirmRedeemPopup.reward.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="star" size={16} color="#F6B828" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 15, color: '#E11D48', fontWeight: '800' }}>
                          ใช้คะแนน -{confirmRedeemPopup.reward.points.toLocaleString()} คะแนน
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                        คะแนนคงเหลือของคุณ: {liveUserPoints.toLocaleString()} คะแนน
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#1F4C9C',
                      borderRadius: 14,
                      paddingVertical: 14,
                      width: '100%',
                      alignItems: 'center',
                      marginBottom: 10,
                      shadowColor: '#1F4C9C',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                    onPress={() => executeRedeemReward(confirmRedeemPopup.reward)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>✅ ยืนยันแลกรับ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#F1F5F9',
                      borderRadius: 14,
                      paddingVertical: 12,
                      width: '100%',
                      alignItems: 'center',
                    }}
                    onPress={() => setConfirmRedeemPopup({ visible: false, reward: null })}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* REDEEMED COUPON DETAIL FULL SCREEN MODAL */}
      {/* Rendered AFTER Redeem History Modal for correct stacking */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={!!selectedRedeemedCoupon && !showRedeemHistoryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedRedeemedCoupon(null)}
      >
        {selectedRedeemedCoupon && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            {renderCouponDetailContent()}
          </SafeAreaView>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* FULL SCREEN MODAL: ลีดเดอร์บอร์ด (Matching Screenshots Exactly) */}
      {/* ---------------------------------------------------- */}
      <Modal
        visible={showLeaderboardModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLeaderboardModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#1E2356' }}>
          <StatusBar barStyle="light-content" backgroundColor="#1E2356" />

          {/* Header Bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 }}>
            <TouchableOpacity onPress={() => setShowLeaderboardModal(false)} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>ลีดเดอร์บอร์ด</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main Scroll Content */}
          <ScrollView style={{ flex: 1, backgroundColor: '#1E2356' }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            
            {/* Top Period Segment Switcher: สัปดาห์ | เดือน | ปี */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 4, marginHorizontal: 20, marginTop: 10, marginBottom: 16, flexDirection: 'row' }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: leaderboardTab === 'week' ? '#E82B74' : 'transparent', alignItems: 'center' }}
                onPress={() => setLeaderboardTab('week')}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: leaderboardTab === 'week' ? '#FFFFFF' : '#E82B74' }}>สัปดาห์</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: leaderboardTab === 'month' ? '#E82B74' : 'transparent', alignItems: 'center' }}
                onPress={() => setLeaderboardTab('month')}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: leaderboardTab === 'month' ? '#FFFFFF' : '#E82B74' }}>เดือน</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: leaderboardTab === 'year' ? '#E82B74' : 'transparent', alignItems: 'center' }}
                onPress={() => setLeaderboardTab('year')}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: leaderboardTab === 'year' ? '#FFFFFF' : '#E82B74' }}>ปี</Text>
              </TouchableOpacity>
            </View>

            {/* Podium Backdrop & List Data */}
            {(() => {
              const WPCoinIcon = ({ size = 20 }) => (
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#F59E0B',
                    borderWidth: 1.5,
                    borderColor: '#FCD34D',
                    alignItems: 'center',
                    justify: 'center',
                    marginLeft: 5,
                    shadowColor: '#D97706',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontSize: size * 0.42, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>WP</Text>
                </View>
              );

              const currentData = dynamicLeaderboardData[leaderboardTab];
              const { top1, top2, top3, myRank, list } = currentData;

              return (
                <View style={{ paddingHorizontal: 16 }}>
                  {/* Podium Container with Dark Blue Curved Card */}
                  <View style={{ backgroundColor: '#252B62', borderRadius: 32, paddingVertical: 24, paddingHorizontal: 10, alignItems: 'center', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', paddingHorizontal: 10 }}>
                      
                      {/* RANK 2 (LEFT) */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ position: 'relative', marginBottom: 8 }}>
                          <Image
                            source={{ uri: top2.avatar }}
                            style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: '#CBD5E1' }}
                          />
                          <View style={{ position: 'absolute', bottom: -6, alignSelf: 'center', width: 22, height: 22, borderRadius: 11, backgroundColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#252B62' }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>2</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 2 }} numberOfLines={1}>
                          {top2.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>{top2.points}</Text>
                          <WPCoinIcon size={18} />
                        </View>
                      </View>

                      {/* RANK 1 (CENTER - WINNER) */}
                      <View style={{ flex: 1.1, alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ fontSize: 24, marginBottom: 2 }}>👑</Text>
                        <View style={{ position: 'relative', marginBottom: 8 }}>
                          <Image
                            source={{ uri: top1.avatar }}
                            style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3.5, borderColor: '#FFC107' }}
                          />
                          <View style={{ position: 'absolute', bottom: -6, alignSelf: 'center', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFC107', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#252B62' }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: '#0F172A' }}>1</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 2 }} numberOfLines={1}>
                          {top1.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{top1.points}</Text>
                          <WPCoinIcon size={20} />
                        </View>
                      </View>

                      {/* RANK 3 (RIGHT) */}
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ position: 'relative', marginBottom: 8 }}>
                          <Image
                            source={{ uri: top3.avatar }}
                            style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: '#F97316' }}
                          />
                          <View style={{ position: 'absolute', bottom: -6, alignSelf: 'center', width: 22, height: 22, borderRadius: 11, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#252B62' }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>3</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 2 }} numberOfLines={1}>
                          {top3.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>{top3.points}</Text>
                          <WPCoinIcon size={18} />
                        </View>
                      </View>

                    </View>
                  </View>

                  {/* USER'S PERSONAL HIGHLIGHTED RANK CARD (WHITE CARD) */}
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#2563EB', width: 28 }}>{myRank.rank}</Text>
                      <Image source={{ uri: myRank.avatar }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }}>{myRank.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#475569' }}>{myRank.points}</Text>
                      <WPCoinIcon size={22} />
                    </View>
                  </View>

                  {/* Sub-Tab Toggle Switcher: กิจกรรม | โอนพอยต์ให้เพื่อน */}
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 3, marginBottom: 14, flexDirection: 'row' }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: leaderboardSubTab === 'activity' ? '#3B4279' : 'transparent', alignItems: 'center' }}
                      onPress={() => setLeaderboardSubTab('activity')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: leaderboardSubTab === 'activity' ? '#FFFFFF' : '#3B4279' }}>กิจกรรม</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: leaderboardSubTab === 'transfer' ? '#3B4279' : 'transparent', alignItems: 'center' }}
                      onPress={() => setLeaderboardSubTab('transfer')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: leaderboardSubTab === 'transfer' ? '#FFFFFF' : '#3B4279' }}>โอนพอยต์ให้เพื่อน</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Leaderboard List Items (Rank 4, 5, 6, 7...) */}
                  {list.map((item, idx) => (
                    <View
                      key={`${item.name}_${idx}`}
                      style={{
                        backgroundColor: '#283060',
                        borderRadius: 18,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justify: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Rank Badge Circle */}
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E82B74', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>{item.rank}</Text>
                        </View>
                        {/* Avatar */}
                        <Image source={{ uri: item.avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                        {/* Name */}
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{item.name}</Text>
                      </View>

                      {/* Points */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{item.points}</Text>
                        <WPCoinIcon size={20} />
                      </View>
                    </View>
                  ))}

                </View>
              );
            })()}

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* ABSOLUTE OVERLAY POPUPS (Non-nested Views to prevent RN Modal touch freeze) */}
      {/* ---------------------------------------------------- */}

      {/* 1. TOP-LEVEL CONFIRM REDEEM OVERLAY */}
      {confirmRedeemPopup.visible && !selectedReward && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="gift" size={42} color="#1F4C9C" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 }}>
              ยืนยันการแลกสิทธิพิเศษ
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
              คุณแน่ใจหรือไม่ว่าต้องการใช้คะแนนเพื่อแลกรับรางวัลนี้?
            </Text>

            {confirmRedeemPopup.reward && (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4, textAlign: 'center' }}>
                  {confirmRedeemPopup.reward.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="star" size={16} color="#F6B828" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 15, color: '#E11D48', fontWeight: '800' }}>
                    ใช้คะแนน -{confirmRedeemPopup.reward.points.toLocaleString()} คะแนน
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                  คะแนนคงเหลือของคุณ: {liveUserPoints.toLocaleString()} คะแนน
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: '#1F4C9C',
                borderRadius: 14,
                paddingVertical: 14,
                width: '100%',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: '#1F4C9C',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 3,
              }}
              onPress={() => executeRedeemReward(confirmRedeemPopup.reward)}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>✅ ยืนยันแลกรับ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#F1F5F9',
                borderRadius: 14,
                paddingVertical: 12,
                width: '100%',
                alignItems: 'center',
              }}
              onPress={() => setConfirmRedeemPopup({ visible: false, reward: null })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. TOP-LEVEL REDEEM SUCCESS OVERLAY */}
      {redeemSuccessPopup.visible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={54} color="#10B981" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 }}>
              🎉 แลกของรางวัลสำเร็จ!
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
              คุณได้ทำการแลกรับสิทธิพิเศษเรียบร้อยแล้ว
            </Text>

            {redeemSuccessPopup.reward && (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4, textAlign: 'center' }}>
                  {redeemSuccessPopup.reward.title}
                </Text>
                <Text style={{ fontSize: 12, color: '#E11D48', fontWeight: '700', marginBottom: 12 }}>
                  ใช้คะแนนไป -{redeemSuccessPopup.reward.points} คะแนน
                </Text>

                <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 }}>รหัสคูปองของคุณ</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#64748B', letterSpacing: 3, fontFamily: 'monospace' }}>
                    ••••-••••••
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'center' }}>
                    🔒 รหัสคูปองถูกซ่อนไว้ สามารถดูรหัสเต็มและสแกนได้ที่ประวัติแลกรางวัล
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={{
                backgroundColor: '#10B981',
                borderRadius: 14,
                paddingVertical: 14,
                width: '100%',
                alignItems: 'center',
                marginBottom: 8,
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 3,
              }}
              onPress={() => {
                const redeemedObj = {
                  id: `r_${Date.now()}`,
                  title: redeemSuccessPopup.reward?.title || 'ของรางวัล',
                  subtitle: `รหัสคูปอง: ${redeemSuccessPopup.voucherCode}`,
                  points: redeemSuccessPopup.reward?.points || 0,
                  date: 'วันนี้ • เพิ่งกดแลก',
                  status: 'พร้อมใช้งาน',
                  color: redeemSuccessPopup.reward?.color || '#D93A8B',
                  icon: redeemSuccessPopup.reward?.icon || 'gift',
                };
                setRedeemSuccessPopup({ visible: false, reward: null, voucherCode: '' });
                setShowRedeemHistoryModal(true);
                setSelectedRedeemedCoupon(redeemedObj);
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>🎁 ไปที่ประวัติแลกรางวัลเพื่อดูคูปอง</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ paddingVertical: 10, width: '100%', alignItems: 'center' }}
              onPress={() => setRedeemSuccessPopup({ visible: false, reward: null, voucherCode: '' })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3. TOP-LEVEL INSUFFICIENT POINTS OVERLAY */}
      {insufficientPopup.visible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="alert-circle" size={44} color="#EF4444" />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 6 }}>
              คะแนนสะสมไม่เพียงพอ
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
              คุณต้องใช้ {insufficientPopup.required.toLocaleString()} คะแนนเพื่อแลก "{insufficientPopup.rewardTitle}" (ปัจจุบันมี {insufficientPopup.current.toLocaleString()} คะแนน)
            </Text>

            <TouchableOpacity
              style={{ backgroundColor: '#1F4C9C', borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center' }}
              onPress={() => setInsufficientPopup({ visible: false, required: 0, current: 0, rewardTitle: '' })}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 4. CLAIMED MISSION REWARD OVERLAY */}
      {claimedModal.visible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ionicons name="gift" size={38} color="#F59E0B" />
            </View>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 6 }}>
              🎉 รับรางวัลสำเร็จ!
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 14 }}>
              คุณได้รับคะแนนสะสมจากการทำภารกิจ "{claimedModal.title}"
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginBottom: 20, gap: 6 }}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#D97706' }}>
                +{claimedModal.points.toLocaleString()} คะแนน
              </Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: '#1F4C9C', borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center' }}
              onPress={() => setClaimedModal({ visible: false, points: 0, title: '' })}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // 2 Main Icons Container
  twoIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 14,
  },
  mainIconButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  mainIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainIconLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
  },
  mainIconSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  seeAll: {
    fontSize: 13,
    color: colors.link,
    fontWeight: '500',
  },
  // Missions
  missionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  missionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  missionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
    marginBottom: 6,
  },
  missionProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionProgressBg: {
    flex: 1,
    height: 5,
    backgroundColor: colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  missionProgressFill: {
    height: 5,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  missionProgressText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  missionPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  missionPointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF8C00',
    marginLeft: 2,
  },
  // Rewards
  rewardsRow: {
    paddingBottom: 16,
  },
  rewardCard: {
    width: (width - 60) / 2.5,
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginRight: 10,
    alignItems: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  rewardIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rewardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
    textAlign: 'center',
  },
  rewardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rewardPointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rewardPointsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF8C00',
    marginLeft: 3,
  },
  // Leaderboard
  leaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  leaderCardMe: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  leaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderRank: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 12,
    width: 30,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.title,
  },
  leaderDept: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  leaderPoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderPointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF8C00',
    marginLeft: 4,
  },

  // Full Screen Views Styling
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    padding: 4,
  },
  fullScreenHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.title,
  },
  fullScreenFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fullScreenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalSubHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  modalFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F6FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  modalFilterChipActive: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  modalFilterChipActiveIn: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  modalFilterChipActiveOut: {
    backgroundColor: '#E24C4B',
    borderColor: '#E24C4B',
  },
  modalFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalFilterTextActive: {
    color: '#FFFFFF',
  },

  // Point History Tx Cards
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.title,
    marginBottom: 3,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txCategory: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  txDot: {
    fontSize: 11,
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  txDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  txPointsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  txPointsText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Redeemed Rewards Items
  redeemedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  redeemedIconBg: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  redeemedInfo: {
    flex: 1,
  },
  redeemedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
  },
  redeemedSubtitle: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  redeemedDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 3,
  },
  redeemedRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusBadgeReady: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeUsed: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextReady: {
    color: '#27AE60',
  },
  statusTextUsed: {
    color: '#9E9E9E',
  },
  redeemedPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redeemedPointsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E24C4B',
    marginLeft: 3,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },

  // Modal styling for Claim Popup
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
