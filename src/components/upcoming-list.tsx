import type { ReactNode } from "react";
import type { UpcomingItem } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { cx } from "./ui";
import { IconAlert, IconClock } from "./icons";

export function dueLabel(days: number) {
  if (days < 0) return { text: `${-days}d overdue`, className: "text-critical-text font-medium", icon: <IconAlert className="h-3.5 w-3.5" /> };
  if (days === 0) return { text: "Due today", className: "text-ink font-medium", icon: <IconClock className="h-3.5 w-3.5" /> };
  if (days === 1) return { text: "Tomorrow", className: "text-ink", icon: null };
  if (days <= 7) return { text: `in ${days} days`, className: "text-ink", icon: null };
  return { text: `in ${days} days`, className: "text-muted", icon: null };
}

function DateChip({ date, overdue }: { date: string; overdue: boolean }) {
  const [y, m, d] = date.split("-").map(Number);
  const mon = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return (
    <div className={cx("flex w-11 shrink-0 flex-col items-center rounded-lg py-1 leading-none", overdue ? "bg-critical/12 text-critical-text" : "bg-surface-2 text-ink")}>
      <span className="text-[10px] font-medium uppercase">{mon}</span>
      <span className="tabular mt-0.5 text-base font-semibold">{d}</span>
    </div>
  );
}

export function UpcomingRow({ item, action }: { item: UpcomingItem; action?: ReactNode }) {
  const due = dueLabel(item.daysLeft);
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <DateChip date={item.date} overdue={item.daysLeft < 0} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a href={item.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-sm font-medium hover:underline">{item.name}</a>
            {item.detail && <p className="line-clamp-1 text-xs text-ink-2">{item.detail}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className={cx("tabular text-sm font-semibold", item.flow === "in" && "text-good-text")}>
              {item.flow === "in" ? "+" : "−"}{formatINR(item.amount)}
            </p>
            <p className={cx("flex items-center gap-1 text-xs", due.className)}>{due.icon}{due.text}</p>
          </div>
        </div>
        {action}
      </div>
    </li>
  );
}
