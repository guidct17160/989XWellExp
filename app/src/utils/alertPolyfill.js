import { Alert, Platform } from 'react-native';

let customAlertHandler = null;

export const registerAlertHandler = (handler) => {
  customAlertHandler = handler;
};

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons, options) => {
    let finalMsg = message;
    let finalBtns = buttons;

    if (Array.isArray(message)) {
      finalBtns = message;
      finalMsg = '';
    }

    if (customAlertHandler) {
      customAlertHandler(title, finalMsg, finalBtns, options);
    } else {
      console.log('In-App Alert:', title, finalMsg, finalBtns);
    }
  };
}

export default Alert;
