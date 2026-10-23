import { Platform } from 'react-native';

class NavigationHistoryManager {
  constructor() {
    this.history = [];
    this.currentScreen = 'Home';
    this.tabScreens = ['Home', 'TimeAttendance', 'HRDashboard', 'Rewards', 'Profile'];
  }

  setCurrentScreen(screenName) {
    if (!screenName) return;
    if (this.currentScreen === screenName) return;

    // Track previously visited screen
    if (this.currentScreen) {
      // Don't push splash or pin lock as previous screens to return to
      if (!['Splash', 'PinLock', 'Onboarding'].includes(this.currentScreen)) {
        const last = this.history[this.history.length - 1];
        if (last !== this.currentScreen) {
          this.history.push(this.currentScreen);
        }
        if (this.history.length > 25) {
          this.history.shift();
        }
      }
    }
    this.currentScreen = screenName;
  }

  getPreviousScreen() {
    // Look for previous screen distinct from current
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i] !== this.currentScreen) {
        return this.history[i];
      }
    }
    return null;
  }

  popPreviousScreen() {
    // Remove any trailing instances of current screen
    while (this.history.length > 0 && this.history[this.history.length - 1] === this.currentScreen) {
      this.history.pop();
    }
    if (this.history.length > 0) {
      return this.history.pop();
    }
    return null;
  }

  goBackSafe(navigation, defaultFallback = 'MainTabs', defaultParams = { screen: 'Home' }) {
    if (!navigation) return;

    // Pop the previous distinct screen
    const prevScreen = this.popPreviousScreen();

    // Check if on web
    if (Platform.OS === 'web') {
      try {
        if (prevScreen && prevScreen !== this.currentScreen) {
          this.currentScreen = prevScreen;
          if (this.tabScreens.includes(prevScreen)) {
            navigation.navigate('MainTabs', { screen: prevScreen });
          } else {
            navigation.navigate(prevScreen);
          }
          return;
        }

        // If native stack can go back, do it in 1 action
        if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
          navigation.goBack();
          return;
        }

        // Safe fallback to MainTabs (Home) - never exit to Google
        this.currentScreen = 'Home';
        navigation.navigate(defaultFallback, defaultParams);
        return;
      } catch (e) {
        console.warn('[SafeBack] Web navigation error:', e);
      }
    }

    // Mobile native (iOS / Android)
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
    } else if (prevScreen) {
      this.currentScreen = prevScreen;
      if (this.tabScreens.includes(prevScreen)) {
        navigation.navigate('MainTabs', { screen: prevScreen });
      } else {
        navigation.navigate(prevScreen);
      }
    } else {
      this.currentScreen = 'Home';
      navigation.navigate(defaultFallback, defaultParams);
    }
  }
}

export const navigationHistory = new NavigationHistoryManager();
export default navigationHistory;
