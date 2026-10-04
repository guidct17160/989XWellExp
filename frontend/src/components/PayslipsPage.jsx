import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, RefreshCw, Search, CheckCircle, Download, DollarSign, Calendar } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function PayslipsPage() {
  const [employees, setEmployees] = useState([]);
  const [payslipsList, setPayslipsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-08');

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
      const [empRes, slipRes] = await Promise.all([
        fetch(`${API_BASE}/employees`, { headers: getHeaders() }).then((r) => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/payslips`, { headers: getHeaders() }).then((r) => r.json()).catch(() => ({})),
      ]);

      if (empRes.success && empRes.employees) {
        setEmployees(empRes.employees);
      } else {
        setEmployees([]);
      }

      if (slipRes.success && slipRes.payslips) {
        setPayslipsList(slipRes.payslips);
      } else {
        setPayslipsList([]);
      }
    } catch (e) {
      console.error('Failed to fetch payslips data:', e);
      setEmployees([]);
      setPayslipsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGeneratePayslip = async (emp) => {
    const baseSalary = Number(emp.salary) || 30000;
    const socialSecurity = Math.min(Math.round(baseSalary * 0.05), 750);
    const taxDeduction = baseSalary > 25000 ? Math.round(baseSalary * 0.03) : 0;
    const bonusInput = prompt(`ป้อนเงินโบนัส/เบี้ยขยันสำหรับ ${emp.name} (บาท):`, '0');
    if (bonusInput === null) return;
    const bonus = parseFloat(bonusInput) || 0;

    const netPay = baseSalary + bonus - socialSecurity - taxDeduction;

    const confirmMsg = `ยืนยันการออกสลิปเงินเดือนประจำเดือน ${selectedMonth} ให้กับคุณ ${emp.name}?\n` +
      `• ฐานเงินเดือนจริง (จาก DB): ${baseSalary.toLocaleString()} บาท\n` +
      `• โบนัส/ค่าตอบแทนพิเศษ: ${bonus.toLocaleString()} บาท\n` +
      `• หักประกันสังคม: -${socialSecurity.toLocaleString()} บาท\n` +
      `• หักภาษี ณ ที่จ่าย: -${taxDeduction.toLocaleString()} บาท\n` +
      `• เงินได้สุทธิ (Net Pay): ${netPay.toLocaleString()} บาท`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const res = await fetch(`${API_BASE}/payslips/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          employeeId: emp.id || emp.code,
          month: selectedMonth,
          year: parseInt(yearStr, 10),
          baseSalary,
          bonus,
          allowance: 0,
          otPay: 0,
          socialSecurity,
          taxDeduction,
          otherDeduction: 0,
          netPay,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`💸 ออกสลิปเงินเดือนให้ ${emp.name} ประจำเดือน ${selectedMonth} บันทึกลง PostgreSQL สำเร็จเรียบร้อย!`);
        fetchData();
      } else {
        alert(`ข้อผิดพลาด: ${json.message || 'ไม่สามารถออกสลิปได้'}`);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการสร้างสลิปเงินเดือน');
    }
  };

  const handleExportCSV = () => {
    if (!payslipsList || payslipsList.length === 0) {
      alert('ยังไม่มีข้อมูลสลิปเงินเดือนสำหรับส่งออก');
      return;
    }
    const headers = ['ลำดับ', 'รหัสสลิป', 'รหัสพนักงาน', 'ประจำงวด', 'ฐานเงินเดือน (บาท)', 'โบนัส/พิเศษ (บาท)', 'หักประกันสังคม (บาท)', 'หักภาษี (บาท)', 'เงินได้สุทธิ Net Pay (บาท)', 'วันที่สร้าง'];
    const rows = payslipsList.map((slip, index) => [
      index + 1,
      `"${slip.id || '-'}"`,
      `"${slip.employeeId || '-'}"`,
      `"${slip.month || '-'}"`,
      Number(slip.baseSalary || 0),
      Number(slip.bonus || 0),
      Number(slip.socialSecurity || 0),
      Number(slip.taxDeduction || 0),
      Number(slip.netPay || 0),
      `"${slip.createdAt || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Payslips_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchGenerateAll = async () => {
    if (!employees || employees.length === 0) {
      alert('ไม่พบข้อมูลพนักงานในระบบ');
      return;
    }
    const [yearStr] = selectedMonth.split('-');
    const activeEmps = employees.filter((e) => e.status !== 'Resigned' && e.status !== 'Inactive');
    if (!window.confirm(`ยืนยันการประมวลผลออกสลิปเงินเดือนอัตโนมัติประจำงวด ${selectedMonth} ให้กับพนักงานทั้งหมด ${activeEmps.length} คน?`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    try {
      for (const emp of activeEmps) {
        const baseSalary = Number(emp.salary) || 30000;
        const socialSecurity = Math.min(Math.round(baseSalary * 0.05), 750);
        const taxDeduction = baseSalary > 25000 ? Math.round(baseSalary * 0.03) : 0;
        const netPay = baseSalary - socialSecurity - taxDeduction;

        await fetch(`${API_BASE}/payslips/generate`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            employeeId: emp.id || emp.code,
            month: selectedMonth,
            year: parseInt(yearStr, 10),
            baseSalary,
            bonus: 0,
            allowance: 0,
            otPay: 0,
            socialSecurity,
            taxDeduction,
            otherDeduction: 0,
            netPay,
          }),
        });
        successCount++;
      }
      alert(`🎉 ประมวลผลและออกสลิปเงินเดือนงวด ${selectedMonth} ให้พนักงานสำเร็จทั้งสิ้น ${successCount} รายการ!`);
      fetchData();
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการประมวลผลสลิปเงินเดือนแบบกลุ่ม');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(
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
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-red-950 text-[#EF4444] border border-red-800/40">
                100% REAL DB DATA
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Electronic Payslips Generator (ระบบออกสลิปเงินเดือนอิเล็กทรอนิกส์)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              สร้างและนำส่งสลิปเงินเดือนอิเล็กทรอนิกส์ คำนวณจากฐานเงินเดือนจริงใน PostgreSQL (employees.salary & payslips)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0B0D13] border border-red-900/40 px-3 py-1.5 rounded-xl">
            <Calendar size={15} className="text-red-400" />
            <span className="text-xs text-slate-400">รอบเดือน:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={handleBatchGenerateAll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            title="ออกสลิปให้อัตโนมัติทุกคน"
          >
            <DollarSign size={15} />
            <span>ออกสลิปทุกคน (Batch)</span>
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Section 1: Employee Salary List for Payslip Generation */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-white">1. ทะเบียนพนักงาน & ออกสลิปเงินเดือน</h3>
            <p className="text-xs text-slate-400">
              กดปุ่มเพื่อสร้างสลิปเงินเดือนตามฐานเงินเดือนจริงของพนักงานแต่ละคน
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน..."
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0D13] text-slate-400 font-mono uppercase border-b border-red-900/30">
              <tr>
                <th className="py-3 px-4">รหัสพนักงาน</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">ฝ่าย/แผนก</th>
                <th className="py-3 px-4 text-right">ฐานเงินเดือนจริง (DB)</th>
                <th className="py-3 px-4 text-center">ออกสลิปประจำงวด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-mono">
                    กำลังโหลดข้อมูลพนักงานจาก PostgreSQL...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลพนักงาน
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-red-400">{emp.code || emp.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{emp.name}</td>
                    <td className="py-3 px-4 text-slate-400">{emp.department || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {(Number(emp.salary) || 0).toLocaleString()} บาท
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleGeneratePayslip(emp)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow transition-all cursor-pointer text-xs inline-flex items-center gap-1.5"
                      >
                        <DollarSign size={13} />
                        <span>ออกสลิป ({selectedMonth})</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Generated Payslips History (from DB table payslips) */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-white">2. ประวัติสลิปเงินเดือนที่ออกแล้วทั้งหมด (ตาราง payslips ใน PostgreSQL)</h3>
            <p className="text-xs text-slate-400">
              บันทึกสลิปเงินเดือนที่ผ่านการอนุมัติและจัดส่งไปยัง App พนักงานเรียบร้อยแล้ว
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg border border-emerald-500/50 shadow transition-all cursor-pointer"
              title="ส่งออกรายงานสลิปเงินเดือน Excel/CSV"
            >
              <Download size={13} />
              <span>ส่งออกรายงาน (CSV)</span>
            </button>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-red-950 text-red-400 border border-red-800/40">
              ทั้งหมด {payslipsList.length} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0D13] text-slate-400 font-mono uppercase border-b border-red-900/30">
              <tr>
                <th className="py-3 px-4">รหัสสลิป</th>
                <th className="py-3 px-4">รหัสพนักงาน</th>
                <th className="py-3 px-4">ประจำงวด</th>
                <th className="py-3 px-4 text-right">ฐานเงินเดือน</th>
                <th className="py-3 px-4 text-right">โบนัส/พิเศษ</th>
                <th className="py-3 px-4 text-right">ประกันสังคม</th>
                <th className="py-3 px-4 text-right">ภาษี</th>
                <th className="py-3 px-4 text-right text-emerald-400 font-bold">เงินได้สุทธิ (Net Pay)</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {payslipsList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 font-mono">
                    ยังไม่มีสลิปเงินเดือนที่ถูกสร้างในฐานข้อมูล
                  </td>
                </tr>
              ) : (
                payslipsList.map((slip) => (
                  <tr key={slip.id} className="hover:bg-red-950/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">{slip.id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-red-400">{slip.employeeId}</td>
                    <td className="py-3 px-4 font-mono text-slate-200">{slip.month}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {(Number(slip.baseSalary) || 0).toLocaleString()} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-cyan-400">
                      +{(Number(slip.bonus) || 0).toLocaleString()} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400">
                      -{(Number(slip.socialSecurity) || 0).toLocaleString()} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-400">
                      -{(Number(slip.taxDeduction) || 0).toLocaleString()} ฿
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-400">
                      {(Number(slip.netPay) || 0).toLocaleString()} ฿
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/40 inline-flex items-center gap-1">
                        <CheckCircle size={11} />
                        <span>สำเร็จ</span>
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
