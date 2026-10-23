import React from 'react';

/**
 * โครงหน้าร่วมของหน้าก่อนล็อกอิน (Login และ Forgot password)
 * มีพื้นหลังแสงสีแดง โลโก้ และการ์ดตรงกลาง ส่วนเนื้อหาของแต่ละหน้าใส่เป็น children
 */
export default function AuthLayout({ children }) {
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

      {/* Card */}
      <div className="w-full max-w-[430px] bg-[#141722]/95 backdrop-blur-2xl rounded-[24px] p-8 sm:p-9 shadow-2xl shadow-red-950/50 border border-red-900/30 z-10">
        {children}
      </div>
    </div>
  );
}
