import { getReferrals } from "@/lib/data";
import { formatDate, formatINR } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, cx } from "@/components/ui";
import { DeleteButton } from "@/components/forms/delete-button";
import { EditPayout, PayoutActions, PayoutForm, ProgramForm } from "@/components/forms/referral-forms";

export const metadata = { title: "Referrals · Finance Tracker" };

export default async function ReferralsPage() {
  const r = await getReferrals();
  const t = r.totals;
  const programOpts = r.programs.map((p) => ({ value: p.id, label: p.company, platform: p.platform }));
  const platformNames = r.platforms.map((p) => p.name); // busiest platform first

  return (
    <>
      <PageHeader title="Referrals" subtitle="Referral and affiliate payouts by platform and company" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Earned (paid out)" value={t.paidAllTime} tone="good" sub="All time" />
        <Stat label="Paid this month" value={t.paidThisMonth} />
        <Stat label="Approved, not paid" value={t.approved} sub="Confirmed, waiting for payout" />
        <Stat label="Pending" value={t.pending} sub="Not yet approved" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <Card title="By platform">
            {r.platforms.length ? (
              <div className="flex flex-col gap-4">
                {r.platforms.map((pl) => (
                  <section key={pl.name} className="rounded-xl border border-line p-4">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">{pl.name}</h3>
                      <p className="tabular text-sm">
                        <span className="text-good-text font-semibold">{formatINR(pl.paid)}</span>
                        <span className="text-ink-2"> paid</span>
                        {pl.pending > 0 && <span className="text-ink-2"> · {formatINR(pl.pending)} to come</span>}
                      </p>
                    </header>
                    <ul className="mt-3 flex flex-col gap-1.5 border-l-2 border-line pl-3">
                      {pl.programs.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="hover:underline">{p.company}</a> : p.company}</span>
                            <span className="text-xs text-muted">
                              {p.commission && <> · {p.commission}</>} · {p.count} payout{p.count === 1 ? "" : "s"}
                              {p.lastPaid && <> · last paid {formatDate(p.lastPaid)}</>}
                            </span>
                          </div>
                          <span className="flex items-center gap-1">
                            <span className="tabular text-right whitespace-nowrap">
                              {formatINR(p.paid)}
                              {p.pending > 0 && <span className="text-xs text-muted"> +{formatINR(p.pending)}</span>}
                            </span>
                            <DeleteButton kind="referralPrograms" id={p.id} label={`${p.company} (${p.platform})`} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : <Empty>No referral programs yet. Add a platform and company on the right.</Empty>}
          </Card>

          <Card title={`Waiting for payout (${r.open.length})`}>
            {r.open.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {r.open.map((x) => (
                  <li key={x.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{x.company} <span className="text-xs font-normal text-muted">· {x.platform}</span></p>
                        <p className="text-xs text-ink-2">
                          {x.name}
                          {x.earnedDate && <> · earned {formatDate(x.earnedDate)}</>}
                          {x.expectedPayout && <> · expected {formatDate(x.expectedPayout)}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="mr-1 text-right">
                          <p className="tabular text-sm font-semibold text-good-text">+{formatINR(x.amount)}</p>
                          {x.originalAmount && <p className="text-xs text-muted">{x.originalAmount}</p>}
                        </div>
                        <EditPayout x={x} programs={programOpts} />
                        <DeleteButton kind="referralPayouts" id={x.id} label={x.name} />
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <Badge tone={x.status === "Approved" ? "accent" : "warning"}>{x.status}</Badge>
                      <PayoutActions id={x.id} amount={x.amount} status={x.status as "Pending" | "Approved"} today={r.today} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty>Nothing waiting. Add a payout when a commission is earned.</Empty>}
          </Card>

          {r.paid.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold">Paid ({r.paid.length}) · {formatINR(t.paidAllTime)}</summary>
              <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                {r.paid.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">
                      <span className="tabular text-xs text-muted">{formatDate(x.paidDate)}</span>{" "}
                      {x.company} <span className="text-xs text-muted">· {x.platform}{x.originalAmount && ` · ${x.originalAmount}`}</span>
                    </span>
                    <span className={cx("tabular whitespace-nowrap text-good-text")}>+{formatINR(x.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="flex flex-col gap-4 self-start lg:col-span-2">
          <Card title="Add a payout">
            <PayoutForm programs={programOpts} today={r.today} />
          </Card>
          <Card title="Add a company">
            <ProgramForm platforms={platformNames.length ? platformNames : ["Dub"]} />
            <p className="mt-3 text-xs text-muted">One platform (like Dub) can have many companies under it.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: "good"; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={cx("tabular mt-1 text-xl font-semibold sm:text-2xl", tone === "good" && "text-good-text")}>{formatINR(value)}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
