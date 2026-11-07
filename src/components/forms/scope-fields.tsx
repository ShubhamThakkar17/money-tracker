"use client";

import { useState } from "react";
import { BUSINESSES, SCOPES } from "@/lib/constants";
import { Field, Select } from "../ui";

/** Scope picker (Personal / Work); Work entries also get an optional Business picker. */
export function ScopeFields({ scope: initialScope, business, onScopeChange }: {
  scope?: string | null; business?: string; onScopeChange?: (scope: string) => void;
}) {
  const [scope, setScope] = useState(initialScope === "Work" ? "Work" : "Personal");
  return (
    <>
      <Field label="Scope">
        <Select name="scope" options={SCOPES} value={scope} onChange={(e) => { setScope(e.target.value); onScopeChange?.(e.target.value); }} />
      </Field>
      {scope === "Work" && (
        <Field label="Business">
          <Select name="business" options={BUSINESSES} placeholder="— Not set —" defaultValue={business ?? ""} />
        </Field>
      )}
    </>
  );
}
