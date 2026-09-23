import React, { useState, useEffect } from 'react';
import { Gift, RefreshCw, Search, Users } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function PointsHistoryPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPointsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`);
      const json = await res.json();
      if (json.success && json.employees) {
        setEmployees(json.employees);
      } else {
        setEmployees([]);
      }
    } catch (e) {
      console.error('Failed to fetch points data:', e);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPointsData();
  }, []);

  const filtered = employees.filter(
    (emp) =>
      !searchTerm ||
      (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.code && emp.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Gift size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                POINTS MANAGEMENT
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Points Balance & History (คะแนนสะสมและประวัติแต้มพนักงาน)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ตรวจสอบยอดแต้มพอยท์คงเหลือและประวัติสะสมแต้มของพนักงานรายบุคคล (100% Real DB Data)
            </p>
          </div>
        </div>

        <button
          onClick={fetchPointsData}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
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
            placeholder="ค้นหาชื่อพนักงาน หรือ รหัสพนักงาน..."
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
                <th className="py-3 px-4">รหัสพนักงาน</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">ฝ่าย/แผนก</th>
                <th className="py-3 px-4 text-right">แต้มสะสมทั้งหมด (Points)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูลแต้มพอยท์...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลพนักงาน
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-red-400">{emp.code || emp.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{emp.name}</td>
                    <td className="py-3 px-4 text-slate-400">{emp.department || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-400 text-sm">
                      {(emp.points || emp.currentPoints || 0).toLocaleString()} PTS
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
