"use client";

import { useRouter } from "next/navigation";
import { inputClass, cx } from "./ui";

type Opt = { value: string; label: string };

/** "Look at" picker: navigates as soon as you choose a category or subcategory. */
export function FocusPicker({ value, groups, base }: {
  value: string;
  groups: { label: string; value: string; subs: Opt[] }[];
  base: string; // query string without focus, e.g. "period=3m&scope=all"
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Look at a category or subcategory"
      value={value}
      onChange={(e) => router.push(`/analytics?${base}${e.target.value ? `&focus=${e.target.value}` : ""}`)}
      className={cx(inputClass, "w-full py-1.5 sm:w-64")}
    >
      <option value="">All categories</option>
      {groups.map((g) => (
        <optgroup key={g.value} label={g.label}>
          <option value={`cat:${g.value}`}>All of {g.label}</option>
          {g.subs.map((s) => <option key={s.value} value={`sub:${s.value}`}>{s.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
