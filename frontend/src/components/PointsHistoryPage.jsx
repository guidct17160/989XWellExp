import React, { useState, useEffect } from 'react';
import { Gift, RefreshCw, Search, History, X, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function PointsHistoryPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // History Modal State
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pointsHistory, setPointsHistory] = useState({ currentPoints: 0, history: [] });

  const getHeaders = () => {
    const token = localStorage.getItem('wellx989_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['x-employee-id'] = 'ADM-001';
    return headers;
  };

  const fetchPointsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`, { headers: getHeaders() });
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

  const handleOpenHistory = async (emp) => {
    setSelectedEmp(emp);
    setHistoryLoading(true);
    try {
      const empId = emp.id || emp.code;
      const res = await fetch(`${API_BASE}/points/history?employeeId=${empId}`, { headers: getHeaders() });
      const json = await res.json();
      if (json.success) {
        setPointsHistory({
          currentPoints: json.currentPoints || emp.points || 0,
          history: json.history || [],
        });
      } else {
        setPointsHistory({ currentPoints: emp.points || 0, history: [] });
      }
    } catch (e) {
      setPointsHistory({ currentPoints: emp.points || 0, history: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = employees.filter(
    (emp) =>
      !searchTerm ||
      (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.code && emp.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
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
                100% REAL DB DATA
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Points Balance & History (คะแนนสะสมและประวัติแต้มพนักงาน)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ตรวจสอบยอดแต้มพอยท์คงเหลือและประวัติสะสมแต้มของพนักงานรายบุคคลจากฐานข้อมูล PostgreSQL (employees & point_transactions)
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
            placeholder="ค้นหาชื่อพนักงาน, รหัส หรือแผนก..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] transition-all"
          />
        </div>
        <div className="text-xs font-mono text-slate-400">
          พนักงานทั้งหมด: <span className="font-bold text-white">{employees.length}</span> คน
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
                <th className="py-3 px-4 text-right">แต้มคงเหลือใน DB</th>
                <th className="py-3 px-4 text-center">ประวัติแต้ม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูลแต้มพอยท์จาก PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
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
                      {(emp.points || 0).toLocaleString()} PTS
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenHistory(emp)}
                        className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/40 text-white font-bold rounded-lg shadow transition-all cursor-pointer text-xs inline-flex items-center gap-1.5"
                      >
                        <History size={13} />
                        <span>ดูประวัติ</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Point History Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141722] border border-red-900/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-red-900/30 bg-[#0B0D13]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950 text-red-400 border border-red-800/40">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">ประวัติแต้มพอยท์</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedEmp.name} ({selectedEmp.code || selectedEmp.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-950/60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Total points banner */}
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">ยอดแต้มสะสมปัจจุบันใน DB</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {(pointsHistory.currentPoints || 0).toLocaleString()} PTS
                  </span>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  ฝ่าย {selectedEmp.department || '-'}
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  รายการความเคลื่อนไหว (Transactions)
                </span>
                {historyLoading ? (
                  <div className="text-center py-6 text-slate-500 font-mono text-xs">
                    กำลังดึงข้อมูลประวัติจาก PostgreSQL...
                  </div>
                ) : pointsHistory.history.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    ยังไม่มีรายการความเคลื่อนไหวของแต้มพอยท์
                  </div>
                ) : (
                  pointsHistory.history.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-[#0B0D13] border border-red-900/20 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            tx.type === 'earn'
                              ? 'bg-emerald-950/80 text-emerald-400'
                              : 'bg-red-950/80 text-red-400'
                          }`}
                        >
                          {tx.type === 'earn' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </div>
                        <div>
                          <p className="font-bold text-white">{tx.title}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{tx.date}</p>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-black text-sm ${
                          tx.type === 'earn' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {tx.type === 'earn' ? '+' : ''}
                        {tx.points} PTS
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-red-900/30 bg-[#0B0D13] text-right">
              <button
                onClick={() => setSelectedEmp(null)}
                className="px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 text-white text-xs font-bold rounded-xl"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
