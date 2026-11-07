"use client";

import type { FormState } from "@/app/actions";

export function FormStatus({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "text-sm text-good-text" : "text-sm text-critical-text"}>
      {state.ok ? "✓ " : "⚠ "}
      {state.message}
    </p>
  );
}
