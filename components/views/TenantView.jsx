"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { formatDateTime } from "@/lib/format";

const ROLES = {
    SUPERADMIN: { label: "Super admin", tone: "danger" },
    ADMIN: { label: "Admin", tone: "warning" },
    USER: { label: "User", tone: "muted" },
};

const REQUEST_TIMEOUT_MS = 10000;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // same limits as the API
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
    const [adding, setAdding] = useState(false);
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
    // Shown when a generated password couldn't be emailed: the admin must pass it on by hand
    function showPasswordOnce(email, password) {
        return Swal.fire({
            icon: "warning",
            title: "Saved, but the email was not sent",
            text: `We couldn't email ${email}. Share this password with them yourself; it won't be shown again.`,
            input: "text",
            inputValue: password,
            inputAttributes: { readonly: true },
            confirmButtonText: "Copy & close",
            preConfirm: () => navigator.clipboard?.writeText(password).catch(() => {}),
        });
    }

    // Create a tenant. Leave the password blank to have one generated and emailed to the tenant.
    async function addTenant() {
        if (adding) return;

        const field = (id, label, attrs = "") => `
            <label for="${id}" style="display:block;font-size:13px;text-align:left;margin-top:12px">${label}</label>
            <input id="${id}" class="swal2-input" style="margin:4px 0 0;width:100%;box-sizing:border-box" ${attrs}>`;

        const { isConfirmed, value } = await Swal.fire({
            title: "Add tenant",
            width: 440,
            html: `
                ${field("tn-name", "Tenant name", 'autocomplete="off" placeholder="Midway Securities Ltd."')}
                ${field("tn-email", "Email (receives the login details)", 'type="email" autocomplete="off" placeholder="portfolio@midwaybd.com"')}
                ${field("tn-domain", "Domain", 'autocomplete="off" placeholder="Defaults to the email domain"')}
                ${field("tn-password", "Password", 'type="password" autocomplete="new-password" placeholder="Leave blank to auto-generate"')}
                <label for="tn-photo" style="display:block;font-size:13px;text-align:left;margin-top:12px">Photo (optional, JPG/PNG/WEBP, max 5 MB)</label>
                <div style="display:flex;gap:12px;align-items:center;margin-top:4px">
                    <img id="tn-preview" alt="" style="display:none;width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none">
                    <input id="tn-photo" type="file" accept="image/jpeg,image/png,image/webp" style="font-size:13px;min-width:0">
                </div>
                <label style="display:flex;gap:8px;align-items:center;font-size:13px;text-align:left;margin-top:14px">
                    <input id="tn-send" type="checkbox" checked> Email the login details to the tenant
                </label>
                <p style="font-size:12px;opacity:.7;text-align:left;margin:6px 0 0">
                    An auto-generated password is always emailed.
                </p>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Create tenant",
            didOpen: () => {
                // Live preview of the chosen photo
                const input = document.getElementById("tn-photo");
                const img = document.getElementById("tn-preview");
                let objectUrl = null;
                input.addEventListener("change", () => {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    const f = input.files?.[0];
                    objectUrl = f && PHOTO_TYPES.includes(f.type) ? URL.createObjectURL(f) : null;
                    img.src = objectUrl ?? "";
                    img.style.display = objectUrl ? "block" : "none";
                });
            },
            willClose: () => {
                const src = document.getElementById("tn-preview")?.src;
                if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
            },
            preConfirm: () => {
                const get = (id) => document.getElementById(id).value.trim();
                const name = get("tn-name");
                const email = get("tn-email").toLowerCase();
                const password = document.getElementById("tn-password").value;
                if (!name) return Swal.showValidationMessage("Tenant name is required");
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                    return Swal.showValidationMessage("Enter a valid email address");
                if (password && password.length < 8)
                    return Swal.showValidationMessage("Password must be at least 8 characters");
                const photo = document.getElementById("tn-photo").files?.[0] ?? null;
                if (photo && !PHOTO_TYPES.includes(photo.type))
                    return Swal.showValidationMessage("Photo must be a JPG, PNG or WEBP image");
                if (photo && photo.size > PHOTO_MAX_BYTES)
                    return Swal.showValidationMessage("Photo must be less than 5 MB");
                return {
                    photo,
                    name,
                    email,
                    domain: get("tn-domain").toLowerCase() || email.split("@")[1],
                    password,
                    sendEmail: document.getElementById("tn-send").checked,
                };
            },
        });
        if (!isConfirmed || !value) return;

        setAdding(true);
        try {
            const body = new FormData();
            body.set("name", value.name);
            body.set("email", value.email);
            body.set("domain", value.domain);
            body.set("sendEmail", String(value.sendEmail));
            if (value.photo) body.set("photo", value.photo);
            if (value.password) {
                body.set("password", value.password);
                body.set("passwordConfirm", value.password);
            }

            const result = await api("/api/users", { method: "POST", body });
            const { emailSent, generatedPassword, ...created } = result;
            setUsers((prev) => [created, ...prev]);

            if (emailSent) {
                notify("success", "Tenant added", `Login details were emailed to ${created.email}`);
            } else if (generatedPassword) {
                // Email failed: show the generated password once so the admin can pass it on
                await showPasswordOnce(created.email, generatedPassword);
            } else {
                notify("success", "Tenant added");
            }
        } catch (err) {
            notify("error", "Couldn't add tenant", err.message);
        } finally {
            setAdding(false);
        }
    }

    // Edit everything about a user: name, email, domain, role, active, and a new password.
    async function editUser(u) {
        if (busyId) return;
        const isSelf = u.id === currentUserId;

        const label = (text, forId) =>
            `<label for="${forId}" style="display:block;font-size:13px;text-align:left;margin-top:12px">${text}</label>`;
        const input = (id, text, value, attrs = "") =>
            `${label(text, id)}<input id="${id}" class="swal2-input" value="${escapeHtml(value)}" style="margin:4px 0 0;width:100%;box-sizing:border-box" ${attrs}>`;
        const check = (id, text, checked, disabled = false) =>
            `<label style="display:flex;gap:8px;align-items:center;font-size:13px;text-align:left;margin-top:12px">
                <input id="${id}" type="checkbox" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}> ${text}
            </label>`;
        const roleOptions = Object.entries(ROLES)
            .map(([key, r]) => `<option value="${key}"${key === u.role ? " selected" : ""}>${r.label}</option>`)
            .join("");

        const { isConfirmed, value: edit } = await Swal.fire({
            title: "Edit user",
            width: 460,
            html: `
                ${input("eu-name", "Name", u.name, 'autocomplete="off"')}
                ${input("eu-email", "Email", u.email, 'type="email" autocomplete="off"')}
                ${input("eu-domain", "Domain", u.domain, 'autocomplete="off" placeholder="e.g. midwaybd.com"')}
                <label for="eu-photo" style="display:block;font-size:13px;text-align:left;margin-top:12px">Photo (JPG/PNG/WEBP, max 5 MB)</label>
                <div style="display:flex;gap:12px;align-items:center;margin-top:4px">
                    <img id="eu-preview" alt="" src="${escapeHtml(u.photo ?? "")}" style="${u.photo ? "" : "display:none;"}width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none">
                    <input id="eu-photo" type="file" accept="image/jpeg,image/png,image/webp" style="font-size:13px;min-width:0">
                </div>
                ${u.photo ? check("eu-rmphoto", "Remove current photo", false) : ""}
                ${label("Role", "eu-role")}
                <select id="eu-role" class="swal2-select" style="margin:4px 0 0;width:100%;box-sizing:border-box" ${isSelf ? "disabled" : ""}>${roleOptions}</select>
                ${check("eu-active", "Active (can sign in)", u.isActive === true, isSelf)}
                ${isSelf ? '<p style="font-size:12px;opacity:.7;text-align:left;margin:6px 0 0">You can\'t change your own role or deactivate yourself.</p>' : ""}
                <hr style="margin:16px 0 0;opacity:.25">
                ${input("eu-password", "New password", "", 'type="password" autocomplete="new-password" placeholder="Leave blank to keep the current password"')}
                ${check("eu-gen", "Generate a random password instead", false)}
                ${check("eu-send", "Email the new password to the user", true)}
                <p style="font-size:12px;opacity:.7;text-align:left;margin:6px 0 0">A generated password is always emailed.</p>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Save changes",
            didOpen: () => {
                const gen = document.getElementById("eu-gen");
                const pw = document.getElementById("eu-password");
                gen.addEventListener("change", () => {
                    pw.disabled = gen.checked;
                    if (gen.checked) pw.value = "";
                });

                // Photo preview; choosing a new photo and "remove" are mutually exclusive
                const file = document.getElementById("eu-photo");
                const img = document.getElementById("eu-preview");
                const rm = document.getElementById("eu-rmphoto");
                let objectUrl = null;
                file.addEventListener("change", () => {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    const f = file.files?.[0];
                    objectUrl = f && PHOTO_TYPES.includes(f.type) ? URL.createObjectURL(f) : null;
                    img.src = objectUrl ?? u.photo ?? "";
                    img.style.display = img.getAttribute("src") ? "block" : "none";
                    if (rm && f) rm.checked = false;
                });
                rm?.addEventListener("change", () => {
                    if (rm.checked) {
                        file.value = "";
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        objectUrl = null;
                        img.style.display = "none";
                    } else {
                        img.src = u.photo ?? "";
                        img.style.display = u.photo ? "block" : "none";
                    }
                });
            },
            willClose: () => {
                const src = document.getElementById("eu-preview")?.src;
                if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
            },
            preConfirm: () => {
                const get = (id) => document.getElementById(id).value.trim();
                const name = get("eu-name");
                const email = get("eu-email").toLowerCase();
                const domain = get("eu-domain").toLowerCase();
                const role = document.getElementById("eu-role").value;
                const isActive = document.getElementById("eu-active").checked;
                const password = document.getElementById("eu-password").value;
                const generate = document.getElementById("eu-gen").checked;
                const sendEmail = document.getElementById("eu-send").checked;

                if (!name) return Swal.showValidationMessage("Name is required");
                if (!EMAIL_RE.test(email)) return Swal.showValidationMessage("Enter a valid email address");
                if (!generate && password && password.length < 8)
                    return Swal.showValidationMessage("Password must be at least 8 characters");
                const photo = document.getElementById("eu-photo").files?.[0] ?? null;
                if (photo && !PHOTO_TYPES.includes(photo.type))
                    return Swal.showValidationMessage("Photo must be a JPG, PNG or WEBP image");
                if (photo && photo.size > PHOTO_MAX_BYTES)
                    return Swal.showValidationMessage("Photo must be less than 5 MB");
                const removePhoto = document.getElementById("eu-rmphoto")?.checked === true;

                // Send only what changed
                const changes = {};
                if (name !== (u.name ?? "")) changes.name = name;
                if (email !== u.email) changes.email = email;
                if (domain !== (u.domain ?? "")) changes.domain = domain || null;
                if (!isSelf && role !== u.role) changes.role = role;
                if (!isSelf && isActive !== (u.isActive === true)) changes.isActive = isActive;
                if (generate) changes.generatePassword = true;
                else if (password) {
                    changes.password = password;
                    changes.sendEmail = sendEmail;
                }
                if (removePhoto && !photo) changes.removePhoto = true;
                if (!Object.keys(changes).length && !photo) return Swal.showValidationMessage("No changes to save");
                return { changes, photo };
            },
        });
        if (!isConfirmed || !edit) return;
        const { changes, photo } = edit;

        setBusyId(u.id);
        try {
            // A new photo needs multipart form data; everything else stays plain JSON
            let init;
            if (photo) {
                const form = new FormData();
                form.set("changes", JSON.stringify(changes));
                form.set("photo", photo);
                init = { method: "PATCH", body: form };
            } else {
                init = {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(changes),
                };
            }
            const result = await api(`/api/users/${encodeURIComponent(u.id)}`, init);
            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...result.data } : x)));

            const passwordChanged = changes.generatePassword || changes.password;
            const wantedEmail = changes.generatePassword || changes.sendEmail;
            if (changes.generatePassword && !result.emailSent && result.generatedPassword) {
                await showPasswordOnce(result.data.email, result.generatedPassword);
            } else if (wantedEmail && !result.emailSent) {
                notify("warning", "User updated", "The new password couldn't be emailed.");
            } else if (passwordChanged && result.emailSent) {
                notify("success", "User updated", `The new password was emailed to ${result.data.email}`);
            } else {
                notify("success", "User updated");
            }
        } catch (err) {
            notify("error", "Couldn't update user", err.message);
        } finally {
            setBusyId(null);
        }
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
                <div className="flex gap-1" style={{ alignItems: "center" }}>
                    {/* <div className="select-wrap">
                        <label htmlFor="userSearch" className="sr-only">Search users</label>
                        <input
                            id="userSearch"
                            type="search"
                            placeholder="Search name or email"
                            autoComplete="off"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div> */}
                    <button type="button" className="btn sm" onClick={addTenant} disabled={adding}>
                        {adding ? "Adding…" : "Add tenant"}
                    </button>
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
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                {u.photo ? (
                                                    <img
                                                        src={u.photo}
                                                        alt=""
                                                        width={28}
                                                        height={28}
                                                        style={{ borderRadius: "50%", objectFit: "cover" }}
                                                    />
                                                ) : null}
                                                <span>
                                                    {u.name || "—"}
                                                    {isSelf && <span className="dim"> (you)</span>}
                                                </span>
                                            </span>
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
                                                    disabled={busy}
                                                    onClick={() => editUser(u)}
                                                    aria-label={`Edit ${u.email}`}
                                                >
                                                    Edit
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