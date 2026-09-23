import { Alert, Platform } from 'react-native';

export const notificationService = {
  sendLocalNotification: (title, message) => {
    if (Platform.OS === 'web') {
      console.log(`[Notification] ${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  },

  registerPushTokenAsync: async () => {
    try {
      console.log('[Notification] Push token registered');
      return 'expo-push-token-demo';
    } catch (e) {
      console.error('Push token registration failed', e);
      return null;
    }
  }
};
