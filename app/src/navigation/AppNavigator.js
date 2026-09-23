import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';

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
import PayslipScreen from '../screens/PayslipScreen';
import RewardsScreen from '../screens/RewardsScreen';
import AboutAppScreen from '../screens/AboutAppScreen';
import TimeAttendanceScreen from '../screens/TimeAttendanceScreen';
import TimeCorrectionScreen from '../screens/TimeCorrectionScreen';
import OtRequestScreen from '../screens/OtRequestScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import RequestStatusScreen from '../screens/RequestStatusScreen';
import PointHistoryScreen from '../screens/PointHistoryScreen';
import MissionsScreen from '../screens/MissionsScreen';
import SetPasswordScreen from '../screens/SetPasswordScreen';
import ManagerApprovalScreen from '../screens/ManagerApprovalScreen';
import EmployeeDirectoryScreen from '../screens/EmployeeDirectoryScreen';
import TeamAttendanceScreen from '../screens/TeamAttendanceScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
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
            <View style={[styles.tabIconContainer, focused && styles.tabIconActive]}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
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
        options={{ tabBarLabel: 'หน้าหลัก', tabBarButtonTestID: 'tab-home' }}
      />
      <Tab.Screen
        name="TimeAttendance"
        component={TimeAttendanceScreen}
        options={{ tabBarLabel: 'ปฏิทิน', tabBarButtonTestID: 'tab-time-attendance' }}
      />
      <Tab.Screen
        name="HRDashboard"
        component={HRDashboardScreen}
        options={{ tabBarLabel: 'HR', tabBarButtonTestID: 'tab-hr-dashboard' }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{ tabBarLabel: 'สิทธิพิเศษ', tabBarButtonTestID: 'tab-rewards' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'โปรไฟล์', tabBarButtonTestID: 'tab-profile' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right', // Ultra Smooth Slide From Right Animation for all stack screens
        animationDuration: 280,
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="HRDashboard" component={HRDashboardScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="Payslip" component={PayslipScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="AboutApp" component={AboutAppScreen} />
      <Stack.Screen name="TimeCorrection" component={TimeCorrectionScreen} />
      <Stack.Screen name="OtRequest" component={OtRequestScreen} />
      <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
      <Stack.Screen name="RequestStatus" component={RequestStatusScreen} />
      <Stack.Screen name="PointHistory" component={PointHistoryScreen} />
      <Stack.Screen name="Missions" component={MissionsScreen} />
      <Stack.Screen name="ManagerApproval" component={ManagerApprovalScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EmployeeDirectory" component={EmployeeDirectoryScreen} />
      <Stack.Screen name="TeamAttendance" component={TeamAttendanceScreen} />
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
