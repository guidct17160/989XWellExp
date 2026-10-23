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

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import DatePicker from './DatePicker';

// Status is only On Time or Late. A record is Late when its stored status says so; any other status
// (e.g. an older auto-closed row) is decided by the clock-in time, late = after 09:00
const isLateLog = (log) => {
  const st = String(log.status || '');
  if (st === 'Late' || st === 'สาย' || st.includes('เข้างานสาย')) return true;
  if (st === 'On Time' || st === 'ปกติ') return false;
  const m = String(log.checkIn || log.clockIn || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const h = Number(m[1]);
  return h > 9 || (h === 9 && Number(m[2]) > 0);
};

// Status order: 1) Late (checked first) 2) otherwise Incomplete Hours (clocked out after working under 9 hours)
// 3) otherwise On Time. Someone still working (no clock-out yet) is never Incomplete Hours.
const REQUIRED_WORK_SECONDS = 9 * 3600;
const toSeconds = (t) => {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
};
const isIncompleteHoursLog = (log) => {
  if (isLateLog(log)) return false; // a late check-in stays "Late" whatever the hours are
  const start = toSeconds(log.checkIn || log.clockIn);
  const end = toSeconds(log.checkOut || log.clockOut);
  if (start === null || end === null) return false;
  return end - start < REQUIRED_WORK_SECONDS;
};

export default function AttendanceManagement({ initialTab = 'attendance' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [notification, setNotification] = useState(null);

  const triggerNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('wellx989_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hr/reports/attendance?date=${selectedDate}`, {
        headers: getHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success && (json.report || json.history)) {
        setAttendanceLogs(json.report || json.history || []);
      } else {
        setAttendanceLogs([]);
        triggerNotification(json.message || 'Unable to load attendance data', 'error');
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs', err);
      setAttendanceLogs([]);
      triggerNotification('Unable to connect to the server to load attendance data', 'error');
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
    
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ON_TIME' && !isLateLog(log) && !isIncompleteHoursLog(log)) ||
      (statusFilter === 'LATE' && isLateLog(log)) ||
      (statusFilter === 'INCOMPLETE' && isIncompleteHoursLog(log));

    return matchSearch && matchStatus;
  });

  // One status per record: Late, else Incomplete Hours, else On Time
  const statusLabels = (log) => [isLateLog(log) ? 'Late' : isIncompleteHoursLog(log) ? 'Incomplete Hours' : 'On Time'];

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      triggerNotification('No data available to export', 'error');
      return;
    }
    const headers = ['No.', 'Employee ID', 'Full Name', 'Department', 'Clock In', 'Clock Out', 'Status', 'GPS Location / Place'];
    const rows = filteredLogs.map((item, index) => [
      index + 1,
      item.employeeCode || item.employeeId || '-',
      `"${item.employeeName || item.name || '-'}"`,
      `"${item.department || '-'}"`,
      item.checkIn || item.clockIn || '-',
      item.checkOut || item.clockOut || '-',
      statusLabels(item).join(' + '),
      `"${item.locationName || item.location || '-'}"`
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

  const lateCount = attendanceLogs.filter(isLateLog).length;
  const incompleteCount = attendanceLogs.filter(isIncompleteHoursLog).length;
  const onTimeCount = attendanceLogs.length - lateCount - incompleteCount;

  return (
    <div className="space-y-6 text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Toast Notification Popup */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-bounce ${
            typeof notification === 'object' && notification?.type === 'error'
              ? 'bg-red-950 border border-red-700/60 text-red-300'
              : 'bg-emerald-950 border border-emerald-700/60 text-emerald-300'
          }`}
        >
          {typeof notification === 'object' && notification?.type === 'error' ? (
            <AlertTriangle size={20} className="text-[#EF4444]" />
          ) : (
            <CheckCircle size={20} className="text-emerald-400" />
          )}
          <span>{typeof notification === 'object' ? notification.msg : notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Clock size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                4. Attendance Management
              </h1>
            </div>
            
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            title="Export Excel/CSV report"
          >
            <FileSpreadsheet size={16} />
            <span>Export</span>
          </button>
          <button
            onClick={fetchAttendanceData}
            className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Work Shift Policy Rule Banner */}
      

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">On Time</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">{onTimeCount} staff</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Late (After 09:00)</p>
            <h3 className="text-2xl font-black text-[#EF4444] font-mono">{lateCount} staff</h3>
          </div>
        </div>

        <div className="bg-[#141722] p-5 rounded-2xl border border-red-900/30 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Incomplete Hours (under 9 hrs)</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">{incompleteCount} staff</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search ID, name, department..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'ALL', label: 'All' },
              { value: 'ON_TIME', label: 'On Time' },
              { value: 'LATE', label: 'Late' },
              { value: 'INCOMPLETE', label: 'Incomplete Hours' },
            ],
          },
        ]}
      >
        <div className="w-44">
          <DatePicker
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </FilterBar>

      <div className="bg-[#141722] p-6 rounded-2xl border border-red-900/30 shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-red-900/30">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-[#EF4444]" />
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Attendance Records ({filteredLogs.length})
            </h3>
          </div>

        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B0D13] text-slate-400 font-bold uppercase tracking-wider border-b border-red-900/40">
              <tr>
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Clock In</th>
                <th className="p-3.5">Clock Out</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">GPS Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    No attendance records found for the selected date
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const inTime = log.checkIn || log.clockIn || '-';
                  const outTime = log.checkOut || log.clockOut || '-';
                  const loc = log.locationName || log.location || '-';

                  return (
                    <tr key={log.id || `${log.employeeId}-${log.dateIso}`} className="hover:bg-[#1A1D2C]/60 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{log.employeeName || '-'}</div>
                        <div className="text-[10px] font-mono text-red-400">{log.employeeCode || log.employeeId || '-'}</div>
                      </td>
                      <td className="p-3.5 font-medium">{log.department || '-'}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">{inTime}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-300">{outTime}</td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {statusLabels(log).map((label) => (
                            <span
                              key={label}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border whitespace-nowrap ${
                                label === 'On Time'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                                  : label === 'Late'
                                  ? 'bg-red-950/80 text-[#EF4444] border-red-800/50'
                                  : 'bg-amber-950/80 text-amber-400 border-amber-800/50'
                              }`}
                            >
                              {`● ${label}`}
                            </span>
                          ))}
                        </div>
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
