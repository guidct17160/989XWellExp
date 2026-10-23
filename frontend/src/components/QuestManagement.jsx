import React, { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Trash2, RefreshCw, Edit, HelpCircle, AlertTriangle, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import { API_BASE } from '../config';
import FilterBar from './FilterBar';
import useDetailRoute from './useDetailRoute';
import QuestWizard from './QuestWizard';

const STATUS_STYLE = {
  Active: 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70',
  Scheduled: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
  Expired: 'bg-slate-900 text-slate-400 border-slate-700',
};

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap" title={`${done} of ${total} employees completed`}>
      <div className="h-2.5 w-20 rounded-full bg-slate-700/40 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-semibold ${complete ? 'text-emerald-300' : 'text-indigo-300'}`}>
        {complete ? 'Completed' : 'Incomplete'} {done}/{total}
      </span>
    </div>
  );
}

export default function QuestManagement() {
  const detailRoute = useDetailRoute('mission');
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchQuests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/quests`);
      const json = await res.json();
      if (res.ok && json.success) {
        setQuests(json.quests || []);
      } else {
        setQuests([]);
        notify(json.message || 'Unable to load quests', 'error');
      }
    } catch (e) {
      setQuests([]);
      notify('Unable to connect to the server to load quests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, []);

  const creators = useMemo(
    () => [...new Set(quests.map((q) => q.createdByName).filter(Boolean))].sort(),
    [quests]
  );

  const term = search.trim().toLowerCase();
  // click a sortable column header to sort; click again to reverse
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' });
  const toggleSort = (key) => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortValue = (q) => {
    if (sort.key === 'title') return String(q.title || '').toLowerCase();
    if (sort.key === 'start') return `${q.startDate} ${q.startTime}`;
    if (sort.key === 'end') return `${q.endDate} ${q.endTime}`;
    return `${q.createdDate || ''} ${q.createdTime || ''}`;
  };

  const filtered = quests.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (creatorFilter && q.createdByName !== creatorFilter) return false;
    if (!term) return true;
    return [q.code, q.id, q.title, q.description].some((v) => v && String(v).toLowerCase().includes(term));
  }).sort((a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
  });

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`${API_BASE}/quests/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(`Quest "${target.title}" deleted`);
        fetchQuests();
      } else {
        notify(json.message || 'Unable to delete the quest', 'error');
      }
    } catch (e) {
      notify('Unable to connect to the server to delete the quest', 'error');
    }
  };

  const toast = notification && (
    <div
      className={`fixed top-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold border ${
        notification.type === 'error'
          ? 'bg-red-950/95 text-red-200 border-red-700/60'
          : 'bg-emerald-950/95 text-emerald-200 border-emerald-700/60'
      }`}
    >
      {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
      {notification.message}
    </div>
  );

  // Create / edit lives on its own URL: /missions/new  or  /missions/<quest code>
  if (detailRoute.detailId) {
    // the URL carries the quest code (/missions/SAFETY-01); the wizard loads the quest by its internal id
    const key = detailRoute.detailId;
    const opened = key === 'new' ? null : quests.find((q) => String(q.code || '').toLowerCase() === key.toLowerCase() || q.id === key);
    if (key !== 'new' && loading) {
      return (
        <div className="flex flex-col gap-6">
          {toast}
          <div className="bg-[#141722] rounded-2xl border border-red-900/30 p-8 text-center text-slate-500 font-mono">Loading...</div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        {toast}
        <QuestWizard
          key={key}
          questId={opened ? opened.id : key}
          notify={notify}
          onClose={detailRoute.close}
          onSaved={() => {
            detailRoute.close();
            fetchQuests();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {toast}

      <div className="bg-[#141722] rounded-2xl p-6 border border-red-900/30 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-950/80 text-[#EF4444] border border-red-800/40">
            <Target size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">Quest Management</h1>
            <p className="text-xs text-slate-400 mt-0.5">{quests.length} Total</p>
          </div>
        </div>
        <button
          onClick={fetchQuests}
          className="p-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] hover:bg-red-950/40 text-slate-300 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search by code or quest name..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All' },
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Active', label: 'Active' },
              { value: 'Expired', label: 'Expired' },
            ],
          },
          {
            label: 'Created by',
            value: creatorFilter,
            onChange: setCreatorFilter,
            options: [{ value: '', label: 'All' }, ...creators.map((c) => ({ value: c, label: c }))],
          },
        ]}
        right={
          <button
            onClick={() => detailRoute.open('new')}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 transition-all uppercase tracking-wide whitespace-nowrap md:ml-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Create New Quest</span>
          </button>
        }
      />

      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B0D13] border-b border-red-900/30 text-[11px] text-slate-400 whitespace-nowrap">
                <th className="py-3 px-2.5 uppercase font-extrabold tracking-wider">Code</th>
                <th className="py-3 px-2.5 w-full">
                  <button type="button" onClick={() => toggleSort('title')} className="inline-flex items-center gap-1 text-left uppercase font-extrabold tracking-wider hover:text-white cursor-pointer">
                    Task List
                    {sort.key === 'title' ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
                  </button>
                </th>
                <th className="py-3 px-2.5 text-center uppercase font-extrabold tracking-wider whitespace-nowrap">Sections</th>
                <th className="py-3 px-2.5 uppercase font-extrabold tracking-wider">Status</th>
                <th className="py-3 px-2.5 uppercase font-extrabold tracking-wider">Approved</th>
                <th className="py-3 px-2.5 text-right uppercase font-extrabold tracking-wider">Point</th>
                <th className="py-3 px-2.5 uppercase font-extrabold tracking-wider">Create By</th>
                <th className="py-3 px-2.5 ">
                  <button type="button" onClick={() => toggleSort('created')} className="inline-flex items-center gap-1 text-left uppercase font-extrabold tracking-wider hover:text-white cursor-pointer">
                    Create Date
                    {sort.key === 'created' ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
                  </button>
                </th>
                <th className="py-3 px-2.5 ">
                  <button type="button" onClick={() => toggleSort('start')} className="inline-flex items-center gap-1 text-left uppercase font-extrabold tracking-wider hover:text-white cursor-pointer">
                    Start Date
                    {sort.key === 'start' ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
                  </button>
                </th>
                <th className="py-3 px-2.5 ">
                  <button type="button" onClick={() => toggleSort('end')} className="inline-flex items-center gap-1 text-left uppercase font-extrabold tracking-wider hover:text-white cursor-pointer">
                    Expire Date
                    {sort.key === 'end' ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-60" />}
                  </button>
                </th>
                <th className="py-3 px-2.5 text-center uppercase font-extrabold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20 text-sm font-medium text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500 font-mono">Loading quests...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500 font-mono">
                    {quests.length === 0 ? 'No quests yet. Click "Create New Quest" to add one.' : 'No quests match the filters'}
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-red-950/20 transition-colors align-middle">
                    <td className="py-4 px-2.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-red-300 bg-red-950/60 border border-red-800/40 px-2 py-1 rounded-lg">{q.code || q.id}</span>
                    </td>
                    <td className="py-4 px-2.5 min-w-[10rem]">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button onClick={() => detailRoute.open(q.code || q.id)} className="font-bold text-white hover:text-[#EF4444] text-left cursor-pointer max-w-[10rem] truncate" title={q.id}>
                          {q.title}
                        </button>
                        {q.rewardTitle && (
                          <span className="inline-flex items-center gap-1 max-w-[8rem] truncate px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-950/70 text-violet-300 border border-violet-700/50" title={`Free reward: ${q.rewardTitle}`}>
                            🎁 {q.rewardTitle}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-2.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-slate-200" title={`${q.sectionCount} quiz section(s), ${q.questionCount} questions, pass ${q.passCount > 0 ? q.passCount : q.questionCount}`}>
                        <HelpCircle size={18} className="text-slate-400" />
                        <span className="font-bold">{q.sectionCount}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2.5">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLE[q.status] || STATUS_STYLE.Expired}`}>
                          {q.status}
                        </span>
                        <ProgressBar done={q.completedCount} total={q.assignedCount} />
                      </div>
                    </td>
                    <td className="py-4 px-2.5 whitespace-nowrap text-[11px] font-bold text-emerald-300">Auto approve</td>
                    <td className="py-4 px-2.5 text-right whitespace-nowrap font-mono font-extrabold text-amber-300 text-base">{q.totalPoints}</td>
                    <td className="py-4 px-2.5 text-slate-300 text-[13px] max-w-[7rem] truncate">{q.createdByName || '-'}</td>
                    <td className="py-4 px-2.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">{q.createdDate || '-'} <span className="text-slate-500">{q.createdTime || ''}</span></td>
                    <td className="py-4 px-2.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">{q.startDate || '-'} <span className="text-slate-500">{q.startTime || ''}</span></td>
                    <td className="py-4 px-2.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">{q.endDate || '-'} <span className="text-slate-500">{q.endTime || ''}</span></td>
                    <td className="py-4 px-2.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => detailRoute.open(q.code || q.id)} className="p-1.5 text-slate-400 hover:text-white hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer" title="Edit quest">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(q)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/60 rounded-lg transition-colors cursor-pointer" title="Delete quest">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#141722] border border-red-900/40 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-extrabold text-white uppercase tracking-wide mb-2">Delete quest?</h3>
            <p className="text-sm text-slate-300">
              "{deleteTarget.title}" and all of its quizzes, questions and progress will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs uppercase tracking-wide cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
