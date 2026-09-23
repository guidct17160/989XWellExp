import React, { useState } from 'react';
import { Lock, CheckCircle, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function SetPasswordPage({ emailParam, onComplete }) {
  const urlParams = new URLSearchParams(window.location.search);
  const email = emailParam || urlParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 4) {
      setErrorMsg('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/employees/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        setSuccessMsg(`ตั้งและบันทึกรหัสผ่านใหม่สำหรับ ${email} เรียบร้อยแล้ว! สามารถนำรหัสผ่านนี้ไปใช้ล็อกอินบน WellX989 Mobile App ได้ทันที`);
      } else {
        setErrorMsg(data.message || 'เกิดข้อผิดพลาดในการตั้งรหัสผ่าน');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend ได้');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D13] flex items-center justify-center p-4 text-slate-100 font-sans">
      <div className="bg-[#141722] rounded-3xl max-w-md w-full p-8 shadow-2xl border border-red-900/40">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40 flex items-center justify-center mx-auto mb-3">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wide">ตั้งรหัสผ่านเข้าใช้งาน</h2>
          <p className="text-xs text-slate-400 mt-1">ตั้งรหัสผ่านส่วนตัวสำหรับลงชื่อเข้าใช้ WellX989 Mobile App</p>
        </div>

        {email && (
          <div className="bg-[#0B0D13] p-3.5 rounded-2xl border border-red-900/40 mb-5 flex items-center gap-3 text-xs font-semibold text-slate-200">
            <Mail size={18} className="text-[#EF4444]" />
            <div className="truncate">
              <span className="text-slate-400 block text-[10px]">อีเมลตั้งรหัสผ่าน:</span>
              <span className="text-[#EF4444] font-mono font-bold">{email}</span>
            </div>
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
            <h3 className="font-bold text-emerald-300 text-base uppercase tracking-wide">ตั้งรหัสผ่านสำเร็จ! 🟢</h3>
            <p className="text-xs text-emerald-200 leading-relaxed">{successMsg}</p>

            <div className="space-y-2.5 pt-2">
              <a
                href="wellx989://login"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
              >
                <span>📱 เปิดแอปพลิเคชัน (WellX989 Mobile App)</span>
                <ArrowRight size={16} />
              </a>

              <a
                href="exp://172.16.0.22:8081"
                className="w-full py-3 rounded-xl bg-[#0B0D13] hover:bg-slate-900 text-slate-200 font-bold text-xs border border-red-900/40 flex items-center justify-center gap-2 uppercase tracking-wide transition-all"
              >
                <span>📱 เปิดใน Expo Go (iOS / Android)</span>
              </a>

              <button
                onClick={() => {
                  try {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  } catch (e) {}
                  if (onComplete) onComplete();
                  else window.location.href = '/';
                }}
                className="w-full py-2.5 rounded-xl bg-transparent text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors"
              >
                เสร็จสิ้น (ปิดหน้านี้)
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">รหัสผ่านใหม่เข้า Mobile App *</label>
              <input
                type="password"
                placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">ยืนยันรหัสผ่านใหม่ *</label>
              <input
                type="password"
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-sm shadow-lg shadow-red-600/40 transition-all flex items-center justify-center gap-2 mt-2 uppercase tracking-wide"
            >
              {loading ? 'กำลังบันทึกรหัสผ่าน...' : '🔒 บันทึกและตั้งรหัสผ่านเข้า Mobile App'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
