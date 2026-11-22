"use client";

/**
 * DashboardLayout — sidebar + sticky top bar + filters + user menu + logout.
 *
 * Usage (app/(dashboard)/layout.jsx) — must be rendered INSIDE <DashboardProvider>:
 *
 *   <DashboardLayout user={currentUser} tenants={tenants}>
 *     {children}
 *   </DashboardLayout>
 *
 * Props:
 *   user         – { name, email, role, domain, photo? }   (user menu hides if missing)
 *   tenants      – [{ id, name, domain }]  for the admin Tenant select
 *   navItems     – [{ label, sub, href, icon, badge? }]
 *   title/subtitle – override the title taken from the active nav item
 *   showFilters  – show Period + Tenant filters in the header (default true)
 *   actions      – custom header node, replaces the default filters
 *   onLogout     – custom logout handler (defaults to POST /api/auth/logout,
 *                  then redirects to /login)
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Drawer from "./Drawer";
import HeaderFilters from "./HeaderFilters";
import UserMenu from "./Usermenu";
import { useDashboard } from "./DashboardProvider";
import { report } from "node:process";

/* ───────────────────────── Config ───────────────────────── */

const DEFAULT_NAV = [
    { label: "Dashboard", sub: "Email delivery at a glance", href: "/", icon: "dashboard" },
    { label: "Transactions", sub: "Every email, with full detail", href: "/transactions", icon: "mail" },
    { label: "Failures", sub: "Errors and troubleshooting", href: "/failures", icon: "alert" },
    { label: "Blocklist", sub: "Recipients you have blocked", href: "/blocklist", icon: "ban" },
    { label: "Tenants", sub: "Manage your tenants and their settings", href: "/tenants", icon: "tenants" },
    { label: "Report", sub: "Download delivery reports as PDF or CSV", href: "/report", icon: "report" },
];

/* ───────────────────────── Icons ───────────────────────── */

const ICONS = {
    dashboard: (
        <>
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </>
    ),
    mail: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </>
    ),
    alert: (
        <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17h.01" />
        </>
    ),
    ban: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m5.6 5.6 12.8 12.8" />
        </>
    ),
    tenants: (
        <><circle cx="9" cy="8" r="3.2" /><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" /><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.3a5 5 0 0 1 3 4.7v1" /></>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </>
    ),
    logout: (
        <>
            <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
            <path d="m16 8 4 4-4 4M20 12H9" />
        </>
    ),
    report:(
        <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /><path d="M9 17v-2M12 17v-5M15 17v-3" /></>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
};

function Icon({ name, className = "h-[18px] w-[18px]" }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`${className} flex-none fill-none stroke-current`}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {ICONS[name] ?? ICONS.dashboard}
        </svg>
    );
}

/* ───────────────────────── Helpers ───────────────────────── */

const isActive = (pathname, href) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

const initials = (name, email) => {
    const parts = (name || email || "?").trim().split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
};

function Avatar({ user, className = "h-9 w-9 text-xs" }) {
    return (
        <span
            className={`grid flex-none place-items-center overflow-hidden rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)] ${className}`}
        >
            {user?.photo ? (
                <img src={user.photo} alt="" className="h-full w-full object-cover" />
            ) : (
                initials(user?.name, user?.email)
            )}
        </span>
    );
}

function Brand() {
    return (
        <div className="flex items-center gap-2.5 text-base font-bold tracking-[-0.01em] text-[var(--side-on)]">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-ink)]">
                <Icon name="mail" />
            </span>
            <span>Mail Dashboard</span>
        </div>
    );
}

/* ───────────────────────── Sidebar content ───────────────────────── */

function SidebarContent({ navItems, pathname, user, onLogout, loggingOut, onClose  }) {
    return (
        <div className="flex h-full flex-col bg-[var(--side-bg)] text-[var(--side-fg)]">
            {/* Brand */}
            <div className="flex h-16 flex-none items-center justify-between px-5">
                <Brand />
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close menu"
                        className="-mr-2 grid h-9 w-9 place-items-center rounded-lg text-[var(--side-fg)] hover:bg-white/5 hover:text-[var(--side-on)]"
                    >
                        <Icon name="close" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3 py-2">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--side-fg)]/60">
                    Menu
                </p>
                <ul className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const active = isActive(pathname, item.href);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={
                                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                                        (active
                                            ? "bg-[var(--side-on-bg)] text-[var(--side-on)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--accent)]"
                                            : "hover:bg-white/5 hover:text-[var(--side-on)]")
                                    }
                                >
                                    <Icon name={item.icon} />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {item.badge ? (
                                        <span className="mono rounded-full bg-[var(--bad)] px-2 py-px text-[11px] font-medium text-white">
                                            {item.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Account + logout */}
            <div className="flex-none border-t border-white/10 p-3">
                {user && (
                    <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
                        <Avatar user={user} className="h-9 w-9 text-xs" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--side-on)]">
                                {user.name || "Account"}
                            </p>
                            <p className="truncate text-xs">{user.email}</p>
                        </div>
                    </div>
                )}
                <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 hover:text-[var(--side-on)] disabled:cursor-wait disabled:opacity-60"
                >
                    <Icon name="logout" />
                    {loggingOut ? "Logging out…" : "Log out"}
                </button>
                <p className="mono px-3 pt-2 text-[11px] text-[var(--side-fg)]/70">
                    Asia/Dhaka · UTC+6
                </p>
            </div>
        </div>
    );
}

/* ───────────────────────── Header user menu ───────────────────────── */

// function UserMenu({ user, onLogout, loggingOut }) {
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);

//   useEffect(() => {
//     if (!open) return;
//     const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
//     const onKey = (e) => e.key === "Escape" && setOpen(false);
//     document.addEventListener("mousedown", onDown);
//     document.addEventListener("keydown", onKey);
//     return () => {
//       document.removeEventListener("mousedown", onDown);
//       document.removeEventListener("keydown", onKey);
//     };
//   }, [open]);

//   if (!user) return null;

//   return (
//     <div className="relative" ref={ref}>
//       <button
//         type="button"
//         aria-haspopup="menu"
//         aria-expanded={open}
//         onClick={() => setOpen((o) => !o)}
//         className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-1 pr-1 shadow-[var(--shadow)] transition-colors hover:border-[var(--muted)] sm:pr-3"
//       >
//         <Avatar user={user} className="h-8 w-8 text-xs" />
//         <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">
//           {user.name || "Account"}
//         </span>
//         <Icon
//           name="chevron"
//           className={`hidden h-4 w-4 text-[var(--muted)] transition-transform sm:block ${open ? "rotate-180" : ""}`}
//         />
//       </button>

//       {open && (
//         <div
//           role="menu"
//           className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-lg shadow-black/15"
//         >
//           <div className="mb-1.5 flex flex-col gap-0.5 border-b border-[var(--line)] px-3 pb-3 pt-2">
//             <strong className="truncate text-sm font-semibold">{user.name || "Account"}</strong>
//             <span className="break-all text-xs text-[var(--muted)]">{user.email}</span>
//             {user.role && (
//               <span className="mt-1.5 w-fit rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
//                 {user.role}
//               </span>
//             )}
//           </div>
//           <button
//             type="button"
//             role="menuitem"
//             onClick={onLogout}
//             disabled={loggingOut}
//             className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--bad)] transition-colors hover:bg-[var(--bad-soft)] disabled:cursor-wait disabled:opacity-60"
//           >
//             <Icon name="logout" />
//             {loggingOut ? "Logging out…" : "Log out"}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

/* ───────────────────────── Layout ───────────────────────── */

export default function DashboardLayout({
    user,
    navItems = DEFAULT_NAV,
    title,
    subtitle,
    showFilters = true,
    actions,
    onLogout,
    children,
    currentUser
}) {
    const{tenants} = useDashboard()
    const pathname = usePathname();
    const router = useRouter();
    const [drawer, setDrawer] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const current = navItems.find((n) => isActive(pathname, n.href)) ?? navItems[0];

    const logout = async () => {
        setLoggingOut(true);
        try {
            if (onLogout) await onLogout();
            else await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
        } catch (err) {
            console.error("Logout failed", err);
            setLoggingOut(false);
        }
    };
    // Close the mobile drawer after navigating
    useEffect(() => {
        setDrawer(false);
    }, [pathname]);

    // While the drawer is open: Escape closes, page doesn't scroll, desktop resize closes
    useEffect(() => {
        if (!drawer) return;
        const onKey = (e) => e.key === "Escape" && setDrawer(false);
        const mq = window.matchMedia("(min-width: 1024px)");
        const onMq = (e) => e.matches && setDrawer(false);
        const prev = document.body.style.overflow;
        document.addEventListener("keydown", onKey);
        mq.addEventListener("change", onMq);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            mq.removeEventListener("change", onMq);
            document.body.style.overflow = prev;
        };
    }, [drawer]);

    const sidebarProps = { navItems, pathname, user, onLogout: logout, loggingOut };

    const headerActions =
        actions ?? (showFilters ? <HeaderFilters currentUser={user} tenants={tenants} /> : null);

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
                <SidebarContent {...sidebarProps} />
            </aside>

            {/* Mobile drawer */}
            <div className="lg:hidden">
                <div
                    aria-hidden="true"
                    onClick={() => setDrawer(false)}
                    className={
                        "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 " +
                        (drawer ? "opacity-100" : "pointer-events-none opacity-0")
                    }
                />
                <aside
                    id="mobile-sidebar"
                    className={
                        "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] pt-[env(safe-area-inset-top,0px)] shadow-2xl " +
                        "bg-[var(--side-bg)] transition-[transform,visibility] duration-200 ease-out " +
                        (drawer ? "translate-x-0" : "-translate-x-full invisible")
                    }
                >
                    <SidebarContent {...sidebarProps} onClose={() => setDrawer(false)} />
                </aside>
            </div>

            {/* Main column */}
            <div className="lg:pl-64">
                <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
                        <button
                            type="button"
                            onClick={() => setDrawer(true)}
                            aria-label="Open menu"
                            aria-expanded={drawer}
                            aria-controls="mobile-sidebar"
                            className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)] lg:hidden"
                        >
                            <Icon name="menu" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-xl font-bold tracking-[-0.015em] sm:text-[22px]">
                                {title ?? current?.label}
                            </h1>
                            <p className="truncate text-[13px] text-[var(--muted)]">
                                {subtitle ?? current?.sub}
                            </p>
                        </div>

                        <div className="order-2 sm:order-3">
                            <UserMenu user={user} onLogout={() => signOut({ callbackUrl: "/login" })} />
                        </div>

                        {headerActions && (
                            <div className="order-3 w-full sm:order-2 sm:w-auto">{headerActions}</div>
                        )}
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>

            <Drawer />
        </div>
    );
}