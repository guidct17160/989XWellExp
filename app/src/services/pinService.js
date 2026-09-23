import { tryFetchApi } from './apiClient';
import { authService } from './authService';

const getPinStorageKey = (userId) => `wellx989_pin_enabled_${userId || 'current'}`;
const getLocalPinHashKey = (userId) => `wellx989_local_pin_${userId || 'current'}`;

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
          window.localStorage.removeItem(getLocalPinHashKey(targetId));
        }
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
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Network')) {
        throw err;
      }
    }

    // Offline / Mock fallback
    const user = authService.getUser();
    if (user) {
      const updated = { ...user, hasPin: true };
      authService.setUser(updated);
      const targetId = user.id || user.code || user.username;
      this.setLocalPinStatus(targetId, true);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(getLocalPinHashKey(targetId), cleanPin);
        }
      } catch (e) {}
    }

    return { success: true, message: 'ตั้งรหัส PIN 6 หลักสำเร็จ (โหมดใช้งานในเครื่อง)', hasPin: true };
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
          authService.setUser(data.user, data.token || data.accessToken);
        }
        return data;
      } else if (response) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'รหัส PIN ไม่ถูกต้อง');
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Network')) {
        throw err;
      }
    }

    // Offline / Local verification fallback
    const targetId = targetUser || 'current';
    let savedLocalPin = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        savedLocalPin = window.localStorage.getItem(getLocalPinHashKey(targetId));
      }
    } catch (e) {}

    // Support demo account fallback default PIN
    if (targetId === 'demo' || (user && user.username === 'demo')) {
      if (cleanPin === '123456' || (savedLocalPin && cleanPin === savedLocalPin)) {
        return { success: true, message: 'ปลดล็อก PIN สำเร็จ (Demo)' };
      }
      throw new Error('รหัส PIN ไม่ถูกต้อง (Demo ค่าเริ่มต้นคือ 123456)');
    }

    if (savedLocalPin && cleanPin === savedLocalPin) {
      return { success: true, message: 'ปลดล็อก PIN สำเร็จ' };
    }

    throw new Error('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
  },

  /**
   * Remove / Disable PIN
   * @param {string} password - account password
   */
  async removePin(password) {
    if (!password) {
      throw new Error('กรุณาระบุรหัสผ่านบัญชีเพื่อยกเลิก PIN');
    }

    try {
      const response = await tryFetchApi('/auth/remove-pin', {
        method: 'POST',
        body: JSON.stringify({ password: String(password).trim() }),
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
    } catch (err) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('Network')) {
        throw err;
      }
    }

    // Offline fallback
    const user = authService.getUser();
    if (user) {
      const updated = { ...user, hasPin: false };
      authService.setUser(updated);
      this.setLocalPinStatus(user.id || user.code || user.username, false);
    }
    return { success: true, message: 'ยกเลิกการใช้งาน PIN สำเร็จ', hasPin: false };
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
