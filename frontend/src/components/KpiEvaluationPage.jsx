import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Search, Award, CheckCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function KpiEvaluationPage() {
  const [employees, setEmployees] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('wellx989_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['x-employee-id'] = 'ADM-001';
    return headers;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, kpiRes] = await Promise.all([
        fetch(`${API_BASE}/employees`, { headers: getHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/kpi/evaluations`, { headers: getHeaders() }).then((r) => r.json()).catch(() => ({})),
      ]);

      if (empRes.success && empRes.employees) {
        setEmployees(empRes.employees);
      } else {
        setEmployees([]);
      }

      if (kpiRes.success && kpiRes.evaluations) {
        setEvaluations(kpiRes.evaluations);
      } else {
        setEvaluations([]);
      }
    } catch (e) {
      console.error('Failed to fetch KPI data:', e);
      setEmployees([]);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEvaluateKpi = async (emp) => {
    const scoreStr = prompt(`ป้อนคะแนนการประเมิน KPI/OKR ของคุณ ${emp.name} (0 - 100):`, '85');
    if (scoreStr === null || scoreStr.trim() === '') return;
    
    const score = parseFloat(scoreStr);
    if (isNaN(score) || score < 0 || score > 100) {
      alert('⚠️ กรุณาระบุคะแนนระหว่าง 0 ถึง 100');
      return;
    }

    const remark = prompt('ระบุความเห็น/ข้อเสนอแนะเพิ่มเติม (Optional):', 'ผลงานเป็นไปตามเป้าหมายขององค์กร');

    try {
      const res = await fetch(`${API_BASE}/kpi/evaluations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          employeeId: emp.id || emp.code,
          evaluator: 'Super Admin',
          kpiScore: score,
          remark: remark || 'ผลงานเป็นไปตามเป้าหมายขององค์กร',
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`⭐ บันทึกผลประเมิน KPI ของ ${emp.name} (คะแนน: ${score} | เกรด: ${json.evaluation.grade}) ลงฐานข้อมูลจริงเรียบร้อยแล้ว!`);
        fetchData();
      } else {
        alert(`ข้อผิดพลาด: ${json.message || 'ไม่สามารถบันทึกข้อมูลได้'}`);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };

  // Find latest evaluation for each employee
  const getLatestEval = (emp) => {
    const match = evaluations.find(
      (ev) => ev.employeeId === emp.id || ev.employeeId === emp.code || ev.employeeCode === emp.code
    );
    return match || null;
  };

  const getGradeBadge = (grade) => {
    switch (grade) {
      case 'A':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-800/40">เกรด A (ยอดเยี่ยม)</span>;
      case 'B+':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-950 text-cyan-400 border border-cyan-800/40">เกรด B+ (ดีมาก)</span>;
      case 'B':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-950 text-blue-400 border border-blue-800/40">เกรด B (ดี)</span>;
      case 'C':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-950 text-amber-400 border border-amber-800/40">เกรด C (พอใช้)</span>;
      case 'D':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-950 text-red-400 border border-red-800/40">เกรด D (ต้องปรับปรุง)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-slate-500 border border-slate-800">ยังไม่ประเมิน</span>;
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
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                100% REAL DB DATA
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                KPI & OKR Evaluation Engine (ระบบประเมินผลงานและดัชนีชี้วัด)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ประเมินผลงานและคำนวณเกรด KPI/OKR รายบุคคล บันทึกและดึงผลจริงจากฐานข้อมูล PostgreSQL (kpi_evaluations)
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
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
            placeholder="ค้นหาชื่อพนักงาน หรือฝ่าย/แผนก..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] transition-all"
          />
        </div>
        <div className="text-xs font-mono text-slate-400">
          พนักงานทั้งหมด: <span className="font-bold text-white">{employees.length}</span> คน | ประเมินแล้ว: <span className="font-bold text-emerald-400">{evaluations.length}</span> ครั้ง
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
                <th className="py-3 px-4 text-center">คะแนนล่าสุด</th>
                <th className="py-3 px-4 text-center">เกรดผลงาน</th>
                <th className="py-3 px-4 text-center">วันที่ประเมิน</th>
                <th className="py-3 px-4 text-center">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูลการประเมินผลงานจาก PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลพนักงาน
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const latestEval = getLatestEval(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-red-950/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-red-400">{emp.code || emp.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-200">{emp.name}</td>
                      <td className="py-3 px-4 text-slate-400">{emp.department || '-'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {latestEval ? (
                          <span className="text-amber-400 text-sm">{latestEval.kpiScore} / 100</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {getGradeBadge(latestEval?.grade)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {latestEval ? latestEval.evaluationDate : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleEvaluateKpi(emp)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow transition-all cursor-pointer text-xs flex items-center gap-1.5 mx-auto"
                        >
                          <Award size={14} />
                          <span>{latestEval ? 'ประเมินซ้ำ / ปรับคะแนน' : '⭐ ประเมินผลงาน'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
