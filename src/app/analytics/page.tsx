import Link from "next/link";
import { getAnalytics, parseFocus, parsePeriod, PERIODS, type Period, type Focus } from "@/lib/analytics";
import { parseScope, type ScopeFilter } from "@/lib/config";
import { formatDate, formatINR } from "@/lib/format";
import { Card, Empty, PageHeader, cx } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { FocusPicker } from "@/components/analytics-filters";
import { IconArrowDown, IconArrowUp } from "@/components/icons";

export const metadata = { title: "Analytics · Finance Tracker" };

const norm = (id: string) => id.replaceAll("-", "");

function href(p: { period: Period; scope: ScopeFilter; focus: Focus | string | null }) {
  const q = new URLSearchParams({ period: p.period });
  if (p.scope !== "all") q.set("scope", p.scope);
  const f = typeof p.focus === "string" ? p.focus : p.focus ? `${p.focus.kind}:${p.focus.id}` : null;
  if (f) q.set("focus", f);
  return `/analytics?${q}`;
}

function Change({ now, prev, label }: { now: number; prev: number; label: string }) {
  if (!prev && !now) return <span className="text-muted">No spending {label} either</span>;
  if (!prev) return <span className="text-muted">Nothing {label}</span>;
  const pct = ((now - prev) / prev) * 100;
  const up = pct > 0;
  return (
    <span className={cx("inline-flex items-center gap-1", up ? "text-critical-text" : "text-good-text")}>
      {up ? <IconArrowUp className="h-3.5 w-3.5" /> : <IconArrowDown className="h-3.5 w-3.5" />}{Math.abs(pct).toFixed(0)}% <span className="text-muted">vs {formatINR(prev)} {label}</span>
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const scope = parseScope(sp.scope);
  const focusParam = parseFocus(sp.focus);
  const a = await getAnalytics({ period, scope, focus: focusParam });
  const prevLabel = period === "this-month" ? "same days last month" : "the period before";
  const f = a.focus;

  const groups = a.categories.map((c) => ({
    value: c.id,
    label: c.name,
    subs: a.subcategories.filter((s) => s.categoryId && norm(s.categoryId) === norm(c.id)).map((s) => ({ value: s.id, label: s.name })),
  }));
  const baseQs = new URLSearchParams({ period, ...(scope !== "all" ? { scope } : {}) }).toString();

  return (
    <>
      <PageHeader title="Analytics" subtitle={<>Where your money went · {a.range.label}</>}>
        <Link href="/categories" className="text-sm font-medium text-accent hover:underline">Manage categories →</Link>
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={href({ period: p.value, scope, focus: focusParam })}
              role="tab"
              aria-selected={p.value === period}
              className={cx("rounded-md px-3 py-1.5 text-sm whitespace-nowrap", p.value === period ? "bg-ink font-medium text-page" : "text-ink-2 hover:bg-surface-2")}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {(["all", "Personal", "Work"] as const).map((s) => (
              <Link key={s} href={href({ period, scope: s, focus: focusParam })} className={cx("rounded-md px-2.5 py-1 whitespace-nowrap", s === scope ? "bg-surface-2 font-medium" : "text-ink-2")}>
                {s === "all" ? "All" : s}
              </Link>
            ))}
          </div>
          <FocusPicker value={focusParam ? `${focusParam.kind}:${focusParam.id}` : ""} groups={groups} base={baseQs} />
        </div>
      </div>

      {f ? (
        /* ---------- Focused view: one category / subcategory ---------- */
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-ink-2">
                  {f.kind === "sub" ? <>Subcategory{f.parent && <> · {f.parent}</>}</> : "Category"}
                </p>
                <h2 className="text-xl font-semibold">{f.name}</h2>
              </div>
              <Link href={href({ period, scope, focus: null })} className="text-sm text-accent hover:underline">← All categories</Link>
            </div>
            <p className="tabular mt-4 text-4xl font-semibold tracking-tight">{formatINR(f.amount)}</p>
            <p className="mt-1 text-sm text-ink-2">spent on {f.name} · {a.range.label}</p>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <span><Change now={f.amount} prev={f.prev} label={prevLabel} /></span>
              <span className="text-ink-2"><strong className="tabular text-ink">{f.count}</strong> transaction{f.count === 1 ? "" : "s"}</span>
              <span className="text-ink-2">Average <strong className="tabular text-ink">{formatINR(f.avg)}</strong> each</span>
              {a.total > 0 && <span className="text-ink-2"><strong className="tabular text-ink">{((f.amount / a.total) * 100).toFixed(0)}%</strong> of all spending</span>}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Month by month" className="lg:col-span-3">
              <TrendChart data={f.trend} highlight={a.range.months} />
              {a.range.months.length < f.trend.length && <p className="mt-2 text-xs text-muted">Darker bars are inside the selected period.</p>}
            </Card>
            <Card title={`Transactions (${f.transactions.length})`} className="lg:col-span-2">
              {f.transactions.length ? (
                <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto">
                  {f.transactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <a href={t.url} target="_blank" rel="noreferrer" className="line-clamp-1 hover:underline">{t.name || "Untitled"}</a>
                        <p className="text-xs text-muted">{formatDate(t.date)}{f.kind === "cat" && t.subName && <> · {t.subName}</>}</p>
                      </div>
                      <span className="tabular font-medium whitespace-nowrap">{formatINR(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No spending here in this period.</Empty>}
            </Card>
          </div>
        </div>
      ) : (
        /* ---------- Overview ---------- */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total spent" value={formatINR(a.total)} />
            <Stat label="Change" value={<Change now={a.total} prev={a.prevTotal} label={prevLabel} />} small />
            <Stat label="Transactions" value={String(a.count)} />
            <Stat label="Per day" value={formatINR(a.perDay)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="By category" className="lg:col-span-2">
              {a.breakdown.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {a.breakdown.map((r) => {
                    const share = a.total ? (r.amount / a.total) * 100 : 0;
                    return (
                      <li key={r.id ?? "none"} className="py-3 first:pt-0 last:pb-0">
                        <details open={r.subs.some((s) => s.id)}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-sm font-medium">
                                  {r.icon && <span className="mr-1.5">{r.icon}</span>}
                                  {r.id ? <Link href={href({ period, scope, focus: `cat:${r.id}` })} className="hover:underline">{r.name}</Link> : r.name}
                                </span>
                                <span className="tabular text-sm font-semibold whitespace-nowrap">{formatINR(r.amount)}</span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                  <div className="h-full rounded-full bg-series-1" style={{ width: `${share}%` }} />
                                </div>
                                <span className="tabular w-20 text-right text-xs text-ink-2">{share.toFixed(0)}% · {r.count}×</span>
                              </div>
                            </div>
                          </summary>
                          {r.subs.length > 0 && !(r.subs.length === 1 && !r.subs[0].id) && (
                            <ul className="mt-2 ml-1 flex flex-col gap-1 border-l border-line pl-3">
                              {r.subs.map((s) => (
                                <li key={s.id ?? "other"} className="flex items-center justify-between gap-3 text-sm">
                                  {s.id ? (
                                    <Link href={href({ period, scope, focus: `sub:${s.id}` })} className="truncate text-ink-2 hover:text-ink hover:underline">{s.name}</Link>
                                  ) : <span className="truncate text-muted">{s.name}</span>}
                                  <span className="tabular whitespace-nowrap text-ink-2">
                                    {formatINR(s.amount)} <span className="text-xs text-muted">· {s.count}×</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty>No spending in this period.</Empty>}
            </Card>

            <Card title="Top subcategories" className="self-start">
              {a.topSubs.length ? (
                <ol className="flex flex-col divide-y divide-line">
                  {a.topSubs.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0">
                      <span className="tabular w-4 text-xs text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={href({ period, scope, focus: `sub:${s.id}` })} className="block truncate font-medium hover:underline">{s.name}</Link>
                        <span className="text-xs text-muted">{s.category} · {s.count}×</span>
                      </div>
                      <span className="tabular font-medium whitespace-nowrap">{formatINR(s.amount)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty>Tag transactions with a subcategory (like Rapido or Zomato) to see them here.</Empty>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <div className={cx("tabular mt-1 font-semibold", small ? "text-sm leading-6" : "text-2xl tracking-tight")}>{value}</div>
    </div>
  );
}
