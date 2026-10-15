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
