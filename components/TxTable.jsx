"use client";

import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { CATS } from "@/lib/sample-data";
import { stamp } from "@/lib/format";
import { useEffect } from "react";

export default function TxTable({ list, limit, compact = false }) {
  const { openEvent, setRows } = useDashboard();
  useEffect(() => {
    setRows(list);
  }, [list, setRows]);
  if (!list.length) return <div className="empty">No messages match these filters.</div>;

  return (
    <div className="tablewrap">
      <table style={compact ? { minWidth: 520 } : undefined}>
        <thead>
          <tr>
            <th>ID</th><th>Time</th><th>To</th><th>Subject</th><th>Status</th>
            {!compact && <th>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {list.slice(0, limit).map((r) => (
            <tr
              key={r.id}
              className="click"
              tabIndex={0}
              onClick={() => openEvent(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(r.id); }
              }}
            >
              <td className="mono dim">{r.id}</td>
              <td className="dim">{stamp(r.payload.payload.time)}</td>
              <td>{r.toAddress}</td>
              <td className="wrap">{r.subject}</td>
              <td><Pill status={r.status} /></td>
              {!compact && <td className="dim">{r.cat ? CATS[r.cat].name : ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
