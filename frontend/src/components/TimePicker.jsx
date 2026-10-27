import React, { useState, useEffect, useRef } from 'react';
import { Clock as ClockIcon, Minus, Plus } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5 ... 55
const pad = (n) => String(n).padStart(2, '0');

// "HH:mm" (24 hour) -> { hour, minute }
const parse = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 0, minute: 0, valid: false };
  return { hour: Number(m[1]), minute: Number(m[2]), valid: true };
};
const toValue = (hour, minute) => `${pad(hour)}:${pad(minute)}`;

const chip = (selected, off) =>
  `h-10 rounded-xl text-sm font-bold transition-all ${
    selected
      ? 'bg-[#7C3AED] text-white shadow-lg shadow-violet-600/30'
      : off
      ? 'text-slate-400 cursor-not-allowed'
      : 'bg-slate-50 text-slate-800 border border-slate-200 hover:border-violet-500/60 hover:text-white cursor-pointer'
  }`;

/**
 * Time picker pop-up in the dark admin style, 24-hour clock (e.g. 20:11, no AM / PM):
 * a big digital readout, an hour grid (00-23) and a minute grid (5-minute steps) plus -1 / +1 buttons for the exact minute.
 * value / onChange use "HH:mm". min = earliest time that can be chosen ("HH:mm").
 * onChange receives { target: { name, value } } like DatePicker.
 */
export default function TimePicker({ value, onChange, name, min, placeholder = 'Select time', disabled = false, placement = 'top' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const current = parse(value);
  const base = current.valid ? current : parse(min || '09:00');

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const commit = (hour, minute) => {
    // minutes wrap into the next / previous hour so the -1 / +1 buttons can cross the hour
    let total = hour * 60 + minute;
    total = ((total % 1440) + 1440) % 1440;
    let next = toValue(Math.floor(total / 60), total % 60);
    if (min && next < min) next = min; // never earlier than the allowed minimum
    if (onChange) onChange({ target: { name, value: next } });
  };

  const hourOff = (h) => !!min && toValue(h, 59) < min;
  const minuteOff = (mm) => !!min && toValue(base.hour, mm) < min;

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setIsOpen((o) => !o); } }}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 flex items-center justify-between cursor-pointer transition-all select-none group ${
          isOpen ? 'border-violet-500 ring-4 ring-violet-200' : 'hover:border-violet-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-slate-900 tracking-wide font-mono' : 'text-slate-500'}>{current.valid ? toValue(current.hour, current.minute) : placeholder}</span>
        <ClockIcon size={18} className={isOpen ? 'text-violet-700' : 'text-slate-500 group-hover:text-slate-800'} />
      </div>
      <input type="hidden" name={name} value={value || ''} />

      {isOpen && (
        <div
          className={`absolute left-0 z-[9999] w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300 select-none animate-in fade-in zoom-in-95 duration-150 ${
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          }`}
        >
          {/* readout */}
          <div className="font-mono text-4xl font-black tracking-tight text-slate-900 leading-none mb-4">
            {pad(base.hour)}
            <span className="text-violet-700 mx-0.5">:</span>
            {pad(base.minute)}
          </div>

          {/* hour */}
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Hour</div>
          <div className="grid grid-cols-6 gap-1.5 mb-4">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={hourOff(h)}
                onClick={() => commit(h, base.minute)}
                className={chip(current.valid && current.hour === h, hourOff(h))}
              >
                {pad(h)}
              </button>
            ))}
          </div>

          {/* minute */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Minute</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="1 minute earlier"
                onClick={() => commit(base.hour, base.minute - 1)}
                className="h-6 w-6 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center cursor-pointer"
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                title="1 minute later"
                onClick={() => commit(base.hour, base.minute + 1)}
                className="h-6 w-6 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 flex items-center justify-center cursor-pointer"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {MINUTE_STEPS.map((mm) => (
              <button
                key={mm}
                type="button"
                disabled={minuteOff(mm)}
                onClick={() => commit(base.hour, mm)}
                className={chip(current.valid && current.minute === mm, minuteOff(mm))}
              >
                {pad(mm)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                commit(d.getHours(), d.getMinutes());
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-extrabold uppercase tracking-wide cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
