import React, { useState, useEffect } from 'react';
import { Gift, RefreshCw, History, TrendingUp, TrendingDown, ArrowLeft, ListOrdered, Wallet } from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import useDetailRoute from './useDetailRoute';

const getHeaders = () => {
  const token = localStorage.getItem('wellx989_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// A spend is stored as a negative amount with type 'spend'; everything else adds points
const isOut = (tx) => tx.type === 'spend' || Number(tx.points) < 0;

// Full page with every point transaction of one employee (/points/<employee code>)
function EmployeeHistory({ employee, loadingEmployees, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ currentPoints: 0, history: [] });
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const empId = employee ? employee.id || employee.code : null;

  const load = async () => {
    if (!empId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/points/history?employeeId=${encodeURIComponent(empId)}`, { headers: getHeaders() });
      const json = await res.json();
      if (res.ok && json.success) {
        setData({ currentPoints: json.currentPoints ?? employee.points ?? 0, history: json.history || [] });
      } else {
        setData({ currentPoints: employee.points || 0, history: [] });
        setError(json.message || 'Unable to load points history');
      }
    } catch (e) {
      setData({ currentPoints: employee.points || 0, history: [] });
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId]);

  if (!employee) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        {loadingEmployees ? 'Loading...' : 'Employee not found.'}{' '}
        {!loadingEmployees && <button onClick={onBack} className="underline text-white cursor-pointer">Back to the list</button>}
      </div>
    );
  }

  const incoming = data.history.filter((tx) => !isOut(tx));
  const outgoing = data.history.filter(isOut);
  const sum = (list) => list.reduce((n, tx) => n + Math.abs(Number(tx.points) || 0), 0);

  const term = search.trim().toLowerCase();
  const visible = data.history.filter((tx) => {
    if (typeFilter === 'IN' && isOut(tx)) return false;
    if (typeFilter === 'OUT' && !isOut(tx)) return false;
    if (!term) return true;
    return [tx.title, tx.category].some((v) => v && String(v).toLowerCase().includes(term));
  });

  const cards = [
    { label: 'Current points balance', value: `${(data.currentPoints || 0).toLocaleString()} PTS`, Icon: Wallet, box: 'bg-amber-50 text-amber-600 border-amber-200', text: 'text-amber-600' },
    { label: 'All transactions', value: `${data.history.length} items`, Icon: ListOrdered, box: 'bg-sky-50 text-sky-600 border-sky-200', text: 'text-sky-600' },
    { label: 'Points in (earned)', value: `${incoming.length} items`, sub: `+${sum(incoming).toLocaleString()} PTS`, Icon: TrendingUp, box: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-emerald-600' },
    { label: 'Points out (spent)', value: `${outgoing.length} items`, sub: `-${sum(outgoing).toLocaleString()} PTS`, Icon: TrendingDown, box: 'bg-violet-100 text-violet-600 border-violet-200', text: 'text-violet-600' },
  ];

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200" data-testid="points-detail">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <button onClick={onBack} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 cursor-pointer" title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">{employee.code || employee.id}</span>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">{employee.name}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Points history · Dept. {employee.department || '-'}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-100 hover:bg-violet-100 border border-violet-200 text-slate-900 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map(({ label, value, sub, Icon, box, text }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${box}`}>
              <Icon size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <h3 className={`text-2xl font-black font-mono ${text}`}>{value}</h3>
              {sub && <p className={`text-xs font-mono font-bold ${text}`}>{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search transaction or category..."
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: 'ALL', label: `All (${data.history.length})` },
              { value: 'IN', label: `In (${incoming.length})` },
              { value: 'OUT', label: `Out (${outgoing.length})` },
            ],
          },
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                <th className="py-3.5 px-4 w-full">Transaction</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Type</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500 font-mono">Loading history from PostgreSQL...</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    {error || (data.history.length === 0 ? 'No points transactions yet' : 'No transactions match the filters')}
                  </td>
                </tr>
              ) : (
                visible.map((tx) => {
                  const out = isOut(tx);
                  return (
                    <tr key={tx.id} className="hover:bg-violet-50 transition-colors">
                      <td className="py-3 px-4 align-middle whitespace-nowrap font-mono text-xs text-slate-500">{tx.date}</td>
                      <td className="py-3 px-4 align-middle font-bold text-slate-900">{tx.title}</td>
                      <td className="py-3 px-4 align-middle whitespace-nowrap text-xs text-slate-500">{tx.category || '-'}</td>
                      <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            out ? 'bg-danger-50 text-danger-700 border-danger-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {out ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {out ? 'Out' : 'In'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 align-middle text-right whitespace-nowrap font-mono font-black ${out ? 'text-violet-600' : 'text-emerald-600'}`}>
                        {out ? '-' : '+'}{Math.abs(Number(tx.points) || 0).toLocaleString()} PTS
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

export default function PointsHistoryPage() {
  const detailRoute = useDetailRoute('points');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchPointsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees`, { headers: getHeaders() });
      const json = await res.json();
      if (res.ok && json.success && json.employees) {
        setEmployees(json.employees);
        setLoadError('');
      } else {
        setEmployees([]);
        setLoadError(json.message || 'Unable to load employee data');
      }
    } catch (e) {
      console.error('Failed to fetch points data:', e);
      setEmployees([]);
      setLoadError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPointsData();
  }, []);

  // The URL carries the readable employee code (/points/EMP-002); the internal id is accepted too
  const routeKey = (emp) => emp.code || emp.id;
  const sameKey = (emp, key) => String(emp.code || '').toLowerCase() === String(key).toLowerCase() || emp.id === key;

  const departmentOptions = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  const filtered = employees.filter(
    (emp) =>
      (!searchTerm ||
        (emp.name && emp.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (emp.code && emp.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))) &&
      (!deptFilter || emp.department === deptFilter)
  );

  if (detailRoute.detailId) {
    const employee = employees.find((e) => sameKey(e, detailRoute.detailId)) || null;
    return (
      <EmployeeHistory
        key={detailRoute.detailId}
        employee={employee}
        loadingEmployees={loading}
        onBack={detailRoute.close}
      />
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200">
            <Gift size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Points Balance & History
              </h1>
            </div>
          </div>
        </div>

        <button
          onClick={fetchPointsData}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-100 hover:bg-violet-100 border border-violet-200 text-slate-900 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter */}
      <FilterBar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Search ID, name, department..."
        filters={[
          {
            label: 'Department',
            value: deptFilter,
            onChange: setDeptFilter,
            options: [{ value: '', label: 'All' }, ...departmentOptions.map((d) => ({ value: d, label: d }))],
          },
        ]}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-mono uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-right">Points Balance</th>
                <th className="py-3 px-4 text-center">Points History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-mono">
                    Loading points data from PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    {loadError || 'No employee data yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-violet-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-violet-600">{emp.code || emp.id}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{emp.name}</td>
                    <td className="py-3 px-4 text-slate-500">{emp.department || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-600 text-sm">
                      {(emp.points || 0).toLocaleString()} PTS
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => detailRoute.open(routeKey(emp))}
                        className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 border border-violet-200 text-slate-900 font-bold rounded-lg shadow transition-all cursor-pointer text-xs inline-flex items-center gap-1.5"
                      >
                        <History size={13} />
                        <span>View History</span>
                      </button>
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
