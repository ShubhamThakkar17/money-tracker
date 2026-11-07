"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "./ui";
import { IconMenu, IconSearch, IconWallet, IconX } from "@/components/icons";
import { links } from "./nav-links";
import { CommandButton, CommandPalette } from "./command-palette";


function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-sm font-semibold whitespace-nowrap">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink"><IconWallet className="h-4 w-4" /></span>
      Finance Tracker
    </span>
  );
}

/** Fixed sidebar on large screens; a top bar with a slide-in drawer below that. */
export function Sidebar({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-page/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/"><Brand /></Link>
        <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("ft-command"))}
          className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
          aria-label="Search"
        >
          <IconSearch className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        </div>
      </header>

      <CommandPalette />
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        id="sidebar"
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:z-10 lg:w-60 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/" onClick={() => setOpen(false)}><Brand /></Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Close menu"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 pb-3">
          <CommandButton className="w-full" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <Nav path={path} onNavigate={() => setOpen(false)} />
        </div>
        <div className="flex flex-col gap-1 border-t border-line px-3 py-3">{footer}</div>
      </aside>
    </>
  );
}

function Nav({ path, onNavigate }: { path: string; onNavigate: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-accent/12 font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <l.icon className={cx("h-[18px] w-[18px] shrink-0", !active && "opacity-80")} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
