import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonDetail, type PersonEvent } from "@/lib/data";
import { formatDate, formatINR } from "@/lib/format";
import { Badge, Card, Empty, cx } from "@/components/ui";
import { RepaymentForm } from "@/components/forms/debt-forms";
import { EditDebt, EditPerson } from "@/components/forms/edit-forms";
import { MarkPaidAction } from "@/components/forms/upcoming-forms";
import { daysBetween } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/people/[id]">) {
  const d = await getPersonDetail((await params).id);
  return { title: `${d?.person.name ?? "Person"} · Finance Tracker` };
}

const kindLabel: Record<PersonEvent["kind"], string> = {
  lent: "Lent",
  borrowed: "Borrowed",
  "repaid-to-you": "Repayment in",
  "you-repaid": "Repayment out",
  paid: "Paid",
  received: "Received",
  upcoming: "Scheduled",
};

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const d = await getPersonDetail((await params).id);
  if (!d) notFound();
  const { person: p, totals: t } = d;
  const net = p.net;

  return (
    <>
      <Link href="/debts" className="text-sm text-accent hover:underline">← Debts & people</Link>
      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-semibold" aria-hidden>
            {p.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="flex items-center gap-1 text-2xl font-semibold tracking-tight">{p.name} <EditPerson p={p} /></h1>
            <p className="text-sm text-ink-2">
              {[p.relationship, p.phone, p.upi].filter(Boolean).join(" · ") || "No contact details"} ·{" "}
              <a href={p.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Open in Sheet</a>
            </p>
          </div>
        </div>
        {net > 0 ? <Badge tone="good">Owes you {formatINR(net)}</Badge> : net < 0 ? <Badge tone="critical">You owe {formatINR(-net)}</Badge> : <Badge>All settled</Badge>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="They owe you" value={t.theyOweMe} tone={t.theyOweMe ? "good" : undefined} sub={`Lent ${formatINR(t.lent)} in total`} />
        <Stat label="You owe them" value={t.iOweThem} tone={t.iOweThem ? "critical" : undefined} sub={`Borrowed ${formatINR(t.borrowed)} in total`} />
        <Stat label="Received from them" value={t.receivedFrom} sub="Repayments + payments in" />
        <Stat label="Paid to them" value={t.paidTo} sub="Repayments + payments out" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title={`All activity (${d.events.length})`} className="lg:col-span-3">
          {d.events.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {d.events.map((e) => (
                <li key={e.key} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular w-14 shrink-0 text-xs text-muted">{formatDate(e.date)}</span>
                      <Badge tone={e.kind === "upcoming" ? "accent" : "neutral"}>{kindLabel[e.kind]}</Badge>
                    </div>
                    <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-medium hover:underline">{e.title}</a>
                    {e.detail && <p className="text-xs text-ink-2">{e.detail}</p>}
                  </div>
                  <span className={cx("tabular shrink-0 text-sm font-semibold", e.flow === "in" && "text-good-text", e.kind === "upcoming" && e.status === "Paid" && "opacity-60")}>
                    {e.flow === "in" ? "+" : "−"}{formatINR(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing recorded with {p.name} yet.</Empty>
          )}
          <p className="mt-4 text-xs text-muted">
            Includes debts with {p.name}, their repayments, upcoming payments linked to them, and transactions whose “Paid to / Received from” is exactly “{p.name}”.
          </p>
        </Card>

        <div className="flex flex-col gap-4 self-start lg:col-span-2">
          <Card title="Open debts">
            {d.openDebts.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {d.openDebts.map((x) => (
                  <li key={x.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium">{x.direction === "Owes me" ? "Owes you" : "You owe"} · {x.description}</span>
                        <span className="text-xs text-ink-2">{x.repaid > 0 ? `${formatINR(x.repaid)} of ${formatINR(x.amount)} paid` : `of ${formatINR(x.amount)}`}{x.dueDate && ` · due ${formatDate(x.dueDate)}`}</span>
                      </span>
                      <span className={cx("tabular font-semibold", x.status === "Overdue" && "text-critical-text")}>{formatINR(x.remaining)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <RepaymentForm debtId={x.id} personName={p.name} remaining={x.remaining} today={d.today} direction={x.direction} />
                      <EditDebt d={x} people={d.people} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty>No open debts.</Empty>}
          </Card>

          <Card title="Upcoming with them">
            {d.pending.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {d.pending.map((x) => {
                  const days = x.dueDate ? daysBetween(d.today, x.dueDate) : null;
                  return (
                    <li key={x.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block font-medium">{x.name}</span>
                          <span className={cx("text-xs", days !== null && days < 0 ? "text-critical-text" : "text-ink-2")}>
                            {x.direction === "To receive" ? "From them" : "To them"} · {x.dueDate ? formatDate(x.dueDate) : "No date"}
                            {days !== null && (days < 0 ? ` · ${-days}d overdue` : days === 0 ? " · today" : ` · in ${days}d`)}
                            {x.paidSoFar > 0 && ` · ${formatINR(x.paidSoFar)} of ${formatINR(x.amount)} done`}
                          </span>
                        </span>
                        <span className={cx("tabular font-semibold", x.direction === "To receive" && "text-good-text")}>
                          {x.direction === "To receive" ? "+" : "−"}{formatINR(x.remaining)}
                        </span>
                      </div>
                      <MarkPaidAction kind="payment" id={x.id} amount={x.remaining} today={d.today} flow={x.direction === "To receive" ? "in" : "out"} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nothing scheduled. <Link href="/upcoming" className="text-accent hover:underline">Add one</Link>.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: "good" | "critical"; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={cx("tabular mt-1 text-xl font-semibold sm:text-2xl", tone === "good" && "text-good-text", tone === "critical" && "text-critical-text")}>{formatINR(value)}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
