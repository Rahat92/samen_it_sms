"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { CATS, EVENT, TENANTS } from "@/lib/sample-data";
import { formatDateTime } from "@/lib/format";

// Copies text and reports whether it worked.
// 1) Modern Clipboard API (needs HTTPS or localhost)
// 2) Fallback: hidden textarea + execCommand, which also works on plain http
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or blocked in an iframe: try the fallback below.
  }

  const previouslyFocused = document.activeElement;
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  } finally {
    previouslyFocused?.focus?.(); // keep keyboard focus inside the drawer
  }
}

// Copy button with "Copied" / "Couldn't copy" feedback.
function CopyButton({ text, label }) {
  const [status, setStatus] = useState(null); // null | "copied" | "failed"
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    const ok = await copyToClipboard(text);
    setStatus(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 2000);
  }

  const tone =
    status === "copied"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition
          active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
          ${tone}`}
      >
        {status === "copied" ? (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </svg>
        ) : status === "failed" ? (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="7" y="7" width="9" height="9" rx="2" />
            <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          </svg>
        )}
        {status === "copied" ? "Copied" : status === "failed" ? "Couldn't copy" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {status === "copied" ? "Copied to clipboard" : status === "failed" ? "Couldn't copy to clipboard" : ""}
      </span>
    </>
  );
}

export default function Drawer() {
  const { selectedId, closeEvent, isBlocked, addBlock, toast, copy, rows } = useDashboard();
  const closeRef = useRef(null);
  const row = rows.find((r) => r.id === selectedId);

  useEffect(() => {
    if (!row) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") closeEvent(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, closeEvent]);

  if (!row) return null;

  const cat = row.cat ? CATS[row.cat] : null;
  // Falls back instead of crashing when no tenant domain matches the sender.
  const tenant =
    Object.values(TENANTS).find((item) => row.fromAddress?.includes(item.domain))?.name ?? "Unknown";
  const blocked = isBlocked(row.toAddress);
  const smtp = cat ? cat.smtp : row.details;

  return (
    <>
      <div className="scrim" onClick={closeEvent} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2 id="drawer-title">{row.subject}</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <Pill status={row.status === "HardFail" ? "Hard Fail" : row.status === "SoftFail" ? "Soft Fail" : row.status} />
              <span className="mono hint">{EVENT[row.status]}</span>
            </div>
          </div>
          <button ref={closeRef} className="iconbtn" onClick={closeEvent} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">
          {row.status !== "Sent" ? (
            <div className={`callout ${row.status}`}>
              <Icon name={row.status === "Delayed" ? "clock" : "fail"} />
              <div>
                <strong>
                  {row.output?.includes("inbox is out of storage space")
                    ? "Mailbox Over Quota (Gmail)"
                    : row.output}
                </strong>
                <p>{row.details}</p>
              </div>
            </div>
          ) : (
            <div className="callout Sent">
              <Icon name="check" />
              <div><strong>Delivered</strong><p>The receiving server accepted this message.</p></div>
            </div>
          )}

          <dl className="facts">
            <dt>To</dt>
            <dd>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-all">{row.toAddress}</span>
                <CopyButton text={row.toAddress} label={`Copy ${row.toAddress}`} />
              </div>
            </dd>
            <dt>From</dt><dd>{row.fromAddress}</dd>
            <dt>Tenant</dt><dd>{tenant}</dd>
            <dt>Event ID</dt><dd className="mono">{row.id}</dd>
            <dt>Time (Dhaka)</dt><dd className="mono">{formatDateTime(row.occurredAt)}</dd>
          </dl>

          <div>
            <p className="hint" style={{ marginBottom: 8, fontWeight: 600 }}>
              SMTP response{row.real ? "" : " (representative)"}
            </p>
            <pre className="code">{row.output}</pre>
          </div>
        </div>

        {/* <div className="drawer-foot">
          <button className="btn" onClick={() => copy(smtp)}>Copy response</button>
          {row.status !== "Sent" &&
            (blocked ? (
              <span className="pill Failed" style={{ alignSelf: "center" }}>Already blocked</span>
            ) : (
              <button
                className="btn danger"
                onClick={() => { addBlock(row.to, cat ? cat.name : "Manual"); toast("Recipient blocked"); }}
              >
                Block recipient
              </button>
            ))}
        </div> */}
      </aside>
    </>
  );
}