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

// Dhaka is UTC+6 with no DST, so day boundaries are fixed-offset
const dhakaDayStart = (ymd) => new Date(`${ymd}T00:00:00+06:00`).getTime();
const dhakaDayEnd = (ymd) => new Date(`${ymd}T23:59:59.999+06:00`).getTime();

export default function Shell({ children, currentUser }) {
  const pathname = usePathname();
  const { range, setRange, tenant, setTenant, scoped, toastMsg, customRange, setCustomRange } = useDashboard();

  const current =
    NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
  const badCount = totals(scoped).bad;

  const today = fmt(new Date());
  const minDate = addDays(today, -30);
  const [mode, setMode] = useState("24");
  const [calOpen, setCalOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const prevMode = useRef("24");

  useEffect(() => {
    if (mode === "today") {
      setCustomRange({ from: dhakaDayStart(fmt(new Date())), to: Date.now() });
    } else if (mode === "custom") {
      setCustomRange({
        from: dhakaDayStart(customRange.from),
        to: Math.min(dhakaDayEnd(customRange.to), Date.now()),
      });
    } else {
      setRange(Number(mode)); // plain hours, as before
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
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
    } else {
      setMode(v);
      setCalOpen(false);
    }
  };

  const onCalOpenChange = (open) => {
    setCalOpen(open);
    // Closed without ever applying a range: go back to the previous period
    if (!open && !applied && mode === "custom") setMode(prevMode.current);
  };

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
                value={customRange}
                minDate={minDate}
                maxDate={today}
                onApply={(r) => {
                  setCustomRange(r);
                  setApplied(true);
                }}
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