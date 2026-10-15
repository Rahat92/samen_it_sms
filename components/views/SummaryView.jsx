"use client";

import { useDashboard } from "../DashboardProvider";
import StatTiles from "../StatTiles";
import VolumeChart from "../VolumeChart";
import Pill from "../Pill";
import { TENANTS } from "@/lib/sample-data";
import { totals } from "@/lib/stats";

const SPLIT = [
  { key: "sent", status: "Sent", color: "var(--bar-ok)" },
  { key: "delayed", status: "Delayed", color: "var(--warn)" },
  { key: "failed", status: "Failed", color: "var(--bar-bad)" },
];

export default function SummaryView() {
  const { scoped, range } = useDashboard();
  const t = totals(scoped);

  return (
    <>
      <StatTiles t={t} />
      <section className="card">
        <header><div><h2>Email volume</h2><p className="hint">Sent versus failed or delayed</p></div></header>
        <div className="pad"><VolumeChart list={scoped} range={range} /></div>
      </section>
      <div className="grid-eq">
        <section className="card">
          <header><div><h2>Status split</h2><p className="hint">Share of all messages in the period</p></div></header>
          <div className="pad">
            {SPLIT.map((s) => {
              const pc = t.total ? (t[s.key] / t.total) * 100 : 0;
              return (
                <div key={s.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Pill status={s.status} />
                    <span className="mono">{t[s.key]} · {pc.toFixed(1)}%</span>
                  </div>
                  <div className="fbar" style={{ height: 8, margin: 0 }}>
                    <i style={{ width: `${pc}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card">
          <header><div><h2>By tenant</h2><p className="hint">Delivery rate per customer</p></div></header>
          <div className="tablewrap">
            <table style={{ minWidth: 520 }}>
              <thead>
                <tr><th>Tenant</th><th>Total</th><th>Sent</th><th>Delayed</th><th>Failed</th><th>Rate</th></tr>
              </thead>
              <tbody>
                {Object.entries(TENANTS).map(([k, ten]) => {
                  const x = totals(scoped.filter((r) => r.tenant === k));
                  return (
                    <tr key={k}>
                      <td>{ten.name}<br /><span className="dim mono" style={{ fontSize: 12 }}>{ten.domain}</span></td>
                      <td className="mono">{x.total}</td>
                      <td className="mono">{x.sent}</td>
                      <td className="mono">{x.delayed}</td>
                      <td className="mono">{x.failed}</td>
                      <td className="mono">{x.rate.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
