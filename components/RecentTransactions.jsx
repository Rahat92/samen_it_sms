'use client'
import { useEffect } from "react";
import { Card, CardHeader, CardLink } from "./Card";
const { scoped, range, blocked, tenant } = useDashboard();
console.log(tenant)
import {
  getStats,
  getDaily,
  getFilterOptions,
  getEvents,
} from "@/lib/queries";
import axios from "axios";
const pill = {
  Sent: "bg-emerald-100 text-emerald-800",
  Delayed: "bg-amber-100 text-amber-800",
  Failed: "bg-red-100 text-red-700",
};
const dot = {
  Sent: "bg-ok",
  Delayed: "bg-amber-500",
  Failed: "bg-bad",
};

export default function RecentTransactions({ rows }) {
  // const [stats, daily, filters, result] = await Promise.all([
  //   getStats(),
  //   getDaily(),
  //   getFilterOptions(),
  //   getEvents({
  //     q: "",
  //     status: "",
  //     event: "",
  //     page: 1,
  //     pageSize: 10,
  //   }),
  // ]);
  useEffect(() => {
    const fetchRows = async () => {
      const { data } = await axios.get('/api/events?limit=20&status=Sent&')
    }
  }, [])

  return (
    <Card className="overflow-x-auto">
      <CardHeader
        title="Recent transactions"
        subtitle="Click a row for the full detail"
        action={<CardLink>View all</CardLink>}
      />
      <div className="overflow-x-auto">
        <table className="mt-3 w-full table-fixed text-left text-[10px] overflow-x-scroll">
          {/* <colgroup>
          <col className="w-[82px]" />
          <col className="w-[158px]" />
          <col className="w-[296px]" />
          <col />
        </colgroup> */}
          <thead>
            <tr className="border-y border-line bg-slate-50/70 text-[8px] font-semibold tracking-wider text-muted uppercase">
              <th className="py-2 pl-3.5 font-semibold w-20.5">ID</th>
              <th className="py-2 font-semibold w-39.5">Time</th>
              <th className="py-2 font-semibold w-39.5">To</th>
              <th className="py-2 font-semibold w-74">Subject</th>
              <th className="py-2 pr-3.5 font-semibold w-20.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-slate-50"
              >
                <td className="py-2.75 pl-3.5 font-mono text-[10px]">{r.id}</td>
                <td className="py-2.75 text-slate-500">{r.time}</td>
                <td className="py-2.75">{r.to}</td>
                <td className="py-2.75">{r.subject}</td>
                <td className="py-2.75 pr-3.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${pill[r.status]}`}
                  >
                    <span className={`size-1 rounded-full ${dot[r.status]}`} />
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
