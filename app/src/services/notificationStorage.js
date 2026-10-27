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

// Settings > Notifications: `general` = work notifications (requests, points), `news` = announcements from the admin.
// Turning one off keeps its items in the list but stops the banner and the bell counter.
const DEFAULT_PREFS = { general: true, news: true };
const readPrefs = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = JSON.parse(window.localStorage.getItem(getStorageKey('notification_prefs')) || 'null');
      if (saved && typeof saved === 'object') {
        return { general: saved.general !== false, news: saved.news !== false };
      }
    }
  } catch (e) {}
  return { ...DEFAULT_PREFS };
};
const categoryOf = (n) => (n && n.fromAnnouncement ? 'news' : 'general');
const isCategoryOn = (n) => readPrefs()[categoryOf(n)];

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

const NOTIF_ICONS = {
  success: { icon: 'checkmark-circle-outline', iconColor: '#10B981' },
  warning: { icon: 'alert-circle-outline', iconColor: '#F5A623' },
  error: { icon: 'close-circle-outline', iconColor: '#EF4444' },
  info: { icon: 'information-circle-outline', iconColor: '#0074C4' },
};

const formatNotifTime = (raw) => {
  if (!raw) return '';
  const d = new Date(String(raw).includes(' ') && !String(raw).includes('T') ? String(raw).replace(' ', 'T') : raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
};

// The server does not store which screen a notification belongs to, so it is worked out from its text:
// a request waiting for approval -> the approval screen, the answer to my own request -> the request status screen
const APPROVER_ROLES = ['admin', 'super admin', 'superadmin', 'hr admin', 'system admin', 'sys admin', 'hr', 'manager', 'boss', 'superboss', 'super boss', 'supervisor', 'head', 'ceo', 'director'];
const isApprover = () => {
  try {
    const session = JSON.parse(window.localStorage.getItem('wellx989_session') || 'null');
    const role = String((session && session.user && session.user.role) || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    return APPROVER_ROLES.includes(role);
  } catch (e) {
    return false;
  }
};
const screenFromText = (n) => {
  const text = `${n.title || ''} ${n.message || ''}`;
  if (n.screen) return n.screen;
  if (isApprover() && /คำขอใหม่|คำขอปรับปรุงเวลาใหม่|ผ่านการอนุมัติระดับ 1|รอ.*พิจารณา|รอการอนุมัติระดับ/.test(text)) return 'ManagerApproval';
  if (/ได้รับการอนุมัติแล้ว|ไม่ได้รับการอนุมัติ/.test(text)) return 'RequestStatus';
  return null;
};

// Map backend notification { id, title, message, type, isRead, createdAt } to the UI shape
const normalizeBackendNotif = (n) => {
  const look = NOTIF_ICONS[n.type] || NOTIF_ICONS.info;
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    icon: n.icon || look.icon,
    iconColor: n.iconColor || look.iconColor,
    unread: n.unread !== undefined ? !!n.unread : !n.isRead,
    time: formatNotifTime(n.createdAt) || n.time || '',
    screen: screenFromText(n),
    sortAt: new Date(n.createdAt).getTime() || 0,
    fromServer: true,
  };
};

// An announcement the admin published shows up here as a notification (read state is kept on this device)
const announcementToNotif = (a, previous) => ({
  id: 'anno-' + a.id,
  title: a.title,
  message: a.desc || a.content || '',
  type: 'info',
  icon: 'megaphone-outline',
  iconColor: '#7C3AED',
  unread: previous ? !!previous.unread : true,
  time: formatNotifTime(`${a.startDate}T${a.startTime}:00+07:00`),
  sortAt: new Date(`${a.startDate}T${a.startTime}:00+07:00`).getTime() || 0,
  screen: 'Announcements',
  announcement: a,
  fromAnnouncement: true,
});

const readJson = async (res) => {
  try {
    if (res && res.ok) return await res.json();
  } catch (e) {}
  return null;
};

const syncWithBackend = async () => {
  try {
    const [notifData, annoData] = await Promise.all([
      tryFetchApi('/notifications').then(readJson).catch(() => null),
      tryFetchApi('/announcements').then(readJson).catch(() => null),
    ]);
    const current = globalState.notifications || [];
    let serverNotifs = current.filter((n) => n && n.fromServer);
    let annoNotifs = current.filter((n) => n && n.fromAnnouncement);
    let changed = false;

    if (notifData && notifData.success && Array.isArray(notifData.notifications)) {
      serverNotifs = notifData.notifications.map(normalizeBackendNotif);
      changed = true;
    }

    const arrived = [];
    if (annoData && annoData.success && Array.isArray(annoData.announcements)) {
      const before = new Map(annoNotifs.map((n) => [n.id, n]));
      annoNotifs = annoData.announcements.map((a) => {
        const prev = before.get('anno-' + a.id);
        if (!prev) arrived.push(a);
        return announcementToNotif(a, prev);
      });
      changed = true;
    }

    if (!changed) return;

    // Keep only purely local (client-generated) items; server and announcement items are replaced by the fresh lists
    const localOnly = current.filter(
      (item) => item && !item.fromServer && !item.fromAnnouncement && !serverNotifs.some((b) => b.id === item.id)
    );
    const fromBackend = [...serverNotifs, ...annoNotifs].sort((x, y) => (y.sortAt || 0) - (x.sortAt || 0));
    globalState.notifications = [...localOnly, ...fromBackend];
    saveState();
    listeners.forEach((l) => l(globalState));

    // Pop the banner for an announcement that arrived while the app was already in use (not the first load on this device)
    const seededKey = getStorageKey('announcement_seeded');
    let seeded = false;
    try { seeded = window.localStorage.getItem(seededKey) === '1'; } catch (e) {}
    if (annoData && annoData.success) {
      try { window.localStorage.setItem(seededKey, '1'); } catch (e) {}
      if (seeded) {
        arrived.forEach((a) => {
          const item = annoNotifs.find((n) => n.id === 'anno-' + a.id);
          if (item && isCategoryOn(item)) bannerListeners.forEach((l) => l(item));
        });
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
    const prefs = readPrefs();
    return globalState.notifications.filter((n) => n.unread && prefs[categoryOf(n)]).length;
  },
  getPrefs() {
    return readPrefs();
  },
  setPrefs(patch) {
    const next = { ...readPrefs(), ...patch };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(getStorageKey('notification_prefs'), JSON.stringify(next));
      }
    } catch (e) {}
    listeners.forEach((l) => l(globalState)); // the bell counter recounts
    return next;
  },
  toggleRead(id) {
    const target = globalState.notifications.find((n) => n.id === id);
    if (target && target.fromServer) {
      tryFetchApi(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).catch(() => {});
    }
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
      tryFetchApi('/notifications/read-all', { method: 'PATCH' }).catch(() => {});
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
    if (isCategoryOn(item)) bannerListeners.forEach(l => l(item));
    return item;
  },
  // Pull announcements + notifications again (the home screen calls this while it is open)
  sync() {
    return syncWithBackend();
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
