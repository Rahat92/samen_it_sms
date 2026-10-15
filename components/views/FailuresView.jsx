"use client";

import Link from "next/link";
import Icon from "../Icon";
import Pill from "../Pill";
import { useDashboard } from "../DashboardProvider";
import { CATS, CAT_ORDER } from "@/lib/sample-data";
import { byCat, totals } from "@/lib/stats";

export default function FailuresView() {
  const { scoped } = useDashboard();
  const t = totals(scoped);
  const m = byCat(scoped);
  const keys = CAT_ORDER.filter((k) => m[k] > 0).sort((a, b) => m[b] - m[a]);

  return (
    <>
      <div className="stats">
        <div className="stat"><span className="badge red"><Icon name="fail" /></span><small>Failed / Delayed</small><b>{t.bad}</b></div>
        <div className="stat"><span className="badge amber"><Icon name="clock" /></span><small>Delayed, will retry</small><b>{t.delayed}</b></div>
        <div className="stat"><span className="badge red"><Icon name="block" /></span><small>Failed for good</small><b>{t.failed}</b></div>
        <div className="stat"><span className="badge blue"><Icon name="pct" /></span><small>Success Rate</small><b>{t.rate.toFixed(2)}%</b></div>
      </div>

      {keys.length ? (
        <div className="grid-eq">
          {keys.map((k) => {
            const c = CATS[k];
            return (
              <section className="card" key={k}>
                <header>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <h2>{c.name}</h2><Pill status={c.status} />
                  </div>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{m[k]}</span>
                </header>
                <div className="pad">
                  <p style={{ fontSize: 13.5 }}>{c.advice}</p>
                  <pre className="code">{c.smtp}</pre>
                  <div><Link className="btn sm" href={`/transactions?cat=${k}`}>See the {m[k]} messages</Link></div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="card"><div className="empty">No failures in this period.</div></section>
      )}
    </>
  );
}
