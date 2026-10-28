"use client";

import { useEffect, useMemo, useState } from "react";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Dhaka",
});
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Dhaka",
});
const hm = (t) => timeFmt.format(new Date(t));
const dm = (t) => dateFmt.format(new Date(t));
const dhm = (t) => `${dm(t)} ${hm(t)}`;

// Pick a slot size that keeps the bar count readable
const autoSize = (span) => {
  if (span <= 2 * HOUR) return 5 * MIN;
  if (span <= 12 * HOUR) return 15 * MIN;
  if (span <= 72 * HOUR) return HOUR;
  return DAY;
};

/**
 * `range` (or legacy `hours`) is either:
 *   - a number of hours  -> rolling window ending now
 *   - { from, to } in ms -> fixed window (Today / custom dates)
 */
export default function SlotChart({ events = [], range, hours = 24, slotMin, labelEvery }) {
  const spec = range ?? hours;

  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(() => {
    if (now === null) return null;

    // 1. Resolve the window
    let start;
    let end;
    let fixed = false;
    if (spec && typeof spec === "object" && Number.isFinite(spec.from) && Number.isFinite(spec.to)) {
      start = spec.from;
      end = spec.to;
      fixed = true;
    } else {
      const h = Number(spec);
      end = now;
      start = end - (Number.isFinite(h) && h > 0 ? h : 24) * HOUR;
    }
    const span = Math.max(end - start, MIN);

    // 2. Slot size and count (guarded so the array length is always valid)
    let size = slotMin ? slotMin * MIN : autoSize(span);
    if (span / size > 120) size = DAY;

    let n;
    if (fixed) {
      n = Math.max(1, Math.ceil((span - 1) / size)); // last slot may be partial
    } else {
      n = Math.max(1, Math.round(span / size));
      start = end - n * size; // rolling window, e.g. 21:21 -> 21:21
    }

    // 3. Bucket the events
    const sent = Array(n).fill(0);
    const bad = Array(n).fill(0);
    for (const e of events) {
      const t = new Date(e.occurredAt).getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const i = Math.min(n - 1, Math.max(0, Math.floor((t - start) / size)));
      // Sent only when status is "Sent"; any other status counts as failed
      if (e.status === "Sent") sent[i]++;
      else bad[i]++;
    }

    const peak = Math.max(0, ...sent.map((v, i) => v + bad[i]));
    const max = Math.max(4, Math.ceil(peak / 4) * 4);
    const multiDay = span > DAY;
    return { n, size, start, sent, bad, max, multiDay };
  }, [events, spec, slotMin, now]);

  if (!data) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;
  }

  const { n, size, start, sent, bad, max, multiDay } = data;
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];
  const every = labelEvery ?? Math.max(1, Math.ceil(n / 6));
  const fmtLabel = size >= DAY ? dm : multiDay ? dhm : hm;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Email volume</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">Sent versus failed or delayed</p>

      <div className="mt-6 flex gap-4">
        {/* Y axis */}
        <div className="flex h-56 flex-col justify-between text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {ticks.map((v) => (
            <span key={v} className="leading-none">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* Plot */}
          <div className="relative h-56">
            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {ticks.map((v) => (
                <div key={v} className="border-t border-slate-200 dark:border-slate-800" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative flex h-full items-end gap-[3px]">
              {sent.map((o, k) => {
                const b = bad[k];
                const a = start + k * size;
                const title =
                  size >= DAY
                    ? `${dm(a)}: ${o} sent, ${b} failed or delayed`
                    : `${fmtLabel(a)} to ${hm(a + size)}: ${o} sent, ${b} failed or delayed`;
                return (
                  <div key={k} title={title} className="group flex h-full flex-1 flex-col justify-end">
                    {b > 0 && (
                      <div
                        className="w-full rounded-t-[3px] bg-[#d9534f] transition-opacity group-hover:opacity-80"
                        style={{ height: `${(b / max) * 100}%` }}
                      />
                    )}
                    {o > 0 && (
                      <div
                        className={`w-full bg-[#2e9e6b] transition-opacity group-hover:opacity-80 ${b ? "" : "rounded-t-[3px]"}`}
                        style={{ height: `${(o / max) * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X axis */}
          <div className="relative mt-3 h-4 font-mono text-xs text-slate-500 dark:text-slate-400">
            {Array.from({ length: n }, (_, k) =>
              k % every === 0 ? (
                <span
                  key={k}
                  className="absolute top-0 whitespace-nowrap"
                  style={{ left: `${(k / n) * 100}%` }}
                >
                  {fmtLabel(start + k * size)}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <i className="size-3 rounded-[3px] bg-[#2e9e6b]" />
          Sent
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-3 rounded-[3px] bg-[#d9534f]" />
          Failed or delayed
        </span>
        <span className="text-slate-500 dark:text-slate-400">Times in Dhaka</span>
      </div>
    </div>
  );
}