"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "../Icon";
import TxTable from "../TxTable";
import { useDashboard } from "../DashboardProvider";
import { CATS, CAT_ORDER } from "@/lib/sample-data";

const STATUSES = ["All", "Sent", "HardFail"];
const PAGE = 12;

export default function TransactionsView({currentUser}) {
  const { q, setQ, total, tenant } = useDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = STATUSES.includes(params.get("status")) ? params.get("status") : "All";
  const cat = CAT_ORDER.includes(params.get("cat")) ? params.get("cat") : "all";
  const [limit, setLimit] = useState(PAGE);
  const [list, setList] = useState([])

  function setParam(key, value, empty) {
    const next = new URLSearchParams(params.toString());
    if (value === empty) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setLimit(PAGE);
  }
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
        {/* <label htmlFor="cat" className="sr-only">Reason</label>
        <select id="cat" className="sel" value={cat} onChange={(e) => setParam("cat", e.target.value, "all")}>
          <option value="all">Any reason</option>
          {CAT_ORDER.map((k) => <option key={k} value={k}>{CATS[k].name}</option>)}
        </select> */}
      </div>

      <section className="card">
        <TxTable limit={limit} status={status} tenant={tenant} q = {q} currentUser={currentUser} />
        <div className="tfoot">
          <span>Showing {Math.min(limit, total)} of {total}</span>
          {total > limit && (
            <button className="btn sm" onClick={() => setLimit((l) => l + PAGE)}>Show {PAGE} more</button>
          )}
        </div>
      </section>
    </>
  );
}
