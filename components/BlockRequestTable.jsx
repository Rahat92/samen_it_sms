"use client";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useDashboard } from "./DashboardProvider";
import { formatDateTime } from "@/lib/format";
import Icon from "./Icon";

// Status of an individual unblock request (UnblockRequest.status)
const STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const isAdminRole = (role) => role === "ADMIN" || role === "SUPERADMIN";

export default function BlockRequestTable({ compact = false, currentUser }) {
  const { toast } = useDashboard();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const isAdmin = isAdminRole(currentUser?.role);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/blocklist-requests");
        if (!res.ok) throw new Error("Couldn't load unblock requests.");
        const result = await res.json();
        if (!cancelled) setRequests(result.data ?? []);
      } catch (err) {
        console.error("fetch unblock requests failed:", err);
        if (!cancelled) toast(err.message || "Couldn't load unblock requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update one request in local state after a review
  const applyReview = useCallback((id, updated, action) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: updated.status,
              reviewNote: updated.reviewNote ?? null,
              reviewedAt: updated.reviewedAt ?? new Date().toISOString(),
              reviewedBy: currentUser
                ? { id: currentUser.id, name: currentUser.name }
                : r.reviewedBy,
              blockList: {
                ...r.blockList,
                status: action === "approve" ? "UNBLOCKED" : "BLOCKED",
              },
            }
          : r
      )
    );
  }, [currentUser]);

  async function review(r, action, note) {
    if (busyId) return;
    setBusyId(r.id);
    try {
      let response;
      try {
        response = await fetch(`/api/unblock-requests/${encodeURIComponent(r.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note: note || undefined }),
        });
      } catch {
        throw new Error("Network error. Check your connection.");
      }

      if (!response.ok) {
        let message = "Couldn't update request. Please try again.";
        if (response.status === 404) message = "This request no longer exists.";
        else if (response.status === 409) message = "This request was already reviewed.";
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired or you don't have permission.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        throw new Error(message);
      }

      const result = await response.json();
      applyReview(r.id, result.data, action);
      toast(action === "approve" ? `${r.blockList.email} unblocked` : "Request rejected");
    } catch (err) {
      console.error("review failed:", err);
      toast(err.message || "Couldn't update request. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(r) {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Approve unblock request?",
      text: `${r.blockList.email} will be unblocked and able to receive mail again.`,
      showCancelButton: true,
      confirmButtonText: "Yes, approve",
    });
    if (isConfirmed) await review(r, "approve");
  }

  async function handleReject(r) {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: "Reject unblock request?",
      text: `${r.blockList.email} will stay blocked.`,
      input: "textarea",
      inputPlaceholder: "Optional note for the requester…",
      showCancelButton: true,
      confirmButtonText: "Reject",
    });
    if (isConfirmed) await review(r, "reject", value?.trim());
  }

  if (loading) {
    return <div className="empty">Loading unblock requests…</div>;
  }

  if (!requests.length) {
    return (
      <div className="empty">
        {isAdmin
          ? "No unblock requests yet."
          : "You haven't requested any unblocks yet."}
      </div>
    );
  }

  return (
    <div className="tablewrap">
      <table style={{ minWidth: compact ? 420 : 900 }}>
        <thead>
          <tr>
            <th>Id</th>
            <th>Email</th>
            <th>Requested by</th>
            {!compact && <th>Reason</th>}
            <th>Requested</th>
            <th>Status</th>
            {!compact && isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.slice(0, compact ? 3 : 50).map((r) => {
            const s = STATUS[r.status] ?? { label: r.status ?? "Unknown", tone: "muted" };
            const busy = busyId === r.id;
            const pending = r.status === "PENDING";

            return (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.blockList?.email ?? "—"}</td>
                <td>
                  <div>{r.requestedBy?.name ?? "—"}</div>
                  <div className="dim">{r.requestedBy?.email}</div>
                </td>
                {!compact && <td className="dim wrap">{r.blockList?.reason ?? "—"}</td>}
                <td className="dim">{formatDateTime(r.createdAt)}</td>
                <td className="dim">
                  <span className={`status-pill ${s.tone}`}>
                    <span className="dot" aria-hidden="true" />
                    {s.label}
                  </span>
                </td>
                {/* {!compact && (
                  <td className="dim wrap">
                    {r.reviewedAt ? (
                      <>
                        <div>{r.reviewedBy?.name ?? "Admin"}</div>
                        <div>{formatDateTime(r.reviewedAt)}</div>
                        {r.reviewNote && <div>“{r.reviewNote}”</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )} */}
                {!compact && isAdmin && (
                  <td>
                    <div className="flex gap-1 row-actions">
                      {pending ? (
                        <>
                          <button
                            type="button"
                            className="btn sm success"
                            disabled={busy}
                            onClick={() => handleApprove(r)}
                            aria-label={`Approve unblock for ${r.blockList?.email}`}
                          >
                            {busy ? "Saving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="btn sm danger"
                            disabled={busy}
                            onClick={() => handleReject(r)}
                            aria-label={`Reject unblock for ${r.blockList?.email}`}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="dim">
                          <Icon name="review" /> Reviewed
                        </span>
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