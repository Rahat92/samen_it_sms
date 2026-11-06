"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useDashboard } from "./DashboardProvider";
import { formatDateTime } from "@/lib/format";
import Icon from "./Icon";

const API = "/api/blocklist-requests"; // list: GET ${API}   review: PATCH ${API}/:id
const PAGE_SIZE = 50;

// Status of an individual unblock request (UnblockRequest.status)
const STATUS = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const isAdminRole = (role) => role === "ADMIN" || role === "SUPERADMIN";
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
// Tells the sidebar badge (Shell) to refetch the pending count right away
const notifyChanged = () => window.dispatchEvent(new Event("unblock-requests:changed"));

export default function BlockRequestTable({ compact = false, currentUser }) {
  const { toast } = useDashboard();
  const isAdmin = isAdminRole(currentUser?.role);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState(isAdmin ? "PENDING" : "ALL");
  const [query, setQuery] = useState("");

  // ---------- load ----------
  const load = useCallback(
    async ({ silent = false } = {}) => {
      silent ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? "Your session has expired. Please sign in again."
              : "Couldn't load unblock requests."
          );
        }
        const result = await res.json();
        setRequests(result.data ?? []);
      } catch (err) {
        console.error("fetch unblock requests failed:", err);
        const message = err.message || "Couldn't load unblock requests.";
        if (silent) toast(message);
        else setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  // ---------- derived data ----------
  const counts = useMemo(() => {
    const c = { ALL: requests.length, PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const r of requests) if (c[r.status] !== undefined) c[r.status] += 1;
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (!q) return true;
      return [
        r.blockList?.email,
        r.blockList?.domain,
        r.blockList?.reason,
        r.requestedBy?.name,
        r.requestedBy?.email,
        r.message,
      ].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [requests, filter, query]);

  const shown = visible.slice(0, compact ? 3 : PAGE_SIZE);

  // ---------- review ----------
  // Update one row locally after a successful review (no refetch needed)
  const applyReview = useCallback(
    (id, updated, status) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                reviewNote: updated.reviewNote ?? null,
                reviewedAt: updated.reviewedAt ?? new Date().toISOString(),
                reviewedBy: currentUser ? { id: currentUser.id, name: currentUser.name } : r.reviewedBy,
                blockList: { ...r.blockList, status: status === "APPROVED" ? "UNBLOCKED" : "BLOCKED" },
              }
            : r
        )
      );
    },
    [currentUser]
  );

  async function review(r, status, note) {
    if (busyId) return;
    setBusyId(r.id);
    try {
      let response;
      try {
        response = await fetch(`${API}/${encodeURIComponent(r.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, note: note || undefined }),
        });
      } catch {
        throw new Error("Network error. Check your connection.");
      }

      if (!response.ok) {
        let message = "Couldn't update the request. Please try again.";
        if (response.status === 404) message = "This request no longer exists.";
        else if (response.status === 409) message = "Another admin already reviewed this request.";
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired or you don't have permission.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        // Row is out of date: pull the latest state
        if (response.status === 404 || response.status === 409) load({ silent: true });
        throw new Error(message);
      }

      const result = await response.json();
      const updated = result.data?.request ?? result.data ?? {};
      applyReview(r.id, updated, status);
      notifyChanged();
      toast(
        status === "APPROVED"
          ? `${r.blockList?.email} was unblocked`
          : `Request for ${r.blockList?.email} was rejected`
      );
    } catch (err) {
      console.error("review failed:", err);
      await Swal.fire({
        icon: "error",
        title: "Couldn't update request",
        text: err.message || "Please try again.",
        confirmButtonText: "OK",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(r) {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Approve unblock request?",
      text: `${r.blockList?.email} will be unblocked and able to receive mail again.`,
      showCancelButton: true,
      confirmButtonText: "Yes, approve",
      focusCancel: true,
    });
    if (isConfirmed) await review(r, "APPROVED");
  }

  async function handleReject(r) {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: "Reject unblock request?",
      text: `${r.blockList?.email} will stay blocked.`,
      input: "textarea",
      inputPlaceholder: "Optional note for the requester…",
      inputAttributes: { maxlength: 1000, "aria-label": "Reason for rejecting" },
      showCancelButton: true,
      confirmButtonText: "Reject request",
      confirmButtonColor: "#dc2626",
    });
    if (isConfirmed) await review(r, "REJECTED", value?.trim());
  }

  // ---------- states ----------
  if (loading) {
    return (
      <div className="empty" role="status" aria-live="polite">
        Loading unblock requests…
      </div>
    );
  }

  if (error && !requests.length) {
    return (
      <div className="empty" role="alert">
        <p>{error}</p>
        <button type="button" className="btn sm" onClick={() => load()} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="empty">
        {isAdmin ? "No unblock requests yet." : "You haven't requested any unblocks yet."}
      </div>
    );
  }

  const filtersActive = filter !== "ALL" || query.trim() !== "";

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.key)}
                  className={
                    "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
                    (active
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-300 bg-transparent hover:bg-slate-500/10")
                  }
                >
                  {f.label}
                  <span
                    className={
                      "ml-1.5 rounded-full px-1.5 text-xs " + (active ? "bg-white/25" : "bg-slate-500/15")
                    }
                  >
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="req-search" className="sr-only">
              Search requests
            </label>
            <input
              id="req-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, name, reason…"
              className="w-56 rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <button
              type="button"
              className="btn sm"
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              aria-label="Refresh requests"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      )}

      {!shown.length ? (
        <div className="empty">
          No requests match your filters.
          {filtersActive && (
            <>
              {" "}
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setFilter("ALL");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="tablewrap">
          <table style={{ minWidth: compact ? 420 : 900 }} aria-busy={refreshing}>
            <caption className="sr-only">Unblock requests</caption>
            <thead>
              <tr>
                <th scope="col">Id</th>
                <th scope="col">Email</th>
                <th scope="col">Requested by</th>
                {!compact && <th scope="col">Reason</th>}
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                {!compact && isAdmin && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status ?? "Unknown", tone: "muted" };
                const busy = busyId === r.id;
                const pending = r.status === "PENDING";

                return (
                  <tr key={r.id} aria-busy={busy}>
                    <td>{r.id}</td>
                    <td>
                      <div>{r.blockList?.email ?? "—"}</div>
                      {r.blockList?.domain && <div className="dim">{r.blockList.domain}</div>}
                    </td>
                    <td>
                      <div>{r.requestedBy?.name ?? "—"}</div>
                      <div className="dim">{r.requestedBy?.email}</div>
                      {!compact && r.message && (
                        <div className="dim wrap" title={r.message} style={{ fontStyle: "italic" }}>
                          “{clip(r.message, 80)}”
                        </div>
                      )}
                    </td>
                    {!compact && <td className="dim wrap">{r.blockList?.reason ?? "—"}</td>}
                    <td className="dim">{formatDateTime(r.createdAt)}</td>
                    <td className="dim">
                      <span className={`status-pill ${s.tone}`}>
                        <span className="dot" aria-hidden="true" />
                        {s.label}
                      </span>
                      {r.reviewedAt && (
                        <div className="dim wrap" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                          {r.reviewedBy?.name ?? "Admin"} · {formatDateTime(r.reviewedAt)}
                          {r.reviewNote && (
                            <div title={r.reviewNote} style={{ fontStyle: "italic" }}>
                              “{clip(r.reviewNote, 60)}”
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    {!compact && isAdmin && (
                      <td>
                        <div className="flex gap-1 row-actions">
                          {pending ? (
                            <>
                              <button
                                type="button"
                                className="btn sm success"
                                disabled={busy || !!busyId}
                                onClick={() => handleApprove(r)}
                                aria-label={`Approve unblock for ${r.blockList?.email}`}
                              >
                                {busy ? "Saving…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="btn sm danger"
                                disabled={busy || !!busyId}
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
      )}

      {!compact && shown.length > 0 && (
        <p className="dim" style={{ marginTop: 8, fontSize: "0.8rem" }} aria-live="polite">
          Showing {shown.length} of {visible.length}
          {visible.length !== requests.length && ` (${requests.length} total)`}
        </p>
      )}
    </div>
  );
}