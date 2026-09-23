import React from 'react';
import './src/utils/alertPolyfill';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AlertProvider } from './src/context/AlertContext';
import WebResponsiveWrapper from './src/components/WebResponsiveWrapper';

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
      Payslip: 'payslip',
      TimeCorrection: 'time-correction',
      OtRequest: 'ot-request',
      Announcements: 'announcements',
      RequestStatus: 'request-status',
      PointHistory: 'point-history',
      Missions: 'missions',
      ManagerApproval: 'manager-approval',
    },
  },
};

export default function App() {
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'WellX989';
    }
  }, []);

  return (
    <AlertProvider>
      <WebResponsiveWrapper>
        <NavigationContainer linking={linking}>
          <AppNavigator />
        </NavigationContainer>
      </WebResponsiveWrapper>
    </AlertProvider>
  );
}

