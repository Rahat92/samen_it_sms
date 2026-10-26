// All times are shown in Asia/Dhaka (UTC+6). Plain UTC arithmetic keeps server and
// client output identical, so there are no hydration mismatches.
export const HOUR = 3600e3;
export const NOW = new Date("2026-10-07T21:21:00+06:00").getTime();
export const DAY0 = new Date("2026-10-07T00:00:00+06:00").getTime();

const p2 = (n) => (n < 10 ? "0" : "") + n;
const dhaka = (ms) => new Date(ms + 6 * HOUR);

export function hm(ms) {
  const d = dhaka(ms);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

export function hms(ms) {
  const d = dhaka(ms);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

export function stamp(ms) {
  return `${ms >= DAY0 ? "Today" : "Yesterday"} ${hm(ms)}`;
}


export function formatDateTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const dateKey = (d) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const todayKey = dateKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (dateKey(date) === todayKey) return `Today ${time}`;
  if (dateKey(date) === dateKey(yesterday)) return `Yesterday ${time}`;

  return `${dateKey(date)} ${time}`;
}