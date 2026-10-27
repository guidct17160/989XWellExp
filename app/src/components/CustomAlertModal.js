import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CustomAlertModal({
  visible,
  title,
  message,
  type = 'info', // 'error' | 'success' | 'warning' | 'info'
  buttons = [],
  onClose,
}) {
  if (!visible) return null;

  const resolveType = () => {
    const t = String(title || '');
    const m = String(message || '');
    const fullText = `${t} ${m}`;

    // Negative / Error checks take priority only if truly an error
    if (
      fullText.includes('ไม่สำเร็จ') ||
      fullText.includes('ล้มเหลว') ||
      fullText.includes('ผิดพลาด') ||
      fullText.includes('เกิดข้อผิดพลาด') ||
      fullText.includes('ข้อผิดพลาด') ||
      fullText.includes('ไม่ถูกต้อง') ||
      fullText.includes('ไม่ตรงกัน') ||
      fullText.includes('Error') ||
      fullText.includes('Failed') ||
      fullText.includes('Fail')
    ) {
      return 'error';
    }

    // Success checks
    if (
      fullText.includes('สำเร็จ') ||
      fullText.includes('เรียบร้อย') ||
      fullText.includes('ส่งเควส') ||
      fullText.includes('รับรางวัล') ||
      fullText.includes('ยินดีต้อนรับ') ||
      fullText.includes('บันทึกแล้ว') ||
      fullText.includes('อนุมัติแล้ว') ||
      fullText.includes('คัดลอกแล้ว') ||
      fullText.includes('ดาวน์โหลดแล้ว') ||
      fullText.includes('Success') ||
      fullText.includes('Completed') ||
      fullText.includes('Done') ||
      t.includes('🎉') ||
      t.includes('✅') ||
      t.includes('✨') ||
      t.includes('🎊') ||
      t.includes('🏆') ||
      m.includes('🎉') ||
      m.includes('✅')
    ) {
      return 'success';
    }

    // Warning checks
    if (
      fullText.includes('แจ้งเตือน') ||
      fullText.includes('คำเตือน') ||
      fullText.includes('โปรดระวัง') ||
      fullText.includes('ข้อกำหนดความปลอดภัย') ||
      fullText.includes('Warning') ||
      t.includes('⚠️') ||
      t.includes('🔔')
    ) {
      return 'warning';
    }

    if (type && type !== 'auto') {
      return type;
    }

    return 'info';
  };

  const resolvedType = resolveType();

  const getIconProps = () => {
    switch (resolvedType) {
      case 'success':
        return { name: 'checkmark-circle', color: '#10B981', bg: '#DCFCE7', badgeBorder: '#86EFAC' };
      case 'warning':
        return { name: 'alert-circle', color: '#F59E0B', bg: '#FEF3C7', badgeBorder: '#FDE68A' };
      case 'info':
        return { name: 'information-circle', color: '#2563EB', bg: '#DBEAFE', badgeBorder: '#93C5FD' };
      case 'error':
      default:
        return { name: 'close-circle', color: '#EF4444', bg: '#FEE2E2', badgeBorder: '#FCA5A5' };
    }
  };

  const iconInfo = getIconProps();

  const handleButtonPress = (btnOnPress) => {
    if (onClose) onClose();
    if (typeof btnOnPress === 'function') {
      btnOnPress();
    }
  };

  const defaultButtons = buttons.length > 0 ? buttons : [{ text: 'ตกลง', style: 'default' }];
  // 3 or more choices (e.g. camera / gallery / cancel) read better stacked, one full-width button per line
  const stacked = defaultButtons.length > 2;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertCard}>
              {/* Icon Header */}
              <View style={[styles.iconContainer, { backgroundColor: iconInfo.bg, borderColor: iconInfo.badgeBorder }]}>
                <Ionicons name={iconInfo.name} size={36} color={iconInfo.color} />
              </View>

              {/* Title */}
              {title ? <Text style={styles.titleText}>{title}</Text> : null}

              {/* Message */}
              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              {/* Buttons Container */}
              <View style={[styles.buttonContainer, stacked && styles.buttonContainerStacked]}>
                {defaultButtons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  
                  let btnStyle = styles.primaryButton;
                  let textStyle = styles.primaryButtonText;

                  if (isCancel) {
                    btnStyle = styles.cancelButton;
                    textStyle = styles.cancelButtonText;
                  } else if (isDestructive) {
                    btnStyle = styles.destructiveButton;
                    textStyle = styles.destructiveButtonText;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      style={[
                        btnStyle,
                        stacked
                          ? styles.stackedButton
                          : defaultButtons.length > 1 && { flex: 1, marginHorizontal: 4 },
                        stacked && index < defaultButtons.length - 1 && { marginBottom: 10 },
                      ]}
                      onPress={() => handleButtonPress(btn.onPress)}
                    >
                      <Text style={textStyle}>{btn.text || 'ตกลง'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 99999,
  },
  alertCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  buttonContainerStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  stackedButton: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#1E40AF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    height: 48,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveButton: {
    height: 48,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
