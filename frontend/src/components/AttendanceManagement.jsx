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

// The working-time rules HR sets in Work Time Settings (these defaults are used until they load)
const DEFAULT_RULES = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 0 };

const toSeconds = (t) => {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
};

// Status is only On Time or Late. A record is Late when its stored status says so; any other status
// (e.g. an older auto-closed row) is decided by the clock-in time against the work start time
const isLateLog = (log, rules = DEFAULT_RULES) => {
  if (log.role === 'SuperBoss') return false; // SuperBoss may clock in at any time
  const st = String(log.status || '');
  if (st === 'Late' || st === 'สาย' || st.includes('เข้างานสาย')) return true;
  if (st === 'On Time' || st === 'ปกติ') return false;
  const t = toSeconds(log.checkIn || log.clockIn);
  return t !== null && t > toSeconds(rules.lateAfterTime);
};

// Status order: 1) Late (checked first) 2) otherwise Incomplete Hours (clocked out after working fewer than the
// required hours, counted from the count-from time when the employee came earlier) 3) otherwise On Time.
// Someone still working (no clock-out yet) is never Incomplete Hours.
const isIncompleteHoursLog = (log, rules = DEFAULT_RULES) => {
  if (log.role === 'SuperBoss') return false; // ...and to work any number of hours
  if (isLateLog(log, rules)) return false; // a late check-in stays "Late" whatever the hours are
  const start = toSeconds(log.checkIn || log.clockIn);
  const end = toSeconds(log.checkOut || log.clockOut);
  if (start === null || end === null) return false;
  return end - Math.max(start, toSeconds(rules.workStartTime)) < rules.requiredHours * 3600;
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
  const [rules, setRules] = useState(DEFAULT_RULES);

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

  // the working-time rules (start time, required hours) HR set in Work Time Settings
  useEffect(() => {
    fetch(`${API_BASE}/settings/work-time`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j && j.success && j.rules) setRules(j.rules); })
      .catch(() => { /* keep the defaults */ });
  }, []);

  const filteredLogs = attendanceLogs.filter((log) => {
    const matchSearch =
      (log.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.employeeCode || log.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ON_TIME' && !isLateLog(log, rules) && !isIncompleteHoursLog(log, rules)) ||
      (statusFilter === 'LATE' && isLateLog(log, rules)) ||
      (statusFilter === 'INCOMPLETE' && isIncompleteHoursLog(log, rules));

    return matchSearch && matchStatus;
  });

  // One status per record: Late, else Incomplete Hours, else On Time
  const statusLabels = (log) => [isLateLog(log, rules) ? 'Late' : isIncompleteHoursLog(log, rules) ? 'Incomplete Hours' : 'On Time'];

  // first / last name from the report, or split the full name when an older response has only that
  const nameParts = (log) => {
    const full = String(log.employeeName || log.name || '').trim();
    return {
      first: log.firstName || full.split(/\s+/)[0] || '-',
      last: log.lastName !== undefined ? log.lastName || '-' : full.split(/\s+/).slice(1).join(' ') || '-',
    };
  };

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      triggerNotification('No data available to export', 'error');
      return;
    }
    const headers = ['No.', 'ID', 'First Name', 'Last Name', 'Department', 'Clock In', 'Clock Out', 'Status', 'GPS Clock In', 'GPS Clock Out'];
    const rows = filteredLogs.map((item, index) => [
      index + 1,
      item.employeeCode || item.employeeId || '-',
      `"${nameParts(item).first}"`,
      `"${nameParts(item).last}"`,
      `"${item.department || '-'}"`,
      item.checkIn || item.clockIn || '-',
      item.checkOut || item.clockOut || '-',
      statusLabels(item).join(' + '),
      `"${item.locationName || item.location || '-'}"`,
      `"${item.checkOutLocationName || '-'}"`
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

  const lateCount = attendanceLogs.filter((l) => isLateLog(l, rules)).length;
  const incompleteCount = attendanceLogs.filter((l) => isIncompleteHoursLog(l, rules)).length;
  const onTimeCount = attendanceLogs.length - lateCount - incompleteCount;

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
      {/* Toast Notification Popup */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-bounce ${
            typeof notification === 'object' && notification?.type === 'error'
              ? 'bg-danger-50 border border-danger-200 text-danger-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
          }`}
        >
          {typeof notification === 'object' && notification?.type === 'error' ? (
            <AlertTriangle size={20} className="text-danger-600" />
          ) : (
            <CheckCircle size={20} className="text-emerald-600" />
          )}
          <span>{typeof notification === 'object' ? notification.msg : notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200">
            <Clock size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Attendance Management
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
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Work Shift Policy Rule Banner */}
      

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">On Time</p>
            <h3 className="text-2xl font-black text-emerald-600 font-mono">{onTimeCount} staff</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-100 text-violet-700 border border-violet-200">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Late (After {rules.lateAfterTime})</p>
            <h3 className="text-2xl font-black text-violet-700 font-mono">{lateCount} staff</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Incomplete Hours (under 9 hrs)</p>
            <h3 className="text-2xl font-black text-amber-600 font-mono">{incompleteCount} staff</h3>
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

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-violet-700" />
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
              Attendance Records ({filteredLogs.length})
            </h3>
          </div>

        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">First Name</th>
                <th className="p-3.5">Last Name</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Clock In</th>
                <th className="p-3.5">Clock Out</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">GPS Clock In</th>
                <th className="p-3.5">GPS Clock Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500">
                    No attendance records found for the selected date
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const inTime = log.checkIn || log.clockIn || '-';
                  const outTime = log.checkOut || log.clockOut || '-';
                  const loc = log.locationName || log.location || '-';
                  // an open shift (not clocked out yet) or a record from before clock-out positions were saved has none
                  const outLoc = log.checkOutLocationName || '-';

                  return (
                    <tr key={log.id || `${log.employeeId}-${log.dateIso}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono text-xs font-bold text-violet-600 whitespace-nowrap">{log.employeeCode || log.employeeId || '-'}</td>
                      <td className="p-3.5 font-bold text-slate-900">{nameParts(log).first}</td>
                      <td className="p-3.5 font-bold text-slate-900">{nameParts(log).last}</td>
                      <td className="p-3.5 font-medium">{log.department || '-'}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-600">{inTime}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{outTime}</td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {statusLabels(log).map((label) => (
                            <span
                              key={label}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border whitespace-nowrap ${
                                label === 'On Time'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : label === 'Late'
                                  ? 'bg-danger-50 text-danger-600 border-danger-200'
                                  : 'bg-amber-50 text-amber-600 border-amber-200'
                              }`}
                            >
                              {`● ${label}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-sky-600 shrink-0" />
                          <span className="truncate max-w-[200px]">{loc}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-violet-600 shrink-0" />
                          <span className="truncate max-w-[200px]" data-testid="gps-clock-out">{outLoc}</span>
                        </div>
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
