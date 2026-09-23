import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmDeleteModal({
  visible = false,
  title = 'ยืนยันการลบข้อมูล?',
  description = 'คุณกำลังจะลบรายการนี้ออกจากระบบ ระบบจะไม่สามารถกู้คืนข้อมูลนี้ได้',
  itemName = '',
  itemId = '',
  onCancel,
  onConfirm,
  loading = false,
}) {
  if (!visible) return null;

  const formattedDescription = itemName
    ? `คุณกำลังจะลบข้อมูล ${itemName} ${itemId ? `(${itemId})` : ''} ออกจากระบบ ระบบจะไม่สามารถกู้คืนข้อมูลนี้ได้`
    : description;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Warning Trash Icon */}
          <View style={styles.iconBadge}>
            <Ionicons name="trash-outline" size={28} color="#EF4444" />
          </View>

          {/* Header/Title */}
          <Text style={styles.modalTitle}>{title}</Text>

          {/* Body/Description */}
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>{formattedDescription}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {/* Cancel Button (Secondary Style) */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>ยกเลิก</Text>
            </TouchableOpacity>

            {/* Confirm Delete Button (Danger Red Style) */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmButtonText}>
                {loading ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#141722',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(127, 29, 29, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  descriptionBox: {
    backgroundColor: '#0B0D13',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.3)',
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.4)',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
