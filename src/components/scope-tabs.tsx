import Link from "next/link";
import type { ScopeFilter } from "@/lib/config";
import { cx } from "./ui";

const options: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Personal", label: "Personal" },
  { value: "Work", label: "Work" },
];

export function ScopeTabs({ current, basePath }: { current: ScopeFilter; basePath: string }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="Scope">
      {options.map((o) => (
        <Link
          key={o.value}
          role="tab"
          aria-selected={current === o.value}
          href={o.value === "all" ? basePath : `${basePath}?scope=${encodeURIComponent(o.value)}`}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
            current === o.value ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
