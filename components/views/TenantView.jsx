"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { formatDateTime } from "@/lib/format";

const ROLES = {
    SUPER_ADMIN: { label: "Super admin", tone: "danger" },
    ADMIN: { label: "Admin", tone: "warning" },
    USER: { label: "User", tone: "muted" },
};

const REQUEST_TIMEOUT_MS = 10000;

// Shared request helper: timeout, network errors and readable server messages.
async function api(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        throw new Error(
            err?.name === "AbortError"
                ? "The request timed out. Please try again."
                : "Network error. Check your connection."
        );
    } finally {
        clearTimeout(timer);
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        // empty or non-JSON body
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
        if (response.status === 403) throw new Error("You don't have permission to do that.");
        if (response.status === 429) throw new Error("Too many requests. Please wait a moment.");
        if (response.status >= 500) throw new Error("Something went wrong on our side. Please try again.");
        throw new Error(data?.error || "Request failed. Please try again.");
    }
    return data;
}

export default function UsersView({ currentUserId }) {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const requestId = useRef(0);

    const load = useCallback(async (term) => {
        const current = ++requestId.current; // ignore out-of-order responses
        setLoading(true);
        setLoadError("");
        try {
            const query = term ? `?search=${encodeURIComponent(term)}` : "";
            const result = await api(`/api/users${query}`);
            if (current === requestId.current) setUsers(result ?? []);
        } catch (err) {
            if (current === requestId.current) setLoadError(err.message);
        } finally {
            if (current === requestId.current) setLoading(false);
        }
    }, []);

    // Debounced search; also runs on first render.
    useEffect(() => {
        const t = setTimeout(() => load(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search, load]);

    function notify(icon, title, text) {
        return Swal.fire({
            icon,
            title,
            text,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
        });
    }

    async function update(u, changes, successMessage) {
        if (busyId) return;
        setBusyId(u.id);
        try {
            const result = await api(`/api/users/${encodeURIComponent(u.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
            });
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...result.data } : x)));
            notify("success", successMessage);
        } catch (err) {
            notify("error", "Couldn't update user", err.message);
        } finally {
            setBusyId(null);
        }
    }
    async function updateRole(u, changes, successMessage) {
        if (busyId) return;
        setBusyId(u.id);
        try {
            const result = await api(`/api/users/${encodeURIComponent(u.id)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(changes),
            });
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...result.data } : x)));
            notify("success", successMessage);
        } catch (err) {
            notify("error", "Couldn't update user", err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function changeRole(u) {
        const options = Object.fromEntries(
            Object.entries(ROLES)
                .filter(([key]) => key !== u.role)
                .map(([key, value]) => [key, value.label])
        );

        const { isConfirmed, value } = await Swal.fire({
            title: "Change role",
            text: u.email,
            input: "select",
            inputOptions: options,
            inputPlaceholder: "Select a new role",
            showCancelButton: true,
            confirmButtonText: "Save",
            inputValidator: (v) => (v ? undefined : "Please choose a role."),
        });
        if (isConfirmed && value) await updateRole(u, { role: value }, `Role changed to ${ROLES[value].label}`);
    }

    async function toggleActive(u) {
        console.log("toggleActive", u);
        const next = !u.isActive;
        if (!next) {
            const { isConfirmed } = await Swal.fire({
                icon: "warning",
                title: "Deactivate this user?",
                text: `${u.email} will no longer be able to sign in.`,
                showCancelButton: true,
                confirmButtonText: "Yes, deactivate",
            });
            if (!isConfirmed) return;
        }
        await update(u, { isActive: next }, next ? "User activated" : "User deactivated");
    }

    async function remove(u) {
        if (busyId) return;
        const { isConfirmed } = await Swal.fire({
            icon: "warning",
            title: "Delete this user?",
            text: `${u.email} will be permanently deleted. This can't be undone.`,
            showCancelButton: true,
            confirmButtonText: "Yes, delete",
            confirmButtonColor: "#dc2626",
        });
        if (!isConfirmed) return;

        setBusyId(u.id);
        try {
            await api(`/api/users/${encodeURIComponent(u.id)}`, { method: "DELETE" });
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            notify("success", "User deleted");
        } catch (err) {
            notify("error", "Couldn't delete user", err.message);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <section className="card">
            <header>
                <div>
                    <h2>Users</h2>
                    <p className="hint">{loading ? "Loading…" : `${users.length} in total`}</p>
                </div>
                <div className="select-wrap">
                    <label htmlFor="userSearch" className="sr-only">Search users</label>
                    <input
                        id="userSearch"
                        type="search"
                        placeholder="Search name or email"
                        autoComplete="off"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </header>

            {loadError ? (
                <div className="empty" role="alert">
                    {loadError}{" "}
                    <button type="button" className="btn sm" onClick={() => load(search.trim())}>
                        Try again
                    </button>
                </div>
            ) : !loading && !users.length ? (
                <div className="empty">{search ? "No users match your search." : "No users yet."}</div>
            ) : (
                <div className="tablewrap" aria-busy={loading}>
                    <table style={{ minWidth: 760 }}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Domain</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => {
                                const role = ROLES[u.role] ?? { label: u.role ?? "Unknown", tone: "muted" };
                                const isSelf = u.id === currentUserId;
                                const busy = busyId === u.id;

                                return (
                                    <tr key={u.id}>
                                        <td>
                                            {u.name || "—"}
                                            {isSelf && <span className="dim"> (you)</span>}
                                        </td>
                                        <td className="dim">{u.email}</td>
                                        <td className="dim">{u.domain || "—"}</td>
                                        <td>
                                            <span className={`status-pill ${role.tone}`}>
                                                <span className="dot" aria-hidden="true" />
                                                {role.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-pill ${u.isActive === true ? "success" : "muted"}`}>
                                                <span className="dot" aria-hidden="true" />
                                                {u.isActive === true ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="dim">{formatDateTime(u.createdAt)}</td>
                                        <td>
                                            <div className="flex gap-1 row-actions">
                                                <button
                                                    type="button"
                                                    className="btn sm"
                                                    disabled={busy || isSelf}
                                                    onClick={() => changeRole(u)}
                                                    aria-label={`Change role for ${u.email}`}
                                                >
                                                    Change role
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn sm"
                                                    disabled={busy || isSelf}
                                                    onClick={() => toggleActive(u)}
                                                    aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.email}`}
                                                >
                                                    {u.isActive ? "Deactivate" : "Activate"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn sm danger"
                                                    disabled={busy || isSelf}
                                                    onClick={() => remove(u)}
                                                    aria-label={`Delete ${u.email}`}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}