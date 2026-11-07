import { TIME_ZONE } from "./constants";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return inr.format(Math.round(n));
}

/** Compact form for chart axes: ₹1.2L, ₹45K. */
export function formatINRCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Today's date (YYYY-MM-DD) in IST. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Shift a YYYY-MM key by n months. */
export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, style: "short" | "long" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

/** Add whole months to a YYYY-MM-DD date, clamping to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return out.toISOString().slice(0, 10);
}

export function cycleMonths(cycle: string | null): number {
  return cycle === "Yearly" ? 12 : cycle === "Quarterly" ? 3 : cycle === "Monthly" ? 1 : 0;
}
