"use client";

import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/constants";

const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const label: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

/** Cycles System → Light → Dark. The choice lives in a cookie so the server renders it without a flash. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function cycle() {
    const t = next[theme];
    setTheme(t);
    if (t === "system") {
      delete document.documentElement.dataset.theme;
      document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    } else {
      document.documentElement.dataset.theme = t;
      document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={`Theme: ${label[theme]}. Switch to ${label[next[theme]]}`}
      title={`Theme: ${label[theme]}`}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
        {theme === "light" ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1.1 1.1M14.6 14.6l1.1 1.1M4.3 15.7l1.1-1.1M14.6 5.4l1.1-1.1" />
          </>
        ) : theme === "dark" ? (
          <path d="M16.5 12.2A6.5 6.5 0 0 1 7.8 3.5a6.5 6.5 0 1 0 8.7 8.7Z" />
        ) : (
          <>
            <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
            <path d="M7 17h6M10 13.5V17" />
          </>
        )}
      </svg>
      <span>Theme: {label[theme]}</span>
    </button>
  );
}
