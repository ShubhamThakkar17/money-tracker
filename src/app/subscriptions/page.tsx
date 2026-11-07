import { connection } from "next/server";
import { getCategories, getSubscriptions } from "@/lib/data";
import { daysBetween, formatDate, formatINR, todayIST } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, cx } from "@/components/ui";
import { SubscriptionActions, SubscriptionForm } from "@/components/forms/subscription-forms";
import { DeleteButton } from "@/components/forms/delete-button";
import { EditSubscription } from "@/components/forms/edit-forms";
import { IconAlert, IconClock } from "@/components/icons";

export const metadata = { title: "Subscriptions · Finance Tracker" };

export default async function SubscriptionsPage() {
  await connection();
  const [subs, categories] = await Promise.all([getSubscriptions(), getCategories()]);
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }));
  const today = todayIST();
  const active = subs.filter((s) => s.active);
  const inactive = subs.filter((s) => !s.active);
  const monthly = active.reduce((s, x) => s + x.monthlyCost, 0);
  const business = active.filter((s) => s.scope === "Infinity Linkage").reduce((s, x) => s + x.monthlyCost, 0);

  return (
    <>
      <PageHeader title="Subscriptions" subtitle="Recurring costs and renewals" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Per month" value={formatINR(monthly)} />
        <Stat label="Per year" value={formatINR(monthly * 12)} />
        <Stat label="Business share" value={formatINR(business) + "/mo"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <Card title={`Active (${active.length})`}>
            {active.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {active.map((s) => {
                  const days = s.nextRenewal ? daysBetween(today, s.nextRenewal) : null;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">{s.name}</a>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                          <span>{s.nextRenewal ? `Renews ${formatDate(s.nextRenewal)}` : "No renewal date"}</span>
                          {days !== null && days <= 7 && (
                            <Badge tone={days < 0 ? "critical" : "warning"}>
                              {days < 0 ? <IconAlert className="h-3.5 w-3.5" /> : <IconClock className="h-3.5 w-3.5" />}
                              {days < 0 ? `${-days}d overdue` : days === 0 ? "Today" : `in ${days}d`}
                            </Badge>
                          )}
                          {s.scope && <Badge tone={s.scope === "Personal" ? "neutral" : "accent"}>{s.scope}</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="tabular text-sm font-semibold">
                          {formatINR(s.amount)} <span className="font-normal text-muted">/ {s.cycle === "Yearly" ? "yr" : s.cycle === "Quarterly" ? "qtr" : "mo"}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <SubscriptionActions id={s.id} active nextRenewal={s.nextRenewal} cycle={s.cycle} />
                          <EditSubscription s={s} categories={catOptions} />
                          <EditSubscription s={s} categories={catOptions} />
                      <DeleteButton kind="subscriptions" id={s.id} label={s.name} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty>No active subscriptions yet.</Empty>}
          </Card>
          {inactive.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold">Cancelled ({inactive.length})</summary>
              <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                {inactive.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={cx("truncate text-ink-2")}>{s.name} · {formatINR(s.amount)}</span>
                    <div className="flex items-center gap-2">
                      <SubscriptionActions id={s.id} active={false} nextRenewal={s.nextRenewal} cycle={s.cycle} />
                      <EditSubscription s={s} categories={catOptions} />
                      <DeleteButton kind="subscriptions" id={s.id} label={s.name} />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <Card title="Add a subscription" className="lg:col-span-2 self-start">
          <SubscriptionForm categories={categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }))} />
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold sm:text-2xl">{value}</p>
    </div>
  );
}
