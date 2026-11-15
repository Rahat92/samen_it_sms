"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const LIMITS = [10, 20, 50, 100]; // rows-per-page choices (the API caps at 100)
const DEFAULT_LIMIT = 20;

const MAX_REASON = 500; // keep in sync with the API
const MAX_CUSTOM_REASON = 100; // same as the Add recipients form

// Keep in sync with REASONS in BlocklistView
const REASONS = [
  { value: "Mailbox Full", label: "Mailbox Full" },
  { value: "Recipient Rejected", label: "Recipient Rejected" },
  { value: "Invalid Mailbox", label: "Invalid Mailbox" },
  { value: "Inactive Mailbox", label: "Inactive Mailbox" },
  { value: "Admin Blocked", label: "Admin Blocked" },
  { value: "other", label: "Other" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const isAdminRole = (role) => role === "ADMIN" || role === "SUPERADMIN";

// Admin can approve while the entry is blocked or waiting for review.
const canAccept = (status) => status === "BLOCKED" || status === "UNBLOCK_REQUESTED";

export default function BlockTable({ compact = false, currentUser }) {
  const { blocked, toast, setBlocked } = useDashboard();
  const [busyId, setBusyId] = useState(null);
  const isAdmin = isAdminRole(currentUser?.role);

  // Server-side pagination (full table only; the compact widget keeps using the shared state)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current; // ignore out-of-order responses
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blocklist?page=${page}&limit=${limit}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(
          res.status === 401 || res.status === 403
            ? "Your session has expired. Please sign in again."
            : "Couldn't load the blocklist."
        );
      }
      const result = await res.json();
      if (id !== reqId.current) return;

      // Page no longer exists (rows were unblocked or removed): jump to the last one
      const { total, totalPages } = result.pagination;
      if (!result.data.length && total > 0 && page > totalPages) {
        setPage(totalPages);
        return;
      }
      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error("load blocklist failed:", err);
      if (id === reqId.current) setError(err.message || "Couldn't load the blocklist.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (!compact) load();
  }, [compact, load]);

  // Other components (e.g. the "add address" form) can refresh the table with:
  //   window.dispatchEvent(new Event("blocklist:changed"))
  useEffect(() => {
    if (compact) return;
    window.addEventListener("blocklist:changed", load);
    return () => window.removeEventListener("blocklist:changed", load);
  }, [compact, load]);

  const rows = compact ? (blocked?.data ?? []).slice(0, 3) : data;
  const shown = rows;

  // Patch one row, both in this page and in the shared blocklist state
  const updateRow = useCallback(
    (id, patch) => {
      const apply = (list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b));
      setData(apply);
      setBlocked((prev) => (prev?.data ? { ...prev, data: apply(prev.data) } : prev));
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
      // UNBLOCKED entries drop out of this list, so totals and the page need a refresh
      if (status === "UNBLOCKED") load();
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
        response = await fetch(`/api/blocklist-requests/${b.id}`, {
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

  // Admin edits the email, reason and status of an entry in one dialog
  async function editEntry(b) {
    if (busyId) return;

    const field = (id, label, value, attrs = "") => `
      <label for="${id}" style="display:block;font-size:13px;text-align:left;margin-top:12px">${label}</label>
      <input id="${id}" class="swal2-input" value="${escapeHtml(value)}" style="margin:4px 0 0;width:100%;box-sizing:border-box" ${attrs}>`;
    // A saved reason that isn't one of the presets is shown as "Other" with its text filled in
    const isPreset = REASONS.some((r) => r.value !== "other" && r.value === b.reason);
    const initialReason = isPreset ? b.reason : "other";
    const initialDetail = isPreset || b.reason === "Other" ? "" : (b.reason ?? "");
    const reasonOptions = REASONS.map(
      (r) => `<option value="${escapeHtml(r.value)}"${r.value === initialReason ? " selected" : ""}>${escapeHtml(r.label)}</option>`
    ).join("");

    const { isConfirmed, value: changes } = await Swal.fire({
      title: "Edit blocked recipient",
      width: 460,
      html: `
        ${field("eb-email", "Email", b.email, 'type="email" autocomplete="off"')}
        <label for="eb-reason" style="display:block;font-size:13px;text-align:left;margin-top:12px">Reason</label>
        <select id="eb-reason" class="swal2-select" style="margin:4px 0 0;width:100%;box-sizing:border-box">${reasonOptions}</select>
        <div id="eb-other-wrap" style="${initialReason === "other" ? "" : "display:none"}">
          ${field("eb-other", "Describe the reason (optional)", initialDetail, `autocomplete="off" maxlength="${MAX_CUSTOM_REASON}"`)}
        </div>`,
      didOpen: () => {
        const select = document.getElementById("eb-reason");
        const wrap = document.getElementById("eb-other-wrap");
        select.addEventListener("change", () => {
          wrap.style.display = select.value === "other" ? "" : "none";
          if (select.value === "other") document.getElementById("eb-other").focus();
        });
      },
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Save changes",
      preConfirm: () => {
        const email = document.getElementById("eb-email").value.trim().toLowerCase();
        const choice = document.getElementById("eb-reason").value;
        const detail = document.getElementById("eb-other").value.trim();
        // "Other" saves the typed text, or the word "Other" when it is left empty
        const reason = choice === "other" ? detail || "Other" : choice;
        // const status = document.getElementById("eb-status").value;
        if (!EMAIL_RE.test(email)) return Swal.showValidationMessage("Enter a valid email address");
        if (!reason) return Swal.showValidationMessage("Reason is required");

        // Send only what changed
        const diff = {};
        if (email !== b.email) diff.email = email;
        if (reason !== (b.reason ?? "")) diff.reason = reason;
        // if (status !== b.status) diff.status = status;
        if (!Object.keys(diff).length) return Swal.showValidationMessage("No changes to save");
        return diff;
      },
    });
    if (!isConfirmed || !changes) return;

    setBusyId(b.id);
    try {
      let response;
      try {
        response = await fetch(`/api/blocklist/${encodeURIComponent(b.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
      } catch {
        throw new Error("Network error. Check your connection.");
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        let message = "Couldn't save the changes. Please try again.";
        if (response.status === 404) message = "This recipient no longer exists.";
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired or you don't have permission.";
        else if (response.status === 429) message = "Too many requests. Please wait a moment.";
        else if (response.status < 500 && body?.error) message = body.error; // e.g. duplicate email
        throw new Error(message);
      }
      const result = await response.json().catch(() => null);
      updateRow(b.id, result?.data ?? changes);
      // UNBLOCKED entries drop out of this list; any status change moves the sidebar counts
      if (changes.status) {
        if (changes.status === "UNBLOCKED") load();
        window.dispatchEvent(new Event("unblock-requests:changed"));
      }
      toast("Recipient updated");
    } catch (err) {
      console.error("editEntry failed:", err);
      toast(err.message || "Couldn't save the changes. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeEntry(b) {
    if (busyId) return;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Delete this recipient?",
      text: `${b.email} will be removed from the blocklist, along with any unblock requests for it. This can't be undone.`,
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      confirmButtonColor: "#dc2626",
    });
    if (!isConfirmed) return;

    setBusyId(b.id);
    try {
      let response;
      try {
        response = await fetch(`/api/blocklist/${encodeURIComponent(b.id)}`, { method: "DELETE" });
      } catch {
        throw new Error("Network error. Check your connection.");
      }
      if (!response.ok) {
        let message = "Couldn't delete the recipient. Please try again.";
        if (response.status === 404) message = "This recipient was already deleted.";
        else if (response.status === 401 || response.status === 403)
          message = "Your session has expired or you don't have permission.";
        throw new Error(message);
      }
      setBlocked((prev) => (prev?.data ? { ...prev, data: prev.data.filter((x) => x.id !== b.id) } : prev));
      window.dispatchEvent(new Event("unblock-requests:changed"));
      toast("Recipient deleted");
      await load(); // refresh totals; the page-no-longer-exists check moves back a page if needed
    } catch (err) {
      console.error("removeEntry failed:", err);
      toast(err.message || "Couldn't delete the recipient. Please try again.");
    } finally {
      setBusyId(null);
    }
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

  if (!compact && loading && !rows.length) {
    return (
      <div className="empty" role="status" aria-live="polite">
        Loading blocklist…
      </div>
    );
  }

  if (!compact && error && !rows.length) {
    return (
      <div className="empty" role="alert">
        <p>{error}</p>
        <button type="button" className="btn sm" onClick={load} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="empty">
        No blocked recipients yet. Add an address above, or block one from a failed transaction.
      </div>
    );
  }

  const total = pagination?.total ?? rows.length;
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  return (
    <div className="tablewrap">
      <table
        style={{
          minWidth: compact ? 420 : 640,
          // keep the previous rows (dimmed) while the next page loads
          opacity: !compact && loading ? 0.55 : 1,
          pointerEvents: !compact && loading ? "none" : undefined,
          transition: "opacity .15s ease",
        }}
        aria-busy={!compact && loading}
      >
        <thead>
          <tr>
            <th>Sl.</th>
            <th>Email</th>
            <th>Domain</th>
            <th>Reason</th>
            <th>Added</th>
            <th>Status</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((b, i) => {
            const s = STATUS[b.status] ?? { label: b.status ?? "Unknown", tone: "muted" };
            const busy = busyId === b.id;

            return (
              <tr key={b.id}>
                <td>{((page - 1) * limit) + (i + 1)}</td>
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
                      {isAdmin ? (
                        <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => editEntry(b)}
                          aria-label={`Edit ${b.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition
               hover:bg-indigo-700 active:scale-[0.98]
               focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600"
                        >
                          <Icon name="set" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeEntry(b)}
                          aria-label={`Delete ${b.email}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition
               hover:bg-red-50 active:scale-[0.98]
               focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
               disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name="close" />
                          Delete
                        </button>
                        </>
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

                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!compact && pagination && (
        <div
          role="navigation"
          aria-label="Blocklist pagination"
          className="pad"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div className="dim" style={{ fontSize: "0.85rem" }} aria-live="polite">
            Showing {from}–{to} of {total}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <label htmlFor="bl-limit" className="dim" style={{ fontSize: "0.85rem" }}>
              Rows per page
            </label>
            <select
              id="bl-limit"
              className="sel"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1); // a new page size starts from the first page
              }}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <button type="button" className="btn sm" disabled={!pagination.hasPrev || loading} onClick={() => setPage(1)} aria-label="First page">
              «
            </button>
            <button type="button" className="btn sm" disabled={!pagination.hasPrev || loading} onClick={() => setPage((n) => n - 1)}>
              Prev
            </button>
            <span className="dim" style={{ fontSize: "0.85rem" }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button type="button" className="btn sm" disabled={!pagination.hasNext || loading} onClick={() => setPage((n) => n + 1)}>
              Next
            </button>
            <button type="button" className="btn sm" disabled={!pagination.hasNext || loading} onClick={() => setPage(pagination.totalPages)} aria-label="Last page">
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}