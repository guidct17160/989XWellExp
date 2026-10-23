import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import DashboardPage from './components/DashboardPage';
import SetPasswordPage from './components/SetPasswordPage';
import { HOME_PATH } from './routes';

// Web Admin HR Timeout Settings:
// Idle Timeout: 30 minutes (30 * 60 * 1000 ms) - no activity, the session is cut off immediately
// Absolute Timeout: 8 hours (8 * 60 * 60 * 1000 ms) - end of the working day, must log in again
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

// The sign-in page lives at a clean /login URL. After signing in the user always lands on the Dashboard (/dashboard).
const LOGIN_PATH = '/login';
const FORGOT_PATH = '/forgot-password';
const AUTH_PATHS = [LOGIN_PATH, FORGOT_PATH];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('wellx989_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      // A session without a JWT cannot call any protected API, so require the token too
      return !!localStorage.getItem('wellx989_token') &&
        (localStorage.getItem('wellx989_is_logged_in') === 'true' || !!localStorage.getItem('wellx989_user'));
    } catch (e) {
      return false;
    }
  });

  // A password-setup link from an email (/set-password?token=...&email=...) must be left untouched
  const isSetPasswordMode = (() => {
    const params = new URLSearchParams(location.search);
    return !!params.get('token') && (location.pathname.includes('/set-password') || !!params.get('email'));
  })();
  const [timeoutNotice, setTimeoutNotice] = useState(null);

  const lastActivityRef = useRef(Date.now());

  // Current sign-in view (/login or /forgot-password); the address bar is the source of truth
  const authPath = location.pathname === FORGOT_PATH ? FORGOT_PATH : LOGIN_PATH;
  // ค่าที่ผู้ใช้พิมพ์ไว้ในหน้า Login ส่งไปเติมในหน้า Forgot password
  const [forgotPrefill, setForgotPrefill] = useState('');
  const goToAuthPath = (path, extra) => {
    if (extra && typeof extra.identifier === 'string') setForgotPrefill(extra.identifier);
    navigate(path);
  };

  const handleLoginSuccess = (userData) => {
    const now = Date.now();
    setUser(userData);
    setIsLoggedIn(true);
    setTimeoutNotice(null);
    navigate(HOME_PATH, { replace: true });
    try {
      localStorage.setItem('wellx989_user', JSON.stringify(userData));
      localStorage.setItem('wellx989_is_logged_in', 'true');
      localStorage.setItem('wellx989_login_time', String(now));
      localStorage.setItem('wellx989_last_activity', String(now));
      localStorage.removeItem('wellx989_active_menu');
    } catch (e) {
      console.error('Failed to save session', e);
    }
    lastActivityRef.current = now;
  };

  const handleLogout = useCallback((reason) => {
    setIsLoggedIn(false);
    setUser(null);
    if (reason) {
      setTimeoutNotice(reason);
    }
    try {
      localStorage.removeItem('wellx989_user');
      localStorage.removeItem('wellx989_token');
      localStorage.removeItem('wellx989_is_logged_in');
      localStorage.removeItem('wellx989_active_menu');
      localStorage.removeItem('wellx989_login_time');
      localStorage.removeItem('wellx989_last_activity');
    } catch (e) {
      console.error('Failed to clear session', e);
    }
  }, []);

  // Activity event listener & periodic session check
  useEffect(() => {
    if (!isLoggedIn) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      try {
        localStorage.setItem('wellx989_last_activity', String(Date.now()));
      } catch (e) {}
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const now = Date.now();

      // 1. Check Idle Timeout (30 minutes)
      const lastAct = lastActivityRef.current || now;
      if (now - lastAct >= IDLE_TIMEOUT_MS) {
        handleLogout('Session expired due to 30 minutes of inactivity (Idle Timeout)');
        return;
      }

      // 2. Check Absolute Timeout (8 hours)
      const loginTime = Number(localStorage.getItem('wellx989_login_time') || now);
      if (now - loginTime >= ABSOLUTE_TIMEOUT_MS) {
        handleLogout('Session expired after 8 hours of use (Absolute Timeout - end of the working day)');
        return;
      }
    }, 10000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, updateActivity));
      clearInterval(intervalId);
    };
  }, [isLoggedIn, handleLogout]);

  const handleSetPasswordComplete = () => {
    navigate('/', { replace: true });
  };

  if (isSetPasswordMode) {
    return <SetPasswordPage onComplete={handleSetPasswordComplete} />;
  }

  // /set-password without a token has nothing to do
  if (location.pathname.includes('/set-password')) {
    return <Navigate to="/" replace />;
  }

  if (!isLoggedIn) {
    // Signed out: only /login and /forgot-password exist, any other address goes to a clean /login
    if (!AUTH_PATHS.includes(location.pathname)) {
      return <Navigate to={LOGIN_PATH} replace />;
    }
    // หนึ่งหน้า = หนึ่งไฟล์ = หนึ่ง path
    if (authPath === FORGOT_PATH) {
      return <ForgotPasswordPage onNavigate={goToAuthPath} initialIdentifier={forgotPrefill} />;
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} initialNotice={timeoutNotice} onNavigate={goToAuthPath} />;
  }

  // Signed in: the sign-in pages are not reachable
  if (AUTH_PATHS.includes(location.pathname)) {
    return <Navigate to={HOME_PATH} replace />;
  }

  return <DashboardPage user={user} onLogout={() => handleLogout()} />;
}
