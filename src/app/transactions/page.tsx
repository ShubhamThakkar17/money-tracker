import { connection } from "next/server";
import { getCategories, getDebtsAndPeople, getSubcategories, getTransactions } from "@/lib/data";
import { parseScope } from "@/lib/config";
import { formatDate, formatINR, monthKey, monthLabel, todayIST } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, cx, inputClass } from "@/components/ui";
import { ScopeTabs } from "@/components/scope-tabs";
import { TransactionForm } from "@/components/forms/transaction-form";
import { DeleteButton } from "@/components/forms/delete-button";
import { EditTransaction } from "@/components/forms/edit-forms";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { IconChevronDown, IconPlus } from "@/components/icons";

export const metadata = { title: "Transactions · Finance Tracker" };

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  await connection();
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "all";
  const type = sp.type === "Income" || sp.type === "Expense" ? sp.type : "all";

  const [transactions, categories, subcategories, { debts, people }] = await Promise.all([getTransactions(), getCategories(), getSubcategories(), getDebtsAndPeople()]);
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }));
  const subOptions = subcategories.map((x) => ({ value: x.id, label: x.name, categoryId: x.categoryId }));
  const subName = new Map(subcategories.map((x) => [x.id.replaceAll("-", ""), x.name]));
  const catName = new Map(categories.map((c) => [c.id, `${c.icon ? c.icon + " " : ""}${c.name}`]));
  const personName = new Map(people.map((p) => [p.id, p.name]));

  const months = [...new Set(transactions.filter((t) => t.date).map((t) => monthKey(t.date!)))].sort().reverse();
  const rows = transactions.filter(
    (t) =>
      (scope === "all" || t.scope === scope) &&
      (type === "all" || t.type === type) &&
      (month === "all" || (t.date && monthKey(t.date) === month)),
  );
  // Transfers (card bill payments, moves between your own accounts) aren't money in or out.
  const totalIn = rows.filter((t) => t.type === "Income" && !t.transfer).reduce((s, t) => s + t.amount, 0);
  const totalOut = rows.filter((t) => t.type === "Expense" && !t.transfer).reduce((s, t) => s + t.amount, 0);

  const debtOptions = debts
    .filter((d) => d.remaining > 0)
    .map((d) => ({
      value: d.id,
      label: `${d.direction === "Owes me" ? "←" : "→"} ${d.personIds.map((id) => personName.get(id)).join(", ") || "?"}: ${d.description} (${formatINR(d.remaining)} left)`,
    }));

  return (
    <>
      <PageHeader title="Transactions" subtitle="Everything you've spent and earned">
        <ScopeTabs current={scope} basePath="/transactions" />
      </PageHeader>

      <div className="flex flex-col gap-4">
        <details id="add" open={sp.add === "1"} className="group min-w-0 scroll-mt-20 rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink"><IconPlus className="h-4 w-4" /></span>
              Add a transaction
            </span>
            <IconChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <TransactionForm
            today={todayIST()}
            categories={categories.map((c) => ({ value: c.id, label: catName.get(c.id)! }))}
            subcategories={subcategories.map((x) => ({ value: x.id, label: x.name, categoryId: x.categoryId }))}
            debts={debtOptions}
          />
          </div>
        </details>

        <Card
          title={`${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
          action={
            <AutoSubmitForm className="flex gap-2">
              {scope !== "all" && <input type="hidden" name="scope" value={scope} />}
              <select name="month" defaultValue={month} className={cx(inputClass, "w-auto py-1.5")} aria-label="Month">
                <option value="all">All months</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m, "long")}</option>)}
              </select>
              <select name="type" defaultValue={type} className={cx(inputClass, "w-auto py-1.5")} aria-label="Type">
                <option value="all">All types</option>
                <option value="Expense">Expenses</option>
                <option value="Income">Income</option>
              </select>
              <noscript><button className="rounded-lg border border-line px-3 text-sm hover:bg-surface-2">Filter</button></noscript>
            </AutoSubmitForm>
          }
        >
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>In <strong className="tabular text-good-text">{formatINR(totalIn)}</strong></span>
            <span>Out <strong className="tabular">{formatINR(totalOut)}</strong></span>
            <span>Net <strong className={cx("tabular", totalIn - totalOut < 0 && "text-critical-text")}>{formatINR(totalIn - totalOut)}</strong></span>
          </div>
          {rows.length ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full text-sm sm:min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-4 pb-2 font-medium sm:px-5">Date</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Category</th>
                    <th className="hidden pb-2 font-medium md:table-cell">Scope</th>
                    <th className="hidden pb-2 font-medium lg:table-cell">Method</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="w-16 pr-2 pb-2 sm:px-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-2/60">
                      <td className="tabular py-2.5 pr-3 pl-4 align-top whitespace-nowrap text-ink-2 sm:px-5 sm:align-middle">{formatDate(t.date)}</td>
                      <td className="py-2.5 pr-3">
                        <a href={t.url} target="_blank" rel="noreferrer" className="hover:underline">{t.name || "Untitled"}</a>
                        {(t.paidToFrom || t.debtIds.length > 0) && (
                          <p className="text-xs text-muted">{[t.paidToFrom, t.debtIds.length ? "Debt repayment" : ""].filter(Boolean).join(" · ")}</p>
                        )}
                        <p className="text-xs text-muted sm:hidden">{catName.get(t.categoryIds[0] ?? "") ?? "Uncategorised"}</p>
                      </td>
                      <td className="hidden py-2.5 pr-3 text-ink-2 sm:table-cell">
                        {catName.get(t.categoryIds[0] ?? "") ?? "—"}
                        {t.subcategoryIds[0] && subName.get(t.subcategoryIds[0].replaceAll("-", "")) && (
                          <span className="block text-xs text-muted">{subName.get(t.subcategoryIds[0].replaceAll("-", ""))}</span>
                        )}
                      </td>
                      <td className="hidden py-2.5 pr-3 md:table-cell">{t.scope ? <Badge tone={t.scope === "Personal" ? "neutral" : "accent"}>{t.scope}</Badge> : "—"}</td>
                      <td className="hidden py-2.5 pr-3 text-ink-2 lg:table-cell">{t.paymentMethod ?? "—"}</td>
                      <td className={cx("tabular py-2.5 text-right font-medium whitespace-nowrap", t.type === "Income" && "text-good-text")}>
                        {t.type === "Income" ? "+" : "−"}{formatINR(t.amount)}
                      </td>
                      <td className="py-2.5 pr-2 pl-1 text-right sm:px-5">
                        <span className="inline-flex items-center gap-0.5">
                          <EditTransaction t={t} categories={catOptions} subcategories={subOptions} />
                          <DeleteButton kind="transactions" id={t.id} label={t.name || "Untitled"} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No transactions match these filters.</Empty>
          )}
          <p className="mt-3 text-xs text-muted">Use the pencil to edit, or click a name to open its row in the Google Sheet.</p>
        </Card>
      </div>
    </>
  );
}
