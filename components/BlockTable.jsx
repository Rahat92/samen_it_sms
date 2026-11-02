"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { useDashboard } from "./DashboardProvider";
import { formatDateTime } from "@/lib/format";

const STATUS = {
  PENDING:  { label: "Pending",  tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

// Accept is only offered when the entry isn't already approved.
const canAccept = (status) => status === "PENDING" || status === "REJECTED";

export default function BlockTable({ compact = false }) {
  // Assumes the provider exposes updateBlockStatus(email, status) to update local state.
  const { blocked, removeBlock, updateBlockStatus, toast } = useDashboard();
  const [busyEmail, setBusyEmail] = useState(null);
  const rows = blocked?.data ?? [];

  async function changeStatus(email, status) {
    if (busyEmail) return;
    setBusyEmail(email);
    try {
      const response = await fetch("/api/blocklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status }),
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

      updateBlockStatus(email, status);
      toast(`Status changed to ${STATUS[status].label}`);
    } catch {
      toast("Couldn't update status. Please try again.");
    } finally {
      setBusyEmail(null);
    }
  }

  async function editStatus(b) {
    const options = Object.fromEntries(
      Object.entries(STATUS)
        .filter(([key]) => key !== b.status)
        .map(([key, value]) => [key, value.label])
    );

    const { isConfirmed, value } = await Swal.fire({
      title: "Edit status",
      text: b.email,
      input: "select",
      inputOptions: options,
      inputPlaceholder: "Select a new status",
      showCancelButton: true,
      confirmButtonText: "Save",
      inputValidator: (v) => (v ? undefined : "Please choose a status."),
    });

    if (isConfirmed && value) await changeStatus(b.email, value);
  }

  async function handleRemove(email) {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Remove from blocklist?",
      text: `${email} will be able to receive mail again.`,
      showCancelButton: true,
      confirmButtonText: "Yes, remove",
    });
    if (!isConfirmed) return;

    try {
      await removeBlock(email);
      toast("Removed from blocklist");
    } catch {
      toast("Couldn't remove recipient. Please try again.");
    }
  }

  if (!rows.length) {
    return (
      <div className="empty">
        No blocked recipients yet. Add an address above, or block one from a failed transaction.
      </div>
    );
  }

  return (
    <div className="tablewrap">
      <table style={{ minWidth: compact ? 420 : 640 }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Reason</th>
            <th>Added</th>
            <th>Status</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, compact ? 3 : 50).map((b) => {
            const s = STATUS[b.status] ?? { label: b.status ?? "Unknown", tone: "muted" };
            const busy = busyEmail === b.email;

            return (
              <tr key={b.email}>
                <td>{b.email}</td>
                <td className="dim wrap">{b.reason}</td>
                <td className="dim">{formatDateTime(b.createdAt)}</td>
                <td className="dim">
                  <span className={`status-pill ${s.tone}`}>
                    <span className="dot" aria-hidden="true" />
                    {s.label}
                  </span>
                </td>
                {!compact && (
                  <td>
                    <div className="flex gap-1 row-actions">
                      {canAccept(b.status) && (
                        <button
                          type="button"
                          className="btn sm success"
                          disabled={busy}
                          onClick={() => changeStatus(b.email, "APPROVED")}
                          aria-label={`Accept ${b.email}`}
                        >
                          {busy ? "Saving…" : "Accept"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => editStatus(b)}
                        aria-label={`Edit status for ${b.email}`}
                      >
                        Edit status
                      </button>
                      <button
                        type="button"
                        className="btn sm danger"
                        disabled={busy}
                        onClick={() => handleRemove(b.email)}
                        aria-label={`Remove ${b.email} from blocklist`}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}