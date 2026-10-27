import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../config';
import AuthLayout from './AuthLayout';

/**
 * หน้าเข้าสู่ระบบ (path: /login)
 * ส่วน "ลืมรหัสผ่าน" แยกเป็นอีกไฟล์/อีก path: ForgotPasswordPage.jsx (/forgot-password)
 *
 * props:
 *  - onLoginSuccess(user): เรียกเมื่อล็อกอินสำเร็จ
 *  - initialNotice: ข้อความแจ้งเตือนด้านบน (เช่น session หมดอายุ)
 *  - onNavigate(path, extra): สั่งเปลี่ยนหน้า (ใช้ไป /forgot-password)
 */
export default function LoginPage({ onLoginSuccess, initialNotice, onNavigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ไปหน้าลืมรหัสผ่าน และส่งค่าที่พิมพ์ไว้ในช่อง username ไปเติมให้
  const openForgot = () => onNavigate && onNavigate('/forgot-password', { identifier: username.trim() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser && !cleanPass) {
      setError('Please enter your username and password');
      return;
    }
    if (!cleanUser) {
      setError('Please enter your username');
      return;
    }
    if (!cleanPass) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          portal: 'web',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          try {
            localStorage.setItem('wellx989_token', data.token);
          } catch (e) {}
        }
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.message || 'Incorrect username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to the server. Please check that the server is running');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-wide uppercase">Welcome to WellX989</h1>
      <p className="text-xs text-slate-500 mb-7">Enter your credentials to sign in to the management system (Admin Suite)</p>

      {initialNotice && (
        <div className="bg-amber-50 border border-amber-500/60 text-amber-800 px-4 py-3 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2 shadow-lg shadow-slate-300">
          <span className="text-amber-600">⏰</span>
          <span>{initialNotice}</span>
        </div>
      )}

      {error && (
        <div className="bg-danger-50 border border-danger-300 text-danger-700 px-4 py-3 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Username Field */}
        <div className="flex flex-col mb-5">
          <label htmlFor="username" className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Username (email)
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter email "
            autoComplete="username"
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-200 outline-none transition-all"
          />
        </div>

        {/* Password Field */}
        <div className="flex flex-col mb-2">
          <label htmlFor="password" className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Password
          </label>
          <div className="relative w-full">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full h-12 pl-4 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:border-violet-500 focus:ring-4 focus:ring-violet-200 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-violet-100 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Forgot Password Link */}
        <div className="mt-2 mb-7 flex justify-end">
          <button
            type="button"
            onClick={openForgot}
            className="text-xs font-semibold text-slate-500 hover:text-violet-700 transition-colors cursor-pointer"
          >
            Forgot Password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-gradient-to-r from-[#7C3AED] to-[#4C1D95] hover:from-[#A78BFA] hover:to-[#6D28D9] active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl text-base shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
        >
          {loading ? <span>Verifying credentials...</span> : <span>Login</span>}
        </button>
      </form>
    </AuthLayout>
  );
}
