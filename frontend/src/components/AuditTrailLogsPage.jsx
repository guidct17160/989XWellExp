import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, Search, Filter, RefreshCw, Clock, FileSpreadsheet, Download, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';

export default function AuditTrailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('wellx989_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/audit-logs?limit=500`, { headers });
      const json = await res.json();
      if (res.ok && json.success && (json.data || json.logs)) {
        setLogs(json.data || json.logs || []);
        setLoadError('');
      } else {
        setLogs([]);
        setLoadError(json.message || 'Unable to load audit logs');
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      setLogs([]);
      setLoadError('Unable to connect to the server to load audit logs');
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

    // Backend actions are compound codes (LOGIN_SUCCESS, CREATE_EMPLOYEE, DELETE_ADMIN, APPROVE_REQUEST...), so match by keyword
    const matchFilter = filterAction === 'ALL' || String(log.action || '').toUpperCase().includes(filterAction);
    return matchSearch && matchFilter;
  });

  // Reset to first page when search or filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAction]);

  // Pagination calculations
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['No.', 'Timestamp', 'Actor', 'Role', 'Action', 'Resource', 'Resource ID', 'Details', 'IP Address'];
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
    const a = String(action || '').toUpperCase();
    if (a.includes('FAILED') || a.includes('DELETE') || a.includes('REJECT')) {
      return 'bg-red-950 text-red-400 border-red-800/50';
    }
    if (a.includes('LOGIN')) {
      return 'bg-blue-950 text-blue-400 border-blue-800/50';
    }
    if (a.includes('CREATE')) {
      return 'bg-emerald-950 text-emerald-400 border-emerald-800/50';
    }
    if (a.includes('UPDATE') || a.includes('APPROVE') || a.includes('RESIGN')) {
      return 'bg-amber-950 text-amber-400 border-amber-800/50';
    }
    return 'bg-purple-950 text-purple-400 border-purple-800/50';
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
              
              <h1 className="text-xl font-black text-white uppercase tracking-wide">
                Enterprise Audit Trail & PDPA Logs (Security Activity Center)
              </h1>
            </div>
            
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/50 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download the audit trail report for PDPA / ISO review"
          >
            <FileSpreadsheet size={16} />
            <span>Export</span>
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-950/60 hover:bg-red-900/60 border border-red-800/50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search actor, IP, action or details..."
        filters={[
          {
            label: 'Action',
            value: filterAction,
            onChange: setFilterAction,
            options: ['ALL', 'LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'].map((a) => ({
              value: a,
              label: a === 'ALL' ? 'All' : a,
            })),
          },
        ]}
      />

      {/* Logs Table */}
      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0D13] text-slate-400 font-mono uppercase border-b border-red-900/30">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Audit Details</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500 font-mono">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-red-500" />
                      <span>Loading audit trail from PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={24} className="text-slate-600" />
                      <span>{loadError || 'No audit records match your search'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
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

        {/* Pagination Bar */}
        {!loading && filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-red-900/30 text-xs">
            <div className="text-slate-400 font-mono">
              Showing <span className="font-bold text-white">{startIndex + 1}</span> - <span className="font-bold text-white">{Math.min(startIndex + pageSize, totalItems)}</span> of <span className="font-bold text-[#EF4444]">{totalItems}</span> records (page {currentPage} / {totalPages})
            </div>

            <div className="flex items-center gap-1.5">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-slate-300 hover:text-white hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="First page"
              >
                <ChevronsLeft size={16} />
              </button>

              {/* Prev Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-slate-300 hover:text-white hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold"
                title="Previous page"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-bold transition-all text-xs font-mono flex items-center justify-center ${
                      currentPage === pageNum
                        ? 'bg-[#DC2626] text-white shadow-lg shadow-red-600/30 border border-red-500 scale-105'
                        : 'bg-[#0B0D13] text-slate-400 hover:text-white border border-red-900/40 hover:bg-red-950/40'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-slate-300 hover:text-white hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold"
                title="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={16} />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-[#0B0D13] border border-red-900/40 text-slate-300 hover:text-white hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Last page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
