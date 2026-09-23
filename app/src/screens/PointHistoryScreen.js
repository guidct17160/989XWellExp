import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { pointsStorage } from '../services/pointsStorage';
import TopNavbar from '../components/TopNavbar';

const { width } = Dimensions.get('window');

export default function PointHistoryScreen({ navigation }) {
  const [pointFilter, setPointFilter] = useState('all'); // 'all' | 'in' | 'out'
  const [userPoints, setUserPoints] = useState(pointsStorage.getUserPoints());
  const [transactions, setTransactions] = useState(pointsStorage.getTransactions());

  useEffect(() => {
    let unsubscribe = () => {};
    if (pointsStorage && typeof pointsStorage.subscribe === 'function') {
      unsubscribe = pointsStorage.subscribe(({ userPoints: newPoints, transactions: newTxs }) => {
        setUserPoints(newPoints);
        setTransactions(newTxs);
      });
    }
    return () => unsubscribe();
  }, []);

  const filteredTransactions = transactions.filter((tx) => {
    if (pointFilter === 'in') return tx.type === 'in';
    if (pointFilter === 'out') return tx.type === 'out';
    return true;
  });

  return (
    <SafeAreaView testID="screen-point-history" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar Header */}
      <TopNavbar navigation={navigation} title="ประวัติสะสมแต้ม" showBack />

      <View style={styles.container} className="flex-1 bg-slate-50">
        {/* Total Points Balance Summary Card */}
        <LinearGradient
          colors={[colors.gradientStart || '#1F4C9C', colors.gradientEnd || '#4A90D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
          className="flex-row items-center justify-between m-4 p-5 rounded-2xl shadow-md"
        >
          <View testID="point-history-summary-card" style={styles.summaryLeft}>
            <Text style={styles.summaryLabel} className="text-xs text-white/80 mb-1">คะแนนสะสมทั้งหมด</Text>
            <View style={styles.summaryPointsRow} className="flex-row items-center">
              <Ionicons name="star" size={24} color="#FFD700" style={{ marginRight: 6 }} />
              <Text style={styles.summaryPointsValue} className="text-3xl font-bold text-white">{Number(userPoints || 0).toLocaleString()}</Text>
              <Text style={styles.summaryPointsUnit} className="text-sm text-white/90 font-medium"> คะแนน</Text>
            </View>
          </View>
          <View style={styles.summaryIconBg} className="w-14 h-14 rounded-2xl bg-white/10 items-center justify-center">
            <Ionicons name="trophy-outline" size={32} color="#FFFFFF" />
          </View>
        </LinearGradient>

        {/* Filter Category Chips */}
        <View style={styles.filterRow} className="flex-row px-4 mb-3">
          <TouchableOpacity
            testID="point-history-filter-all"
            style={[
              styles.filterChip,
              pointFilter === 'all' && styles.filterChipActive,
            ]}
            className={`px-4 py-2 rounded-full mr-2 ${pointFilter === 'all' ? 'bg-primary' : 'bg-white border border-slate-200'}`}
            onPress={() => setPointFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                pointFilter === 'all' && styles.filterChipTextActive,
              ]}
              className={`text-xs font-semibold ${pointFilter === 'all' ? 'text-white' : 'text-slate-600'}`}
            >
              ทั้งหมด
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="point-history-filter-in"
            style={[
              styles.filterChip,
              pointFilter === 'in' && styles.filterChipActiveIn,
            ]}
            className={`flex-row items-center px-4 py-2 rounded-full mr-2 ${pointFilter === 'in' ? 'bg-emerald-600' : 'bg-white border border-slate-200'}`}
            onPress={() => setPointFilter('in')}
          >
            <Ionicons
              name="arrow-down-circle"
              size={15}
              color={pointFilter === 'in' ? '#FFFFFF' : '#27AE60'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                pointFilter === 'in' && styles.filterChipTextActive,
              ]}
              className={`text-xs font-semibold ${pointFilter === 'in' ? 'text-white' : 'text-slate-600'}`}
            >
              คะแนนเข้า (+)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="point-history-filter-out"
            style={[
              styles.filterChip,
              pointFilter === 'out' && styles.filterChipActiveOut,
            ]}
            className={`flex-row items-center px-4 py-2 rounded-full ${pointFilter === 'out' ? 'bg-red-600' : 'bg-white border border-slate-200'}`}
            onPress={() => setPointFilter('out')}
          >
            <Ionicons
              name="arrow-up-circle"
              size={15}
              color={pointFilter === 'out' ? '#FFFFFF' : '#E24C4B'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                pointFilter === 'out' && styles.filterChipTextActive,
              ]}
              className={`text-xs font-semibold ${pointFilter === 'out' ? 'text-white' : 'text-slate-600'}`}
            >
              คะแนนออก (-)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transactions History List */}
        <ScrollView testID="point-history-list" style={styles.scrollView} className="flex-1 bg-slate-50" showsVerticalScrollIndicator={false}>
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyContainer} className="items-center justify-center py-12">
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText} className="text-sm font-medium text-slate-400 mt-2">ไม่มีรายการในหมวดหมู่นี้</Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => (
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#1F4C9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#E0E7FF',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryPointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  summaryPointsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  summaryPointsUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E0E7FF',
  },
  summaryIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipActiveIn: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  filterChipActiveOut: {
    backgroundColor: '#E24C4B',
    borderColor: '#E24C4B',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  txIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 4,
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
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  txDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  txPointsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txPointsText: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 12,
  },
});
