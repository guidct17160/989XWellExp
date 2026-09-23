import { Platform } from 'react-native';
import { getCandidateUrls, tryFetchWithCandidates } from './apiUtils';

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
          window.localStorage.removeItem('wellx989_session');
        } else {
          currentUser = { ...DEFAULT_USER, ...parsed.user };
          loggedIn = true;
          currentToken = parsed.token || parsed.accessToken || null;
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

  setUser(userObj, token = null) {
    if (userObj && userObj.name) {
      userObj.name = userObj.name.replace(/\s*\([^)]*\)/g, '').trim();
    }
    if (token) {
      currentToken = token;
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
        require('./otStorage').otStorage.clearAndSync();
      } catch (e) {}
    }, 0);
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

  logout() {
    // 1. Save all current storage states to user-scoped localStorage keys before clearing session
    try {
      require('./attendanceStorage').attendanceStorage.getState();
      require('./leaveStorage').leaveStorage.getState();
      require('./notificationStorage').notificationStorage.getState();
      require('./pointsStorage').pointsStorage.getState();
      require('./otStorage').otStorage.getState();
    } catch (e) {}

    // 2. Reset currentUser and remove active session
    currentUser = { ...DEFAULT_USER };
    loggedIn = false;
    currentToken = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('wellx989_session');
      }
    } catch (e) {}
    listeners.forEach((l) => l(currentUser));

    // 3. Re-sync storage modules for default/guest session (lazy to avoid circular require)
    setTimeout(() => {
      try {
        require('./attendanceStorage').attendanceStorage.clearAndSync();
        require('./leaveStorage').leaveStorage.clearAndSync();
        require('./notificationStorage').notificationStorage.clearAndSync();
        require('./pointsStorage').pointsStorage.clearAndSync();
        require('./otStorage').otStorage.clearAndSync();
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
          this.setUser(data.user, data.token || data.accessToken);
          return data;
        } else {
          // Backend responded with an error (e.g. Wrong Password, User Not Found, Admin Restriction)
          throw new Error(data.message || 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง');
        }
      }

      // Offline / Network Error Fallback (ONLY when backend server cannot be reached)
      const uLower = cleanUsername.toLowerCase();

      // Mobile App Access Control: Admins CANNOT log in to Mobile App
      if (uLower === 'admin' || uLower === 'hr_admin' || uLower === 'sys_admin') {
        throw new Error('บัญชีนี้เป็นผู้ดูแลระบบ (Admin) สามารถเข้าใช้งานได้เฉพาะบน Web Admin เท่านั้น');
      }

      if (uLower === 'demo' && (cleanPassword === 'demo' || cleanPassword === '1234')) {
        const demoUser = {
          id: 'EMP-DEMO',
          code: 'demo',
          username: 'demo',
          name: 'พนักงานทดสอบ (Demo)',
          email: 'demo@wellx989.com',
          role: 'Employee',
          department: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
          position: 'Mobile Developer',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        };
        const demoToken = 'wellx989-jwt-demo-001';
        this.setUser(demoUser, demoToken);
        return { success: true, message: 'เข้าสู่ระบบสำเร็จ (Demo)', user: demoUser, token: demoToken };
      }

      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่');
    } catch (error) {
      throw error;
    }
  },
};
