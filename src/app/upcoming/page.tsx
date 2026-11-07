import { getUpcomingFeed, type UpcomingItem } from "@/lib/data";
import { parseScope } from "@/lib/config";
import { formatINR } from "@/lib/format";
import { Card, Empty, PageHeader, cx } from "@/components/ui";
import { ScopeTabs } from "@/components/scope-tabs";
import { UpcomingRow } from "@/components/upcoming-list";
import { MarkPaidAction, UpcomingForm } from "@/components/forms/upcoming-forms";
import { PersonForm } from "@/components/forms/debt-forms";
import { DeleteButton } from "@/components/forms/delete-button";
import { EditUpcoming } from "@/components/forms/edit-forms";
import { IconAlert } from "@/components/icons";

export const metadata = { title: "Upcoming · Finance Tracker" };

export default async function UpcomingPage({ searchParams }: PageProps<"/upcoming">) {
  const scope = parseScope((await searchParams).scope);
  const { today, items, people, categories, payments } = await getUpcomingFeed(scope);
  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }));
  const peopleOpts = people.map((p) => ({ value: p.id, label: p.name }));

  const groups: { title: string; items: UpcomingItem[]; tone?: "critical" }[] = [
    { title: "Overdue", items: items.filter((i) => i.daysLeft < 0), tone: "critical" },
    { title: "Next 7 days", items: items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 7) },
    { title: "Later this month", items: items.filter((i) => i.daysLeft > 7 && i.daysLeft <= 30) },
    { title: "Further out", items: items.filter((i) => i.daysLeft > 30) },
  ];
  const sum = (list: UpcomingItem[], flow: "in" | "out") => list.filter((i) => i.flow === flow).reduce((s, i) => s + i.amount, 0);
  const next30 = items.filter((i) => i.daysLeft <= 30);
  const overdue = groups[0].items;

  return (
    <>
      <PageHeader title="Upcoming payments" subtitle="Bills, renewals and debts with a due date">
        <ScopeTabs current={scope} basePath="/upcoming" />
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To pay · next 30 days" value={formatINR(sum(next30, "out"))} />
        <Stat label="To receive · next 30 days" value={formatINR(sum(next30, "in"))} tone="good" />
        <Stat label="Net · next 30 days" value={formatINR(sum(next30, "in") - sum(next30, "out"))} />
        <Stat
          label={`Overdue${overdue.length ? ` · ${overdue.length} item${overdue.length === 1 ? "" : "s"}` : ""}`}
          value={overdue.length ? `${formatINR(sum(overdue, "out"))} to pay` : "None"}
          tone={overdue.length ? "critical" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          {items.length === 0 && <Card><Empty>Nothing coming up. Add a bill or expected payment →</Empty></Card>}
          {groups.filter((g) => g.items.length).map((g) => (
            <Card
              key={g.title}
              title={<span className={cx("inline-flex items-center gap-1.5", g.tone === "critical" && "text-critical-text")}>{g.tone === "critical" && <IconAlert className="h-4 w-4" />}{g.title} ({g.items.length})</span>}
              action={<span className="tabular text-xs text-ink-2">−{formatINR(sum(g.items, "out"))}{sum(g.items, "in") > 0 && <> · <span className="text-good-text">+{formatINR(sum(g.items, "in"))}</span></>}</span>}
            >
              <ul className="flex flex-col divide-y divide-line">
                {g.items.map((i) => (
                  <UpcomingRow
                    key={i.key}
                    item={i}
                    action={
                      <div className="flex items-start justify-between gap-2">
                        <MarkPaidAction kind={i.kind} id={i.id} amount={i.amount} today={today} flow={i.flow} />
                        {i.kind === "payment" && (
                          <span className="inline-flex items-center gap-0.5">
                            {paymentById.get(i.id) && <EditUpcoming p={paymentById.get(i.id)!} categories={catOptions} people={peopleOpts} />}
                            <DeleteButton kind="upcoming" id={i.id} label={i.name} />
                          </span>
                        )}
                      </div>
                    }
                  />
                ))}
              </ul>
            </Card>
          ))}
          <p className="text-xs text-muted">
            Marking something paid logs it as a transaction. Recurring items then move to their next due date; one-time items are marked Paid.
          </p>
        </div>
        <div className="flex flex-col gap-4 self-start lg:col-span-2">
        <Card title="Add an upcoming payment">
          <UpcomingForm
            today={today}
            categories={categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }))}
            people={people.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Card>
        <Card title="Add a person">
          <PersonForm />
          <p className="mt-3 text-xs text-muted">People show up in the &ldquo;Paying&rdquo; / &ldquo;From&rdquo; list above and on the Debts page.</p>
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
      <p className={cx("tabular mt-1 text-lg font-semibold sm:text-2xl", tone === "good" && "text-good-text", tone === "critical" && "text-critical-text")}>{value}</p>
    </div>
  );
}
