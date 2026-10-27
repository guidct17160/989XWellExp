// "Today" as YYYY-MM-DD in Thailand time (UTC+7), the same day the backend stores in attendance.date_iso.
// new Date().toISOString() is UTC, so between 00:00 and 06:59 in Bangkok it still returns yesterday.
export const todayIsoBkk = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
