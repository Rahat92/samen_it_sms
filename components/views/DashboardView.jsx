"use client";

import Link from "next/link";
import { useDashboard } from "../DashboardProvider";
import StatTiles from "../StatTiles";
import VolumeChart from "../VolumeChart";
import FailureList from "../FailureList";
import TxTable from "../TxTable";
import BlockTable from "../BlockTable";
import { totals } from "@/lib/stats";

export default function DashboardView({stats, daily, filters, result, sent}) {
  console.log("DashboardView", {stats, daily, filters, result});
  const { scoped, range, blocked } = useDashboard();
  const t = totals(scoped);

  return (
    <>
      <StatTiles t={t} stats={stats} sent={sent} />
      <div className="grid-2">
        <section className="card">
          <header><div><h2>Email volume</h2><p className="hint">Sent versus failed or delayed</p></div></header>
          <div className="pad"><VolumeChart list={scoped} range={range} /></div>
        </section>
        <section className="card">
          <header>
            <div><h2>Failures</h2><p className="hint">Errors and troubleshooting</p></div>
            <Link className="link" href="/failures">View all</Link>
          </header>
          <div className="pad"><FailureList stats={stats} limit={5} /></div>
        </section>
      </div>
      <div className="grid-2">
        <section className="card">
          <header>
            <div><h2>Recent transactions</h2><p className="hint">Click a row for the full detail</p></div>
            <Link className="link" href="/transactions">View all</Link>
          </header>
          <TxTable list={result.rows} limit={6} compact />
        </section>
        <section className="card">
          <header>
            <div><h2>Blocked recipients</h2><p className="hint">{blocked.length} blocked</p></div>
            <Link className="link" href="/blocklist">Manage</Link>
          </header>
          <BlockTable compact />
        </section>
      </div>
    </>
  );
}
