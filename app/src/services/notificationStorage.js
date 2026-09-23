import { tryFetchApi } from './apiClient';

const getUserId = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const session = window.localStorage.getItem('wellx989_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && parsed.loggedIn && parsed.user) {
          return parsed.user.id || parsed.user.code || parsed.user.username;
        }
      }
    }
  } catch (e) {}
  return 'default';
};

const getStorageKey = (prefix) => `${prefix}_${getUserId()}`;

let initialNotifications = [];

let globalState = {
  notifications: initialNotifications,
};

const loadLocalState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(getStorageKey('notification_state'));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.notifications)) {
          globalState.notifications = parsed.notifications;
          return;
        }
      }
    }
  } catch (e) {}
  globalState = { notifications: [] };
};
loadLocalState();

const syncWithBackend = async () => {
  try {
    const res = await tryFetchApi('/notifications');
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.notifications)) {
        const mergedNotifs = [...data.notifications];
        (globalState.notifications || []).forEach((localItem) => {
          if (localItem && !mergedNotifs.some((b) => b.id === localItem.id)) {
            mergedNotifs.push(localItem);
          }
        });
        globalState.notifications = mergedNotifs;
        saveState();
        listeners.forEach((l) => l(globalState));
      }
    }
  } catch (e) {
    console.log('Failed to sync notifications from API', e);
  }
};
syncWithBackend();

const listeners = new Set();

const saveState = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getStorageKey('notification_state'), JSON.stringify(globalState));
    }
  } catch (e) {
    console.log('Error saving notificationState to localStorage', e);
  }
};

const bannerListeners = new Set();

export const notificationStorage = {
  getState() {
    return { ...globalState };
  },
  getUnreadCount() {
    return globalState.notifications.filter(n => n.unread).length;
  },
  toggleRead(id) {
    const updated = globalState.notifications.map(n =>
      n.id === id ? { ...n, unread: false } : n
    );
    globalState = { notifications: updated };
    saveState();
    listeners.forEach(l => l(globalState));
  },
  markAllRead() {
    const updated = globalState.notifications.map(n => ({ ...n, unread: false }));
    globalState = { notifications: updated };
    saveState();
    listeners.forEach(l => l(globalState));
    try {
      tryFetchApi('/notifications/read-all', { method: 'PATCH' });
    } catch (e) {}
  },
  addNotification(newNotif) {
    const item = {
      id: 'notif_' + Date.now(),
      type: 'warning',
      icon: 'alert-circle-outline',
      iconColor: '#D93A8B',
      time: 'เมื่อครู่นี้',
      unread: true,
      screen: 'TimeCorrection',
      ...newNotif,
    };
    const updated = [item, ...globalState.notifications];
    globalState = { notifications: updated };
    saveState();
    listeners.forEach(l => l(globalState));
    bannerListeners.forEach(l => l(item));
    return item;
  },
  async clearAndSync() {
    loadLocalState();
    saveState();
    listeners.forEach((l) => l(globalState));
    await syncWithBackend();
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(globalState);
    return () => listeners.delete(listener);
  },
  subscribeBanner(listener) {
    bannerListeners.add(listener);
    return () => bannerListeners.delete(listener);
  }
};
