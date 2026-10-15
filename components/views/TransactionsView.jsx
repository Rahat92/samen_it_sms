"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "../Icon";
import TxTable from "../TxTable";
import { useDashboard } from "../DashboardProvider";
import { CATS, CAT_ORDER } from "@/lib/sample-data";

const STATUSES = ["All", "Sent", "Delayed", "Failed"];
const PAGE = 20;

export default function TransactionsView() {
  const { scoped } = useDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = STATUSES.includes(params.get("status")) ? params.get("status") : "All";
  const cat = CAT_ORDER.includes(params.get("cat")) ? params.get("cat") : "all";
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  function setParam(key, value, empty) {
    const next = new URLSearchParams(params.toString());
    if (value === empty) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setLimit(PAGE);
  }

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((r) => {
      if (status !== "All" && r.status !== status) return false;
      if (cat !== "all" && r.cat !== cat) return false;
      if (needle && `${r.to} ${r.subject} ${r.id}`.toLowerCase().indexOf(needle) < 0) return false;
      return true;
    });
  }, [scoped, status, cat, q]);

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search recipient, subject or ID"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
          />
        </label>
        <div className="chips" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button key={s} className="chip" aria-pressed={status === s} onClick={() => setParam("status", s, "All")}>
              {s}
            </button>
          ))}
        </div>
        <label htmlFor="cat" className="sr-only">Reason</label>
        <select id="cat" className="sel" value={cat} onChange={(e) => setParam("cat", e.target.value, "all")}>
          <option value="all">Any reason</option>
          {CAT_ORDER.map((k) => <option key={k} value={k}>{CATS[k].name}</option>)}
        </select>
      </div>

      <section className="card">
        <TxTable list={list} limit={limit} />
        <div className="tfoot">
          <span>Showing {Math.min(limit, list.length)} of {list.length}</span>
          {list.length > limit && (
            <button className="btn sm" onClick={() => setLimit((l) => l + PAGE)}>Show 20 more</button>
          )}
        </div>
      </section>
    </>
  );
}
