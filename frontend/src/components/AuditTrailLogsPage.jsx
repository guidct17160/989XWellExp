import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, Search, Filter, RefreshCw, Clock, FileSpreadsheet, Download, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function AuditTrailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('wellx989_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Fallback for dev mode
        headers['x-employee-id'] = 'ADM-001';
      }

      const res = await fetch(`${API_BASE}/audit-logs?limit=100`, { headers });
      const json = await res.json();
      if (json.success && (json.data || json.logs)) {
        setLogs(json.data || json.logs || []);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const actorStr = `${log.actorName || ''} ${log.actorId || ''} ${log.actorRole || ''}`.toLowerCase();
    const actionStr = String(log.action || '').toLowerCase();
    const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
    const resourceStr = `${log.resourceType || ''} ${log.resourceId || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchSearch =
      !searchTerm ||
      actorStr.includes(search) ||
      actionStr.includes(search) ||
      detailsStr.toLowerCase().includes(search) ||
      resourceStr.includes(search);

    const matchFilter = filterAction === 'ALL' || log.action === filterAction;
    return matchSearch && matchFilter;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['ลำดับ', 'วัน-เวลา (Timestamp)', 'ผู้ดำเนินการ (Actor)', 'ตำแหน่ง (Role)', 'การกระทำ (Action)', 'เป้าหมาย (Resource)', 'รหัสเป้าหมาย (Resource ID)', 'รายละเอียด (Details)', 'IP Address'];
    const rows = filteredLogs.map((item, index) => [
      index + 1,
      `"${item.createdAt || item.timestamp || '-'}"`,
      `"${item.actorName || item.actorId || 'System'}"`,
      `"${item.actorRole || '-'}"`,
      `"${item.action || '-'}"`,
      `"${item.resourceType || '-'}"`,
      `"${item.resourceId || '-'}"`,
      `"${typeof item.details === 'object' ? JSON.stringify(item.details).replace(/"/g, '""') : String(item.details || '-').replace(/"/g, '""')}"`,
      `"${item.ipAddress || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PDPA_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'ADMIN_LOGIN':
      case 'LOGIN':
        return 'bg-blue-950 text-blue-400 border-blue-800/50';
      case 'CREATE':
      case 'EMPLOYEE_CREATE':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800/50';
      case 'UPDATE':
      case 'EMPLOYEE_UPDATE':
      case 'APPROVE':
        return 'bg-amber-950 text-amber-400 border-amber-800/50';
      case 'DELETE':
      case 'EMPLOYEE_DELETE':
      case 'REJECT':
        return 'bg-red-950 text-red-400 border-red-800/50';
      default:
        return 'bg-purple-950 text-purple-400 border-purple-800/50';
    }
  };

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
                AUDIT & COMPLIANCE
              </span>
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Enterprise Audit Trail & PDPA Logs (ศูนย์บันทึกประวัติความปลอดภัย)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              เก็บบันทึกประวัติการเข้าสู่ระบบ การอนุมัติ และการแก้ไขข้อมูลพนักงานตามมาตรฐาน PDPA / ISO 27001 (Real DB Sync)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/50 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="ดาวน์โหลดรายงาน Audit Trail สำหรับการตรวจสอบ PDPA / ISO"
          >
            <FileSpreadsheet size={16} />
            <span>ส่งออก CSV (PDPA Report)</span>
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#141722] rounded-2xl p-4 border border-red-900/30 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Actor, IP, Action หรือรายละเอียด..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-xs font-medium text-white outline-none focus:border-[#EF4444] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter size={14} /> ตัวกรอง:
          </span>
          {['ALL', 'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'].map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                filterAction === action
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40 border border-red-500'
                  : 'bg-[#0B0D13] text-slate-400 hover:text-white border border-red-900/30'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0D13] text-slate-400 font-mono uppercase border-b border-red-900/30">
              <tr>
                <th className="py-3 px-4">วัน-เวลา (Timestamp)</th>
                <th className="py-3 px-4">ผู้ดำเนินการ (Actor)</th>
                <th className="py-3 px-4">การกระทำ (Action)</th>
                <th className="py-3 px-4">เป้าหมาย (Resource)</th>
                <th className="py-3 px-4">รายละเอียด (Audit Details)</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-red-500" />
                      <span>กำลังดึงข้อมูล Audit Trail จาก PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={24} className="text-slate-600" />
                      <span>ไม่พบประวัติการทำรายการที่ตรงกับเงื่อนไขการค้นหา</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const detailsText = typeof log.details === 'object'
                    ? JSON.stringify(log.details, null, 2)
                    : String(log.details || '-');

                  return (
                    <tr key={log.id} className="hover:bg-red-950/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{log.actorName || log.actorId || 'System'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {log.actorId} • Role: {log.actorRole || 'Unknown'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {log.resourceType ? (
                          <span>
                            <span className="text-slate-400">{log.resourceType}:</span> {log.resourceId || 'ALL'}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-400 font-mono" title={detailsText}>
                        {detailsText}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {log.ipAddress || '127.0.0.1'}
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
