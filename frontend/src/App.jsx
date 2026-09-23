import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import SetPasswordPage from './components/SetPasswordPage';

// Web Admin HR Timeout Settings:
// Idle Timeout: 30 นาที (30 * 60 * 1000 ms) - ไม่มีการเคลื่อนไหว หน้าจอตัดทันที
// Absolute Timeout: 8 ชั่วโมง (8 * 60 * 60 * 1000 ms) - หมดวันทำงาน ต้องล็อกอินใหม่
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('wellx989_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('wellx989_is_logged_in') === 'true' || !!localStorage.getItem('wellx989_user');
  });

  const [isSetPasswordMode, setIsSetPasswordMode] = useState(false);
  const [timeoutNotice, setTimeoutNotice] = useState(null);

  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('token') || window.location.pathname.includes('/set-password')) {
      setIsSetPasswordMode(true);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    const now = Date.now();
    setUser(userData);
    setIsLoggedIn(true);
    setTimeoutNotice(null);
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

      // 1. Check Idle Timeout (30 นาที)
      const lastAct = lastActivityRef.current || now;
      if (now - lastAct >= IDLE_TIMEOUT_MS) {
        handleLogout('เซสชันหมดอายุเนื่องจากไม่มีการขยับหน้าจอเกิน 30 นาที (Idle Timeout)');
        return;
      }

      // 2. Check Absolute Timeout (8 ชั่วโมง)
      const loginTime = Number(localStorage.getItem('wellx989_login_time') || now);
      if (now - loginTime >= ABSOLUTE_TIMEOUT_MS) {
        handleLogout('เซสชันหมดอายุจากการใช้งานครบ 8 ชั่วโมง (Absolute Timeout - หมดวันทำงาน)');
        return;
      }
    }, 10000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, updateActivity));
      clearInterval(intervalId);
    };
  }, [isLoggedIn, handleLogout]);

  const handleSetPasswordComplete = () => {
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}
    setIsSetPasswordMode(false);
  };

  if (isSetPasswordMode) {
    return <SetPasswordPage onComplete={handleSetPasswordComplete} />;
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} initialNotice={timeoutNotice} />;
  }

  return <DashboardPage user={user} onLogout={() => handleLogout()} />;
}
