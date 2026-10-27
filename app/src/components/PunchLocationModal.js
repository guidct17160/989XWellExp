import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import PunchMap from './PunchMap';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { attendanceStorage } from '../services/attendanceStorage';

const formatDistance = (m) => {
  if (m === null || m === undefined) return '-';
  return m < 1000 ? `${m} ม.` : `${(m / 1000).toFixed(2)} km`;
};

/**
 * Clock in / out location picker.
 * 1) "กำลังค้นหาตำแหน่ง..." while the GPS position and the allowed work locations are loaded
 * 2) a map plus a bottom sheet listing the work locations, nearest first; only locations inside their
 *    radius can be chosen (the server checks the distance again)
 * There is no confirm button: a punch is only possible by choosing a work location the employee is inside of.
 * When no work location has been set up (or none is assigned / nearby) the employee cannot clock in / out.
 *
 * onSelect({ locationId, locationName, latitude, longitude })
 */
export default function PunchLocationModal({ visible, kind, onClose, onSelect }) {
  const [phase, setPhase] = useState('searching'); // searching | choose | error
  const [canRetry, setCanRetry] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [position, setPosition] = useState(null);
  const [locations, setLocations] = useState([]);
  const pulse = useRef(new Animated.Value(0)).current;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const title = kind === 'clock-out' ? 'ลงเวลาออกงาน' : 'ลงเวลาเข้างาน';

  const load = useCallback(async () => {
    setPhase('searching');
    setErrorMsg('');
    setCanRetry(true);
    try {
      const pos = await attendanceStorage.getPosition();
      if (!pos) {
        throw new Error('ไม่พบตำแหน่งของคุณ กรุณาอนุญาตการเข้าถึงตำแหน่ง (GPS) แล้วลองใหม่อีกครั้ง');
      }
      const result = await attendanceStorage.fetchWorkLocations(pos);
      if (!result.required) {
        // HR has not set up any work location yet, so nobody can punch (the server refuses too)
        setErrorMsg('ยังไม่ได้กำหนดสถานที่ทำงาน ไม่สามารถลงเวลาได้ กรุณาติดต่อ HR');
        setCanRetry(false);
        setPhase('error');
        return;
      }
      setPosition(pos);
      setLocations(result.locations);
      setPhase('choose');
    } catch (e) {
      setErrorMsg(e.message || 'ไม่สามารถค้นหาตำแหน่งได้');
      setPhase('error');
    }
  }, []);

  // every time the sheet opens it looks for the position again; the previous result is dropped when it closes
  useEffect(() => {
    if (visible) {
      load();
    } else {
      setPhase('searching');
      setPosition(null);
      setLocations([]);
    }
  }, [visible, load]);

  useEffect(() => {
    if (!visible || phase !== 'searching') return undefined;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [visible, phase, pulse]);

  const choose = (loc) => {
    if (!loc.inRange) return;
    onSelectRef.current({ locationId: loc.id, locationName: loc.name, latitude: position.latitude, longitude: position.longitude });
  };

  // Only the places the employee is inside of are shown (list and map). Locations that are too far are never listed.
  const nearby = useMemo(() => locations.filter((l) => l.inRange), [locations]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {phase === 'choose' ? (
        <View style={styles.flex}>
          <PunchMap position={position} locations={nearby} />

          <TouchableOpacity testID="punch-location-close" style={styles.mapClose} onPress={onClose}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{kind === 'clock-out' ? 'เลือกพื้นที่ออกงาน' : 'เลือกพื้นที่เข้างาน'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {locations.length === 0 ? (
              <Text style={styles.emptyText}>ยังไม่มีสถานที่ทำงานที่คุณลงเวลาได้ กรุณาติดต่อ HR</Text>
            ) : nearby.length === 0 ? (
              <Text style={styles.emptyText}>ไม่มีสถานที่ใกล้เคียง ไม่สามารถลงเวลาได้</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {nearby.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    testID={`punch-location-${l.id}`}
                    style={styles.item}
                    activeOpacity={0.7}
                    onPress={() => choose(l)}
                  >
                    <Ionicons name="location-outline" size={24} color="#111827" style={{ marginRight: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{l.name}</Text>
                      <Text style={styles.itemDistance}>{formatDistance(l.distanceM)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        <LinearGradient colors={['#F59527', '#EBB470']} style={styles.flex}>
          <View style={styles.topBar}>
            <TouchableOpacity testID="punch-location-back" onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>{title}</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.center}>
            {phase === 'searching' ? (
              <>
                <View style={styles.pulseWrap}>
                  <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
                  <View style={styles.ringInner} />
                  <View style={styles.disc}>
                    <Ionicons name="locate" size={64} color="#F59527" />
                  </View>
                </View>
                <Text style={styles.searchText}>กำลังค้นหาตำแหน่ง..</Text>
              </>
            ) : (
              <>
                <Ionicons name="warning-outline" size={64} color="#FFFFFF" />
                <Text style={styles.errorText}>{errorMsg}</Text>
                {canRetry && (
                  <TouchableOpacity testID="punch-location-retry" style={styles.retryBtn} onPress={load}>
                    <Text style={styles.retryText}>ลองอีกครั้ง</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </LinearGradient>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 64 : 40,
  },
  topTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  pulseWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFFFFF' },
  ringInner: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.35)' },
  disc: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: { color: '#FFFFFF', fontSize: 18, marginTop: 56 },
  errorText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 24 },
  retryBtn: { marginTop: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#F59527', fontWeight: '700', fontSize: 15 },
  mapClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 40,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 34,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: '#111827', marginLeft: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  itemDisabled: { opacity: 0.7 },
  itemName: { fontSize: 17, fontWeight: '600', color: '#111827' },
  itemDistance: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#6B7280', paddingVertical: 24, fontSize: 15 },
});
