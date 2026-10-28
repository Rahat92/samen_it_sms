"use client";

import { useEffect, useRef, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");
const toYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based
const parts = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m: m - 1, d };
};

// Pure string/UTC date math, so the browser's timezone never shifts a day.
export const addDays = (ymd, n) => {
  const { y, m, d } = parts(ymd);
  const t = new Date(Date.UTC(y, m, d + n));
  return toYmd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};

const label = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DateRangePicker({ open, onOpenChange, value, onApply, minDate, maxDate }) {
  const wrapRef = useRef(null);
  const [start, setStart] = useState(value.from);
  const [end, setEnd] = useState(value.to);
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(() => {
    const p = parts(value.to || maxDate);
    return { y: p.y, m: p.m };
  });

  // Reset the draft each time the calendar opens
  useEffect(() => {
    if (open) {
      setStart(value.from);
      setEnd(value.to);
      setHover(null);
      const p = parts(value.to || maxDate);
      setView({ y: p.y, m: p.m });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onOpenChange(false);
    };
    const onKey = (e) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const minP = parts(minDate);
  const maxP = parts(maxDate);
  const idx = view.y * 12 + view.m;
  const canPrev = idx > minP.y * 12 + minP.m;
  const canNext = idx < maxP.y * 12 + maxP.m;

  const go = (delta) => {
    const n = view.y * 12 + view.m + delta;
    setView({ y: Math.floor(n / 12), m: n % 12 });
  };

  const pick = (ymd) => {
    if (!start || (start && end)) {
      setStart(ymd);
      setEnd(null);
    } else if (ymd < start) {
      setStart(ymd);
    } else {
      setEnd(ymd);
    }
  };

  // Range to highlight (includes hover preview while picking the end date)
  let lo = start;
  let hi = end;
  if (start && !end && hover) {
    lo = hover < start ? hover : start;
    hi = hover < start ? start : hover;
  }

  const firstDow = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toYmd(view.y, view.m, d));

  const monthTitle = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const triggerText = `${label(value.from)} – ${label(value.to)}`;
  const draftText = start ? `${label(start)} – ${label(end || start)}` : "Select a start date";

  return (
    <div className="drp" ref={wrapRef}>
      <button
        type="button"
        className="sel drp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {triggerText}
      </button>

      {open && (
        <div className="drp-pop" role="dialog" aria-label="Choose date range">
          <div className="drp-head">
            <button type="button" className="drp-nav" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous month">
              ‹
            </button>
            <strong>{monthTitle}</strong>
            <button type="button" className="drp-nav" onClick={() => go(1)} disabled={!canNext} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="drp-grid drp-dow">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="drp-grid">
            {cells.map((ymd, i) => {
              if (!ymd) return <span key={`b${i}`} />;
              const disabled = ymd < minDate || ymd > maxDate;
              const isEdge = ymd === lo || ymd === hi;
              const inRange = lo && hi && ymd > lo && ymd < hi;
              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={disabled}
                  className={`drp-day${isEdge ? " edge" : ""}${inRange ? " mid" : ""}${ymd === maxDate ? " today" : ""}`}
                  onClick={() => pick(ymd)}
                  onMouseEnter={() => setHover(ymd)}
                  onMouseLeave={() => setHover(null)}
                >
                  {parts(ymd).d}
                </button>
              );
            })}
          </div>

          <div className="drp-foot">
            <span className="drp-sum">{draftText}</span>
            <div>
              <button type="button" className="drp-btn" onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="drp-btn primary"
                disabled={!start}
                onClick={() => {
                  onApply({ from: start, to: end || start });
                  onOpenChange(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .drp { position: relative; display: inline-block; }
        .drp-trigger { cursor: pointer; white-space: nowrap; }
        .drp-pop {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
          width: 280px; padding: 12px;
          background: var(--surface, #fff); color: var(--text, #111827);
          border: 1px solid var(--border, #e5e7eb); border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,.15);
        }
        .drp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .drp-nav {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb);
          background: transparent; color: inherit; cursor: pointer; font-size: 16px; line-height: 1;
        }
        .drp-nav:disabled { opacity: .35; cursor: not-allowed; }
        .drp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .drp-dow { margin-bottom: 4px; text-align: center; font-size: 11px; opacity: .6; }
        .drp-day {
          height: 34px; border: 0; border-radius: 6px; background: transparent;
          color: inherit; cursor: pointer; font-size: 13px;
        }
        .drp-day:hover:not(:disabled) { background: var(--hover, rgba(37,99,235,.12)); }
        .drp-day:disabled { opacity: .3; cursor: not-allowed; }
        .drp-day.today { font-weight: 700; }
        .drp-day.mid { background: var(--hover, rgba(37,99,235,.14)); border-radius: 0; }
        .drp-day.edge { background: var(--accent, #2563eb); color: #fff; }
        .drp-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
        .drp-sum { font-size: 12px; opacity: .75; }
        .drp-btn {
          padding: 5px 10px; margin-left: 6px; border-radius: 6px; cursor: pointer;
          border: 1px solid var(--border, #e5e7eb); background: transparent; color: inherit; font-size: 12px;
        }
        .drp-btn.primary { background: var(--accent, #2563eb); border-color: var(--accent, #2563eb); color: #fff; }
        .drp-btn:disabled { opacity: .45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}