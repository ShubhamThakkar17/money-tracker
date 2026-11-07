import "server-only";
import { connection } from "next/server";
import type { ScopeFilter } from "./config";
import { getCategories, getSubcategories, getTransactions, type Transaction } from "./data";
import { daysBetween, monthKey, monthLabel, shiftMonth, todayIST } from "./format";

export const PERIODS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "This year" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

export function parsePeriod(v: unknown): Period {
  return PERIODS.some((p) => p.value === v) ? (v as Period) : "this-month";
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Inclusive date range for a period, plus the equally long period right before it. */
export function periodRange(period: Period, today: string) {
  const cur = monthKey(today);
  let startMonth: string;
  let endMonth = cur;
  switch (period) {
    case "last-month": startMonth = endMonth = shiftMonth(cur, -1); break;
    case "3m": startMonth = shiftMonth(cur, -2); break;
    case "6m": startMonth = shiftMonth(cur, -5); break;
    case "12m": startMonth = shiftMonth(cur, -11); break;
    case "ytd": startMonth = `${cur.slice(0, 4)}-01`; break;
    default: startMonth = cur;
  }
  const from = `${startMonth}-01`;
  const to = endMonth === cur ? today : lastDayOf(endMonth);
  const months: string[] = [];
  for (let m = startMonth; m <= endMonth; m = shiftMonth(m, 1)) months.push(m);

  // Previous period of the same length (for "vs before"). For month-to-date we compare
  // against the same number of days into last month, so it's a fair comparison.
  const span = months.length;
  const prevStart = shiftMonth(startMonth, -span);
  const prevEndMonth = shiftMonth(endMonth, -span);
  const prevTo =
    endMonth === cur
      ? `${prevEndMonth}-${String(Math.min(Number(today.slice(8, 10)), Number(lastDayOf(prevEndMonth).slice(8, 10)))).padStart(2, "0")}`
      : lastDayOf(prevEndMonth);

  const label =
    months.length === 1
      ? monthLabel(months[0], "long")
      : `${monthLabel(months[0])} – ${monthLabel(months.at(-1)!, "long")}`;
  return { from, to, months, prevFrom: `${prevStart}-01`, prevTo, label };
}

export type Focus = { kind: "cat" | "sub"; id: string } | null;

export function parseFocus(v: unknown): Focus {
  if (typeof v !== "string") return null;
  const [kind, id] = v.split(":");
  if ((kind === "cat" || kind === "sub") && /^[0-9a-f-]{32,36}$/i.test(id ?? "")) return { kind, id };
  return null;
}

const norm = (id: string) => id.replaceAll("-", "");

export async function getAnalytics(opts: { period: Period; scope: ScopeFilter; focus: Focus }) {
  await connection();
  const [transactions, categories, subcategories] = await Promise.all([
    getTransactions(),
    getCategories(),
    getSubcategories(),
  ]);
  const today = todayIST();
  const range = periodRange(opts.period, today);

  const catById = new Map(categories.map((c) => [norm(c.id), c]));
  const subById = new Map(subcategories.map((s) => [norm(s.id), s]));

  // Spending only: expenses, not debt repayments or transfers, in scope.
  const spend = transactions.filter(
    (t) =>
      t.type === "Expense" &&
      t.date &&
      t.date <= today && // ignore future-dated entries
      t.debtIds.length === 0 &&
      !t.transfer &&
      (opts.scope === "all" || t.scope === opts.scope),
  );

  /** Category of a transaction: its own, else the category its subcategory belongs to. */
  const catOf = (t: Transaction): string | null => {
    if (t.categoryIds[0]) return norm(t.categoryIds[0]);
    const sub = t.subcategoryIds[0] ? subById.get(norm(t.subcategoryIds[0])) : undefined;
    return sub?.categoryId ? norm(sub.categoryId) : null;
  };
  const subOf = (t: Transaction): string | null => (t.subcategoryIds[0] ? norm(t.subcategoryIds[0]) : null);

  const inRange = (t: Transaction, from: string, to: string) => t.date! >= from && t.date! <= to;
  const cur = spend.filter((t) => inRange(t, range.from, range.to));
  const prev = spend.filter((t) => inRange(t, range.prevFrom, range.prevTo));
  const total = (list: Transaction[]) => list.reduce((s, t) => s + t.amount, 0);

  // ---- Breakdown: category → subcategory ----
  type Row = { id: string | null; name: string; icon: string | null; amount: number; count: number; prev: number; subs: SubRow[] };
  type SubRow = { id: string | null; name: string; amount: number; count: number; prev: number };
  const rows = new Map<string, Row>();
  const rowFor = (catId: string | null) => {
    const key = catId ?? "none";
    let r = rows.get(key);
    if (!r) {
      const c = catId ? catById.get(catId) : undefined;
      r = { id: c?.id ?? null, name: c?.name ?? "Uncategorised", icon: c?.icon ?? null, amount: 0, count: 0, prev: 0, subs: [] };
      rows.set(key, r);
    }
    return r;
  };
  const addTo = (t: Transaction, field: "amount" | "prev") => {
    const r = rowFor(catOf(t));
    r[field] += t.amount;
    if (field === "amount") r.count++;
    const sid = subOf(t);
    const sname = sid ? (subById.get(sid)?.name ?? "Unknown") : "Other / unspecified";
    let sr = r.subs.find((x) => (x.id ? norm(x.id) : null) === sid);
    if (!sr) {
      sr = { id: sid ? (subById.get(sid)?.id ?? null) : null, name: sname, amount: 0, count: 0, prev: 0 };
      r.subs.push(sr);
    }
    sr[field] += t.amount;
    if (field === "amount") sr.count++;
  };
  cur.forEach((t) => addTo(t, "amount"));
  prev.forEach((t) => addTo(t, "prev"));
  const breakdown = [...rows.values()]
    .filter((r) => r.amount > 0)
    .map((r) => ({ ...r, subs: r.subs.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount) }))
    .sort((a, b) => b.amount - a.amount);

  const topSubs = breakdown
    .flatMap((r) => r.subs.filter((s) => s.id).map((s) => ({ ...s, category: r.name })))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // ---- Focus on one category or subcategory ----
  let focus: null | {
    kind: "cat" | "sub";
    id: string;
    name: string;
    parent: string | null;
    amount: number;
    prev: number;
    count: number;
    avg: number;
    trend: { month: string; amount: number }[];
    transactions: (Transaction & { subName: string | null })[];
  } = null;
  if (opts.focus) {
    const fid = norm(opts.focus.id);
    const match =
      opts.focus.kind === "cat"
        ? (t: Transaction) => catOf(t) === fid
        : (t: Transaction) => subOf(t) === fid;
    const name =
      opts.focus.kind === "cat" ? catById.get(fid)?.name : subById.get(fid)?.name;
    if (name) {
      const parentId = opts.focus.kind === "sub" ? subById.get(fid)?.categoryId : null;
      const fc = cur.filter(match);
      const trendMonths = range.months.length >= 6
        ? range.months
        : Array.from({ length: 6 }, (_, i) => shiftMonth(range.months.at(-1)!, i - 5));
      focus = {
        kind: opts.focus.kind,
        id: opts.focus.id,
        name,
        parent: parentId ? (catById.get(norm(parentId))?.name ?? null) : null,
        amount: total(fc),
        prev: total(prev.filter(match)),
        count: fc.length,
        avg: fc.length ? total(fc) / fc.length : 0,
        trend: trendMonths.map((m) => ({
          month: m,
          amount: total(spend.filter((t) => monthKey(t.date!) === m && match(t))),
        })),
        transactions: fc.map((t) => ({ ...t, subName: subOf(t) ? (subById.get(subOf(t)!)?.name ?? null) : null })),
      };
    }
  }

  const days = Math.max(1, daysBetween(range.from, range.to) + 1);
  return {
    today,
    range,
    total: total(cur),
    prevTotal: total(prev),
    count: cur.length,
    perDay: total(cur) / days,
    breakdown,
    topSubs,
    focus,
    categories,
    subcategories,
  };
}
