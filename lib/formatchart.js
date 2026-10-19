// All times are shown in Asia/Dhaka (UTC+6). Plain UTC arithmetic keeps server and
// client output identical, so there are no hydration mismatches.
export const MIN = 60e3;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const OFFSET = 6 * HOUR;

const p2 = (n) => (n < 10 ? "0" : "") + n;
const dhaka = (ms) => new Date(ms + OFFSET);

export function hm(ms) {
  const d = dhaka(ms);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

export function hms(ms) {
  const d = dhaka(ms);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

// Start of the Dhaka calendar day containing `ms`
export function dayStart(ms) {
  return Math.floor((ms + OFFSET) / DAY) * DAY - OFFSET;
}

export function stamp(ms, now = Date.now()) {
  const diff = dayStart(now) - dayStart(ms);
  if (diff === 0) return `Today ${hm(ms)}`;
  if (diff === DAY) return `Yesterday ${hm(ms)}`;
  return `${dhaka(ms).toISOString().slice(0, 10)} ${hm(ms)}`;
}