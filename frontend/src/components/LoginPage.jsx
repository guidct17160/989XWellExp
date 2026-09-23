import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage({ onLoginSuccess, initialNotice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser && !cleanPass) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    if (!cleanUser) {
      setError('กรุณากรอกชื่อผู้ใช้ (Username)');
      return;
    }
    if (!cleanPass) {
      setError('กรุณากรอกรหัสผ่าน (Password)');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
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
        setError(data.message || 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#0B0D13] relative overflow-hidden font-sans text-slate-100">
      {/* Background Blood Red Soft Glow Radial Lights */}
      <div className="absolute top-[-10%] right-[-5%] w-[550px] h-[550px] bg-[#DC2626]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[550px] h-[550px] bg-[#991B1B]/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#EF4444]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-6 z-10 flex flex-col items-center">
        <img src="/logo.png" alt="WellX989" className="h-28 w-auto object-contain drop-shadow-lg" />
      </div>

      {/* Sign In Card */}
      <div className="w-full max-w-[430px] bg-[#141722]/95 backdrop-blur-2xl rounded-[24px] p-8 sm:p-9 shadow-2xl shadow-red-950/50 border border-red-900/30 z-10">
        <h1 className="text-2xl font-black text-white mb-2 tracking-wide uppercase">War Command Portal</h1>
        <p className="text-xs text-slate-400 mb-7">กรอกข้อมูลผู้ใช้งานเพื่อเข้าสู่ระบบบริหารจัดการ (Admin Suite)</p>

        {initialNotice && (
          <div className="bg-amber-950/90 border border-amber-500/60 text-amber-200 px-4 py-3 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2 shadow-lg shadow-amber-950/40">
            <span className="text-amber-400">⏰</span>
            <span>{initialNotice}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-950/80 border border-red-600/50 text-red-300 px-4 py-3 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Username Field */}
          <div className="flex flex-col mb-5">
            <label htmlFor="username" className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              User Name
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอกชื่อผู้ใช้งาน"
              autoComplete="username"
              className="w-full h-12 px-4 rounded-xl border border-red-900/40 bg-[#0B0D13] text-white font-medium placeholder:text-slate-500 focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 outline-none transition-all"
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col mb-2">
            <label htmlFor="password" className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative w-full">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
                className="w-full h-12 pl-4 pr-11 rounded-xl border border-red-900/40 bg-[#0B0D13] text-white font-medium focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-950/50 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forget Password Link */}
          <div className="mt-2 mb-7 flex justify-end">
            <a
              href="#forget-password"
              onClick={(e) => e.preventDefault()}
              className="text-xs font-semibold text-slate-400 hover:text-[#EF4444] transition-colors"
            >
              Forgot Password?
            </a>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl text-base shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
          >
            {loading ? (
              <span>กำลังตรวจสอบสิทธิ์...</span>
            ) : (
              <span>Sign In to Command Suite</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
