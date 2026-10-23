import React from 'react';
import './src/utils/alertPolyfill';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AlertProvider } from './src/context/AlertContext';
import { ThemeProvider } from './src/context/ThemeContext';
import WebResponsiveWrapper from './src/components/WebResponsiveWrapper';
import { navigationHistory } from './src/services/navigationHistory';

function getActiveRouteName(state) {
  if (!state || !state.routes || state.routes.length === 0) return null;
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

const linking = {
  prefixes: [
    'wellx989://',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:8081',
  ],
  config: {
    screens: {
      Splash: '',
      SetPassword: 'set-password',
      Login: 'login',
      PinLock: 'pin-lock',
      SetPin: 'set-pin',
      ForgotPassword: 'forgot-password',
      MainTabs: {
        path: 'main',
        screens: {
          Home: '',
          TimeAttendance: 'time-attendance',
          HRDashboard: 'hr',
          Rewards: 'rewards',
          Profile: 'profile',
        },
      },
      Notifications: 'notifications',
      LeaveRequest: 'leave-request',
      TimeCorrection: 'time-correction',
      Announcements: 'announcements',
      RequestStatus: 'request-status',
      PointHistory: 'point-history',
      ManagerApproval: 'manager-approval',
    },
  },
};

export default function App() {
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'WellX989';
    }

    if (typeof window !== 'undefined' && window.history) {
      try {
        if (!window.history.state || !window.history.state.wellxApp) {
          window.history.replaceState({ wellxApp: true }, document.title, window.location.href);
        }
      } catch (e) {}

      const handlePopState = (e) => {
        try {
          if (!e.state || !e.state.wellxApp) {
            window.history.replaceState({ wellxApp: true }, document.title, window.location.href);
          }
        } catch (err) {}
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  return (
    <ThemeProvider>
      <AlertProvider>
        <WebResponsiveWrapper>
          <NavigationContainer
            linking={linking}
            onStateChange={(state) => {
              if (!state) return;
              const currentRoute = getActiveRouteName(state);
              if (currentRoute) {
                navigationHistory.setCurrentScreen(currentRoute);
              }
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </WebResponsiveWrapper>
      </AlertProvider>
    </ThemeProvider>
  );
}

