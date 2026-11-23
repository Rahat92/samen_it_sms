"use client";

/**
 * HeaderFilters — Period select, custom date range, Tenant select.
 * Self-contained: reads and writes filter state through your useDashboard().
 *
 * ── CHECK THESE (only things I couldn't see in your code) ──────────────
 * 1. Import paths for DashboardProvider and DateRangePicker.
 * 2. useDashboard() must expose: range, setRange, customRange,
 *    setCustomRange, tenant, setTenant. (I only saw the getters and
 *    setTenant in your code — rename setRange / setCustomRange if yours differ.)
 * 3. toRange(): how "Today" maps onto `range` (I use hours since midnight).
 * 4. onApply: I store the picked value with setCustomRange(value) and
 *    set range to "custom". Adjust if your API expects something else.
 */

import { useRef, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import DateRangePicker, { addDays } from "./Daterangepicker";
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "1", label: "Last hour" },
  { value: "6", label: "Last 6 hours" },
  { value: "24", label: "Last 24 hours" },
  { value: "48", label: "Last 48 hours" },
  { value: "72", label: "Last 72 hours" },
  { value: "custom", label: "Custom range…" },
];

const hoursSinceMidnight = () =>
  Math.max(1, Math.ceil((Date.now() - new Date().setHours(0, 0, 0, 0)) / 36e5));

const toRange = (mode) => (mode === "today" ? hoursSinceMidnight() : Number(mode));

const selectClass =
  "w-full min-w-0 appearance-none rounded-lg border border-[var(--line)] bg-[color:var(--surface)] " +
  "py-[7px] pl-3 pr-[30px] font-medium outline-none transition-colors " +
  "bg-[linear-gradient(45deg,transparent_50%,var(--muted)_50%),linear-gradient(135deg,var(--muted)_50%,transparent_50%)] " +
  "bg-[position:calc(100%_-_16px)_50%,calc(100%_-_11px)_50%] bg-[size:5px_5px] bg-no-repeat " +
  "hover:border-[var(--muted)] focus-visible:border-[var(--accent)] " +
  "disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export default function HeaderFilters({ currentUser, tenants = [] }) {
  const { range, setRange, customRange, setCustomRange, tenant, setTenant } = useDashboard();

  const isAdmin = currentUser?.role === "ADMIN";
  const isUser = currentUser?.role === "USER";
  const pickerValue =
    typeof customRange?.from === "string" && customRange.from
      ? customRange
      : { from: addDays(today, -7), to: today };
  const [mode, setMode] = useState(() => {
    const s = String(range ?? "24");
    return PERIODS.some((p) => p.value === s) ? s : "today";
  });
  const [calOpen, setCalOpen] = useState(false);

  const onPeriodChange = (e) => {
    const v = e.target.value;
    setMode(v);
    if (v === "custom") {
      setCalOpen(true);
      return;
    }
    setCalOpen(false);
    setRange(toRange(v));
  };
  const customApplied = useRef(false); // true once the user confirmed a custom range
  const onApply = (r) => {
    customApplied.current = true;
    setRange("");
    setCustomRange({ from: r.from, to: r.to });
  };

  const today = fmt(new Date());
  const minDate = addDays(today, -30);

  return (
    <div className="grid w-full grid-cols-2 items-center gap-2.5 sm:flex sm:w-auto sm:flex-wrap">
      {/* Period */}
      <label htmlFor="range" className="sr-only">Period</label>
      <select id="range" className={selectClass} value={mode} onChange={onPeriodChange}>
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {mode === "custom" && (
        <div className="">
          <DateRangePicker
            open={calOpen}
            onOpenChange={setCalOpen}
            value={pickerValue}
            minDate={minDate}
            maxDate={today}
            onApply={onApply}
          />
        </div>
      )}
      {/* Tenant */}
      <label htmlFor="tenant" className="sr-only">Tenant</label>
      <select
        id="tenant"
        className={selectClass}
        disabled={isUser}
        value={tenant}
        onChange={(e) => setTenant(e.target.value)}
      >
        {isAdmin && <option value="all">All Tenants</option>}
        {isAdmin
          ? tenants
            ?.filter((item) => item.domain)
            .map((i) => (
              <option key={i.id ?? i.domain} value={i.domain}>
                {i.name}
              </option>
            ))
          : currentUser && (
            <option value={currentUser.domain}>{currentUser.name}</option>
          )}
      </select>

      {/* Custom range: full-width row on mobile */}

    </div>
  );
}