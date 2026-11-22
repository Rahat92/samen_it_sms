"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import Drawer from "./Drawer";
import HeaderFilters from "./HeaderFilters";
import UserMenu from "./Usermenu";
import { useDashboard } from "./DashboardProvider";


const ROLES = { ADMIN: "ADMIN", USER: "USER" };

const DEFAULT_NAV = [
    // everyone
    { label: "Dashboard", sub: "Email delivery at a glance", href: "/", icon: "dashboard" },
    { label: "Transactions", sub: "Every email, with full detail", href: "/transactions", icon: "mail" },
    { label: "Failures", sub: "Errors and troubleshooting", href: "/failures", icon: "alert" },
    {
        // everyone (the group is hidden automatically if no child is visible)
        label: "Blocklist",
        sub: "Blocked recipients and unblock requests",
        icon: "ban",
        children: [
            { label: "Blocked recipients", sub: "Recipients you have blocked", href: "/blocklist", icon: "ban" },
            // admin only
            {
                label: "Unblock requests",
                sub: "Review requests to unblock",
                href: "/unblock-requests",
                icon: "mail",
                roles: [ROLES.ADMIN],
            },
        ],
    },
    // admin only
    {
        label: "Tenants",
        sub: "Manage your tenants and their settings",
        href: "/tenants",
        icon: "tenants",
        roles: [ROLES.ADMIN],
    },
    // everyone
    { label: "Report", sub: "Download delivery reports as PDF or CSV", href: "/report", icon: "report" },

    // Example of a user-only item (not shown to admins):
    // { label: "My requests", sub: "Your unblock requests", href: "/my-requests", icon: "mail", roles: [ROLES.USER] },
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
        <>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
            <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.3a5 5 0 0 1 3 4.7v1" />
        </>
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
    report: (
        <>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
            <path d="M14 3v5h5" />
            <path d="M9 17v-2M12 17v-5M15 17v-3" />
        </>
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

// No `roles` (or an empty list) = visible to everyone.
const canSee = (item, role) => !item.roles?.length || item.roles.includes(role);

// Apply role rules to the nav tree. A parent is dropped when it has no visible children.
function filterNavByRole(items, role) {
    return items.reduce((out, item) => {
        if (!canSee(item, role)) return out;
        if (item.children) {
            const children = item.children.filter((c) => canSee(c, role));
            if (children.length) out.push({ ...item, children });
            return out;
        }
        out.push(item);
        return out;
    }, []);
}

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

function Badge({ value, tone }) {
    if (!value) return null;
    return (
        <span
            className={
                "mono rounded-full px-2 py-px text-[11px] font-medium " +
                (tone === "muted"
                    ? "bg-[#c2342b] text-white"
                    : "bg-[var(--bad)] text-white")
            }
        >
            {value}
        </span>
    );
}

/* ───────────────────── Blocklist count hook ───────────────────── */

function useBlocklistCount(pathname) {
    const [counts, setCounts] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch("/api/blocklist/count", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setCounts(data);
            } catch {
                /* keep the last known counts on network errors */
            }
        };

        load();
        const id = setInterval(load, 60_000);
        window.addEventListener("blocklist:changed", load);

        return () => {
            cancelled = true;
            clearInterval(id);
            window.removeEventListener("blocklist:changed", load);
        };
    }, [pathname]);

    return counts;
}

/* ───────────────────────── Sidebar content ───────────────────────── */

function SidebarContent({ navItems, pathname, user, onClose }) {
    const [openGroups, setOpenGroups] = useState({});

    const isGroupActive = (item) => item.children?.some((c) => isActive(pathname, c.href));
    // An explicit toggle wins; otherwise open exactly when a child is active
    const isGroupOpen = (item) => openGroups[item.label] ?? isGroupActive(item);
    const toggleGroup = (label, current) =>
        setOpenGroups((s) => ({ ...s, [label]: !current }));

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
                <ul className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        /* ───── Parent with children ───── */
                        if (item.children?.length) {
                            const groupActive = isGroupActive(item);
                            const open = isGroupOpen(item);
                            // Only actionable (non-muted) badges roll up to the parent
                            const childBadge = item.children.reduce(
                                (n, c) => (c.badgeTone === "muted" ? n : n + (Number(c.badge) || 0)),
                                0
                            );

                            return (
                                <li key={item.label}>
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(item.label, open)}
                                        aria-expanded={open}
                                        aria-controls={`group-${item.label}`}
                                        className={
                                            "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                                            (groupActive && !open
                                                ? "bg-[var(--side-on-bg)] text-[var(--side-on)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--accent)]"
                                                : groupActive
                                                    ? "text-[var(--side-on)]"
                                                    : "hover:bg-white/5 hover:text-[var(--side-on)]")
                                        }
                                    >
                                        <Icon name={item.icon} />
                                        <span className="flex-1 truncate text-left">{item.label}</span>
                                        {!open && <Badge value={childBadge} />}
                                        <span className={"transition-transform " + (open ? "rotate-180" : "")}>
                                            <Icon name="chevron" />
                                        </span>
                                    </button>

                                    {open && (
                                        <ul
                                            id={`group-${item.label}`}
                                            className="ml-[22px] mt-1 flex flex-col gap-1 border-l border-white/10 pl-3"
                                        >
                                            {item.children.map((child) => {
                                                const active = isActive(pathname, child.href);
                                                return (
                                                    <li key={child.href}>
                                                        <Link
                                                            href={child.href}
                                                            aria-current={active ? "page" : undefined}
                                                            className={
                                                                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors " +
                                                                (active
                                                                    ? "bg-[var(--side-on-bg)] text-[var(--side-on)] before:absolute before:bottom-2 before:-left-[13px] before:top-2 before:w-[3px] before:rounded-full before:bg-[var(--accent)]"
                                                                    : "hover:bg-white/5 hover:text-[var(--side-on)]")
                                                            }
                                                        >
                                                            <span className="flex-1 truncate">{child.label}</span>
                                                            <Badge value={child.badge} tone={child.badgeTone} />
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            );
                        }

                        /* ───── Regular item ───── */
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
                                    <Badge value={item.badge} />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Account */}
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
                <p className="mono px-3 pt-2 text-[11px] text-[var(--side-fg)]/70">
                    Asia/Dhaka · UTC+6
                </p>
            </div>
        </div>
    );
}

/* ───────────────────────── Layout ───────────────────────── */

export default function DashboardLayout({
    user,
    navItems: navItemsProp = DEFAULT_NAV,
    title,
    subtitle,
    showFilters = true,
    actions,
    onLogout,
    children,
}) {
    const { tenants } = useDashboard();
    const pathname = usePathname();
    const router = useRouter();
    const counts = useBlocklistCount(pathname);
    const [drawer, setDrawer] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // "admin", "Admin" and "ADMIN" all count as ADMIN
    const role = String(user?.role ?? "").toUpperCase();

    // 1) keep only what this role may see, 2) inject live counts
    const navItems = useMemo(
        () =>
            filterNavByRole(navItemsProp, role).map((item) => {
                if (!item.children) return item;
                return {
                    ...item,
                    children: item.children.map((child) => {
                        if (child.href === "/blocklist") {
                            return { ...child, badge: counts?.total || null, badgeTone: "muted" };
                        }
                        if (child.href === "/unblock-requests") {
                            return { ...child, badge: counts?.unblockRequested || null };
                        }
                        return child;
                    }),
                };
            }),
        [navItemsProp, role, counts]
    );

    // Flatten children so the header title works on child routes too
    const flatNav = useMemo(
        () => navItems.flatMap((n) => (n.children ? n.children : [n])),
        [navItems]
    );
    const current = flatNav.find((n) => isActive(pathname, n.href)) ?? flatNav[0];

    // Kept for custom use
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

    const sidebarProps = { navItems, pathname, user };

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
                <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
                    <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:px-3">
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
                            <UserMenu user={user} />
                        </div>

                        {headerActions && (
                            <div className="order-3 w-full sm:order-2 sm:w-auto">{headerActions}</div>
                        )}
                    </div>
                </header>

                <main className="container mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-3">
                    {children}
                </main>
            </div>

            <Drawer />
        </div>
    );
}