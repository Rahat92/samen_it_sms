"use client";

import { useCallback, useState } from "react";
import Swal from "sweetalert2";
import { useDashboard } from "./DashboardProvider";
import { formatDateTime } from "@/lib/format";
import Icon from "./Icon";

const STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

// Accept is only offered when the entry isn't already approved.
const canAccept = (status) => status === "PENDING" || status === "REJECTED";

export default function BlockTable({ compact = false, currentUser }) {
  const { blocked, removeBlock, toast, setBlocked } = useDashboard();
  const updateBlockStatus = useCallback((id, status) => {
    setBlocked((prev) => ({
      ...prev,
      data: prev.data.map((b) => (b.id === id ? { ...b, status } : b)),
    }));
  }, []);
  const [busyId, setBusyId] = useState(null);
  const rows = blocked?.data ?? [];

  async function changeStatus(b, status, successMessage) {
    console.log("Changing status for:", b, "to", status);
    if (busyId) return;
    setBusyId(b.id);
    try {
      let response;
      try {
        response = await fetch(`/api/blocklist/${encodeURIComponent(b.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
      } catch {
        throw new Error("Network error. Check your connection.");
      }

      if (!response.ok) {
        let message = "Couldn't update status. Please try again.";
        if (response.status === 404) message = "This recipient no longer exists.";
        else if (response.status === 401 || response.status === 403) message = "Your session has expired. Please sign in again.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        throw new Error(message);
      }

      updateBlockStatus(b.id, status);
      toast(successMessage ?? `Status changed to ${STATUS[status].label}`);
    } catch (err) {
      console.error("changeStatus failed:", err);
      toast(err.message || "Couldn't update status. Please try again.");
    } finally {
      setBusyId(null);
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

    if (isConfirmed && value) await changeStatus(b, value);
  }

  async function handleRemove(id) {
    const block = blocked?.data?.find((b) => b.id === id);
    if (!block) return;

    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Remove from blocklist?",
      text: `${block.email} will be able to receive mail again.`,
      showCancelButton: true,
      confirmButtonText: "Yes, remove",
    });
    if (!isConfirmed) return;
    console.log("Removing blocklist entry:", block);
    await changeStatus(block, "REJECTED", "Removed from blocklist");
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
            <th>Domain</th>
            <th>Reason</th>
            <th>Added</th>
            <th>Status</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, compact ? 3 : 50).map((b) => {
            const s = STATUS[b.status] ?? { label: b.status ?? "Unknown", tone: "muted" };
            const busy = busyId === b.id;

            return (
              <tr key={b.id}>
                <td>{b.email}</td>
                <td className="dim">{b.domain ?? "—"}</td>
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
                      {canAccept(b.status) && currentUser.role === "ADMIN" && (
                        <button
                          type="button"
                          className="btn sm success"
                          disabled={busy}
                          onClick={() => changeStatus(b, "APPROVED")}
                          aria-label={`Accept ${b.email}`}
                        >
                          {busy ? "Saving…" : "Accept"}
                        </button>
                      )}
                      {currentUser?.role === "ADMIN" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => editStatus(b)}
                          aria-label={`Edit status for ${b.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition
               hover:bg-indigo-700 active:scale-[0.98]
               focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600"
                        >
                          <Icon name="set" />
                          Edit status
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => requestUnblock(b)} // wire up your handler
                          aria-label={`Request to unblock ${b.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition
               hover:bg-amber-100 active:scale-[0.98]
               focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name="unlock" />
                          Request to Unblock
                        </button>
                      )}
                      {b.status == "PENDING" && (
                        <button
                          type="button"
                          className="btn sm danger"
                          disabled={busy}
                          onClick={() => handleRemove(b.id)}
                          aria-label={`Remove ${b.email} from blocklist`}
                        >
                          Reject
                        </button>
                      )}
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