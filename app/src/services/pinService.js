import { tryFetchApi } from './apiClient';
import { authService } from './authService';

const getPinStorageKey = (userId) => `wellx989_pin_enabled_${userId || 'current'}`;

export const pinService = {
  /**
   * Check whether current user or specified user has a PIN configured
   */
  hasPin(userId) {
    const user = authService.getUser();
    if (user && user.hasPin !== undefined) {
      return Boolean(user.hasPin);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const targetId = userId || (user ? user.id || user.code || user.username : 'current');
        const flag = window.localStorage.getItem(getPinStorageKey(targetId));
        return flag === 'true';
      }
    } catch (e) {}
    return false;
  },

  /**
   * Set local PIN status
   */
  setLocalPinStatus(userId, enabled) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const targetId = userId || 'current';
        if (enabled) {
          window.localStorage.setItem(getPinStorageKey(targetId), 'true');
        } else {
          window.localStorage.removeItem(getPinStorageKey(targetId));
        }
      }
    } catch (e) {}
  },

  /**
   * Clear all PIN status and keys on logout
   */
  clearPin(userId) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (userId) {
          window.localStorage.removeItem(getPinStorageKey(userId));
        }
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('wellx989_pin_enabled_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      }
    } catch (e) {}
  },

  /**
   * Set or update 6-digit PIN on backend
   * @param {string} pin - 6-digit new PIN
   * @param {string} currentPin - previous PIN (if updating)
   * @param {string} currentPassword - account password (alternative verification)
   */
  async setPin(pin, currentPin = null, currentPassword = null) {
    const cleanPin = String(pin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      throw new Error('รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น (0-9)');
    }

    const payload = { pin: cleanPin };
    if (currentPin) payload.currentPin = String(currentPin).trim();
    if (currentPassword) payload.currentPassword = String(currentPassword).trim();

    try {
      const response = await tryFetchApi('/auth/set-pin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response && response.ok) {
        const data = await response.json();
        const user = authService.getUser();
        if (user) {
          const updated = { ...user, hasPin: true };
          authService.setUser(updated);
          this.setLocalPinStatus(user.id || user.code || user.username, true);
        }
        return data;
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'ไม่สามารถตั้งค่า PIN ได้');
      }
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกรหัส PIN ได้');
    } catch (err) {
      throw err;
    }
  },

  /**
   * Verify PIN for unlocking or quick login
   * @param {string} pin - 6-digit PIN
   * @param {string} username - Optional username for quick PIN login
   */
  async verifyPin(pin, username = null) {
    const cleanPin = String(pin).trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      throw new Error('รหัส PIN ต้องเป็นตัวเลข 6 หลัก');
    }

    const user = authService.getUser();
    const targetUser = username || (user ? user.id || user.code || user.username : null);

    try {
      const response = await tryFetchApi('/auth/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: cleanPin, username: targetUser }),
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.user) {
          authService.setUser(data.user, data.token || data.accessToken, data.refreshToken);
        }
        return data;
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'รหัส PIN ไม่ถูกต้อง');
      }
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อตรวจสอบ PIN ได้');
    } catch (err) {
      throw err;
    }
  },

  /**
   * Remove / Disable PIN
   * @param {string} [password] - account password (optional for authenticated session)
   */
  async removePin(password = null) {
    try {
      const payload = password ? { password: String(password).trim() } : {};
      const response = await tryFetchApi('/auth/remove-pin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response && response.ok) {
        const data = await response.json();
        const user = authService.getUser();
        if (user) {
          const updated = { ...user, hasPin: false };
          authService.setUser(updated);
          this.setLocalPinStatus(user.id || user.code || user.username, false);
        }
        return data;
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'ไม่สามารถยกเลิก PIN ได้');
      }
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อยกเลิก PIN ได้');
    } catch (err) {
      throw err;
    }
  },

  /**
   * Fetch current PIN status from backend
   */
  async fetchPinStatus() {
    try {
      const response = await tryFetchApi('/auth/pin-status');
      if (response && response.ok) {
        const data = await response.json();
        const user = authService.getUser();
        if (user && data.hasPin !== undefined) {
          user.hasPin = data.hasPin;
          this.setLocalPinStatus(user.id || user.code || user.username, data.hasPin);
        }
        return data.hasPin;
      }
    } catch (e) {}
    return this.hasPin();
  },
};
