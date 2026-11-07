import Link from "next/link";
import { connection } from "next/server";
import { getCategories, getSubcategories, getTransactions } from "@/lib/data";
import { formatINR, monthKey, monthLabel, todayIST } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { CategoryForm, SubcategoryForm } from "@/components/forms/category-forms";
import { DeleteButton } from "@/components/forms/delete-button";

export const metadata = { title: "Categories · Finance Tracker" };

const norm = (id: string) => id.replaceAll("-", "");

export default async function CategoriesPage() {
  await connection();
  const [categories, subcategories, transactions] = await Promise.all([getCategories(), getSubcategories(), getTransactions()]);
  const today = todayIST();
  const month = monthKey(today);
  const catSpend = new Map<string, number>();
  const subSpend = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "Expense" || !t.date || t.date > today || monthKey(t.date) !== month || t.debtIds.length || t.transfer) continue;
    const c = t.categoryIds[0];
    if (c) catSpend.set(norm(c), (catSpend.get(norm(c)) ?? 0) + t.amount);
    const s = t.subcategoryIds[0];
    if (s) subSpend.set(norm(s), (subSpend.get(norm(s)) ?? 0) + t.amount);
  }
  const subsOf = (catId: string) => subcategories.filter((s) => s.categoryId && norm(s.categoryId) === norm(catId));
  const orphans = subcategories.filter((s) => !s.categoryId || !categories.some((c) => norm(c.id) === norm(s.categoryId!)));
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.icon ? c.icon + " " : ""}${c.name}` }));

  return (
    <>
      <PageHeader title="Categories" subtitle={<>Group spending into categories, and track places like Rapido or Zomato as subcategories · spend shown for {monthLabel(month, "long")}</>}>
        <Link href="/analytics" className="text-sm font-medium text-accent hover:underline">Open analytics →</Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="columns-1 gap-3 sm:columns-2">
            {categories.map((c) => {
              const subs = subsOf(c.id);
              return (
                <section key={c.id} className="mb-3 flex break-inside-avoid flex-col rounded-xl border border-line bg-surface p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/analytics?focus=cat:${c.id}`} className="font-medium hover:underline">
                        {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.name}
                      </Link>
                      <p className="text-xs text-muted">{c.scope ?? "—"} · {subs.length} subcategor{subs.length === 1 ? "y" : "ies"}</p>
                    </div>
                    <p className="tabular text-sm font-semibold whitespace-nowrap">{formatINR(catSpend.get(norm(c.id)) ?? 0)}</p>
                  </header>
                  {subs.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {subs.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 py-1 pr-1 pl-2.5 text-sm">
                          <Link href={`/analytics?focus=sub:${s.id}`} className="min-w-0 truncate hover:underline">{s.name}</Link>
                          <span className="flex items-center gap-1">
                            <span className="tabular text-xs text-ink-2">{formatINR(subSpend.get(norm(s.id)) ?? 0)}</span>
                            <DeleteButton kind="subcategories" id={s.id} label={s.name} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {orphans.length > 0 && (
            <p className="mt-3 text-xs text-muted">Not linked to a category: {orphans.map((o) => o.name).join(", ")}. Set their Category in the sheet.</p>
          )}
        </div>

        <div className="flex flex-col gap-4 self-start">
          <Card title="Add a subcategory">
            <SubcategoryForm categories={catOptions} />
            <p className="mt-3 text-xs text-muted">Examples: Rapido, Uber, Ola under Transport · Zomato, Swiggy under Food & Dining.</p>
          </Card>
          <Card title="Add a category">
            <CategoryForm />
          </Card>
        </div>
      </div>
    </>
  );
}
