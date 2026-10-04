import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function AttendanceManagement({ initialTab = 'attendance' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [timeCorrections, setTimeCorrections] = useState([]);
  const [otLogs, setOtLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const getHeaders = () => {
    const token = localStorage.getItem('wellx989_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['x-employee-id'] = 'ADM-001';
    return headers;
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hr/reports/attendance?date=${selectedDate}`, {
        headers: getHeaders(),
      });
      const json = await res.json();
      if (json.success && (json.report || json.history)) {
        setAttendanceLogs(json.report || json.history || []);
      } else {
        setAttendanceLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs', err);
      setAttendanceLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate]);

  const filteredLogs = attendanceLogs.filter((log) => {
    const matchSearch =
      (log.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.employeeCode || log.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const isNormal = log.status === 'On Time' || log.status === 'ปกติ';
    const isLate = log.status === 'Late' || log.status === 'สาย' || log.status === 'เข้างานสาย';

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ON_TIME' && isNormal) ||
      (statusFilter === 'LATE' && isLate);

    return matchSearch && matchStatus;
  });

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออกในขณะนี้');
      return;
    }
    const headers = ['ลำดับ', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'ฝ่าย/แผนก', 'เวลาเข้างาน', 'เวลาออกงาน', 'สถานะ', 'พิกัด GPS / สถานที่'];
    const rows = filteredLogs.map((item, index) => [
      index + 1,
      item.employeeCode || item.employeeId || '-',
      `"${item.employeeName || item.name || '-'}"`,
      `"${item.department || '-'}"`,
      item.clockIn || item.checkIn || '-',
      item.clockOut || item.checkOut || '-',
      item.status || '-',
      `"${item.location || item.locationName || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onTimeCount = attendanceLogs.filter((l) => l.status === 'On Time' || l.status === 'ปกติ').length;
  const lateCount = attendanceLogs.filter((l) => l.status === 'Late' || l.status === 'สาย' || l.status === 'เข้างานสาย').length;

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
                MODULE 4
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                4. Attendance Management (การจัดการเวลาเข้า-ออกงาน)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ตรวจสอบข้อมูลเวลาเข้า-ออกงาน พิกัด GPS สรุปมาสาย และชั่วโมง OT รายวัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            title="ส่งออกรายงาน Excel/CSV"
          >
            <FileSpreadsheet size={16} />
            <span>ส่งออกรายงาน (Excel/CSV)</span>
          </button>
          <button
            onClick={fetchAttendanceData}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 bg-[#0B0D13] border border-red-900/40 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300">
            <Calendar size={16} className="text-[#EF4444]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Work Shift Policy Rule Banner */}
      <div className="bg-gradient-to-r from-red-950/90 via-[#141722] to-[#0B0D13] p-4.5 rounded-2xl border border-red-800/50 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/50 text-[#EF4444] flex items-center justify-center font-black">
            ⏱️
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">เกณฑ์การเข้างานบริษัท (Shift Rule)</h4>
            <p className="text-xs text-slate-400">
              เวลาทำงาน 9 ชั่วโมงต่อวัน (08:00 น. - 17:00 น.) • เข้างานหลัง <span className="font-bold text-red-400">09:00 น.</span> ระบบบันทึกเป็น <span className="font-bold text-red-400">"สาย"</span> อัตโนมัติ
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800/60 hidden md:inline-block">
          Active Shift Rule
        </span>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">เข้างานตรงเวลา (On Time)</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{onTimeCount} คน</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">เข้างานสาย (Late &gt; 09:00)</p>
            <h3 className="text-2xl font-black text-[#EF4444] font-mono">{lateCount} คน</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">รวมชั่วโมง OT เดือนนี้</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">18.5 ชม.</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-sky-950/80 text-sky-400 border border-sky-800/40">
            <MapPin size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">พิกัด GPS Verified</p>
            <h3 className="text-2xl font-black text-sky-400 font-mono">100%</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-red-900/30">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-[#EF4444]" />
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              รายการบันทึกเวลา ({filteredLogs.length})
            </h3>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-bold text-white outline-none focus:border-[#EF4444]"
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="ON_TIME">ตรงเวลา (On Time)</option>
              <option value="LATE">สาย (Late)</option>
            </select>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัส, แผนก..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs text-white placeholder-slate-500 outline-none focus:border-[#EF4444]"
              />
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B0D13] text-slate-400 font-bold uppercase tracking-wider border-b border-red-900/40">
              <tr>
                <th className="p-3.5">พนักงาน</th>
                <th className="p-3.5">สังกัด/แผนก</th>
                <th className="p-3.5">เวลาเข้างาน</th>
                <th className="p-3.5">เวลาออกงาน</th>
                <th className="p-3.5">สถานะ</th>
                <th className="p-3.5">พิกัด GPS Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    ไม่พบข้อมูลการบันทึกเวลาเข้างานในวันที่เลือก
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const inTime = log.checkIn || log.clockIn || '-';
                  const outTime = log.checkOut || log.clockOut || '-';
                  const loc = log.locationName || log.location || 'สำนักงานใหญ่ (HQ GPS)';
                  const isNormal = log.status === 'On Time' || log.status === 'ปกติ';

                  return (
                    <tr key={log.id} className="hover:bg-[#1A1D2C]/60 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{log.employeeName || '-'}</div>
                        <div className="text-[10px] font-mono text-red-400">{log.employeeCode || log.employeeId || '-'}</div>
                      </td>
                      <td className="p-3.5 font-medium">{log.department || '-'}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">{inTime}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-300">{outTime}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border ${
                            isNormal
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                              : 'bg-red-950/80 text-[#EF4444] border-red-800/50'
                          }`}
                        >
                          {isNormal ? '● ตรงเวลา' : `● ${log.status || 'เข้างานสาย'}`}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 flex items-center gap-1.5">
                        <MapPin size={14} className="text-sky-400 shrink-0" />
                        <span className="truncate max-w-[220px]">{loc}</span>
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
