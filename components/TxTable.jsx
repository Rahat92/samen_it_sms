"use client";

import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { CATS } from "@/lib/sample-data";
import { stamp } from "@/lib/format";
import { useEffect, useState } from "react";
import axios from "axios";

export default function TxTable({ limit, status, compact = false }) {
  const { openEvent, setRows,tenant, range  } = useDashboard();
    const [filteredRows, setFilteredRows] = useState([{}])
  
  useEffect(() => {
    const fetchRows = async() => {
      const {data} = await axios.get(`/api/events?limit=${limit}&status=${(status===''|| status=='All')?'':status }&tenant=${tenant === 'all'?'':tenant}&timeFrom=${range}`)
      setFilteredRows(await data.rows)
    } 
    fetchRows()
  }, [tenant, range, status]) 

  if (filteredRows.length === 0) return <div className="empty">No messages match these filters.</div>;

  return (
    <div className="tablewrap">
      <table style={compact ? { minWidth: 520 } : undefined}>
        <thead>
          <tr>
            <th>Time</th><th>To</th><th>From</th><th>Subject</th><th>Status</th>
            {!compact && <th>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r) => (
            <tr
              key={r.id}
              className="click"
              tabIndex={0}
              onClick={() => openEvent(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(r.id); }
              }}
            >
              {/* <td className="mono dim">{r.id}</td> */}
              <td className="dim">{stamp(r.payload?.payload?.time)}</td>
              <td>{r.toAddress}</td>
              <td>{r.fromAddress}</td>
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
