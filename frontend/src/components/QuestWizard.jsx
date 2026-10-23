import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Settings,
  ListChecks,
  Trophy,
  FileText,
  ChevronRight,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  X,
  Check,
} from 'lucide-react';

import { API_BASE } from '../config';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

const INPUT =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#0B0D13] border border-red-900/40 text-sm font-medium text-white outline-none focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const LABEL = 'block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1';
const BTN_PRIMARY =
  'px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-lg shadow-red-600/30 uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST =
  'px-5 py-2.5 rounded-xl border border-red-900/40 bg-[#0B0D13] text-slate-300 hover:bg-red-950/40 font-bold text-xs uppercase tracking-wide transition-colors cursor-pointer';

const STEPS = [
  { key: 'settings', label: 'Quest Settings', icon: Settings },
  { key: 'content', label: 'Quest Content', icon: ListChecks },
  { key: 'reward', label: 'Reward', icon: Trophy },
  { key: 'summary', label: 'Summary', icon: FileText },
];

const QUESTION_TYPES = [
  { value: 'single', label: 'Single Choice' },
  { value: 'multi', label: 'Multi Choice' },
];
const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t.label]));

let uidCounter = 0;
const uid = () => `k${(uidCounter += 1)}`;

const blankChoices = () => [
  { key: uid(), text: '', isCorrect: true },
  { key: uid(), text: '', isCorrect: false },
];
const newQuestion = () => ({
  key: uid(), type: 'single', title: '', description: '', imageUrl: '', points: '0', choices: blankChoices(),
});
const newSection = (data) => ({
  key: uid(), title: data.title, description: data.description, timeLimitMinutes: String(data.timeLimitMinutes),
  editType: data.editType, questions: [newQuestion()],
});

const emptyForm = () => ({
  code: '',
  title: '',
  description: '',
  imageUrl: '',
  sendMode: 'now',
  startDate: '',
  startTime: '',
  // new quests default to the current date and time (the end can be changed, but never to the past)
  endDate: localToday(),
  endTime: localNowTime(),
  assignType: 'all',
  members: [],
  rewardPoints: '0',
  passCount: '',
  rewardId: '',
  sections: [],
});

const fromApi = (q) => ({
  code: q.code || '',
  title: q.title,
  description: q.description || '',
  imageUrl: q.imageUrl || '',
  // an existing quest keeps its real schedule; "Send now" only applies to a new quest
  sendMode: 'date',
  startDate: q.startDate,
  startTime: q.startTime,
  endDate: q.endDate,
  endTime: q.endTime,
  assignType: q.assignType,
  members: q.members || [],
  rewardPoints: String(q.rewardPoints ?? 0),
  passCount: q.passCount ? String(q.passCount) : '',
  rewardId: q.rewardId || '',
  sections: (q.sections || []).map((s) => ({
    key: uid(),
    title: s.title,
    description: s.description || '',
    timeLimitMinutes: String(s.timeLimitMinutes ?? 10),
    editType: s.editType || 'can_edit',
    questions: (s.questions || []).map((x) => ({
      key: uid(),
      type: x.type,
      title: x.title,
      description: x.description || '',
      imageUrl: x.imageUrl || '',
      points: String(x.points ?? 0),
      choices: (x.choices || []).map((c) => ({ key: uid(), text: c.text, isCorrect: !!c.isCorrect })),
    })),
  })),
});

const toPayload = (f) => ({
  code: f.code.trim(),
  title: f.title.trim(),
  description: f.description.trim(),
  imageUrl: f.imageUrl.trim(),
  sendMode: f.sendMode,
  startDate: f.startDate,
  startTime: f.startTime,
  endDate: f.endDate,
  endTime: f.endTime,
  assignType: f.assignType,
  memberIds: f.assignType === 'members' ? f.members.map((m) => m.id) : [],
  autoApprove: true,
  rewardPoints: Number(f.rewardPoints) || 0,
  passCount: f.passCount === '' ? undefined : Number(f.passCount),
  rewardId: f.rewardId || null,
  sections: f.sections.map((s) => ({
    type: 'quiz',
    title: s.title.trim(),
    description: s.description.trim(),
    timeLimitMinutes: Number(s.timeLimitMinutes),
    editType: s.editType,
    questions: s.questions.map((q) => ({
      type: q.type,
      title: q.title.trim(),
      description: q.description.trim(),
      imageUrl: q.imageUrl.trim(),
      points: 0, // points are set once for the whole quest, not per question
      choices: q.choices.map((c) => ({ text: c.text.trim(), isCorrect: c.isCorrect })),
    })),
  })),
});

// Local date / time right now, used so an end date cannot be set in the past
const pad2 = (n) => String(n).padStart(2, '0');
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const localNowTime = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Client-side checks mirror the server rules so problems show up on the step where they are fixed
const validateStep = (step, f) => {
  if (step === 0) {
    if (!f.code.trim()) return 'Quest code is required';
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(f.code.trim())) return 'Quest code can only contain letters, numbers, - and _ (up to 30 characters)';
    if (!f.title.trim()) return 'Title is required';
    if (!f.description.trim()) return 'Description is required';
    if (f.sendMode === 'date' && (!f.startDate || !f.startTime)) return 'Start date / time is required';
    if (!f.endDate || !f.endTime) return 'End date / time is required';
    if (f.sendMode === 'date' && `${f.endDate} ${f.endTime}` <= `${f.startDate} ${f.startTime}`) {
      return 'End date / time must be after the start date / time';
    }
    if (`${f.endDate} ${f.endTime}` < `${localToday()} ${localNowTime()}`) return 'End date / time cannot be earlier than the current time';
    if (f.assignType === 'members' && f.members.length === 0) return 'Select at least one employee for "Members"';
  }
  if (step === 1) {
    if (f.sections.length === 0) return 'Add at least one quiz';
    for (let si = 0; si < f.sections.length; si++) {
      const s = f.sections[si];
      if (s.questions.length === 0) return `Section ${si + 1}: add at least one question`;
      for (let qi = 0; qi < s.questions.length; qi++) {
        const q = s.questions[qi];
        const where = `Section ${si + 1}, question ${qi + 1}`;
        if (!q.title.trim()) return `${where}: title is required`;
        if (q.choices.length < 2) return `${where}: add at least 2 choices`;
        if (q.choices.some((c) => !c.text.trim())) return `${where}: every choice needs a text`;
        const correct = q.choices.filter((c) => c.isCorrect).length;
        if (q.type === 'multi' ? correct < 1 : correct !== 1) return `${where}: mark ${q.type === 'multi' ? 'at least one' : 'exactly one'} correct choice`;
      }
    }
  }
  if (step === 2) {
    if (!Number.isInteger(Number(f.rewardPoints)) || Number(f.rewardPoints) < 0) return 'Points must be a whole number (0 or more)';
    const totalQuestions = f.sections.reduce((n, sec) => n + sec.questions.length, 0);
    if (f.passCount !== '' && (!Number.isInteger(Number(f.passCount)) || Number(f.passCount) < 1 || Number(f.passCount) > totalQuestions)) {
      return `Pass score must be a whole number between 1 and ${totalQuestions} (the number of questions)`;
    }
  }
  return '';
};

function Radio({ checked, onChange, label, disabled }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm font-medium text-slate-200 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} className="w-4 h-4 accent-red-500" />
      <span>{label}</span>
    </label>
  );
}

function Stepper({ step, setStep, maxStep }) {
  return (
    <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg px-4 py-4 flex flex-wrap items-center justify-center gap-2 md:gap-4">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const active = i === step;
        const reachable = i <= maxStep;
        return (
          <React.Fragment key={s.key}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => setStep(i)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all ${reachable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                  active ? 'bg-[#DC2626] border-red-400 text-white' : reachable ? 'bg-red-950/60 border-red-700/60 text-red-300' : 'bg-[#0B0D13] border-red-900/40 text-slate-600'
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="text-left">
                <span className={`block text-[10px] font-bold uppercase tracking-wider ${active ? 'text-red-400' : 'text-slate-500'}`}>Step {i + 1}</span>
                <span className={`block text-sm font-extrabold ${active ? 'text-white' : reachable ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && <ChevronRight size={18} className="text-slate-600 hidden sm:block" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- step 1
function SettingsStep({ form, set }) {
  const [employees, setEmployees] = useState([]);
  const [employeesState, setEmployeesState] = useState('idle'); // idle | loading | ready | error
  const [memberSearch, setMemberSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (form.assignType !== 'members' || employeesState !== 'idle') return;
    setEmployeesState('loading');
    fetch(`${API_BASE}/employees`)
      .then((r) => r.json())
      .then((j) => {
        if (j && j.success && Array.isArray(j.employees)) {
          setEmployees(j.employees);
          setEmployeesState('ready');
        } else {
          setEmployeesState('error');
        }
      })
      .catch(() => setEmployeesState('error'));
  }, [form.assignType, employeesState]);

  // close the list when clicking anywhere outside the picker
  useEffect(() => {
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedIds = new Set(form.members.map((m) => m.id));
  const term = memberSearch.trim().toLowerCase();
  // Anyone already chosen is hidden from the list, so nobody can be added twice; resigned staff are not offered
  const available = employees.filter((e) => !selectedIds.has(e.id) && !/^resign/i.test(String(e.status || '')));
  const matches = available.filter(
    (e) => !term || [e.name, e.email].some((v) => v && String(v).toLowerCase().includes(term))
  );

  const addMember = (e) => {
    if (selectedIds.has(e.id)) return;
    set({ members: [...form.members, { id: e.id, code: e.code, name: e.name, email: e.email }] });
    setMemberSearch('');
  };

  const dateChange = (e) => set({ [e.target.name]: e.target.value });

  return (
    <div className="space-y-6">
      <div>
        <label className={LABEL}>Code <span className="text-red-400">*</span></label>
        <input className={`${INPUT} max-w-xs font-mono uppercase`} value={form.code} maxLength={30} placeholder="e.g. SAFETY-01" onChange={(e) => set({ code: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} />
        <p className="text-[11px] text-slate-500 mt-1">Letters, numbers, - and _ only. Each quest needs its own code.</p>
      </div>

      <div>
        <label className={LABEL}>Title <span className="text-red-400">*</span></label>
        <input className={INPUT} value={form.title} maxLength={255} onChange={(e) => set({ title: e.target.value })} />
        <p className="text-[11px] text-slate-500 mt-1">Up to 255 characters ({form.title.length}/255)</p>
      </div>

      <div>
        <label className={LABEL}>Description <span className="text-red-400">*</span></label>
        <textarea className={`${INPUT} h-28`} value={form.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} />
        <p className="text-[11px] text-slate-500 mt-1">Up to 2,000 characters ({form.description.length}/2,000)</p>
      </div>

 

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-6 gap-y-5 pt-2 border-t border-red-900/30">
        <span className={`${LABEL} md:pt-2.5`}>Send Quest</span>
        <div className="flex flex-wrap gap-6 md:pt-2">
          <Radio checked={form.sendMode === 'now'} onChange={() => set({ sendMode: 'now' })} label="Send Now" />
          <Radio checked={form.sendMode === 'date'} onChange={() => set({ sendMode: 'date' })} label="Select Date" />
        </div>

        {form.sendMode === 'date' && (
          <>
            <span className={`${LABEL} md:pt-2.5`}>Start Date / Time <span className="text-red-400">*</span></span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <DatePicker name="startDate" value={form.startDate} onChange={dateChange} placeholder="Select date" />
              <TimePicker name="startTime" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </div>
          </>
        )}

        <span className={`${LABEL} md:pt-2.5`}>End Date / Time <span className="text-red-400">*</span></span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <DatePicker name="endDate" value={form.endDate} onChange={dateChange} placeholder="Select date" minDate={form.sendMode === 'date' && form.startDate > localToday() ? form.startDate : 'today'} />
          <TimePicker name="endTime" value={form.endTime} min={form.endDate === localToday() ? localNowTime() : undefined} onChange={(e) => set({ endTime: e.target.value })} />
        </div>

        <span className={`${LABEL} md:pt-2.5`}>Assign To <span className="text-red-400">*</span></span>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-6 md:pt-2">
            <Radio checked={form.assignType === 'all'} onChange={() => set({ assignType: 'all' })} label="Send to all" />
            <Radio checked={form.assignType === 'new_employee'} onChange={() => set({ assignType: 'new_employee' })} label="Send to new employee" />
            <Radio checked={form.assignType === 'members'} onChange={() => set({ assignType: 'members' })} label="Members" />
          </div>
          {form.assignType === 'new_employee' && (
            <p className="text-[11px] text-slate-500">New employees = active employees whose start date is on or after the quest start date.</p>
          )}
          {form.assignType === 'members' && (
            <div className="max-w-xl space-y-3" ref={pickerRef}>
              <div className="relative">
                <input
                  className={INPUT}
                  placeholder="Click and type a name or email to find employees"
                  value={memberSearch}
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e) => { setMemberSearch(e.target.value); setPickerOpen(true); }}
                />
                {pickerOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-red-900/40 bg-[#0B0D13] shadow-2xl shadow-black/60">
                    {employeesState === 'loading' && <div className="px-3.5 py-3 text-xs text-slate-400">Loading employees...</div>}
                    {employeesState === 'error' && (
                      <div className="px-3.5 py-3 text-xs text-red-300">
                        Unable to load employees.{' '}
                        <button type="button" onClick={() => setEmployeesState('idle')} className="underline cursor-pointer">Try again</button>
                      </div>
                    )}
                    {employeesState === 'ready' && matches.length === 0 && (
                      <div className="px-3.5 py-3 text-xs text-slate-400">
                        {available.length === 0 ? 'Every employee is already selected' : 'No employees match your search'}
                      </div>
                    )}
                    {matches.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => addMember(e)}
                        className="w-full text-left px-3.5 py-2 text-sm text-slate-200 hover:bg-red-950/40 border-b border-red-900/20 last:border-b-0 cursor-pointer flex items-center gap-3"
                      >
                        <span className="font-mono text-xs text-red-400 shrink-0">{e.code}</span>
                        <span className="min-w-0">
                          <span className="block font-bold truncate">{e.name}</span>
                          <span className="block text-[11px] text-slate-500 truncate">{[e.department, e.email].filter(Boolean).join(' • ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {form.members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-700/50 text-xs font-bold text-slate-200">
                    {m.name}
                    <button type="button" onClick={() => set({ members: form.members.filter((x) => x.id !== m.id) })} className="text-red-300 hover:text-white cursor-pointer" title="Remove">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {form.members.length === 0 && <span className="text-xs text-slate-500">No employees selected</span>}
              </div>
              {form.members.length > 0 && <p className="text-[11px] text-slate-500">{form.members.length} employee(s) selected</p>}
            </div>
          )}
        </div>

        <span className={`${LABEL} md:pt-2.5`}>Approval</span>
        <div className="md:pt-2 text-sm text-slate-200">
          <span className="font-bold">Auto Approve</span>
          <span className="block text-[11px] text-slate-500 mt-0.5">An employee who passes the quest on time is approved automatically and receives the points (and the reward, if any).</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- step 2
function QuizModal({ initial, onSave, onClose }) {
  const [data, setData] = useState(
    initial || { title: '', description: '', timeLimitMinutes: '10', editType: 'can_edit' }
  );
  const [error, setError] = useState('');
  const submit = () => {
    if (!data.title.trim()) return setError('Quiz title is required');
    if (!data.description.trim()) return setError('Description is required');
    const mins = Number(data.timeLimitMinutes);
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) return setError('Time limit must be 1 - 600 minutes');
    onSave({ ...data, timeLimitMinutes: mins });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#141722] border border-red-900/40 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-900/30">
          <h3 className="text-base font-extrabold text-white uppercase tracking-wide">{initial ? 'Edit Quiz' : 'Add Quiz'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={LABEL}>Quiz Title <span className="text-red-400">*</span></label>
            <input className={INPUT} value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Description <span className="text-red-400">*</span></label>
            <textarea className={`${INPUT} h-20`} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">Time limit</span>
            <input type="number" min="1" max="600" className={`${INPUT} w-24`} value={data.timeLimitMinutes} onChange={(e) => setData({ ...data, timeLimitMinutes: e.target.value })} />
            <span className="text-sm text-slate-300">minutes</span>
          </div>
          <div>
            <label className={LABEL}>Quiz edit type <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-6">
              <Radio checked={data.editType === 'can_edit'} onChange={() => setData({ ...data, editType: 'can_edit' })} label="Can edit later" />
              <Radio checked={data.editType === 'no_edit'} onChange={() => setData({ ...data, editType: 'no_edit' })} label="No edit allow" />
            </div>
            {data.editType === 'no_edit' && (
              <p className="text-[11px] text-amber-400 mt-1.5">Once the quest has started, this quiz can no longer be changed.</p>
            )}
          </div>
          {error && <p className="text-xs font-bold text-red-400">{error}</p>}
        </div>
        <div className="flex justify-between px-6 py-4 border-t border-red-900/30">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="button" onClick={submit} className={BTN_PRIMARY}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({ q, update }) {
  const setType = (type) => {
    let choices = q.choices;
    if (type === 'single') {
      // a single choice question keeps only one correct answer
      const first = choices.findIndex((c) => c.isCorrect);
      choices = choices.map((c, i) => ({ ...c, isCorrect: i === (first === -1 ? 0 : first) }));
    }
    update({ type, choices });
  };
  const setChoice = (key, patch) => update({ choices: q.choices.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  const markCorrect = (key) => {
    if (q.type === 'multi') setChoice(key, { isCorrect: !q.choices.find((c) => c.key === key).isCorrect });
    else update({ choices: q.choices.map((c) => ({ ...c, isCorrect: c.key === key })) });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className={LABEL}>Question type <span className="text-red-400">*</span></label>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {QUESTION_TYPES.map((t) => (
            <Radio key={t.value} checked={q.type === t.value} onChange={() => setType(t.value)} label={t.label} />
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL}>Title <span className="text-red-400">*</span></label>
        <input className={INPUT} value={q.title} onChange={(e) => update({ title: e.target.value })} />
      </div>

      <div>
        <label className={LABEL}>Description <span className="text-slate-500 normal-case font-medium">- optional</span></label>
        <textarea className={`${INPUT} h-20`} value={q.description} onChange={(e) => update({ description: e.target.value })} />
      </div>

      <div>
        <label className={LABEL}>Image URL <span className="text-slate-500 normal-case font-medium">- optional</span></label>
        <input className={INPUT} placeholder="https://..." value={q.imageUrl} onChange={(e) => update({ imageUrl: e.target.value })} />
      </div>

      {(
        <div>
          <label className={LABEL}>
            Choice <span className="text-red-400">*</span>
            <span className="text-slate-500 normal-case font-medium ml-2">
              {q.type === 'multi' ? '(tick every correct answer)' : '(select the correct answer)'}
            </span>
          </label>
          <div className="rounded-xl bg-[#0B0D13] border border-red-900/30 p-3 space-y-2">
            {q.choices.map((c) => (
              <div key={c.key} className="flex items-center gap-3 rounded-xl bg-[#141722] border border-red-900/30 px-3 py-2.5">
                <input
                  type={q.type === 'multi' ? 'checkbox' : 'radio'}
                  checked={c.isCorrect}
                  onChange={() => markCorrect(c.key)}
                  className="w-4 h-4 accent-red-500 cursor-pointer"
                  title="Correct answer"
                />
                <input
                  className={INPUT}
                  placeholder="Choice text"
                  value={c.text}
                  onChange={(e) => setChoice(c.key, { text: e.target.value })}
                />
                {(
                  <button
                    type="button"
                    disabled={q.choices.length <= 2}
                    onClick={() => update({ choices: q.choices.filter((x) => x.key !== c.key) })}
                    className="text-slate-400 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                    title="Remove choice"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {(
              <button
                type="button"
                onClick={() => update({ choices: [...q.choices, { key: uid(), text: '', isCorrect: false }] })}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer px-1 py-1"
              >
                <Plus size={14} /> Add choice
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ index, total, section, patch, onMove, onRemove, onEditMeta }) {
  const [selected, setSelected] = useState(0);
  const qIndex = Math.min(selected, section.questions.length - 1);
  const current = section.questions[qIndex];

  const updateQuestion = (patchQ) =>
    patch({ questions: section.questions.map((q, i) => (i === qIndex ? { ...q, ...patchQ } : q)) });
  const addQuestion = () => {
    patch({ questions: [...section.questions, newQuestion()] });
    setSelected(section.questions.length);
  };
  const removeQuestion = (i) => {
    patch({ questions: section.questions.filter((_, idx) => idx !== i) });
    setSelected(Math.max(0, i - 1));
  };

  return (
    <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-red-900/30">
        <div className="flex items-center gap-3 text-white font-extrabold">
          <HelpCircle size={18} className="text-red-400" />
          <span>Section {index + 1}: Quiz</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <button type="button" onClick={onRemove} className="p-1.5 hover:text-red-400 cursor-pointer" title="Delete quiz"><Trash2 size={16} /></button>
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="p-1.5 hover:text-white disabled:opacity-30 cursor-pointer" title="Move up"><ChevronUp size={18} /></button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="p-1.5 hover:text-white disabled:opacity-30 cursor-pointer" title="Move down"><ChevronDown size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-red-900/30">
        <div className="min-w-0">
          <div className="font-extrabold text-white truncate">{section.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {section.timeLimitMinutes} minutes • {section.questions.length} Questions
            {section.editType === 'no_edit' && <span className="ml-2 text-amber-400">• No edit allow</span>}
          </div>
          <div className="text-xs text-slate-500 mt-1 line-clamp-2">{section.description}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-white">{section.questions.length}</div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Questions</div>
        </div>
        <button type="button" onClick={onEditMeta} className={BTN_GHOST}>Edit</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <div className="border-b lg:border-b-0 lg:border-r border-red-900/30 flex flex-col">
          <div className="flex-1 p-3 space-y-2">
            {section.questions.map((q, i) => (
              <div
                key={q.key}
                onClick={() => setSelected(i)}
                className={`rounded-xl px-3 py-2.5 border cursor-pointer flex items-start justify-between gap-2 ${
                  i === qIndex ? 'bg-red-950/60 border-red-600/60' : 'bg-[#0B0D13] border-red-900/30 hover:bg-red-950/30'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">Question #{i + 1} • {TYPE_LABEL[q.type]}</div>
                  <div className={`text-sm font-bold truncate ${q.title.trim() ? 'text-white' : 'text-red-400 italic'}`}>
                    {q.title.trim() || '* (Empty Question Title)'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={section.questions.length <= 1}
                  onClick={(e) => { e.stopPropagation(); removeQuestion(i); }}
                  className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                  title="Delete question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-red-900/30">
            <button type="button" onClick={addQuestion} className={`${BTN_GHOST} w-full flex items-center justify-center gap-2`}>
              <Plus size={14} /> Add Question
            </button>
          </div>
        </div>

        <div className="p-5">
          <h4 className="text-lg font-extrabold text-white mb-4">Question #{qIndex + 1}</h4>
          {current && <QuestionEditor q={current} update={updateQuestion} />}
        </div>
      </div>
    </div>
  );
}

function ContentStep({ form, set }) {
  const [modal, setModal] = useState(null); // { index: number | null }
  const patchSection = (i, patch) => set({ sections: form.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const move = (i, dir) => {
    const next = [...form.sections];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    set({ sections: next });
  };

  return (
    <div className="space-y-5">
      {form.sections.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-4 text-slate-400">
          <ListChecks size={56} className="text-slate-600" />
          <p className="text-sm">No quest content created</p>
        </div>
      ) : (
        form.sections.map((s, i) => (
          <SectionCard
            key={s.key}
            index={i}
            total={form.sections.length}
            section={s}
            patch={(p) => patchSection(i, p)}
            onMove={(d) => move(i, d)}
            onRemove={() => set({ sections: form.sections.filter((_, idx) => idx !== i) })}
            onEditMeta={() => setModal({ index: i })}
          />
        ))
      )}

      <div className="flex justify-center">
        <button type="button" onClick={() => setModal({ index: null })} className={`${BTN_PRIMARY} flex items-center gap-2`}>
          <Plus size={14} /> Quiz
        </button>
      </div>

      {modal && (
        <QuizModal
          initial={modal.index === null ? null : {
            title: form.sections[modal.index].title,
            description: form.sections[modal.index].description,
            timeLimitMinutes: form.sections[modal.index].timeLimitMinutes,
            editType: form.sections[modal.index].editType,
          }}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.index === null) set({ sections: [...form.sections, newSection(data)] });
            else patchSection(modal.index, { ...data, timeLimitMinutes: String(data.timeLimitMinutes) });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- step 3 / 4

function RewardStep({ form, set }) {
  const total = Number(form.rewardPoints) || 0;
  const totalQuestions = form.sections.reduce((n, sec) => n + sec.questions.length, 0);

  // rewards the Admin can give away for free (active and in stock)
  const [rewards, setRewards] = useState([]);
  const [rewardsState, setRewardsState] = useState('loading'); // loading | ready | error
  useEffect(() => {
    fetch(`${API_BASE}/rewards`)
      .then((r) => r.json())
      .then((j) => {
        if (j && j.success && Array.isArray(j.rewards)) {
          setRewards(j.rewards);
          setRewardsState('ready');
        } else setRewardsState('error');
      })
      .catch(() => setRewardsState('error'));
  }, []);
  const chosen = rewards.find((r) => r.id === form.rewardId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <label className={LABEL}>Pass score <span className="text-slate-500 normal-case font-medium">- correct answers needed to pass and get the points</span></label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max={totalQuestions}
            className={`${INPUT} max-w-[8rem]`}
            placeholder={String(totalQuestions)}
            value={form.passCount}
            onChange={(e) => set({ passCount: e.target.value })}
          />
          <span className="text-sm text-slate-300">out of {totalQuestions} question(s)</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Leave empty to require every question to be correct.</p>
      </div>

      <div>
        <label className={LABEL}>Points <span className="text-slate-500 normal-case font-medium">- total points an employee gets once they pass</span></label>
        <input type="number" min="0" className={`${INPUT} max-w-xs`} value={form.rewardPoints} onChange={(e) => set({ rewardPoints: e.target.value })} />
        <p className="text-[11px] text-slate-500 mt-1">
          Example: pass score {form.passCount === '' ? totalQuestions : form.passCount} of {totalQuestions} and {total} points means anyone who answers at least{' '}
          {form.passCount === '' ? totalQuestions : form.passCount} questions correctly gets {total} points in total.
        </p>
      </div>

      <div>
        <label className={LABEL}>Reward <span className="text-slate-500 normal-case font-medium">- optional, given free to everyone who passes (no points are spent)</span></label>
        <select className={`${INPUT} max-w-md`} value={form.rewardId} onChange={(e) => set({ rewardId: e.target.value })}>
          <option value="">No reward</option>
          {rewards.map((r) => (
            <option key={r.id} value={r.id} disabled={(Number(r.stock) || 0) <= 0 && r.id !== form.rewardId}>
              {r.title}{(Number(r.stock) || 0) <= 0 ? ' (out of stock)' : ` (stock ${r.stock})`}
            </option>
          ))}
        </select>
        {rewardsState === 'error' && <p className="text-[11px] text-red-300 mt-1">Unable to load rewards. Reload the page to try again.</p>}
        {chosen && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-900/30 bg-[#0B0D13] p-3 max-w-md">
            {chosen.imageUrl ? <img src={chosen.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" /> : <div className="w-14 h-14 rounded-lg bg-red-950/50" />}
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{chosen.title}</div>
              <div className="text-[11px] text-slate-400">Normally {chosen.pointsRequired} points — free for employees who pass</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function SummaryStep({ form }) {
  const total = Number(form.rewardPoints) || 0;
  const assignLabel = form.assignType === 'all' ? 'All employees' : form.assignType === 'new_employee' ? 'New employees' : `${form.members.length} selected member(s)`;
  const Row = ({ label, children }) => (
    <div className="grid grid-cols-[170px_1fr] gap-4 py-3 border-b border-red-900/20 text-sm">
      <span className="text-slate-400 font-bold uppercase text-xs tracking-wider pt-0.5">{label}</span>
      <span className="text-slate-100 break-words">{children}</span>
    </div>
  );
  return (
    <div className="max-w-3xl">
      <Row label="Code"><span className="font-mono">{form.code}</span></Row>
      <Row label="Title">{form.title}</Row>
      <Row label="Description"><span className="whitespace-pre-wrap">{form.description}</span></Row>
      <Row label="Image">{form.imageUrl || '-'}</Row>
      <Row label="Start">{form.sendMode === 'now' ? 'Immediately after saving' : `${form.startDate} ${form.startTime}`}</Row>
      <Row label="End">{`${form.endDate} ${form.endTime}`}</Row>
      <Row label="Assign to">
        {assignLabel}
        {form.assignType === 'members' && <span className="block text-xs text-slate-400 mt-1">{form.members.map((m) => m.name).join(', ')}</span>}
      </Row>
      <Row label="Approval">Auto approve points</Row>
      <Row label="Pass score">{form.passCount === '' ? 'All questions correct' : `${form.passCount} correct answer(s) or more`}</Row>
      <Row label="Reward">{form.rewardId ? 'Free reward for everyone who passes' : 'No reward'}</Row>
      <Row label="Content">
        {form.sections.map((s, i) => (
          <span key={s.key} className="block">
            Section {i + 1}: {s.title} — {s.questions.length} questions, {s.timeLimitMinutes} min
            <span className="text-slate-500"> ({s.questions.map((q) => TYPE_LABEL[q.type]).join(', ')})</span>
          </span>
        ))}
      </Row>
      <Row label="Points">
        <span className="font-extrabold text-white">{total}</span>
        <span className="text-slate-400"> in total for everyone who passes</span>
      </Row>
    </div>
  );
}

// ---------------------------------------------------------------- wizard
export default function QuestWizard({ questId, onClose, onSaved, notify }) {
  const isNew = questId === 'new';
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(isNew ? 0 : 3);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/quests/${encodeURIComponent(questId)}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success) setForm(fromApi(json.quest));
        else {
          notify(json.message || 'Unable to load the quest', 'error');
          onClose();
        }
      } catch (e) {
        if (!cancelled) {
          notify('Unable to connect to the server to load the quest', 'error');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  const set = (patch) => {
    setError('');
    setForm((f) => ({ ...f, ...patch }));
  };

  const goNext = () => {
    const problem = validateStep(step, form);
    if (problem) return setError(problem);
    setError('');
    setStep(step + 1);
    setMaxStep((m) => Math.max(m, step + 1));
  };

  const jumpTo = (target) => {
    // moving forward through the stepper still has to pass every step in between
    for (let i = 0; i < target; i++) {
      const problem = validateStep(i, form);
      if (problem) {
        setStep(i);
        return setError(problem);
      }
    }
    setError('');
    setStep(target);
  };

  const save = async () => {
    for (let i = 0; i < 3; i++) {
      const problem = validateStep(i, form);
      if (problem) {
        setStep(i);
        return setError(problem);
      }
    }
    setSaving(true);
    try {
      const res = await fetch(isNew ? `${API_BASE}/quests` : `${API_BASE}/quests/${encodeURIComponent(questId)}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(form)),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notify(isNew ? `Quest "${json.quest.title}" created` : `Quest "${json.quest.title}" updated`);
        onSaved();
      } else {
        setError(json.message || 'Unable to save the quest');
      }
    } catch (e) {
      setError('Unable to connect to the server to save the quest');
    } finally {
      setSaving(false);
    }
  };

  const stepBody = useMemo(() => {
    if (step === 0) return <SettingsStep form={form} set={set} />;
    if (step === 1) return <ContentStep form={form} set={set} />;
    if (step === 2) return <RewardStep form={form} set={set} />;
    return <SummaryStep form={form} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form]);

  if (loading) {
    return <div className="py-24 text-center text-slate-500 font-mono">Loading quest...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper step={step} setStep={jumpTo} maxStep={maxStep} />

      <div className="bg-[#141722] rounded-2xl border border-red-900/30 shadow-lg">
        <div className="px-6 pt-6">
          <h2 className="text-xl font-black text-white uppercase tracking-wide">
            {isNew ? 'New Quest' : 'Edit Quest'} — {STEPS[step].label}
          </h2>
        </div>
        <div className="p-6">{stepBody}</div>

        {error && (
          <div className="mx-6 mb-4 px-4 py-3 rounded-xl bg-red-950/60 border border-red-700/50 text-sm font-bold text-red-300">{error}</div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-red-900/30">
          <button type="button" onClick={step === 0 ? onClose : () => { setError(''); setStep(step - 1); }} className={BTN_GHOST}>
            {step === 0 ? 'Cancel' : 'Go Back'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className={BTN_PRIMARY}>Continue</button>
          ) : (
            <button type="button" onClick={save} disabled={saving} className={`${BTN_PRIMARY} flex items-center gap-2`}>
              <Check size={14} /> {saving ? 'Saving...' : isNew ? 'Create Quest' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
