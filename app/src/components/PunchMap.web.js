import React from 'react';
import { View, StyleSheet } from 'react-native';

// Expo web has no native map (react-native-maps cannot load here): the location list below still works.
export default function PunchMap() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E5E7EB' }]} />;
}
