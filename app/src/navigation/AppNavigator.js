import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import HRDashboardScreen from '../screens/HRDashboardScreen';
import LeaveRequestScreen from '../screens/LeaveRequestScreen';
import RewardsScreen from '../screens/RewardsScreen';
import AboutAppScreen from '../screens/AboutAppScreen';
import TimeAttendanceScreen from '../screens/TimeAttendanceScreen';
import TimeCorrectionScreen from '../screens/TimeCorrectionScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import RequestStatusScreen from '../screens/RequestStatusScreen';
import PointHistoryScreen from '../screens/PointHistoryScreen';
import SetPasswordScreen from '../screens/SetPasswordScreen';
import SetPinScreen from '../screens/SetPinScreen';
import PinLockScreen from '../screens/PinLockScreen';
import ManagerApprovalScreen from '../screens/ManagerApprovalScreen';
import EmployeeDirectoryScreen from '../screens/EmployeeDirectoryScreen';
import QuestsScreen from '../screens/QuestsScreen';
import QuestPlayScreen from '../screens/QuestPlayScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { theme, t } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade', // Super Ultra Smooth Fade Animation for Bottom Nav Bar Menu
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'TimeAttendance':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'HRDashboard':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Rewards':
              iconName = focused ? 'gift' : 'gift-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }
          return (
            <View style={[styles.tabIconContainer, focused && (theme.isDark ? { backgroundColor: '#334155' } : styles.tabIconActive)]}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: theme.isDark ? '#64748B' : colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.isDark ? '#1E293B' : colors.tabBarBackground,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: theme.isDark ? 0.3 : 0.06,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t('home', 'หน้าหลัก'), tabBarButtonTestID: 'tab-home' }}
      />
      <Tab.Screen
        name="TimeAttendance"
        component={TimeAttendanceScreen}
        options={{ tabBarLabel: t('calendar', 'ปฏิทิน'), tabBarButtonTestID: 'tab-time-attendance' }}
      />
      <Tab.Screen
        name="HRDashboard"
        component={HRDashboardScreen}
        options={{ tabBarLabel: t('hr', 'HR'), tabBarButtonTestID: 'tab-hr-dashboard' }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{ tabBarLabel: t('rewards', 'สิทธิพิเศษ'), tabBarButtonTestID: 'tab-rewards' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t('profile', 'โปรไฟล์'), tabBarButtonTestID: 'tab-profile' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
        contentStyle: { backgroundColor: theme.isDark ? '#0F172A' : '#F8FAFC' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
      <Stack.Screen
        name="PinLock"
        component={PinLockScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="SetPin" component={SetPinScreen} />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="HRDashboard" component={HRDashboardScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="AboutApp" component={AboutAppScreen} />
      <Stack.Screen name="TimeCorrection" component={TimeCorrectionScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="RequestStatus" component={RequestStatusScreen} />
      <Stack.Screen name="PointHistory" component={PointHistoryScreen} />
      <Stack.Screen name="ManagerApproval" component={ManagerApprovalScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EmployeeDirectory" component={EmployeeDirectoryScreen} />
      <Stack.Screen name="Quests" component={QuestsScreen} />
      <Stack.Screen name="QuestPlay" component={QuestPlayScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 28,
    borderRadius: 8,
  },
  tabIconActive: {
    backgroundColor: colors.primaryLight,
  },
});
