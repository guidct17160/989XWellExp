// Working-time rules that HR sets on the web (Attendance -> Work Time Settings).
// They live inside the `app_settings` JSON of system_settings under the keys noted below.
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const DEFAULTS = {
  workStartTime: '08:00', // work starts / hours are counted from here (app_settings.workTimeStart)
  lateAfterTime: '09:00', // check in after this time = late (app_settings.lateThresholdTime)
  requiredHours: 9, // hours to work per day for a full day (app_settings.workHoursPerDay)
  onTimePoints: 0, // points for checking in on time AND working the full hours, 0 = off (app_settings.onTimePoints)
};

const pad = (t) => {
  const m = HHMM.exec(String(t || ''));
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : null;
};

// settings (the stored JSON) -> the rules, falling back to the defaults for anything missing / invalid
const fromSettings = (settings = {}) => {
  const hours = Number(settings.workHoursPerDay);
  const points = Number(settings.onTimePoints);
  return {
    workStartTime: pad(settings.workTimeStart) || DEFAULTS.workStartTime,
    lateAfterTime: pad(settings.lateThresholdTime) || DEFAULTS.lateAfterTime,
    requiredHours: Number.isFinite(hours) && hours > 0 && hours <= 16 ? hours : DEFAULTS.requiredHours,
    onTimePoints: Number.isInteger(points) && points >= 0 ? points : DEFAULTS.onTimePoints,
  };
};

// the rules -> the keys stored in app_settings
const toSettings = (rules) => ({
  workTimeStart: rules.workStartTime,
  lateThresholdTime: rules.lateAfterTime,
  workHoursPerDay: rules.requiredHours,
  onTimePoints: rules.onTimePoints,
});

const toSeconds = (hhmm) => {
  const m = HHMM.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : 0;
};

// Validate a request body; returns { rules } or { error }
const validate = (body = {}) => {
  const workStartTime = pad(body.workStartTime);
  const lateAfterTime = pad(body.lateAfterTime);
  if (!workStartTime) return { error: 'Work start time must be a valid time (HH:mm)' };
  if (!lateAfterTime) return { error: 'Late time must be a valid time (HH:mm)' };
  if (toSeconds(workStartTime) > toSeconds(lateAfterTime)) return { error: 'Work start time cannot be later than the late time' };
  const requiredHours = Number(body.requiredHours);
  if (!Number.isFinite(requiredHours) || requiredHours < 1 || requiredHours > 16 || Math.round(requiredHours * 2) !== requiredHours * 2) {
    return { error: 'Required work hours must be between 1 and 16 (steps of 0.5)' };
  }
  const onTimePoints = Number(body.onTimePoints);
  if (!Number.isInteger(onTimePoints) || onTimePoints < 0 || onTimePoints > 100000) {
    return { error: 'On-time points must be a whole number from 0 to 100,000' };
  }
  return { rules: { workStartTime, lateAfterTime, requiredHours, onTimePoints } };
};

module.exports = { DEFAULTS, fromSettings, toSettings, toSeconds, validate };
