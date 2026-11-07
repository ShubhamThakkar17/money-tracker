import Link from "next/link";
import { getDebtsAndPeople, type Debt } from "@/lib/data";
import { formatDate, formatINR, todayIST } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, cx } from "@/components/ui";
import { DebtForm, PersonForm, PersonPaymentForm, RepaymentForm } from "@/components/forms/debt-forms";
import { DeleteButton } from "@/components/forms/delete-button";
import { EditDebt } from "@/components/forms/edit-forms";
import { IconAlert, IconCheck, IconCircle, IconHalf, IconSparkle } from "@/components/icons";

export const metadata = { title: "Debts · Finance Tracker" };

const statusTone = { Overdue: "critical", "Partially paid": "warning", Open: "neutral", Settled: "good" } as const;
const statusIcon = { Overdue: IconAlert, "Partially paid": IconHalf, Open: IconCircle, Settled: IconCheck } as const;

export default async function DebtsPage() {
  const { debts, people } = await getDebtsAndPeople();
  const today = todayIST();
  const name = new Map(people.map((p) => [p.id, p.name]));
  const peopleOpts = people.map((p) => ({ value: p.id, label: p.name }));
  const personOf = (d: Debt) => d.personIds.map((id) => name.get(id)).filter(Boolean).join(", ") || "Unknown";

  const open = debts.filter((d) => d.remaining > 0).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const settled = debts.filter((d) => d.remaining <= 0);

  // Group open debts by person + direction, so several debts with one person read as one ledger.
  type Group = { key: string; personId: string | null; name: string; direction: "I owe" | "Owes me"; debts: Debt[]; amount: number; repaid: number; remaining: number };
  const byKey = new Map<string, Group>();
  for (const d of open) {
    if (!d.direction) continue;
    const pid = d.personIds[0] ?? null;
    const key = `${pid ?? "none"}|${d.direction}`;
    const g = byKey.get(key) ?? { key, personId: pid, name: personOf(d), direction: d.direction, debts: [], amount: 0, repaid: 0, remaining: 0 };
    g.debts.push(d);
    g.amount += d.amount;
    g.repaid += d.repaid;
    g.remaining += d.remaining;
    byKey.set(key, g);
  }
  const groups = [...byKey.values()]
    .map((g) => ({ ...g, debts: g.debts.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")) }))
    .sort((a, b) => b.remaining - a.remaining);
  const owedToMe = open.filter((d) => d.direction === "Owes me").reduce((s, d) => s + d.remaining, 0);
  const iOwe = open.filter((d) => d.direction === "I owe").reduce((s, d) => s + d.remaining, 0);

  return (
    <>
      <PageHeader title="Debts & loans" subtitle="Money you've lent and borrowed" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Owed to you" value={formatINR(owedToMe)} tone="good" />
        <Stat label="You owe" value={formatINR(iOwe)} tone="critical" />
        <Stat label="Net position" value={formatINR(owedToMe - iOwe)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <Card title="People">
            {people.length ? (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full text-sm sm:min-w-[480px]">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="px-4 pb-2 font-medium sm:px-5">Name</th>
                      <th className="hidden pb-2 text-right font-medium sm:table-cell">They owe</th>
                      <th className="hidden pb-2 text-right font-medium sm:table-cell">You owe</th>
                      <th className="px-4 pb-2 text-right font-medium sm:px-5">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {people.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 sm:px-5">
                          <Link href={`/people/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                          {(p.upi || p.phone) && <p className="text-xs text-muted">{p.upi || p.phone}</p>}
                        </td>
                        <td className="tabular hidden py-2.5 text-right text-ink-2 sm:table-cell">{p.theyOweMe ? formatINR(p.theyOweMe) : "—"}</td>
                        <td className="tabular hidden py-2.5 text-right text-ink-2 sm:table-cell">{p.iOweThem ? formatINR(p.iOweThem) : "—"}</td>
                        <td className="px-4 py-2.5 text-right sm:px-5">
                          {p.net > 0 ? <Badge tone="good">Owes you {formatINR(p.net)}</Badge>
                            : p.net < 0 ? <Badge tone="critical">You owe {formatINR(-p.net)}</Badge>
                            : <Badge><IconCheck className="h-3.5 w-3.5" />Settled</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>No people yet.</Empty>}
          </Card>

          <Card title={`Open (${open.length} debt${open.length === 1 ? "" : "s"} · ${groups.length} ${groups.length === 1 ? "person" : "people"})`}>
            {groups.length ? (
              <ul className="flex flex-col gap-4">
                {groups.map((g) => (
                  <li key={g.key} className="rounded-xl border border-line p-4">
                    {/* Person summary */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {g.direction === "Owes me" ? (
                            <><Link href={`/people/${g.personId}`} className="hover:underline">{g.name}</Link> owes you</>
                          ) : (
                            <>You owe <Link href={`/people/${g.personId}`} className="hover:underline">{g.name}</Link></>
                          )}
                        </p>
                        <p className="text-xs text-ink-2">
                          {g.debts.length} debt{g.debts.length === 1 ? "" : "s"}
                          {g.repaid > 0 && <> · {formatINR(g.repaid)} of {formatINR(g.amount)} paid</>}
                        </p>
                      </div>
                      <p className={cx("tabular text-lg font-semibold", g.direction === "Owes me" ? "text-good-text" : "text-critical-text")}>{formatINR(g.remaining)}</p>
                    </div>
                    {g.personId && (
                      <div className="mt-2">
                        <PersonPaymentForm personId={g.personId} personName={g.name} direction={g.direction} total={g.remaining} today={today} />
                      </div>
                    )}

                    {/* Individual debts, each with its own payment log */}
                    <ul className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-3">
                      {g.debts.map((d) => (
                        <li key={d.id}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm">
                                <a href={d.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{d.description}</a>
                                <span className="text-xs text-ink-2"> · {formatDate(d.date)}{d.dueDate && <> · due {formatDate(d.dueDate)}</>}</span>
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge tone={statusTone[d.status]}><StatusIcon status={d.status} />{d.status}</Badge>
                                <span className="tabular text-xs text-muted">{d.repaid > 0 ? `${formatINR(d.repaid)} of ${formatINR(d.amount)} paid` : `of ${formatINR(d.amount)}`}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="tabular mr-1 text-sm font-semibold">{formatINR(d.remaining)}</span>
                              <EditDebt d={d} people={peopleOpts} />
                              <DeleteButton kind="debts" id={d.id} label={d.description} />
                            </div>
                          </div>
                          {d.payments.length > 0 && (
                            <ul className="mt-1.5 flex flex-col gap-0.5">
                              {d.payments.map((t) => (
                                <li key={t.id} className="flex items-center justify-between gap-3 text-xs text-ink-2">
                                  <a href={t.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                                    ↳ {formatDate(t.date)} · {t.name}{t.method && ` · ${t.method}`}
                                  </a>
                                  <span className="tabular whitespace-nowrap">{formatINR(t.amount)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {g.debts.length > 1 && (
                            <div className="mt-1">
                              <RepaymentForm debtId={d.id} personName={g.name} remaining={d.remaining} today={today} direction={d.direction} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : <Empty><span className="inline-flex items-center gap-1.5"><IconSparkle className="h-4 w-4 text-accent" />No open debts.</span></Empty>}
          </Card>

          {settled.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold">Settled ({settled.length})</summary>
              <ul className="mt-3 flex flex-col divide-y divide-line text-sm">
                {settled.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-ink-2">{personOf(d)} · {d.description}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-muted">{formatINR(d.amount)}</span>
                      <EditDebt d={d} people={peopleOpts} />
                      <DeleteButton kind="debts" id={d.id} label={d.description} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card title="Add a debt or loan">
            <DebtForm today={today} people={people.map((p) => ({ value: p.id, label: p.name }))} />
          </Card>
          <Card title="Add a person">
            <PersonForm />
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "critical" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={`tabular mt-1 text-lg font-semibold sm:text-2xl ${tone === "good" ? "text-good-text" : tone === "critical" ? "text-critical-text" : ""}`}>{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: keyof typeof statusIcon }) {
  const Icon = statusIcon[status];
  return <Icon className="h-3.5 w-3.5" />;
}
