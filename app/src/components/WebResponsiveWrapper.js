import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Text } from 'react-native';

export default function WebResponsiveWrapper({ children }) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isLargeScreen = isWeb && width > 550;

  useEffect(() => {
    if (isWeb && typeof document !== 'undefined') {
      const styleId = 'wellx-web-responsive-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          html, body, #root, #root > div {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            background-color: #0B0D13 !important;
            overflow-x: hidden;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          /* Custom scrollbar for web */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: #0B0D13;
          }
          ::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #EF4444;
          }
        `;
        document.head.appendChild(style);
      }

      // Add Mouse Drag Horizontal Scroll Listener for Web
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let activeContainer = null;

      const handleMouseDown = (e) => {
        const target = e.target.closest && e.target.closest('.overflow-x-auto, [data-scrollable="true"], div');
        if (target && target.scrollWidth > target.clientWidth) {
          isDown = true;
          activeContainer = target;
          startX = e.pageX - target.offsetLeft;
          scrollLeft = target.scrollLeft;
        }
      };

      const handleMouseLeaveOrUp = () => {
        isDown = false;
        activeContainer = null;
      };

      const handleMouseMove = (e) => {
        if (!isDown || !activeContainer) return;
        e.preventDefault();
        const x = e.pageX - activeContainer.offsetLeft;
        const walk = (x - startX) * 1.5;
        activeContainer.scrollLeft = scrollLeft - walk;
      };

      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseleave', handleMouseLeaveOrUp);
      window.addEventListener('mouseup', handleMouseLeaveOrUp);
      window.addEventListener('mousemove', handleMouseMove);

      return () => {
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseleave', handleMouseLeaveOrUp);
        window.removeEventListener('mouseup', handleMouseLeaveOrUp);
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isWeb]);

  if (!isLargeScreen) {
    return <View style={styles.fullContainer}>{children}</View>;
  }

  return (
    <View style={styles.webOuterBackground}>
      {/* Centered Desktop Web Container Frame */}
      <View style={styles.webDesktopFrame}>
        {/* Sleek Top Web Shell Header Bar */}
        <View style={styles.webFrameHeader}>
          <View style={styles.windowDotsContainer}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          </View>
          <View style={styles.headerTitleBadge}>
            <Text style={styles.headerTitleText}>WellX989 Mobile Web</Text>
          </View>
          <Text style={styles.viewportIndicator}>{Math.round(width)}px</Text>
        </View>

        {/* Inner App Container */}
        <View style={styles.webInnerAppContent}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  webOuterBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0D13',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  webDesktopFrame: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    maxHeight: 920,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    display: 'flex',
    flexDirection: 'column',
  },
  webFrameHeader: {
    height: 38,
    backgroundColor: '#141722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.15)',
  },
  windowDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitleBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  headerTitleText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewportIndicator: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  webInnerAppContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
