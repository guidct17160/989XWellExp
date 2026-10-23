import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';

/**
 * Native map for the clock in / out location picker: the employee's position, every work location and its radius.
 * (react-native-maps cannot load on Expo web, which uses PunchMap.web.js instead.)
 */
export default function PunchMap({ position, locations }) {
  const mapRef = useRef(null);

  // fit the map to the employee and the nearest locations
  useEffect(() => {
    if (!mapRef.current || !position) return undefined;
    const points = [position, ...locations.slice(0, 3).map((l) => ({ latitude: l.latitude, longitude: l.longitude }))];
    const t = setTimeout(() => {
      try {
        mapRef.current.fitToCoordinates(points, { edgePadding: { top: 120, right: 60, bottom: 360, left: 60 }, animated: true });
      } catch (e) {}
    }, 300);
    return () => clearTimeout(t);
  }, [position, locations]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {locations.map((l) => (
        <React.Fragment key={l.id}>
          <Marker coordinate={{ latitude: l.latitude, longitude: l.longitude }} title={l.name} pinColor={l.inRange ? '#16A34A' : '#B91C1C'} />
          <Circle
            center={{ latitude: l.latitude, longitude: l.longitude }}
            radius={l.radiusM}
            strokeColor={l.inRange ? 'rgba(22,163,74,0.9)' : 'rgba(185,28,28,0.7)'}
            fillColor={l.inRange ? 'rgba(22,163,74,0.15)' : 'rgba(185,28,28,0.1)'}
          />
        </React.Fragment>
      ))}
    </MapView>
  );
}
