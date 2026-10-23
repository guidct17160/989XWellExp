/**
 * Asia/Bangkok time helpers.
 * Server may run in UTC (containers) - attendance dates / late checks must follow Thai local time,
 * not `toISOString()` (UTC) or the server's `getHours()`.
 */
const TZ = 'Asia/Bangkok';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const bangkokParts = (date = new Date()) => {
  const out = {};
  formatter.formatToParts(date).forEach((p) => {
    out[p.type] = p.value;
  });
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    dateIso: `${out.year}-${out.month}-${out.day}`,
    timeLabel: `${out.hour}:${out.minute} น.`,
  };
};

/** YYYY-MM-DD in Thai local time */
const todayIso = (date = new Date()) => bangkokParts(date).dateIso;

/**
 * Worked time for a forgotten clock-out: from the clock-in label (e.g. "08:45 น.") until 23:59,
 * formatted like every other duration ("HH:MM:SS ชม."). Clock-ins at/after 23:59 give 0.
 */
const durationUntilEndOfDay = (checkInLabel) => {
  const match = String(checkInLabel || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return '00:00:00 ชม.';
  const diffSec = (23 * 3600 + 59 * 60) - (parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60);
  if (diffSec <= 0) return '00:00:00 ชม.';
  const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const ss = String(diffSec % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss} ชม.`;
};

module.exports = { TZ, bangkokParts, todayIso, durationUntilEndOfDay };
