import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Expo web map for the clock in / out location picker (react-native-maps cannot load on web, so this uses
 * Leaflet + OpenStreetMap): the employee's position, every work location and its radius.
 * PunchMap.js is the native version with the same props.
 */
export default function PunchMap({ position, locations }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !position) return undefined;

    const el = document.createElement('div');
    el.style.width = '100%';
    el.style.height = '100%';
    host.appendChild(el);

    const map = L.map(el, { zoomControl: false, center: [position.latitude, position.longitude], zoom: 17 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const shapes = [];
    locations.forEach((l) => {
      const color = l.inRange ? '#16A34A' : '#B91C1C';
      const radius = L.circle([l.latitude, l.longitude], { radius: l.radiusM, color, weight: 2, fillColor: color, fillOpacity: 0.15 }).addTo(map);
      L.circleMarker([l.latitude, l.longitude], { radius: 7, color: '#FFFFFF', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(l.name)
        .addTo(map);
      shapes.push(radius);
    });
    // the employee: a blue dot with a halo
    L.circleMarker([position.latitude, position.longitude], { radius: 18, stroke: false, fillColor: '#2563EB', fillOpacity: 0.2 }).addTo(map);
    L.circleMarker([position.latitude, position.longitude], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }).addTo(map);

    // fit the employee and the nearest locations (keep clear of the close button and the bottom sheet)
    const near = shapes.slice(0, 3).reduce((b, s) => b.extend(s.getBounds()), L.latLngBounds([[position.latitude, position.longitude]]));
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(near, { paddingTopLeft: [40, 100], paddingBottomRight: [40, 340], maxZoom: 18 });
    }, 50);

    return () => {
      clearTimeout(timer);
      map.remove();
      el.remove();
    };
  }, [position, locations]);

  // zIndex 0 keeps Leaflet's own layers (z-index up to 1000) underneath the close button and the bottom sheet
  return <View ref={hostRef} style={[StyleSheet.absoluteFill, styles.host]} />;
}

const styles = StyleSheet.create({
  host: { zIndex: 0, backgroundColor: '#E5E7EB' },
});
