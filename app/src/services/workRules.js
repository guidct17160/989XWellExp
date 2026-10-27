import { tryFetchApi } from './apiClient';

// Working-time rules HR sets on the web (Attendance -> Work Time Settings), read from GET /settings/work-time.
//   workStartTime: work hours are counted from this time (earlier arrivals count from here)
//   lateAfterTime: checking in after this time = late
//   requiredHours: hours to work for a full day
//   onTimePoints : points for checking in on time AND working the full hours (0 = off)
// The defaults are used until the rules load (and when the server cannot be reached).
const DEFAULT_RULES = { workStartTime: '08:00', lateAfterTime: '09:00', requiredHours: 9, onTimePoints: 0 };
const CACHE_KEY = 'wellx989_work_rules_v2';

const toMinutes = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const valid = (r) =>
  r && toMinutes(r.workStartTime) !== null && toMinutes(r.lateAfterTime) !== null && Number(r.requiredHours) > 0;

let rules = { ...DEFAULT_RULES };
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (valid(cached)) rules = { ...DEFAULT_RULES, ...cached };
  }
} catch (e) { /* keep the defaults */ }

// SuperBoss may clock in / out at any time: never late, never "not enough hours" (the role comes from the saved session)
const isSuperBoss = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const session = JSON.parse(window.localStorage.getItem('wellx989_session') || 'null');
      return !!(session && session.user && session.user.role === 'SuperBoss');
    }
  } catch (e) { /* not signed in */ }
  return false;
};

export const workRules = {
  get: () => rules,

  /** Re-read the rules from the server (does nothing when it cannot be reached) */
  async refresh() {
    try {
      const res = await tryFetchApi('/settings/work-time');
      if (!res || !res.ok) return rules;
      const data = await res.json().catch(() => ({}));
      if (data && data.success && valid(data.rules)) {
        rules = { ...DEFAULT_RULES, ...data.rules };
        try {
          if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(CACHE_KEY, JSON.stringify(rules));
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* keep the current rules */ }
    return rules;
  },

  /** Work hours are counted from this time (minutes from midnight) */
  workStartMinutes: () => toMinutes(rules.workStartTime),
  /** Required work seconds per day */
  requiredSeconds: () => (isSuperBoss() ? 0 : Math.round(Number(rules.requiredHours) * 3600)),
  /** True for roles that are not held to the late time / required hours (SuperBoss) */
  exempt: () => isSuperBoss(),
  /** "9" or "8.5" for messages */
  requiredHoursLabel: () => String(Number(rules.requiredHours)),
  onTimePoints: () => Number(rules.onTimePoints) || 0,

  /** Checking in at hour:minute is late (same minute precision the app always used) */
  isLateAt: (hour, minute) => !isSuperBoss() && hour * 60 + minute > toMinutes(rules.lateAfterTime),
};
