import React, { useState } from 'react';
import { API_BASE } from '../config';
import AuthLayout from './AuthLayout';

/**
 * หน้าลืมรหัสผ่าน (path: /forgot-password)
 * กรอกอีเมล / username / รหัสพนักงาน แล้วระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล
 *
 * props:
 *  - onNavigate(path): สั่งเปลี่ยนหน้า (ใช้กลับไป /login)
 *  - initialIdentifier: ค่าที่ผู้ใช้พิมพ์ไว้ในหน้า Login (เติมให้ในช่องกรอก)
 */
export default function ForgotPasswordPage({ onNavigate, initialIdentifier = '' }) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { maskedEmail, resetUrl } เมื่อส่งสำเร็จ

  const backToSignIn = () => onNavigate && onNavigate('/login');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setError('Please enter your email, username or employee ID');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // portal: 'web' = ลิงก์ในอีเมลต้องเปิดหน้าตั้งรหัสผ่านบนเว็บ (ไม่ใช่แอปมือถือ)
        body: JSON.stringify({ email: value, portal: 'web' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDone({ maskedEmail: data.maskedEmail || '', resetUrl: data.resetUrl || '' });
      } else if (res.status === 404) {
        setError('No account matches that email, username or ID. Please check it or contact HR.');
      } else if (res.status === 429) {
        setError('Too many attempts. Please wait 15 minutes and try again.');
      } else {
        setError('Unable to send the reset link. Please try again later.');
      }
    } catch (err) {
      setError('Unable to connect to the server. Please check that the server is running');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <h2 className="text-lg font-extrabold text-white mb-1">Reset your password</h2>
        {done ? (
          <div className="mt-3 mb-6 space-y-3">
            <div className="bg-emerald-950/70 border border-emerald-600/50 text-emerald-200 px-4 py-3 rounded-xl text-sm font-semibold">
              A password reset link has been sent{done.maskedEmail ? ` to ${done.maskedEmail}` : ' to your registered email'}.
              Open the email and follow the link to set a new password.
            </div>
            {done.resetUrl && (
              <a href={done.resetUrl} className="block text-xs text-amber-300 underline break-all">
                Development only: open the reset link directly
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-5">
              Enter your email, username or employee ID. We will email you a link to set a new password.
            </p>
            {error && (
              <div className="bg-red-950/80 border border-red-600/50 text-red-300 px-4 py-3 rounded-xl text-sm font-semibold mb-5 flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            <label htmlFor="forgot-id" className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Email / username / ID
            </label>
            <input
              id="forgot-id"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter email, username or employee ID"
              autoComplete="username"
              autoFocus
              className="w-full h-12 px-4 mb-6 rounded-xl border border-red-900/40 bg-[#0B0D13] text-white font-medium placeholder:text-slate-500 focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-[#DC2626] to-[#991B1B] hover:from-[#EF4444] hover:to-[#B91C1C] active:scale-[0.99] disabled:opacity-60 text-white font-bold rounded-xl text-base shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
            >
              {loading ? <span>Sending...</span> : <span>Send reset link</span>}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={backToSignIn}
          className="mt-4 text-xs font-semibold text-slate-400 hover:text-[#EF4444] transition-colors cursor-pointer self-center"
        >
          Back to sign in
        </button>
      </form>
    </AuthLayout>
  );
}
