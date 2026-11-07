import Link from "next/link";
import { Suspense } from "react";
import { getDashboard } from "@/lib/data";
import { parseScope, type ScopeFilter } from "@/lib/config";
import { formatDate, formatINR, monthLabel } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, cx } from "@/components/ui";
import { ScopeTabs } from "@/components/scope-tabs";
import { CashflowChart, CategoryChart } from "@/components/charts";
import { UpcomingRow } from "@/components/upcoming-list";
import { AddEntryMenu, BalanceSummary } from "@/components/summary";
import { IconAlert } from "@/components/icons";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const scope = parseScope((await searchParams).scope);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="A snapshot of your personal and work finances">
        <div className="flex flex-wrap items-center gap-3">
          <ScopeTabs current={scope} basePath="/" />
          <AddEntryMenu />
        </div>
      </PageHeader>
      <Suspense key={scope} fallback={<DashboardSkeleton />}>
        <Dashboard scope={scope} />
      </Suspense>
    </>
  );
}

async function Dashboard({ scope }: { scope: ScopeFilter }) {
  const d = await getDashboard(scope);
  const q = scope === "all" ? "" : `?scope=${encodeURIComponent(scope)}`;

  return (
    <div className="flex flex-col gap-4">
      <BalanceSummary s={d.summary} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Income vs expenses · last 6 months" className="lg:col-span-3">
          <CashflowChart data={d.monthly} />
          <p className="mt-2 text-xs text-muted">Debt repayments aren&apos;t counted as income or spending.</p>
        </Card>
        <Card title={`Spending by category · ${monthLabel(d.thisMonth, "long")}`} className="lg:col-span-2">
          {d.categorySpend.length ? <CategoryChart data={d.categorySpend} /> : <Empty>No expenses this month yet.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Who owes what" action={<Link href="/debts" className="text-xs text-accent hover:underline">All debts</Link>}>
          {d.people.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {d.people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <Link href={`/people/${p.id}`} className="truncate hover:underline">{p.name}</Link>
                  {p.net > 0 ? (
                    <Badge tone="good">Owes you {formatINR(p.net)}</Badge>
                  ) : (
                    <Badge tone="critical">You owe {formatINR(-p.net)}</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>All square. No open debts.</Empty>
          )}
          {d.openDebts.some((x) => x.status === "Overdue") && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-critical-text"><IconAlert className="h-3.5 w-3.5" />{d.openDebts.filter((x) => x.status === "Overdue").length} debt(s) overdue</p>
          )}
        </Card>

        <Card
          title="Upcoming · next 30 days"
          action={<Link href={`/upcoming${q}`} className="text-xs text-accent hover:underline">All upcoming</Link>}
        >
          {d.upcoming.length ? (
            <>
              <p className="tabular -mt-2 mb-3 text-xs text-ink-2">
                {formatINR(d.dueOut)} to pay{d.dueIn > 0 && <> · <span className="text-good-text">{formatINR(d.dueIn)} to receive</span></>}
              </p>
              <ul className="flex flex-col divide-y divide-line">
                {d.upcoming.slice(0, 5).map((i) => <UpcomingRow key={i.key} item={i} />)}
              </ul>
              {d.upcoming.length > 5 && (
                <Link href={`/upcoming${q}`} className="mt-3 block text-xs text-accent hover:underline">+{d.upcoming.length - 5} more</Link>
              )}
            </>
          ) : (
            <Empty>Nothing due in the next 30 days. <Link href="/upcoming" className="text-accent hover:underline">Add a bill</Link>.</Empty>
          )}
        </Card>
      </div>

      <Card title="Recent transactions" action={<Link href={`/transactions${q}`} className="text-xs text-accent hover:underline">See all · Add new</Link>}>
        {d.recent.length ? <RecentTable rows={d.recent} /> : <Empty>No transactions yet. <Link href="/transactions" className="text-accent hover:underline">Add your first one</Link>.</Empty>}
      </Card>
    </div>
  );
}

function RecentTable({ rows }: { rows: Awaited<ReturnType<typeof getDashboard>>["recent"] }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full text-sm sm:min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-4 pb-2 font-medium sm:px-5">Date</th>
            <th className="pb-2 font-medium">Name</th>
            <th className="hidden pb-2 font-medium sm:table-cell">Category</th>
            <th className="hidden pb-2 font-medium md:table-cell">Scope</th>
            <th className="px-4 pb-2 text-right font-medium sm:px-5">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="tabular px-4 py-2.5 whitespace-nowrap text-ink-2 sm:px-5">{formatDate(t.date)}</td>
              <td className="py-2.5 pr-3">
                <span className="line-clamp-1">{t.name}</span>
                {t.debtIds.length > 0 && <span className="text-xs text-muted">Debt repayment</span>}
                <span className="block text-xs text-muted sm:hidden">{t.categoryName ?? "Uncategorised"}</span>
              </td>
              <td className="hidden py-2.5 pr-3 text-ink-2 sm:table-cell">{t.categoryName ?? "—"}</td>
              <td className="hidden py-2.5 pr-3 md:table-cell">{t.scope ? <Badge tone={t.scope === "Personal" ? "neutral" : "accent"}>{t.business || t.scope}</Badge> : "—"}</td>
              <td className={cx("tabular px-4 py-2.5 text-right font-medium whitespace-nowrap sm:px-5", t.type === "Income" && "text-good-text")}>
                {t.type === "Income" ? "+" : "−"}{formatINR(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton() {
  const block = "animate-pulse rounded-xl border border-line bg-surface";
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className={`${block} h-[112px]`} />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => <div key={i} className={`${block} h-[136px]`} />)}
      </div>
      <div className={`${block} h-[216px]`} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`${block} h-80 lg:col-span-3`} />
        <div className={`${block} h-80 lg:col-span-2`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className={`${block} h-64`} />)}
      </div>
    </div>
  );
}
