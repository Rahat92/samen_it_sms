"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 text-base font-bold tracking-[-0.01em] text-[var(--side-on)]">
      <i className="grid h-7 w-7 place-items-center rounded-[7px] bg-[var(--accent)] text-[var(--accent-ink)] not-italic">
        <Icon name="tx" />
      </i>
      <span>Mail Dashboard</span>
    </div>
  );
}

const iconBtn =
  "grid h-10 w-10 place-items-center rounded-lg text-[var(--side-fg)] hover:bg-white/5 hover:text-[var(--side-on)]";

/**
 * Usage:
 *   <Sidebar>
 *     {navItems.map((n) => (n.children ? renderGroup(n) : renderLeaf(n)))}
 *   </Sidebar>
 */
export default function Sidebar({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu after navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: Escape closes, body doesn't scroll, resizing to desktop closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 861px)");
    const onMq = (e) => e.matches && setOpen(false);
    const prevOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <aside className="sticky top-0 z-30 self-start min-[861px]:h-screen">
      {/* ── Mobile top bar (hidden on desktop) ── */}
      <div className="bg-[var(--side-bg)] pt-[env(safe-area-inset-top,0px)] min-[861px]:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Brand />
          <button
            type="button"
            className={iconBtn}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="sidebar-panel"
            onClick={() => setOpen(true)}
          >
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrim (mobile only) ── */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 min-[861px]:hidden " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />

      {/* ── Panel: slide-out drawer on mobile, fixed sidebar on desktop ── */}
      <div
        id="sidebar-panel"
        className={
          "flex flex-col gap-1.5 bg-[var(--side-bg)] text-[var(--side-fg)] " +
          // mobile: drawer
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] px-3.5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] " +
          "transition-[transform,visibility] duration-200 ease-out " +
          (open ? "translate-x-0 " : "-translate-x-full invisible ") +
          // desktop: static column
          "min-[861px]:visible min-[861px]:static min-[861px]:h-full min-[861px]:w-full " +
          "min-[861px]:max-w-none min-[861px]:translate-x-0 min-[861px]:px-3.5 min-[861px]:py-5"
        }
      >
        {/* <div className="flex items-center justify-between pb-[18px] pl-2.5 pt-1 min-[861px]:pr-2.5">
          <Brand />
          <button
            type="button"
            className={iconBtn + " -mr-1 min-[861px]:hidden"}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div> */}

        <nav
          aria-label="Sections"
          className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto"
        >
          {children}
        </nav>

        <div className="flex flex-col gap-1 p-2.5 text-xs">
          <span className="mono text-[var(--side-on)]">Asia/Dhaka · UTC+6</span>
        </div>
      </div>
    </aside>
  );
}