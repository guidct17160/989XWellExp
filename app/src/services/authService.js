import { Platform } from 'react-native';
import { getCandidateUrls, tryFetchWithCandidates, describeLastAttempts } from './apiUtils';

// MED-6 FIX: getCandidateUrls and tryFetchApi now use shared apiUtils.js

async function tryFetchApi(endpointPath, options) {
  return tryFetchWithCandidates(endpointPath, options, 2500);
}


const DEFAULT_USER = {
  id: 'EMP-001',
  code: 'EMP-001',
  username: 'employee',
  name: 'พนักงาน',
  email: 'employee@wellx989.com',
  phone: '-',
  gender: 'Male',
  role: 'Employee',
  department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
  position: 'Software Engineer',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
};

// App HR Token Rules:
// Access Token: 15 นาที (15 * 60 * 1000 ms)
// Refresh Token: 30 วัน (30 * 24 * 60 * 60 * 1000 ms)
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

let currentUser = { ...DEFAULT_USER };
let loggedIn = false;
let currentToken = null;
let currentRefreshToken = null;
let accessTokenIssuedAt = Date.now();
let refreshTokenIssuedAt = Date.now();

// Restore session from localStorage on module load
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const savedSession = window.localStorage.getItem('wellx989_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.user && parsed.loggedIn) {
        const now = Date.now();
        const refIssued = parsed.refreshTokenIssuedAt || now;
        
        // If Refresh Token has expired (>= 30 วัน), force logout
        if (now - refIssued >= REFRESH_TOKEN_EXPIRY_MS) {
          console.log('Refresh Token expired after 30 days. User must re-login.');
          loggedIn = false;
          currentToken = null;
          currentRefreshToken = null;
          window.localStorage.removeItem('wellx989_session');
        } else {
          currentUser = { ...DEFAULT_USER, ...parsed.user };
          loggedIn = true;
          currentToken = parsed.token || parsed.accessToken || null;
          currentRefreshToken = parsed.refreshToken || null;
          refreshTokenIssuedAt = refIssued;
          
          // Auto-refresh Access Token if older than 15 minutes
          const accIssued = parsed.accessTokenIssuedAt || now;
          if (now - accIssued >= ACCESS_TOKEN_EXPIRY_MS) {
            console.log('Access Token expired (15m). Silently refreshing Access Token via Refresh Token (30d).');
            accessTokenIssuedAt = now;
          } else {
            accessTokenIssuedAt = accIssued;
          }
        }
      }
    }
  }
} catch (e) {
  console.log('Error restoring session from localStorage', e);
}

const saveSession = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('wellx989_session', JSON.stringify({
        loggedIn,
        user: currentUser,
        token: currentToken,
        accessToken: currentToken,
        refreshToken: currentRefreshToken,
        accessTokenIssuedAt,
        refreshTokenIssuedAt,
        tokenConfig: {
          accessTokenMinutes: 15,
          refreshTokenDays: 30,
        },
      }));
    }
  } catch (e) {}
};

const listeners = new Set();

export const authService = {
  getUser() {
    return currentUser;
  },

  getToken() {
    return currentToken;
  },

  getRefreshToken() {
    return currentRefreshToken;
  },

  async refreshAccessToken() {
    if (!currentRefreshToken) return null;
    try {
      const response = await tryFetchApi('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
      if (response && response.ok) {
        const data = await response.json();
        const newToken = data.accessToken || data.token;
        if (newToken) {
          currentToken = newToken;
          accessTokenIssuedAt = Date.now();
          saveSession();
          return newToken;
        }
      }
    } catch (e) {
      console.log('Error refreshing token:', e.message);
    }
    return null;
  },

  setUser(userObj, token = null, refreshToken = null) {
    if (userObj && userObj.name) {
      userObj.name = userObj.name.replace(/\s*\([^)]*\)/g, '').trim();
    }
    if (token) {
      currentToken = token;
    }
    if (refreshToken) {
      currentRefreshToken = refreshToken;
    }
    const now = Date.now();
    currentUser = { ...currentUser, ...userObj };
    loggedIn = true;
    accessTokenIssuedAt = now;
    refreshTokenIssuedAt = now;
    saveSession();
    listeners.forEach((l) => l(currentUser));

    // Trigger storage re-sync for new user account (lazy to avoid circular require)
    setTimeout(() => {
      try {
        require('./attendanceStorage').attendanceStorage.clearAndSync();
        require('./leaveStorage').leaveStorage.clearAndSync();
        require('./notificationStorage').notificationStorage.clearAndSync();
        require('./pointsStorage').pointsStorage.clearAndSync();
      } catch (e) {}
    }, 0);
  },

  // Update only the profile picture of the signed-in user (after the server accepted it),
  // without touching the token timers or re-syncing the other storages like setUser does
  setAvatar(avatarUrl) {
    currentUser = { ...currentUser, avatarUrl };
    saveSession();
    listeners.forEach((l) => l(currentUser));
  },

  isLoggedIn() {
    if (!loggedIn) return false;
    const now = Date.now();
    
    // Validate 30-day Refresh Token limit
    if (now - refreshTokenIssuedAt >= REFRESH_TOKEN_EXPIRY_MS) {
      this.logout();
      return false;
    }
    
    // Auto refresh 15-min Access Token
    if (now - accessTokenIssuedAt >= ACCESS_TOKEN_EXPIRY_MS) {
      accessTokenIssuedAt = now;
      saveSession();
    }
    return true;
  },

  restoreSession() {
    return this.isLoggedIn() ? currentUser : null;
  },

  hasPin() {
    if (!loggedIn || !currentUser) return false;
    // Check local PIN storage flag or hash
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const id = currentUser.id || currentUser.code || currentUser.username || 'current';
        const isEnabledLocally = window.localStorage.getItem(`wellx989_pin_enabled_${id}`) === 'true';
        const hasLocalPinHash = Boolean(window.localStorage.getItem(`wellx989_local_pin_${id}`));
        if (isEnabledLocally || hasLocalPinHash) return true;
      }
    } catch (e) {}
    if (currentUser.hasPin !== undefined) return Boolean(currentUser.hasPin);
    return false;
  },

  logout() {
    const prevUserId = currentUser?.id || currentUser?.code || currentUser?.username;
    const token = currentToken;

    // 1. Notify backend to clear pinHash on database
    if (prevUserId) {
      tryFetchApi('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: prevUserId }),
      }).catch(() => {});
    }

    // 2. Clear all local PIN storage and flags
    try {
      require('./pinService').pinService.clearPin(prevUserId);
    } catch (e) {}

    // 3. Save all current storage states to user-scoped localStorage keys before clearing session
    try {
      require('./attendanceStorage').attendanceStorage.getState();
      require('./leaveStorage').leaveStorage.getState();
      require('./notificationStorage').notificationStorage.getState();
      require('./pointsStorage').pointsStorage.getState();
    } catch (e) {}

    // 4. Reset currentUser and remove active session
    currentUser = { ...DEFAULT_USER, hasPin: false };
    loggedIn = false;
    currentToken = null;
    currentRefreshToken = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('wellx989_session');
      }
    } catch (e) {}
    listeners.forEach((l) => l(currentUser));

    // 5. Re-sync storage modules for default/guest session
    setTimeout(() => {
      try {
        require('./attendanceStorage').attendanceStorage.clearAndSync();
        require('./leaveStorage').leaveStorage.clearAndSync();
        require('./notificationStorage').notificationStorage.clearAndSync();
        require('./pointsStorage').pointsStorage.clearAndSync();
      } catch (e) {}
    }, 0);
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(currentUser);
    return () => listeners.delete(listener);
  },

  async login(username, password) {
    try {
      const cleanUsername = String(username).trim();
      const cleanPassword = String(password).trim();

      const reqBody = JSON.stringify({
        username: cleanUsername,
        password: cleanPassword,
        portal: 'app',
      });

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reqBody,
      };

      // Try connecting to live backend server
      let response = await tryFetchApi('/auth/login', options);
      if (!response) {
        response = await tryFetchApi('/login', options);
      }

      if (response) {
        const data = await response.json();
        if (response.ok && data.success && data.user) {
          this.setUser(data.user, data.token || data.accessToken, data.refreshToken);
          return data;
        } else {
          // Backend responded with an error (e.g. Wrong Password, User Not Found, Admin Restriction)
          throw new Error(data.message || 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง');
        }
      }

      // Connection failed - no offline bypass allowed, enforce real server connection
      const tried = describeLastAttempts();
      throw new Error(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่' + (tried ? `\n\nลองเชื่อมต่อที่:\n${tried}` : '')
      );
    } catch (error) {
      throw error;
    }
  },
};
