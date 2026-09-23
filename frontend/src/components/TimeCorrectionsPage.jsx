import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Search, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function TimeCorrectionsPage() {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/attendance/corrections`);
      const json = await res.json();
      if (json.success && json.corrections) {
        setCorrections(json.corrections);
      } else {
        setCorrections([]);
      }
    } catch (e) {
      console.error('Failed to fetch time corrections:', e);
      setCorrections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  const filtered = corrections.filter(
    (c) =>
      !searchTerm ||
      (c.employeeName && c.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.reason && c.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Clock size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                TIME CORRECTIONS
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Time Correction Requests (ขอปรับปรุงเวลาเข้างาน)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              คำขอปรับปรุงเวลาลงเวลาลืมสแกนนิ้ว/ลืมเข้างาน อิงจากตาราง PostgreSQL time_corrections (100% Real DB Data)
            </p>
          </div>
        </div>

        <button
          onClick={fetchCorrections}
          className="flex items-center gap-2 px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อพนักงาน หรือ เหตุผล..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0D13] text-slate-400 font-mono uppercase border-b border-red-900/30">
              <tr>
                <th className="py-3 px-4">วันที่ขอ</th>
                <th className="py-3 px-4">ชื่อพนักงาน</th>
                <th className="py-3 px-4">เวลาเดิม</th>
                <th className="py-3 px-4">เวลาใหม่ที่ขอปรับ</th>
                <th className="py-3 px-4">เหตุผลประกอบ</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500 font-mono">
                    กำลังดึงข้อมูลคำขอปรับปรุงเวลา...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    ยังไม่มีคำขอปรับปรุงเวลาในขณะนี้
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{item.dateIso || item.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{item.employeeName || item.employeeId}</td>
                    <td className="py-3 px-4 font-mono text-red-400">{item.oldCheckIn || '-'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{item.newCheckIn || '-'}</td>
                    <td className="py-3 px-4 text-slate-300">{item.reason || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                        {item.status || 'รออนุมัติ'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
