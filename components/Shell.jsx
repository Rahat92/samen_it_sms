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
import UserMenu from "./Usermenu";

// YYYY-MM-DD in Asia/Dhaka
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

export default function Shell({ children, currentUser }) {
  const pathname = usePathname();
  const { range, setRange, tenant, setTenant, scoped, toastMsg, customRange, setCustomRange } =
    useDashboard();
  const [tenants, setTenants] = useState([]);

  // Role-filtered nav. A group with a single visible child is shown as a plain link.
  const role = currentUser?.role;
  const allowed = (n) => !n.only || n.only.includes(role);
  const navItems = NAV.flatMap((n) => {
    if (!n.children) return allowed(n) ? [n] : [];
    const kids = n.children.filter(allowed);
    if (!kids.length) return [];
    if (kids.length === 1) return [{ ...kids[0], label: n.label, icon: n.icon }];
    return [{ ...n, children: kids }];
  });
  const leaves = navItems.flatMap((n) => n.children ?? [n]);
  const isActive = (n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
  const current = leaves.find(isActive) ?? leaves[0] ?? NAV[0];
  const badCount = totals(scoped).bad;

  // Nav badge counts
  //   blockedCount -> "Blocklist" item, shown to admins and users (users: own domain only)
  //   pendingCount -> "Unblock Requests" item, admins only
  const [blockedCount, setBlockedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  // Which nav groups the user opened/closed by hand; otherwise a group is open while one of its pages is active
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const admin = currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN";

    async function getJson(url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        return res.ok ? await res.json() : null;
      } catch {
        return null; // keep the previous count if the request fails
      }
    }

    async function loadCounts() {
      const [blocked, pending] = await Promise.all([
        getJson("/api/blocklist/count"),
        admin ? getJson("/api/blocklist-requests/pending-counts") : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (blocked) {
        // entries waiting for review are still blocked
        setBlockedCount((blocked.blocked ?? 0) + (blocked.unblockRequested ?? 0));
      }
      if (pending) setPendingCount(Number(pending.count ?? pending.data ?? 0) || 0);
    }

    loadCounts();
    const timer = setInterval(loadCounts, 30000); // refresh every 30s
    // Lets other components refresh the badges instantly:
    //   window.dispatchEvent(new Event("unblock-requests:changed"))
    window.addEventListener("unblock-requests:changed", loadCounts);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("unblock-requests:changed", loadCounts);
    };
  }, [currentUser]);

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
      setTenant(currentUser.domain);
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

  const signOut = async ({ callbackUrl }) => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = callbackUrl;
    } catch (err) {
      console.error("Logout failed", err);
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
  useEffect(() => {
    const fetchTenants = async () => {
      const res = await fetch(`/api/users`)

      const users = await res.json()
      setTenants(users)
    }
    fetchTenants()
  }, [])
  console.log(tenants)

  const badgeFor = (href) =>
    href === "/failures" ? badCount
      : href === "/blocklist" ? blockedCount
        : href === "/unblock-requests" ? pendingCount
          : 0;
  const renderCount = (c) => (c > 0 ? <span className="count">{c > 99 ? "99+" : c}</span> : null);

  const isGroupOpen = (g) => openGroups[g.label] ?? g.children.some((c) => c === current);
  const toggleGroup = (g) => setOpenGroups((prev) => ({ ...prev, [g.label]: !isGroupOpen(g) }));

  const renderLeaf = (n, { child = false } = {}) => {
    const props = {
      className: "nav",
      "aria-current": n === current ? "page" : undefined,
      style: child ? { paddingLeft: "2.5rem" } : undefined,
    };
    const content = (
      <>
        {!child && <Icon name={n.icon} />}
        <span>{n.label}</span>
        {renderCount(badgeFor(n.href))}
      </>
    );
    // API URLs (downloads) must be plain links, not client-side navigation
    return n.href.startsWith("/api/") ? (
      <a key={n.href} href={n.href} {...props}>{content}</a>
    ) : (
      <Link key={n.href} href={n.href} {...props}>{content}</Link>
    );
  };

  const renderGroup = (g) => {
    const open = isGroupOpen(g);
    const groupId = `nav-group-${g.label.toLowerCase().replace(/\s+/g, "-")}`;
    // While collapsed, surface the counts of the children that need attention
    const attention = g.children.reduce((sum, c) => sum + (c.attention ? badgeFor(c.href) : 0), 0);
    return (
      <div key={g.label}>
        <button
          type="button"
          className="nav"
          aria-expanded={open}
          aria-controls={groupId}
          onClick={() => toggleGroup(g)}
          style={{
            width: "100%",
            background: "transparent",
            border: 0,
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <Icon name={g.icon} />
          <span>{g.label}</span>
          {!open && renderCount(attention)}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              marginLeft: "auto",
              flexShrink: 0,
              transition: "transform .15s ease",
              transform: open ? "rotate(90deg)" : "none",
            }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        {open && (
          <div id={groupId} role="group" aria-label={g.label}>
            {g.children.map((c) => renderLeaf(c, { child: true }))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <i><Icon name="tx" /></i>
          <span>Mail Dashboard</span>
        </div>
        <nav style={{ display: "contents" }} aria-label="Sections">
          {navItems.map((n) => (n.children ? renderGroup(n) : renderLeaf(n)))}
        </nav>
        <div className="side-foot">
          {/* <span>Postal webhooks</span> */}
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
            {/* <span className="tag">Sample data</span> */}

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
                // Object.entries(TENANTS).map(([k, t]) => (
                //   <option key={k} value={t.domain}>{t.name}</option>
                // ))
                tenants?.filter((item) => item.domain).map((i) => {
                  return (
                    <option key={i.id ?? i.domain} value={i.domain}>{i.name}</option>
                  )
                })
              ) : (
                currentUser && (
                  <option value={currentUser.domain}>{currentUser.name}</option>
                )
              )}
            </select>

            {/* <div className="avatar" aria-hidden="true">AD</div> */}
            <UserMenu user={currentUser} onLogout={() => signOut({ callbackUrl: "/login" })} />
          </div>
        </header>
        <main>{children}</main>
      </div>

      <Drawer />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}