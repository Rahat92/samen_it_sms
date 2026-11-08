"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const initials = (name, email) => {
  const parts = (name || email || "?").trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
};

export default function UserMenu({
  user,
  profileHref = "/profile",
  onLogout,
  loginHref = "/login",
}) {
  const router = useRouter();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const logout = async () => {
    setBusy(true);
    try {
      if (onLogout) await onLogout();
      else await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed", err);
    }
    router.push(loginHref);
    router.refresh();
  };

  return (
    <div className="um" ref={wrapRef}>
      <button
        type="button"
        className="avatar um-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {initials(user.name, user.email)}
      </button>

      {open && (
        <div className="um-pop" role="menu">
          <div className="um-who">
            <strong>{user.name || "Account"}</strong>
            <span>{user.email}</span>
            {user.role && <em>{user.role}</em>}
          </div>

          {/* <Link href={profileHref} className="um-item" role="menuitem" onClick={() => setOpen(false)}>
            Profile
          </Link> */}
          <button type="button" className="um-item um-danger" role="menuitem" onClick={logout} disabled={busy}>
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}

      <style>{`
        .um { position: relative; display: inline-block; }
        .um-btn { border: 0; cursor: pointer; font: inherit; }
        .um-pop {
          position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; min-width: 220px;
          padding: 6px; border-radius: 10px;
          background: var(--surface, #fff); color: var(--text, #111827);
          border: 1px solid var(--border, #e5e7eb); box-shadow: 0 10px 30px rgba(0,0,0,.15);
        }
        .um-who { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 10px;
          border-bottom: 1px solid var(--border, #e5e7eb); margin-bottom: 6px; font-size: 13px; }
        .um-who span { opacity: .7; font-size: 12px; word-break: break-all; }
        .um-who em { font-style: normal; font-size: 11px; opacity: .6; text-transform: uppercase; letter-spacing: .04em; }
        .um-item {
          display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 6px;
          background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-decoration: none;
        }
        .um-item:hover:not(:disabled) { background: var(--hover, rgba(37,99,235,.1)); }
        .um-item:disabled { opacity: .6; cursor: wait; }
        .um-danger { color: #d9534f; }
      `}</style>
    </div>
  );
}