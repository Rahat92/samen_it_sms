// lib/range-params.js
// Reads the period from a request's query string. Accepts any of:
//   ?timeFrom=24                               rolling window, hours
//   ?from=<ms>&to=<ms>                         fixed window, epoch ms
//   ?from=2026-10-22&to=2026-10-29             fixed window, Dhaka calendar days
//   ?timeFrom[from]=<ms>&timeFrom[to]=<ms>     what a nested-object serializer sends

const toMs = (value, edge) => {
  if (value === null || value === undefined || value === "") return NaN;
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    // Dhaka is UTC+6 with no DST, so day boundaries are fixed-offset
    return new Date(edge === "start" ? `${v}T00:00:00+06:00` : `${v}T23:59:59.999+06:00`).getTime();
  }
  return /^\d{10,}$/.test(v) ? Number(v) : NaN;
};

export function parseRange(searchParams, defaultHours = 24) {
  const fromRaw = searchParams.get("timeFrom[from]") ?? searchParams.get("from");
  const toRaw = searchParams.get("timeFrom[to]") ?? searchParams.get("to");

  const from = toMs(fromRaw, "start");
  const to = toMs(toRaw, "end");
  if (Number.isFinite(from) && Number.isFinite(to)) return { from, to };

  // Plain hours; ignore a "[object Object]" value from a bad serializer
  const hours = Number(searchParams.get("timeFrom"));
  return Number.isFinite(hours) && hours > 0 ? hours : defaultHours;
}