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
  // Set when the session ends (idle / 8 hours / server says 401): a popup covers the page, OK signs out and opens /login
  const [sessionExpired, setSessionExpired] = useState(null);

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
    setSessionExpired(null);
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

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setUser(null);
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
    window.dispatchEvent(new Event('wellx989:session-cleared'));
  }, []);

  const expireSession = useCallback((reason) => {
    setSessionExpired((current) => current || reason);
  }, []);

  // main.jsx reports a 401 from the server
  useEffect(() => {
    const onExpired = (e) => expireSession((e.detail && e.detail.reason) || 'Your login is no longer valid.');
    window.addEventListener('wellx989:session-expired', onExpired);
    return () => window.removeEventListener('wellx989:session-expired', onExpired);
  }, [expireSession]);

  const confirmSessionExpired = () => {
    setSessionExpired(null);
    handleLogout();
    navigate(LOGIN_PATH, { replace: true });
  };

  // Activity event listener & periodic session check
  useEffect(() => {
    if (!isLoggedIn || sessionExpired) return;

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
        expireSession('You were inactive for 30 minutes.');
        return;
      }

      // 2. Check Absolute Timeout (8 hours)
      const loginTime = Number(localStorage.getItem('wellx989_login_time') || now);
      if (now - loginTime >= ABSOLUTE_TIMEOUT_MS) {
        expireSession('You have been signed in for 8 hours (end of the working day).');
        return;
      }
    }, 10000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, updateActivity));
      clearInterval(intervalId);
    };
  }, [isLoggedIn, sessionExpired, expireSession]);

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
    return <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={goToAuthPath} />;
  }

  // Signed in: the sign-in pages are not reachable
  if (AUTH_PATHS.includes(location.pathname)) {
    return <Navigate to={HOME_PATH} replace />;
  }

  return (
    <>
      <DashboardPage user={user} onLogout={() => handleLogout()} />
      {sessionExpired && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" data-testid="session-expired-popup">
          <div role="alertdialog" aria-modal="true" aria-labelledby="session-expired-title" className="w-full max-w-sm rounded-2xl border border-violet-500/30 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-violet-700 text-xl font-black">!</div>
            <h3 id="session-expired-title" className="text-lg font-black text-slate-900">Session expired</h3>
            <p className="mt-2 text-sm text-slate-700">{sessionExpired} Please sign in again to continue.</p>
            <button
              type="button"
              autoFocus
              onClick={confirmSessionExpired}
              className="mt-6 w-full px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
