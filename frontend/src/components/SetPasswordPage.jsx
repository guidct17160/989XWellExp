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
    <div className="min-h-screen bg-[#0B0D13] flex items-center justify-center p-4 text-slate-100 font-sans">
      <div className="bg-[#141722] rounded-3xl max-w-md w-full p-8 shadow-2xl border border-red-900/40">
        <button
          type="button"
          onClick={handleFinish}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </button>

        {!token && (
          <div className="bg-amber-950/80 border border-amber-700/60 p-4 rounded-2xl text-xs text-amber-200 mb-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
              <span>Password setup link not found</span>
            </div>
            <p className="text-[11px] text-slate-300">
              This link has no verification token. Please open it from the link you received by email, or go back to the home page
            </p>
            <button
              type="button"
              onClick={handleFinish}
              className="mt-1 w-full py-2.5 rounded-xl bg-amber-900/70 hover:bg-amber-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to home (Dashboard / Login)</span>
            </button>
          </div>
        )}

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40 flex items-center justify-center mx-auto mb-3">
            {isAdminPortal ? <ShieldCheck size={28} /> : <Lock size={28} />}
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">
            {isAdminPortal ? 'Set Web Admin Password' : 'Set Your Password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAdminPortal
              ? 'Set your personal password to manage the WellX989 Web Admin'
              : 'Set your personal password to sign in to the WellX989 Mobile App'}
          </p>
        </div>

        {/* 15-Minute Expiration Countdown Bar */}
        <div className={`p-3.5 rounded-2xl border mb-3 flex items-center justify-between text-xs font-bold transition-all ${
          isExpired
            ? 'bg-red-950/90 border-red-700/60 text-red-300'
            : secondsRemaining !== null && secondsRemaining <= 180
            ? 'bg-amber-950/80 border-amber-700/60 text-amber-300 animate-pulse'
            : 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
        }`}>
          <div className="flex items-center gap-2">
            <Clock size={16} className={isExpired ? 'text-[#EF4444]' : secondsRemaining !== null && secondsRemaining <= 180 ? 'text-amber-400' : 'text-emerald-400'} />
            <span>
              {isExpired
                ? 'Link expired (over 15 minutes)'
                : 'Time left to set password (15-minute limit):'}
            </span>
          </div>
          <span className="font-mono text-sm px-2.5 py-0.5 rounded-lg bg-black/50 border border-current">
            {isExpired ? '00:00' : secondsRemaining !== null ? formatCountdown(secondsRemaining) : '15:00'}
          </span>
        </div>

        {email && (
          <div className="bg-[#0B0D13] p-3.5 rounded-2xl border border-red-900/40 mb-5 flex items-center gap-3 text-xs font-semibold text-slate-200">
            <Mail size={18} className="text-[#EF4444]" />
            <div className="truncate">
              <span className="text-slate-400 block text-[10px]">
                {isAdminPortal ? 'Login email / username:' : 'Password setup email:'}
              </span>
              <span className="text-[#EF4444] font-mono font-bold">{email}</span>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-950/90 border border-red-700/60 text-red-300 px-4 py-3 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#EF4444] shrink-0" />
            <span>This link has expired (links are valid for 15 minutes for security). Please contact your administrator for a new link</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/90 border border-red-700/60 text-red-300 px-4 py-3 rounded-2xl text-xs font-bold mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg ? (
          <div className="bg-emerald-950/80 border border-emerald-700/60 p-6 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-700/50">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-bold text-emerald-300 text-base uppercase tracking-wide">
              Password set successfully! 🟢
            </h3>
            <p className="text-xs text-emerald-200 leading-relaxed">{successMsg}</p>

            <div className="space-y-2.5 pt-2">
              {isAdminPortal ? (
                <button
                  onClick={handleFinish}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                >
                  <Monitor size={16} />
                  <span>🖥️ Log in to Web Admin</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <a
                    href="wellx989://login"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                  >
                    <span>📱 Open the app (WellX989 Mobile App)</span>
                    <ArrowRight size={16} />
                  </a>

                  <a
                    href="exp://172.16.0.22:8081"
                    className="w-full py-3 rounded-xl bg-[#0B0D13] hover:bg-slate-900 text-slate-200 font-bold text-xs border border-red-900/40 flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
                  >
                    <span>📱 Open in Expo Go (iOS / Android)</span>
                  </a>

                  <button
                    onClick={handleFinish}
                    className="w-full py-2.5 rounded-xl bg-transparent text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors"
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
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                {isAdminPortal ? 'New password for Web Admin *' : 'New password for Mobile App *'}
              </label>
              <input
                type="password"
                placeholder={`Enter new password (at least ${minLength} characters)`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Confirm new password *
              </label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || isExpired}
              className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mt-2 uppercase tracking-wide ${
                isExpired
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-red-600/40'
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
