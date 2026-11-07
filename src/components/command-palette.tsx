"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addActions, links } from "./nav-links";
import { cx } from "./ui";
import { IconPlus, IconSearch } from "./icons";

type Item = { href: string; label: string; hint?: string; keywords?: string; group: "Add" | "Go to"; icon: typeof IconPlus };

const items: Item[] = [
  ...addActions.map((a) => ({ ...a, group: "Add" as const, icon: IconPlus })),
  ...links.map((l) => ({ ...l, group: "Go to" as const })),
];

/** Ctrl/⌘+K opens a quick switcher for pages and "add" actions. */
export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query]);

  const open = useCallback(() => {
    setQuery("");
    setActive(0);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    const onOpen = () => open();
    window.addEventListener("keydown", onKey);
    window.addEventListener("ft-command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("ft-command", onOpen); };
  }, [open]);

  function go(i: Item | undefined) {
    if (!i) return;
    dialog.current?.close();
    router.push(i.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % Math.max(results.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % Math.max(results.length, 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  }

  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <IconSearch className="h-4 w-4 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Search pages and actions…"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          role="combobox"
          aria-expanded
          aria-controls="command-results"
          aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
        />
        <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
      </div>
      <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches</li>}
        {results.map((i, idx) => {
          const header = idx === 0 || results[idx - 1].group !== i.group ? i.group : null;
          return (
            <li key={i.href + i.label} role="presentation">
              {header && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{header}</p>}
              <button
                id={`cmd-${idx}`}
                role="option"
                aria-selected={idx === active}
                onMouseMove={() => setActive(idx)}
                onClick={() => go(i)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", idx === active && "bg-accent/12 text-accent")}
              >
                <i.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{i.label}</span>
                {i.hint && <span className="hidden text-xs text-muted sm:inline">{i.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}

/** Button that opens the palette (for the sidebar / mobile header). */
export function CommandButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("ft-command"))}
      className={cx("flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-2 text-sm text-muted hover:text-ink", className)}
    >
      <IconSearch className="h-4 w-4" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden rounded border border-line px-1.5 text-[10px] lg:inline">Ctrl K</kbd>
    </button>
  );
}
