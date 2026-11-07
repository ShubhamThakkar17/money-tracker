"use client";

import { useEffect, useState } from "react";
import { IconAlert, IconCheck, IconX } from "./icons";

const EVENT = "ft-toast";

export function toast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, ok } }));
}

export function Toaster() {
  const [t, setT] = useState<{ message: string; ok: boolean; id: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const { message, ok } = (e as CustomEvent<{ message: string; ok: boolean }>).detail;
      setT({ message, ok, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 4500);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer); };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {t && (
        <div key={t.id} role="status" className="toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
          <span className={t.ok ? "text-good-text" : "text-critical-text"}>{t.ok ? <IconCheck className="h-4 w-4" /> : <IconAlert className="h-4 w-4" />}</span>
          {t.message}
          <button onClick={() => setT(null)} className="-mr-1 ml-1 rounded p-0.5 text-muted hover:text-ink" aria-label="Dismiss"><IconX className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}
