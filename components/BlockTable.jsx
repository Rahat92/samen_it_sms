"use client";

import { useCallback, useState } from "react";
import Swal from "sweetalert2";
import { useDashboard } from "./DashboardProvider";
import { formatDateTime } from "@/lib/format";
import Icon from "./Icon";

// BlockList.status
const STATUS = {
  BLOCKED: { label: "Blocked", tone: "danger" },
  UNBLOCK_REQUESTED: { label: "Unblock requested", tone: "warning" },
  UNBLOCKED: { label: "Unblocked", tone: "success" },
};

const isAdminRole = (role) => role === "ADMIN" || role === "SUPERADMIN";

// Admin can approve while the entry is blocked or waiting for review.
const canAccept = (status) => status === "BLOCKED" || status === "UNBLOCK_REQUESTED";

export default function BlockTable({ compact = false, currentUser }) {
  const { blocked, toast, setBlocked } = useDashboard();
  const [busyId, setBusyId] = useState(null);
  const rows = blocked?.data ?? [];
  const isAdmin = isAdminRole(currentUser?.role);

  // Patch one row in the shared blocklist state
  const updateRow = useCallback(
    (id, patch) => {
      setBlocked((prev) => ({
        ...prev,
        data: prev.data.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }));
    },
    [setBlocked]
  );

  async function changeStatus(b, status, successMessage) {
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
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired. Please sign in again.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        throw new Error(message);
      }

      updateRow(b.id, { status });
      toast(successMessage ?? `Status changed to ${STATUS[status].label}`);
    } catch (err) {
      console.error("changeStatus failed:", err);
      toast(err.message || "Couldn't update status. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  // User asks for a blocked entry to be reviewed for unblocking
  async function requestUnblock(b) {
    if (busyId) return;

    const { isConfirmed, value } = await Swal.fire({
      title: "Request to unblock?",
      text: b.email,
      input: "textarea",
      inputPlaceholder: "Why should this address be unblocked? (optional)",
      showCancelButton: true,
      confirmButtonText: "Submit request",
    });
    if (!isConfirmed) return;

    setBusyId(b.id);
    try {
      let response;
      try {
        response = await fetch(`http://localhost:3001/api/blocklist-requests/${b.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: value?.trim() || undefined }),
        });
      } catch {
        throw new Error("Network error. Check your connection.");
      }

      if (!response.ok) {
        let message = "Couldn't submit the request. Please try again.";
        if (response.status === 404) message = "This entry no longer exists.";
        else if (response.status === 409) message = "A request for this entry is already in progress.";
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired or you don't have permission.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        throw new Error(message);
      }

      const result = await response.json();

      // Update the page right away: row flips to "Unblock requested" / "Admin Review in Progress"
      updateRow(b.id, {
        status: "UNBLOCK_REQUESTED",
        unblockRequest: result.data ?? { status: "PENDING" },
      });

      await Swal.fire({
        icon: "success",
        title: "Request submitted",
        text: `Your request to unblock ${b.email} was sent to an admin for review.`,
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("requestUnblock failed:", err);
      await Swal.fire({
        icon: "error",
        title: "Request failed",
        text: err.message || "Couldn't submit the request. Please try again.",
      });
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

  // Admin rejects a pending unblock request -> back to BLOCKED
  async function handleReject(id) {
    const block = rows.find((b) => b.id === id);
    if (!block) return;

    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Reject unblock request?",
      text: `${block.email} will stay blocked.`,
      showCancelButton: true,
      confirmButtonText: "Yes, reject",
    });
    if (!isConfirmed) return;
    await changeStatus(block, "BLOCKED", "Request rejected");
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
            <th>Id</th>
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
                <td>{b.id}</td>
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
                      {isAdmin && canAccept(b.status) && (
                        <button
                          type="button"
                          className="btn sm success"
                          disabled={busy}
                          onClick={() => changeStatus(b, "UNBLOCKED", "Unblocked")}
                          aria-label={`Accept ${b.email}`}
                        >
                          {busy ? "Saving…" : "Accept"}
                        </button>
                      )}

                      {isAdmin ? (
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
                      ) : b.status === "UNBLOCK_REQUESTED" ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800"
                          aria-label={`Unblock request for ${b.email} is under review`}
                        >
                          <Icon name="review" />
                          Admin Review in Progress
                        </span>
                      ) : b.status === "BLOCKED" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => requestUnblock(b)}
                          aria-label={`Request to unblock ${b.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition
               hover:bg-amber-100 active:scale-[0.98]
               focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name="unlock" />
                          {busy ? "Submitting…" : "Request to Unblock"}
                        </button>
                      ) : null}

                      {isAdmin && b.status === "UNBLOCK_REQUESTED" && (
                        <button
                          type="button"
                          className="btn sm danger"
                          disabled={busy}
                          onClick={() => handleReject(b.id)}
                          aria-label={`Reject unblock request for ${b.email}`}
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