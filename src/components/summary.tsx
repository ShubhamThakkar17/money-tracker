import Link from "next/link";
import type { ReactNode } from "react";
import { formatINR } from "@/lib/format";
import { cx } from "./ui";

type Tone = "good" | "critical" | "neutral";
const toneText: Record<Tone, string> = { good: "text-good-text", critical: "text-critical-text", neutral: "text-ink" };
const signTone = (n: number): Tone => (n > 0 ? "good" : n < 0 ? "critical" : "neutral");

const icons = {
  wallet: <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h9.5v2.5M3.5 6.5v8A1.5 1.5 0 0 0 5 16h11a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H5a1.5 1.5 0 0 1-1.5-1.5Zm10 5h.01" />,
  up: <path d="M6 14 14 6m0 0H7.5M14 6v6.5" />,
  down: <path d="M6 6l8 8m0 0V7.5m0 6.5H7.5" />,
  clock: <path d="M10 6v4l2.5 1.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />,
  trend: <path d="M2.5 14l5-5 3 3 6-6m0 0h-4m4 0v4" />,
  sparkle: <path d="M8 3.5 9.2 7a2 2 0 0 0 1.3 1.3L14 9.5l-3.5 1.2a2 2 0 0 0-1.3 1.3L8 15.5 6.8 12a2 2 0 0 0-1.3-1.3L2 9.5 5.5 8.3A2 2 0 0 0 6.8 7L8 3.5Zm7 8 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Zm0-9 .6 1.4L17 4.5l-1.4.6L15 6.5l-.6-1.4L13 4.5l1.4-.6.6-1.4Z" />,
};

function Icon({ name, className }: { name: keyof typeof icons; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={cx("h-4 w-4", className)} aria-hidden>
      {icons[name]}
    </svg>
  );
}

function StatCard({ label, value, tone, icon, sub, href }: {
  label: string; value: number; tone: Tone; icon: keyof typeof icons; sub?: ReactNode; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{label}</p>
        <Icon name={icon} className={toneText[tone]} />
      </div>
      <p className={cx("tabular mt-2 text-xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]", toneText[tone])}>{formatINR(value)}</p>
      {sub && <p className="mt-2 text-xs text-ink-2">{sub}</p>}
    </>
  );
  const cls = "block h-full min-w-0 rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5";
  return href ? <Link href={href} className={cx(cls, "transition hover:border-ink/20")}>{body}</Link> : <div className={cls}>{body}</div>;
}

const dot = <span className="mx-1.5 text-muted">·</span>;

export type Summary = {
  netBalance: number; totalIncome: number; totalExpenses: number; monthIncome: number; monthExpenses: number;
  upcomingOut: number; bills: number; peopleYouOwe: number;
  upcomingIn: number; expected: number; receivables: number; referrals: number; projected: number;
};

export function BalanceSummary({ s }: { s: Summary }) {
  const short = s.projected < 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="col-span-2 sm:col-span-1"><StatCard label="Net Balance" icon="wallet" value={s.netBalance} tone={signTone(s.netBalance)} sub="All income − all expenses" /></div>
        <StatCard label="Total Income" icon="up" value={s.totalIncome} tone="good" href="/transactions?type=Income" sub={<>This month {formatINR(s.monthIncome)}</>} />
        <StatCard label="Total Expenses" icon="down" value={s.totalExpenses} tone="critical" href="/transactions?type=Expense" sub={<>This month {formatINR(s.monthExpenses)}</>} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="Upcoming Payments" icon="clock" value={s.upcomingOut} tone="critical" href="/upcoming"
          sub={<>Bills {formatINR(s.bills)}{dot}People you owe {formatINR(s.peopleYouOwe)}</>}
        />
        <StatCard
          label="Upcoming Income" icon="trend" value={s.upcomingIn} tone="good" href="/upcoming"
          sub={<>Expected {formatINR(s.expected)}{dot}Receivables {formatINR(s.receivables)}{dot}Referrals {formatINR(s.referrals)}</>}
        />
      </div>

      <section className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-ink-2"><Icon name="sparkle" />Projected Balance</p>
          <p className="text-xs text-ink-2">After all upcoming items settle</p>
        </div>
        <p className={cx("tabular mt-4 text-4xl font-semibold tracking-tight sm:text-[2.6rem]", toneText[signTone(s.projected)])}>{formatINR(s.projected)}</p>
        <p className="mt-1 text-xs text-ink-2">
          {short ? "You will be short by this amount" : s.projected > 0 ? "You'll have this left over" : "You'll break even"}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <Term label="Current" value={s.netBalance} />
          <Op>+</Op>
          <Term label="Incoming" value={s.upcomingIn} tone="good" />
          <Op>−</Op>
          <Term label="Outgoing" value={s.upcomingOut} tone="critical" />
          <Op>=</Op>
          <Term label="Projected" value={s.projected} highlight />
        </div>
      </section>
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <span className="px-1 text-muted" aria-hidden>{children}</span>;
}

function Term({ label, value, tone, highlight }: { label: string; value: number; tone?: Tone; highlight?: boolean }) {
  const t = tone ?? signTone(value);
  return (
    <span className={cx("inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5", highlight && "bg-surface-2")}>
      <span className="text-xs text-ink-2">{label}</span>
      <span className={cx("tabular font-medium", toneText[t])}>{formatINR(value)}</span>
    </span>
  );
}

export function AddEntryMenu() {
  const items = [
    { href: "/transactions?add=1#add", label: "Expense or income", hint: "Log money in or out" },
    { href: "/upcoming", label: "Upcoming payment", hint: "A bill or expected payment" },
    { href: "/debts", label: "Debt or loan", hint: "Money lent or borrowed" },
    { href: "/subscriptions", label: "Subscription", hint: "A recurring service" },
  ];
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M10 4v12M4 10h12" /></svg>
        Add Entry
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="block rounded-lg px-3 py-2 hover:bg-surface-2">
            <span className="block text-sm font-medium">{i.label}</span>
            <span className="block text-xs text-ink-2">{i.hint}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
