import React, { useState, useEffect } from 'react';
import { Clock, Hourglass, Award, AlarmClock, Timer, RefreshCw, CheckCircle, Save, RotateCcw } from 'lucide-react';

import { API_BASE } from '../config';
import TimePicker from './TimePicker';

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200 transition-all';
const LABEL = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1';

const DEFAULT_FORM = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: '9', onTimePoints: '0' };

const toSec = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
};

export default function WorkTimeSettingsPage() {
  const [saved, setSaved] = useState(null); // the rules stored on the server
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fromRules = (r) => ({
    workStartTime: r.workStartTime,
    lateAfterTime: r.lateAfterTime,
    requiredHours: String(r.requiredHours),
    onTimePoints: String(r.onTimePoints),
  });

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/settings/work-time`);
      const json = await res.json();
      if (res.ok && json.success && json.rules) {
        setSaved(json.rules);
        setForm(fromRules(json.rules));
      } else {
        setLoadError(json.message || 'Unable to load the work time settings');
      }
    } catch (err) {
      console.error('Failed to load work time settings', err);
      setLoadError('Unable to connect to the server to load the work time settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    if (toSec(form.workStartTime) === null) return 'Work start time is required';
    if (toSec(form.lateAfterTime) === null) return 'Late time is required';
    if (toSec(form.workStartTime) > toSec(form.lateAfterTime)) return 'Work start time cannot be later than the late time';
    const h = Number(form.requiredHours);
    if (!Number.isFinite(h) || h < 1 || h > 16 || Math.round(h * 2) !== h * 2) return 'Required work hours must be between 1 and 16 (steps of 0.5)';
    const p = Number(form.onTimePoints);
    if (!Number.isInteger(p) || p < 0 || p > 100000) return 'On-time points must be a whole number from 0 to 100,000';
    return '';
  };
  const problem = validate();
  const dirty = saved && JSON.stringify(form) !== JSON.stringify(fromRules(saved));

  const save = async () => {
    if (problem) return notify(problem, 'error');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings/work-time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workStartTime: form.workStartTime,
          lateAfterTime: form.lateAfterTime,
          requiredHours: Number(form.requiredHours),
          onTimePoints: Number(form.onTimePoints),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSaved(json.rules);
        setForm(fromRules(json.rules));
        notify('Work time settings saved');
      } else {
        notify(json.message || 'Failed to save the settings', 'error');
      }
    } catch (err) {
      console.error('Failed to save work time settings', err);
      notify('Unable to connect to the server to save the settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans animate-in fade-in duration-200">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[60] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 border ${
            notification.type === 'error' ? 'bg-danger-50 border-danger-200 text-danger-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <CheckCircle size={18} className={notification.type === 'error' ? 'text-danger-600' : 'text-emerald-600'} />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200">
            <Timer size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">Work Time Settings</h1>
            
          </div>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 text-slate-700 transition-colors self-start md:self-auto cursor-pointer"
          title="Reload"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 font-mono">Loading...</div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-danger-200 p-10 text-center text-danger-700">{loadError}</div>
      ) : (
        <>
          {/* Current values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[
              { label: 'Work starts at', value: saved.workStartTime, Icon: Clock, box: 'bg-sky-50 text-sky-600 border-sky-200', text: 'text-sky-600' },
              { label: 'Late after', value: saved.lateAfterTime, Icon: AlarmClock, box: 'bg-danger-50 text-danger-600 border-danger-200', text: 'text-danger-600' },
              { label: 'Full day (hours)', value: `${saved.requiredHours} h`, Icon: Hourglass, box: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-emerald-600' },
              { label: 'On-time + full hours points', value: saved.onTimePoints > 0 ? `${saved.onTimePoints} PTS` : 'Off', Icon: Award, box: 'bg-amber-50 text-amber-600 border-amber-200', text: 'text-amber-600' },
            ].map(({ label, value, Icon, box, text }) => (
              <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${box}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                  <h3 className={`text-2xl font-black font-mono ${text}`}>{value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="w-full">
            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>Work start time <span className="text-danger-600">*</span></label>
                  <TimePicker name="workStartTime" value={form.workStartTime} onChange={(e) => set({ workStartTime: e.target.value })} placement="bottom" />
                </div>
                <div>
                  <label className={LABEL}>Late time (check-in after this is late) <span className="text-danger-600">*</span></label>
                  <TimePicker name="lateAfterTime" value={form.lateAfterTime} onChange={(e) => set({ lateAfterTime: e.target.value })} placement="bottom" />
                </div>
                <div>
                  <label className={LABEL}>Full day (work hours) <span className="text-danger-600">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    step="0.5"
                    className={INPUT}
                    value={form.requiredHours}
                    onChange={(e) => set({ requiredHours: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Points for on time + full hours</label>
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    className={INPUT}
                    value={form.onTimePoints}
                    onChange={(e) => set({ onTimePoints: e.target.value })}
                  />
                </div>
              </div>

              {problem && dirty && <p className="text-xs font-bold text-danger-600">{problem}</p>}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setForm(fromRules(saved))}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wide cursor-pointer"
                >
                  <RotateCcw size={14} /> Undo changes
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || !!problem || saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-violet-600/30 uppercase tracking-wide cursor-pointer"
                >
                  <Save size={14} /> {saving ? 'Saving...' : 'Save settings'}
                </button>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
