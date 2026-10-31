"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Drawer from "./Drawer";
import DateRangePicker, { addDays } from "./Daterangepicker";
import { useDashboard } from "./DashboardProvider";
import { NAV } from "@/lib/nav";
import { TENANTS } from "@/lib/sample-data";
import { totals } from "@/lib/stats";

// YYYY-MM-DD in Asia/Dhaka
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

export default function Shell({ children, currentUser }) {
  const pathname = usePathname();
  const { range, setRange, tenant, setTenant, scoped, toastMsg, customRange, setCustomRange } =
    useDashboard();

  const current =
    NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
  const badCount = totals(scoped).bad;

  const today = fmt(new Date());
  const minDate = addDays(today, -30);

  const [mode, setMode] = useState("today");
  const [calOpen, setCalOpen] = useState(false);
  const prevMode = useRef("today");
  const customApplied = useRef(false); // true once the user confirmed a custom range

  // Exactly ONE of the two is set at a time, and both are changed together here,
  // so nothing needs effects that clear each other.
  //   hours  -> range = <number>, customRange = { from: "", to: "" }
  //   today  -> range = "",       customRange = { from: today, to: today }
  //   custom -> range = "",       customRange = { from, to }   (YYYY-MM-DD strings)
  const applyPeriod = (v) => {
    if (v === "today") {
      const t = fmt(new Date());
      setRange("");
      setCustomRange({ from: t, to: t });
    } else {
      setRange(Number(v));
      setCustomRange({ from: "", to: "" });
    }
  };

  // Apply the initial period once, so the dashboard state matches the select
  useEffect(() => {
    applyPeriod("today");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === "USER") {
      setTenant(currentUser.email.split("@")[1]);
    } else if (currentUser.role === "ADMIN") {
      setTenant("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const onPeriodChange = (e) => {
    const v = e.target.value;
    if (v === "custom") {
      if (mode !== "custom") prevMode.current = mode;
      setMode("custom");
      setCalOpen(true); // open the calendar as soon as "Custom" is chosen
      // data stays as it is until the user presses Apply
    } else {
      customApplied.current = false;
      setMode(v);
      setCalOpen(false);
      applyPeriod(v);
    }
  };

  const onCalOpenChange = (open) => {
    setCalOpen(open);
    // Closed without applying a range: go back to the previous period
    if (!open && mode === "custom" && !customApplied.current) setMode(prevMode.current);
  };

  const onApply = (r) => {
    customApplied.current = true;
    setRange("");
    setCustomRange({ from: r.from, to: r.to });
  };

  // The picker needs YYYY-MM-DD strings; fall back to the last 7 days
  const pickerValue =
    typeof customRange?.from === "string" && customRange.from
      ? customRange
      : { from: addDays(today, -7), to: today };

  const isAdmin = currentUser?.role === "ADMIN";
  const isUser = currentUser?.role === "USER";

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <i><Icon name="tx" /></i>
          <span>Mail Dashboard</span>
        </div>
        <nav style={{ display: "contents" }} aria-label="Sections">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="nav"
              aria-current={n === current ? "page" : undefined}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.href === "/failures" && badCount > 0 && <span className="count">{badCount}</span>}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <span>Postal webhooks</span>
          <span className="mono" style={{ color: "var(--side-on)" }}>Asia/Dhaka · UTC+6</span>
        </div>
      </aside>

      <div className="content">
        <header className="top">
          <div>
            <h1>{current.label}</h1>
            <p className="sub">{current.sub}</p>
          </div>
          <div className="controls">
            <span className="tag">Sample data</span>

            <label htmlFor="range" className="sr-only">Period</label>
            <select id="range" className="sel" value={mode} onChange={onPeriodChange}>
              <option value="today">Today</option>
              <option value="1">Last hour</option>
              <option value="6">Last 6 hours</option>
              <option value="24">Last 24 hours</option>
              <option value="48">Last 48 hours</option>
              <option value="72">Last 72 hours</option>
              <option value="custom">Custom range…</option>
            </select>

            {mode === "custom" && (
              <DateRangePicker
                open={calOpen}
                onOpenChange={onCalOpenChange}
                value={pickerValue}
                minDate={minDate}
                maxDate={today}
                onApply={onApply}
              />
            )}

            <label htmlFor="tenant" className="sr-only">Tenant</label>
            <select
              disabled={isUser}
              id="tenant"
              className="sel"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
            >
              {isAdmin && <option value="all">All Tenants</option>}
              {isAdmin ? (
                Object.entries(TENANTS).map(([k, t]) => (
                  <option key={k} value={t.domain}>{t.name}</option>
                ))
              ) : (
                currentUser && (
                  <option value={currentUser.email.split("@")[1]}>{currentUser.name}</option>
                )
              )}
            </select>

            <div className="avatar" aria-hidden="true">AD</div>
          </div>
        </header>
        <main>{children}</main>
      </div>

      <Drawer />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}