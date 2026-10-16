"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";
import Pill from "./Pill";
import { useDashboard } from "./DashboardProvider";
import { rows, CATS, EVENT, TENANTS } from "@/lib/sample-data";
import { HOUR, hms } from "@/lib/format";

export default function Drawer() {
  const { selectedId, closeEvent, isBlocked, addBlock, toast, copy, rows  } = useDashboard();
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
  const tenant = TENANTS[row.fromAddress.split("@")[1]] || { name: row.fromAddress.split("@")[1], from: row.fromAddress };
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
              <Pill status={row.status === 'HardFail'?'Hard Fail':row.status === 'SoftFail'?'Soft Fail':row.status} />
              <span className="mono hint">{EVENT[row.status]}</span>
            </div>
          </div>
          <button ref={closeRef} className="iconbtn" onClick={closeEvent} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer-body">
          {row.status !== 'Sent' ? (
            <div className={`callout ${row.status}`}>
              <Icon name={row.status === "Delayed" ? "clock" : "fail"} />
              <div><strong>{row.output}</strong><p>{row.details}</p></div>
            </div>
          ) : (
            <div className="callout Sent">
              <Icon name="check" />
              <div><strong>Delivered</strong><p>The receiving server accepted this message.</p></div>
            </div>
          )}

          <dl className="facts">
            <dt>To</dt><dd>{row.toAddress}</dd>
            <dt>From</dt><dd>{tenant.from}</dd>
            <dt>Tenant</dt><dd>{tenant.name}</dd>
            <dt>Event ID</dt><dd className="mono">{row.id}</dd>
            <dt>Time (Dhaka)</dt><dd className="mono">{hms(row.t)}</dd>
            <dt>Time (UTC)</dt><dd className="mono">{hms(row.t - 6 * HOUR)}</dd>
          </dl>

          <div>
            <p className="hint" style={{ marginBottom: 8, fontWeight: 600 }}>
              SMTP response{row.real ? "" : " (representative)"}
            </p>
            <pre className="code">{row.output}</pre>
          </div>
        </div>

        <div className="drawer-foot">
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
        </div>
      </aside>
    </>
  );
}
