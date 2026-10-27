import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, ShieldCheck, Mail, ArrowRight, ArrowLeft, Monitor, Clock, AlertTriangle } from 'lucide-react';

import { API_BASE } from '../config';

export default function SetPasswordPage({ emailParam, onComplete }) {
  const urlParams = new URLSearchParams(window.location.search);
  const email = emailParam || urlParams.get('email') || '';
  const token = urlParams.get('token') || '';
  const type = urlParams.get('type') || '';
  const portal = urlParams.get('portal') || '';

  const isAdminPortal = type === 'admin' || portal === 'web';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!token) return;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        if (decoded.exp) {
          const update = () => {
            const nowSec = Math.floor(Date.now() / 1000);
            const remaining = decoded.exp - nowSec;
            if (remaining <= 0) {
              setSecondsRemaining(0);
              setIsExpired(true);
            } else {
              setSecondsRemaining(remaining);
            }
          };
          update();
          const interval = setInterval(update, 1000);
          return () => clearInterval(interval);
        }
      }
    } catch (err) {
      console.warn('Could not decode token expiry', err);
    }
  }, [token]);

  const formatCountdown = (totalSec) => {
    if (totalSec === null || totalSec <= 0) return '00:00';
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Backend requires >= 6 chars for both portals (employees also need letters + digits)
  const minLength = 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isExpired) {
      setErrorMsg('The password link has expired (15-minute limit). Please request a new link from your administrator');
      return;
    }
    if (!password || password.length < minLength) {
      setErrorMsg(`Password must be at least ${minLength} characters`);
      return;
    }
    if (!isAdminPortal && !/^(?=.*[a-zA-Z])(?=.*[0-9]).{6,30}$/.test(password)) {
      setErrorMsg('Password must contain at least 1 English letter and 1 number (6-30 characters)');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Password and confirmation do not match');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const endpoint = isAdminPortal ? `${API_BASE}/admins/set-password` : `${API_BASE}/employees/set-password`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, token }),
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.success) {
        if (isAdminPortal) {
          setSuccessMsg(`Password for ${email} has been set! You can use it to log in to Web Admin right away`);
        } else {
          setSuccessMsg(`New password for ${email} has been saved! You can use it to log in to the WellX989 Mobile App right away`);
        }
      } else {
        setErrorMsg(data.message || 'An error occurred while setting the password');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Unable to connect to the backend server');
    }
  };

  const handleFinish = () => {
    try {
      window.history.replaceState({}, document.title, '/');
    } catch (e) {}
    if (onComplete) onComplete();
    else window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-900 font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200">
        <button
          type="button"
          onClick={handleFinish}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </button>

        {!token && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 mb-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-700">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <span>Password setup link not found</span>
            </div>
            <p className="text-[11px] text-slate-700">
              This link has no verification token. Please open it from the link you received by email, or go back to the home page
            </p>
            <button
              type="button"
              onClick={handleFinish}
              className="mt-1 w-full py-2.5 rounded-xl bg-amber-100 hover:bg-amber-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to home (Dashboard / Login)</span>
            </button>
          </div>
        )}

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center mx-auto mb-3">
            {isAdminPortal ? <ShieldCheck size={28} /> : <Lock size={28} />}
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
            {isAdminPortal ? 'Set Web Admin Password' : 'Set Your Password'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAdminPortal
              ? 'Set your personal password to manage the WellX989 Web Admin'
              : 'Set your personal password to sign in to the WellX989 Mobile App'}
          </p>
        </div>

        {/* 15-Minute Expiration Countdown Bar */}
        <div className={`p-3.5 rounded-2xl border mb-3 flex items-center justify-between text-xs font-bold transition-all ${
          isExpired
            ? 'bg-danger-50 border-danger-200 text-danger-700'
            : secondsRemaining !== null && secondsRemaining <= 180
            ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <div className="flex items-center gap-2">
            <Clock size={16} className={isExpired ? 'text-danger-600' : secondsRemaining !== null && secondsRemaining <= 180 ? 'text-amber-600' : 'text-emerald-600'} />
            <span>
              {isExpired
                ? 'Link expired (over 15 minutes)'
                : 'Time left to set password (15-minute limit):'}
            </span>
          </div>
          <span className="font-mono text-sm px-2.5 py-0.5 rounded-lg bg-slate-900/50 border border-current">
            {isExpired ? '00:00' : secondsRemaining !== null ? formatCountdown(secondsRemaining) : '15:00'}
          </span>
        </div>

        {email && (
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-5 flex items-center gap-3 text-xs font-semibold text-slate-800">
            <Mail size={18} className="text-violet-700" />
            <div className="truncate">
              <span className="text-slate-500 block text-[10px]">
                {isAdminPortal ? 'Login email / username:' : 'Password setup email:'}
              </span>
              <span className="text-violet-700 font-mono font-bold">{email}</span>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-600 shrink-0" />
            <span>This link has expired (links are valid for 15 minutes for security). Please contact your administrator for a new link</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-2xl text-xs font-bold mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg ? (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-bold text-emerald-700 text-base uppercase tracking-wide">
              Password set successfully! 🟢
            </h3>
            <p className="text-xs text-emerald-800 leading-relaxed">{successMsg}</p>

            <div className="space-y-2.5 pt-2">
              {isAdminPortal ? (
                <button
                  onClick={handleFinish}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                >
                  <Monitor size={16} />
                  <span>🖥️ Log in to Web Admin</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <a
                    href="wellx989://login"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                  >
                    <span>📱 Open the app (WellX989 Mobile App)</span>
                    <ArrowRight size={16} />
                  </a>

                  <a
                    href="exp://172.16.0.22:8081"
                    className="w-full py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                  >
                    <span>📱 Open in Expo Go (iOS / Android)</span>
                  </a>

                  <button
                    onClick={handleFinish}
                    className="w-full py-2.5 rounded-xl bg-transparent text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors"
                  >
                    Done (close this page)
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {isAdminPortal ? 'New password for Web Admin *' : 'New password for Mobile App *'}
              </label>
              <input
                type="password"
                placeholder={`Enter new password (at least ${minLength} characters)`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm new password *
              </label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || isExpired}
              className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-2 uppercase tracking-wide ${
                isExpired
                  ? 'bg-slate-200 border border-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-violet-600/40'
              }`}
            >
              {loading
                ? 'Saving password...'
                : isExpired
                ? '⏳ Link expired (15-minute limit exceeded)'
                : isAdminPortal
                ? 'Save and set Web Admin password'
                : 'Save and set Mobile App password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
