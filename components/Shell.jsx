"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import Drawer from "./Drawer";
import { useDashboard } from "./DashboardProvider";
import { NAV } from "@/lib/nav";
import { TENANTS } from "@/lib/sample-data";
import { totals } from "@/lib/stats";

export default function Shell({ children }) {
  const pathname = usePathname();
  const { range, setRange, tenant, setTenant, scoped, toastMsg } = useDashboard();
  const current = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ?? NAV[0];
  const badCount = totals(scoped).bad;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <i><Icon name="tx" /></i>
          <span>Mail Dashboard</span>
        </div>
        <nav style={{ display: "contents" }} aria-label="Sections">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav" aria-current={n === current ? "page" : undefined}>
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
            <select id="range" className="sel" value={range} onChange={(e) => setRange(Number(e.target.value))}>
              <option value={1}>Last hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={72}>Last 72 hours</option>
            </select>
            <label htmlFor="tenant" className="sr-only">Tenant</label>
            <select id="tenant" className="sel" value={tenant} onChange={(e) => setTenant(e.target.value)}>
              <option value="all">All Tenants</option>
              {Object.entries(TENANTS).map(([k, t]) => {
                console.log(t);
                return <option key={k} value={t.domain}>{t.name}</option>
              }
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
