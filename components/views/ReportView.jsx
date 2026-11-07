"use client";

import { useEffect, useState } from "react";
import { useDashboard } from "../DashboardProvider";

const REPORT_API = "/api/events/report";
const TIMEOUT_MS = 60000; // PDFs can take a while to render
const FORMATS = [
  { key: "pdf", label: "PDF", hint: "Formatted report with a summary, up to 2,000 events" },
  { key: "csv", label: "CSV", hint: "Spreadsheet-friendly data, up to 50,000 events" },
];

const dhakaDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

const hoursOf = (range) => {
  const n = Number(range);
  return range !== "" && range != null && Number.isFinite(n) && n > 0 ? n : null;
};

function periodLabel(range, customRange) {
  const hours = hoursOf(range);
  if (hours) return hours === 1 ? "Last hour" : `Last ${hours} hours`;
  const { from, to } = customRange ?? {};
  if (from && to) {
    if (from === to) return from === dhakaDay(new Date()) ? "Today" : from;
    return `${from} → ${to}`;
  }
  return "All time";
}

/**
 * Downloads the events report (PDF or CSV) for whatever the dashboard filters
 * (period, tenant) currently select. There is no filter UI here on purpose.
 * Optional `status` / `q` props pass through a status or search filter from the page.
 */
export default function ReportView({ status, q }) {
  const { range, customRange, tenant } = useDashboard();
  const [busy, setBusy] = useState(null); // "pdf" | "csv" while generating
  const [result, setResult] = useState(null); // { type: "success" | "warning" | "error", message }

  // A report message describes the filters it was made with, so drop it when they change
  useEffect(() => {
    setResult(null);
  }, [range, customRange, tenant, status, q]);

  function buildUrl(format) {
    const p = new URLSearchParams({ format });
    const set = (k, v) => {
      if (v !== "" && v != null) p.set(k, String(v));
    };
    set("status", status && status !== "All" ? status : "");
    set("tenant", tenant);
    set("q", q);
    const hours = hoursOf(range);
    if (hours) set("range", hours);
    else if (customRange?.from && customRange?.to) {
      set("from", customRange.from);
      set("to", customRange.to);
    }
    return `${REPORT_API}?${p}`;
  }

  async function download(format) {
    if (busy) return;
    setBusy(format);
    setResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      let res;
      try {
        res = await fetch(buildUrl(format), { cache: "no-store", signal: controller.signal });
      } catch (err) {
        throw new Error(
          err?.name === "AbortError"
            ? "Generating the report took too long. Try a shorter period."
            : "Network error. Check your connection."
        );
      }

      if (!res.ok) {
        let message = "Couldn't generate the report. Please try again.";
        if (res.status === 401) message = "Your session has expired. Please sign in again.";
        else if (res.status === 403) message = "You don't have permission to export this report.";
        else if (res.status === 429) message = "Too many requests. Please wait a moment.";
        else if (res.status < 500) {
          const body = await res.json().catch(() => null);
          if (body?.error) message = body.error;
        }
        throw new Error(message);
      }

      const total = Number(res.headers.get("X-Total-Rows") ?? 0);
      const truncated = res.headers.get("X-Truncated") === "true";

      // Nothing matched: don't hand over an empty file
      if (total === 0) {
        setResult({ type: "warning", message: "No events match the current filters, so there is nothing to export." });
        return;
      }

      const blob = await res.blob();
      const filename =
        /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
        `mail-report.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setResult(
        truncated
          ? {
              type: "warning",
              message: `${filename} was downloaded, but it only includes the most recent events (${total.toLocaleString()} matched). Narrow the period or tenant to get everything.`,
            }
          : {
              type: "success",
              message: `${filename} downloaded (${total.toLocaleString()} ${total === 1 ? "event" : "events"}).`,
            }
      );
    } catch (err) {
      console.error("report download failed:", err);
      setResult({ type: "error", message: err.message || "Couldn't generate the report. Please try again." });
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  }

  const filters = [
    { label: "Period", value: periodLabel(range, customRange) },
    { label: "Tenant", value: !tenant || tenant === "all" ? "All tenants" : tenant },
    ...(status && status !== "All" ? [{ label: "Status", value: status }] : []),
    ...(q ? [{ label: "Search", value: q }] : []),
  ];

  return (
    <section className="card">
      <header>
        <div>
          <h2>Export report</h2>
          <p className="hint">
            Uses the period and tenant selected at the top of the page. Change them there to change what is exported.
          </p>
        </div>
      </header>

      <div className="pad">
        <dl
          aria-label="Filters applied to this report"
          style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px", margin: "0 0 20px" }}
        >
          {filters.map((f) => (
            <div key={f.label}>
              <dt className="dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: ".04em" }}>
                {f.label}
              </dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {FORMATS.map((f) => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
              <button
                type="button"
                className="btn"
                disabled={!!busy}
                aria-busy={busy === f.key}
                onClick={() => download(f.key)}
              >
                {busy === f.key ? "Generating…" : `Download ${f.label}`}
              </button>
              <span className="dim" style={{ fontSize: "0.8rem" }}>
                {f.hint}
              </span>
            </div>
          ))}
        </div>

        {result && (
          <p
            role={result.type === "error" ? "alert" : "status"}
            className="dim"
            style={{
              marginTop: 16,
              fontWeight: 500,
              color:
                result.type === "error" ? "#dc2626" : result.type === "warning" ? "#b45309" : "#15803d",
            }}
          >
            {result.message}
          </p>
        )}
      </div>
    </section>
  );
}