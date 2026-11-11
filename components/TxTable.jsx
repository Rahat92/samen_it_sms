"use client";

import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { CATS } from "@/lib/sample-data";
import { formatDateTime, stamp } from "@/lib/format";
import { useEffect, useState } from "react";
import axios from "axios";

export default function TxTable({ limit, status, compact = false, q, currentUser, tenant }) {
  const { openEvent, setRows, range, selectedId, setTotal, customRange } = useDashboard();
  const [filteredRows, setFilteredRows] = useState([]);
  // Start as "loading" so the empty message never flashes before the first fetch
  const [loadingRows, setLoadingRows] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to retry after an error
  const [query, setQuery] = useState(q ?? "");

  useEffect(() => {
    if (!currentUser) return; // still waiting for the user: stay in the loading state

    if (currentUser.role !== "USER" && currentUser.role !== "ADMIN") {
      setLoadingRows(false); // nothing will ever load for this role
      return;
    }

    const controller = new AbortController();

    const fetchRows = async () => {
      setLoadingRows(true);
      setError(null);
      try {
        const params = {
          limit,
          status: !status || status === "All" ? "" : status,
          tenant:
            currentUser.role === "USER"
              ? currentUser.domain
              : tenant === "all"
                ? ""
                : tenant,
          timeFrom: !range.from ? range : "",
          from: customRange.from,
          to: customRange.to,
          q: query,
        };

        const { data } = await axios.get("/api/events", {
          params,
          signal: controller.signal,
        });

        const rows = data.rows ?? [];
        setFilteredRows(rows);
        setTotal(data.total);
        setRows(rows);
      } catch (err) {
        // A cancelled request means a newer one has started: it owns the loading state
        if (axios.isCancel(err)) return;
        console.error("Failed to fetch events:", err);
        setError("Couldn't load messages. Please try again.");
      } finally {
        // Never clear the flag for a request that was aborted, or it would hide the
        // spinner of the newer request that replaced it
        if (!controller.signal.aborted) setLoadingRows(false);
      }
    };

    fetchRows();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, range, status, query, limit, currentUser, customRange, reloadKey]);

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q ?? ""), 400);
    return () => clearTimeout(timer);
  }, [q]);

  // First load, or refetching while there is nothing to show yet
  if (loadingRows && filteredRows.length === 0) {
    return (
      <div className="empty" role="status" aria-live="polite">
        Loading messages…
      </div>
    );
  }

  if (error && filteredRows.length === 0) {
    return (
      <div className="empty" role="alert">
        <p>{error}</p>
        <button type="button" className="btn sm" onClick={() => setReloadKey((k) => k + 1)} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );
  }

  if (!loadingRows && filteredRows.length === 0) {
    return <div className="empty">No messages match these filters.</div>;
  }

  // Keep the previous rows on screen (dimmed) while a new request is in flight,
  // instead of unmounting the table and flashing "Loading…" on every keystroke/filter change
  return (
    <div
      className="tablewrap"
      aria-busy={loadingRows}
      style={{
        opacity: loadingRows ? 0.55 : 1,
        pointerEvents: loadingRows ? "none" : undefined,
        transition: "opacity .15s ease",
      }}
    >
      {loadingRows && (
        <span className="sr-only" role="status">
          Updating messages…
        </span>
      )}
      {error && (
        <div className="empty" role="alert">
          {error}{" "}
          <button type="button" className="btn sm" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}
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