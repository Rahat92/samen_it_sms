"use client";

import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { CATS } from "@/lib/sample-data";
import { formatDateTime, stamp } from "@/lib/format";
import { useEffect, useState } from "react";
import axios from "axios";

export default function TxTable({ limit, status, compact = false, q, currentUser, tenant }) {
  const { openEvent, setRows, range, selectedId, setTotal, customRange } = useDashboard();
  const [filteredRows, setFilteredRows] = useState([])
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role !== 'USER' && currentUser.role !== 'ADMIN') {
      return;
    }

    const controller = new AbortController();
    const fetchRows = async () => {
      try {
        const params = {
          limit,
          status: !status || status === 'All' ? '' : status,
          tenant:
            currentUser.role === 'USER'
              ? currentUser.email.split('@')[1]
              : tenant === 'all'
                ? ''
                : tenant,
          timeFrom: !range.from?range:'',
          from: customRange.from,
          to: customRange.to,
          q: query,
        };

        const { data } = await axios.get('/api/events', {
          params,
          signal: controller.signal,
        });

        setFilteredRows(data.rows);
        setTotal(data.total);
        setRows(data.rows);
      } catch (error) {
        if (error.code !== 'ERR_CANCELED') {
          console.error('Failed to fetch events:', error);
        }
      }
    };

    fetchRows();

    return () => controller.abort();
  }, [tenant, range, status, query, limit, currentUser, customRange]);
  useEffect(() => {
    let timer = setTimeout(() => {
      setQuery(q)
    }, 400)
    return () => {
      clearTimeout(timer)
    }
  }, [q])
  if (filteredRows.length === 0) return <div className="empty">No messages match these filters.</div>;

  return (
    <div className="tablewrap">
      <table style={compact ? { minWidth: 520 } : undefined}>
        <thead>
          <tr>
            <th>Sl</th><th>Time</th><th>To</th><th>From</th><th>Subject</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r, index) => (
            <tr
              key={r.id}
              className="click"
              tabIndex={0}
              onClick={() => openEvent(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEvent(r.id); }
              }}
            >
              <td className="mono dim">{index + 1}</td>
              <td className="dim">{formatDateTime(r.occurredAt)}</td>
              <td>{r.toAddress}</td>
              <td>{r.fromAddress}</td>
              <td className="wrap">{r.subject}</td>
              <td><Pill status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
