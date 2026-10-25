"use client";

import { useEffect, useMemo, useState } from "react";

const MIN = 60_000;
const HOUR = 60 * MIN;

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Dhaka",
});
const hm = (t) => timeFmt.format(new Date(t));

export default function SlotChart({ events = [], hours = 24, slotMin = 60, labelEvery = 4 }) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  
  const data = useMemo(() => {
    if (now === null) return null;

    const size = slotMin * MIN;
    const n = Math.max(1, Math.round((hours * HOUR) / size));
    const end = now;
    const start = end - n * size; // rolling window, e.g. 21:21 -> 21:21

    const sent = Array(n).fill(0);
    const bad = Array(n).fill(0);
    console.log(events.filter(item => item.status!=='Sent'))
    for (const e of events) {
      const t = new Date(e.occurredAt).getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const i = Math.min(n - 1, Math.floor((t - start) / size));
      // Sent only when status is "Sent"; any other status counts as failed
      if (e.status === "Sent") sent[i]++;
      else bad[i]++;
    }
    console.log(bad)
    const peak = Math.max(0, ...sent.map((v, i) => v + bad[i]));
    const max = Math.max(4, Math.ceil(peak / 4) * 4);
    return { n, size, start, sent, bad, max };
  }, [events, hours, slotMin, now]);

  if (!data) {
    return <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;
  }

  const { n, size, start, sent, bad, max } = data;
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];

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
                const title = `${hm(a)} to ${hm(a + size)}: ${o} sent, ${b} failed or delayed`;
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
              k % labelEvery === 0 ? (
                <span
                  key={k}
                  className="absolute top-0 whitespace-nowrap"
                  style={{ left: `${(k / n) * 100}%` }}
                >
                  {hm(start + k * size)}
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