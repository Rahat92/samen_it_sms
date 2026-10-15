"use client";

import { useDashboard } from "./DashboardProvider";
import { stamp } from "@/lib/format";

export default function BlockTable({ compact = false }) {
  const { blocked, removeBlock, toast } = useDashboard();

  if (!blocked.length) {
    return <div className="empty">No blocked recipients yet. Add an address above, or block one from a failed transaction.</div>;
  }

  return (
    <div className="tablewrap">
      <table style={{ minWidth: compact ? 420 : 640 }}>
        <thead>
          <tr><th>Email</th><th>Reason</th><th>Added</th>{!compact && <th />}</tr>
        </thead>
        <tbody>
          {blocked.slice(0, compact ? 3 : 50).map((b) => (
            <tr key={b.email}>
              <td>{b.email}</td>
              <td className="dim wrap">{b.reason}</td>
              <td className="dim">{stamp(b.at)}</td>
              {!compact && (
                <td>
                  <button className="btn sm danger" onClick={() => { removeBlock(b.email); toast("Removed from blocklist"); }}>
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
