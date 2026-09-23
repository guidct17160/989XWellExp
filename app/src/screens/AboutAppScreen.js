import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TopNavbar from '../components/TopNavbar';

export default function AboutAppScreen({ navigation }) {
  return (
    <SafeAreaView testID="screen-about-app" className="flex-1 bg-white" style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.gradientStart} />

      {/* Top Navbar */}
      <TopNavbar navigation={navigation} title="เกี่ยวกับแอปพลิเคชัน" showBack />

      <ScrollView
        style={styles.scrollView}
        className="flex-1 bg-slate-50"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo & Info */}
        <View style={styles.appInfoSection} className="items-center py-6">
          <View style={styles.logoContainer} className="w-20 h-20 rounded-2xl bg-primary-light items-center justify-center mb-3 shadow-sm">
            <Ionicons name="people" size={44} color={colors.primary} />
          </View>
          <Text style={styles.appName} className="text-xl font-extrabold text-slate-900 mb-1">
            well<Text style={{ color: '#8B5CF6' }}>X</Text>989
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#8E95A5', letterSpacing: 3, marginBottom: 6 }}>
            GO. TRACK. EARN.
          </Text>
          <Text style={styles.appVersion} className="text-xs font-semibold text-slate-500">เวอร์ชัน 1.0.0</Text>
          <Text style={styles.appBuild} className="text-[11px] text-slate-400 mt-0.5">Build 2568.08.27</Text>
        </View>

        {/* Info Items */}
        <View testID="about-app-info-card" style={styles.infoCard} className="bg-white mx-4 mb-4 p-4 rounded-2xl border border-slate-100 shadow-sm">
          <View style={styles.infoItem} className="flex-row items-center my-2">
            <Ionicons name="business-outline" size={18} color={colors.primary} style={{ marginRight: 12 }} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel} className="text-xs text-slate-400">พัฒนาโดย</Text>
              <Text style={styles.infoValue} className="text-sm font-semibold text-slate-800">WellX989 Team</Text>
            </View>
          </View>
          <View style={styles.infoSep} className="h-px bg-slate-100 my-2" />
          <View style={styles.infoItem} className="flex-row items-center my-2">
            <Ionicons name="mail-outline" size={18} color={colors.primary} style={{ marginRight: 12 }} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel} className="text-xs text-slate-400">ติดต่อ</Text>
              <Text style={styles.infoValue} className="text-sm font-semibold text-slate-800">support@wellx989.com</Text>
            </View>
          </View>
          <View style={styles.infoSep} className="h-px bg-slate-100 my-2" />
          <View style={styles.infoItem} className="flex-row items-center my-2">
            <Ionicons name="globe-outline" size={18} color={colors.primary} style={{ marginRight: 12 }} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel} className="text-xs text-slate-400">เว็บไซต์</Text>
              <Text style={[styles.infoValue, { color: colors.link }]} className="text-sm font-semibold text-primary">www.wellx989.com</Text>
            </View>
          </View>
        </View>

        {/* Links */}
        <View style={styles.linksCard} className="bg-white mx-4 mb-6 rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {[
            { icon: 'document-text-outline', label: 'ข้อกำหนดการใช้งาน' },
            { icon: 'shield-outline', label: 'นโยบายความเป็นส่วนตัว' },
            { icon: 'star-outline', label: 'ให้คะแนนแอป' },
            { icon: 'share-social-outline', label: 'แชร์แอปนี้' },
          ].map((item, i) => (
            <TouchableOpacity
              testID={`about-app-link-${i}`}
              key={i}
              style={[styles.linkItem, i < 3 && styles.linkItemBorder]}
              className="flex-row items-center justify-between px-4 py-3.5 border-b border-slate-100"
            >
              <View style={styles.linkLeft} className="flex-row items-center">
                <Ionicons name={item.icon} size={18} color={colors.primary} style={{ marginRight: 12 }} />
                <Text style={styles.linkLabel} className="text-sm font-medium text-slate-800">{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.copyright} className="text-xs text-slate-400 text-center mb-8">
          © 2026 Your Company. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 40,
  },
  // App Info
  appInfoSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  appBuild: {
    fontSize: 12,
    color: colors.label,
    marginTop: 2,
  },
  // Info Card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoSep: {
    height: 1,
    backgroundColor: colors.divider,
    marginHorizontal: 16,
  },
  infoContent: {
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '500',
    marginTop: 1,
  },
  // Links Card
  linksCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkLabel: {
    fontSize: 14,
    color: colors.title,
    fontWeight: '500',
    marginLeft: 12,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.label,
  },
});
