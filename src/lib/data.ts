import "server-only";
import { connection } from "next/server";
import { type ScopeFilter } from "./config";
import { read, rowsOf } from "./sheets";
import { daysBetween, formatDate, formatINR, monthKey, shiftMonth, todayIST } from "./format";

export type Transaction = {
  id: string;
  url: string;
  name: string;
  date: string | null;
  amount: number;
  type: "Expense" | "Income" | null;
  scope: string | null;
  categoryIds: string[];
  subcategoryIds: string[];
  paymentMethod: string | null;
  paidToFrom: string;
  debtIds: string[];
  gst: number | null;
  notes: string;
  /** Category is marked Transfer (e.g. a credit card bill payment), so it isn't income or spending. */
  transfer: boolean;
};

export type Category = {
  id: string;
  url: string;
  name: string;
  icon: string | null;
  scope: string | null;
  transfer: boolean;
};

export type Debt = {
  id: string;
  url: string;
  description: string;
  personIds: string[];
  direction: "I owe" | "Owes me" | null;
  amount: number;
  date: string | null;
  dueDate: string | null;
  scope: string | null;
  notes: string;
  repaid: number;
  remaining: number;
  status: "Settled" | "Partially paid" | "Overdue" | "Open";
  /** Repayment transactions linked to this debt, oldest first. */
  payments: { id: string; url: string; date: string | null; amount: number; name: string; method: string | null }[];
};

export type Person = {
  id: string;
  url: string;
  name: string;
  phone: string;
  upi: string;
  relationship: string | null;
  theyOweMe: number;
  iOweThem: number;
  net: number; // positive = they owe me
};

export type Subscription = {
  id: string;
  url: string;
  name: string;
  amount: number;
  cycle: string | null;
  nextRenewal: string | null;
  scope: string | null;
  paymentMethod: string | null;
  active: boolean;
  monthlyCost: number;
  categoryIds: string[];
  notes: string;
};

export type UpcomingPayment = {
  id: string;
  url: string;
  name: string;
  amount: number;
  dueDate: string | null;
  direction: "To pay" | "To receive";
  repeat: string | null;
  status: string | null;
  scope: string | null;
  categoryIds: string[];
  personIds: string[];
  paymentMethod: string | null;
  notes: string;
  /** Already paid/received toward the current due date (partial payments). */
  paidSoFar: number;
  /** amount − paidSoFar, never below 0. */
  remaining: number;
};

/** One row in the combined "what's coming up" feed. */
export type UpcomingItem = {
  key: string;
  kind: "payment" | "subscription" | "debt";
  id: string;
  url: string;
  name: string;
  detail: string;
  amount: number;
  date: string;
  daysLeft: number;
  flow: "out" | "in";
  scope: string | null;
  repeat: string | null;
};

export async function getTransactions(): Promise<Transaction[]> {
  const [rows, categories] = await Promise.all([rowsOf("transactions"), getCategories()]);
  const transferIds = new Set(categories.filter((c) => c.transfer).map((c) => c.id));
  return rows
    .map((r) => {
      const type = read.select(r, "Type");
      const categoryIds = read.ids(r, "Category");
      return {
        id: r.id,
        url: r.url,
        name: read.text(r, "Name"),
        date: read.date(r, "Date"),
        amount: read.number(r, "Amount") ?? 0,
        type: type === "Expense" || type === "Income" ? type : null,
        scope: read.select(r, "Scope"),
        categoryIds,
        subcategoryIds: read.ids(r, "Subcategory"),
        paymentMethod: read.select(r, "Payment Method"),
        paidToFrom: read.text(r, "Paid To / From"),
        debtIds: read.ids(r, "Debt"),
        gst: read.number(r, "GST Paid"),
        notes: read.text(r, "Notes"),
        transfer: categoryIds.some((id) => transferIds.has(id)),
      } satisfies Transaction;
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Categories live in the "Categories" tab; subcategories in "Subcategories". */
export type Subcategory = { id: string; url: string; name: string; categoryId: string | null };

export async function getSubcategories(): Promise<Subcategory[]> {
  const rows = await rowsOf("subcategories");
  return rows
    .map((r) => ({
      id: r.id,
      url: r.url,
      name: read.text(r, "Name"),
      categoryId: read.ids(r, "Category")[0] ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategories(): Promise<Category[]> {
  const rows = await rowsOf("categories");
  return rows
    .map((r) => ({
      id: r.id,
      url: r.url,
      name: read.text(r, "Category"),
      icon: read.text(r, "Icon") ? [...read.text(r, "Icon")][0] : null,
      scope: read.select(r, "Scope"),
      transfer: read.checkbox(r, "Transfer"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getRawDebts() {
  const rows = await rowsOf("debts");
  return rows.map((r) => {
    const dir = read.select(r, "Direction");
    return {
      id: r.id,
      url: r.url,
      description: read.text(r, "Description"),
      personIds: read.ids(r, "Person"),
      direction: dir === "I owe" || dir === "Owes me" ? dir : null,
      amount: read.number(r, "Amount") ?? 0,
      date: read.date(r, "Date"),
      dueDate: read.date(r, "Due Date"),
      scope: read.select(r, "Scope"),
      notes: read.text(r, "Notes"),
    } as const;
  });
}

async function getRawPeople() {
  const rows = await rowsOf("people");
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    name: read.text(r, "Name"),
    phone: read.text(r, "Phone"),
    upi: read.text(r, "UPI ID"),
    relationship: read.select(r, "Relationship"),
  }));
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const rows = await rowsOf("subscriptions");
  return rows
    .map((r) => {
      const pr = r;
      const amount = read.number(pr, "Amount") ?? 0;
      const cycle = read.select(pr, "Billing Cycle");
      const monthlyCost =
        cycle === "Yearly" ? amount / 12 : cycle === "Quarterly" ? amount / 3 : amount;
      return {
        id: r.id,
        url: r.url,
        name: read.text(pr, "Name"),
        amount,
        cycle,
        nextRenewal: read.date(pr, "Next Renewal"),
        scope: read.select(pr, "Scope"),
        paymentMethod: read.select(pr, "Payment Method"),
        active: read.checkbox(pr, "Active"),
        monthlyCost,
        categoryIds: read.ids(pr, "Category"),
        notes: read.text(pr, "Notes"),
      };
    })
    .sort((a, b) => (a.nextRenewal ?? "9999").localeCompare(b.nextRenewal ?? "9999"));
}

export async function getUpcomingPayments(): Promise<UpcomingPayment[]> {
  const rows = await rowsOf("upcoming");
  return rows.map((pr) => {
    return {
      id: pr.id,
      url: pr.url,
      name: read.text(pr, "Name"),
      amount: read.number(pr, "Amount") ?? 0,
      dueDate: read.date(pr, "Due Date"),
      direction: read.select(pr, "Direction") === "To receive" ? "To receive" : "To pay",
      repeat: read.select(pr, "Repeat"),
      status: read.select(pr, "Status"),
      scope: read.select(pr, "Scope"),
      categoryIds: read.ids(pr, "Category"),
      personIds: read.ids(pr, "Person"),
      paymentMethod: read.select(pr, "Payment Method"),
      notes: read.text(pr, "Notes"),
      paidSoFar: read.number(pr, "Paid So Far") ?? 0,
      remaining: Math.max(0, (read.number(pr, "Amount") ?? 0) - (read.number(pr, "Paid So Far") ?? 0)),
    };
  });
}

/**
 * Everything with a date coming up: pending upcoming payments, active subscription
 * renewals and open debts with a due date. Sorted soonest first (overdue at the top).
 */
export function buildUpcoming(
  payments: UpcomingPayment[],
  subscriptions: Subscription[],
  debts: Debt[],
  peopleById: Map<string, string>,
  today: string,
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const p of payments) {
    if (p.status === "Paid" || !p.dueDate) continue;
    const who = p.personIds.map((id) => peopleById.get(id)).filter(Boolean).join(", ");
    items.push({
      key: `p:${p.id}`, kind: "payment", id: p.id, url: p.url, name: p.name,
      detail: [
        p.paidSoFar > 0 ? `${formatINR(p.paidSoFar)} of ${formatINR(p.amount)} ${p.direction === "To receive" ? "received" : "paid"}` : null,
        p.repeat && p.repeat !== "One-time" ? p.repeat : null, who, p.paymentMethod,
      ].filter(Boolean).join(" · "),
      amount: p.remaining, date: p.dueDate, daysLeft: daysBetween(today, p.dueDate),
      flow: p.direction === "To receive" ? "in" : "out", scope: p.scope, repeat: p.repeat,
    });
  }
  for (const s of subscriptions) {
    if (!s.active || !s.nextRenewal) continue;
    items.push({
      key: `s:${s.id}`, kind: "subscription", id: s.id, url: s.url, name: s.name,
      detail: ["Subscription", s.cycle, s.paymentMethod].filter(Boolean).join(" · "),
      amount: s.amount, date: s.nextRenewal, daysLeft: daysBetween(today, s.nextRenewal),
      flow: "out", scope: s.scope, repeat: s.cycle,
    });
  }
  for (const d of debts) {
    if (d.remaining <= 0 || !d.dueDate) continue;
    const who = d.personIds.map((id) => peopleById.get(id)).filter(Boolean).join(", ") || "someone";
    items.push({
      key: `d:${d.id}`, kind: "debt", id: d.id, url: d.url,
      name: d.direction === "Owes me" ? `${who} owes you` : `Pay back ${who}`,
      detail: `Debt · ${d.description}`,
      amount: d.remaining, date: d.dueDate, daysLeft: daysBetween(today, d.dueDate),
      flow: d.direction === "Owes me" ? "in" : "out", scope: d.scope, repeat: null,
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export async function getUpcomingFeed(scope: ScopeFilter) {
  await connection();
  const [payments, subscriptions, rawDebts, rawPeople, transactions, categories] = await Promise.all([
    getUpcomingPayments(),
    getSubscriptions(),
    getRawDebts(),
    getRawPeople(),
    getTransactions(),
    getCategories(),
  ]);
  const today = todayIST();
  const { debts, people } = computeDebts(rawDebts, rawPeople, transactions, today);
  const peopleById = new Map(people.map((p) => [p.id, p.name]));
  const items = buildUpcoming(payments, subscriptions, debts, peopleById, today).filter(inScope(scope));
  return { today, items, people, categories, payments: payments.filter(inScope(scope)) };
}

/** Debts with repayments rolled up from linked transactions, plus per-person balances. */
export function computeDebts(
  rawDebts: Awaited<ReturnType<typeof getRawDebts>>,
  rawPeople: Awaited<ReturnType<typeof getRawPeople>>,
  transactions: Transaction[],
  today: string,
): { debts: Debt[]; people: Person[] } {
  const repaidBy = new Map<string, number>();
  const paymentsBy = new Map<string, Debt["payments"]>();
  for (const t of transactions) {
    for (const d of t.debtIds) {
      repaidBy.set(d, (repaidBy.get(d) ?? 0) + t.amount);
      const list = paymentsBy.get(d) ?? [];
      list.push({ id: t.id, url: t.url, date: t.date, amount: t.amount, name: t.name, method: t.paymentMethod });
      paymentsBy.set(d, list);
    }
  }
  const debts: Debt[] = rawDebts.map((d) => {
    const repaid = repaidBy.get(d.id) ?? 0;
    const remaining = d.amount - repaid;
    const status: Debt["status"] =
      remaining <= 0
        ? "Settled"
        : repaid > 0
          ? "Partially paid"
          : d.dueDate && d.dueDate < today
            ? "Overdue"
            : "Open";
    const payments = (paymentsBy.get(d.id) ?? []).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    return { ...d, repaid, remaining, status, payments };
  });
  const people: Person[] = rawPeople
    .map((p) => {
      let theyOweMe = 0;
      let iOweThem = 0;
      for (const d of debts) {
        if (!d.personIds.includes(p.id) || d.remaining <= 0) continue;
        if (d.direction === "Owes me") theyOweMe += d.remaining;
        if (d.direction === "I owe") iOweThem += d.remaining;
      }
      return { ...p, theyOweMe, iOweThem, net: theyOweMe - iOweThem };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
  return { debts, people };
}

export async function getDebtsAndPeople() {
  await connection();
  const [rawDebts, rawPeople, transactions] = await Promise.all([
    getRawDebts(),
    getRawPeople(),
    getTransactions(),
  ]);
  return computeDebts(rawDebts, rawPeople, transactions, todayIST());
}

const inScope = (scope: ScopeFilter) => (x: { scope: string | null }) =>
  scope === "all" || x.scope === scope;

/** Transactions that count as real income/spend (debt repayments and transfers are excluded). */
export const isCashflow = (t: Transaction) => t.debtIds.length === 0 && !t.transfer && t.date !== null;

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(scope: ScopeFilter) {
  await connection();
  const [transactions, categories, rawDebts, rawPeople, subscriptions, payments] = await Promise.all([
    getTransactions(),
    getCategories(),
    getRawDebts(),
    getRawPeople(),
    getSubscriptions(),
    getUpcomingPayments(),
  ]);
  const today = todayIST();
  const thisMonth = monthKey(today);
  const { debts, people } = computeDebts(rawDebts, rawPeople, transactions, today);

  const tx = transactions.filter(inScope(scope));
  const flow = tx.filter(isCashflow);
  const monthTx = flow.filter((t) => monthKey(t.date!) === thisMonth);
  const lastMonthTx = flow.filter((t) => monthKey(t.date!) === shiftMonth(thisMonth, -1));

  const sum = (list: Transaction[], type: "Income" | "Expense") =>
    list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

  const income = sum(monthTx, "Income");
  const expenses = sum(monthTx, "Expense");
  const lastIncome = sum(lastMonthTx, "Income");
  const lastExpenses = sum(lastMonthTx, "Expense");

  // Last 6 months, oldest first.
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(thisMonth, i - 5));
  const monthly = months.map((m) => {
    const list = flow.filter((t) => monthKey(t.date!) === m);
    return { month: m, income: sum(list, "Income"), expenses: sum(list, "Expense") };
  });

  // This month's spend per category.
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const spendByCat = new Map<string, number>();
  for (const t of monthTx) {
    if (t.type !== "Expense") continue;
    const key = t.categoryIds[0] ?? "uncategorised";
    spendByCat.set(key, (spendByCat.get(key) ?? 0) + t.amount);
  }
  const categorySpend = [...spendByCat.entries()]
    .map(([id, amount]) => ({
      name: categoryById.get(id)?.name ?? "Uncategorised",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const scopedDebts = debts.filter(inScope(scope));
  const openDebts = scopedDebts
    .filter((d) => d.remaining > 0)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const owedToMe = openDebts
    .filter((d) => d.direction === "Owes me")
    .reduce((s, d) => s + d.remaining, 0);
  const iOwe = openDebts
    .filter((d) => d.direction === "I owe")
    .reduce((s, d) => s + d.remaining, 0);

  const activeSubs = subscriptions.filter((s) => s.active).filter(inScope(scope));
  const monthlySubCost = activeSubs.reduce((s, x) => s + x.monthlyCost, 0);
  const upcoming = buildUpcoming(payments, subscriptions, debts, new Map(people.map((p) => [p.id, p.name])), today)
    .filter(inScope(scope))
    .filter((i) => i.daysLeft <= 30);
  const dueOut = upcoming.filter((i) => i.flow === "out").reduce((s, i) => s + i.amount, 0);
  const dueIn = upcoming.filter((i) => i.flow === "in").reduce((s, i) => s + i.amount, 0);

  // ---- Balance summary (all-time cash + everything still pending) ----
  const totalIncome = sum(tx.filter((t) => t.date && !t.transfer), "Income");
  const totalExpenses = sum(tx.filter((t) => t.date && !t.transfer), "Expense");
  const netBalance = totalIncome - totalExpenses;

  const catName = (ids: string[]) => categoryById.get(ids[0] ?? "")?.name ?? "";
  const isReferral = (ids: string[]) => /referral|affiliate|side income/i.test(catName(ids));
  const pending = payments.filter((p) => p.status !== "Paid").filter(inScope(scope));
  const bills =
    pending.filter((p) => p.direction === "To pay").reduce((s, p) => s + p.remaining, 0) +
    activeSubs
      .filter((x) => x.nextRenewal && daysBetween(today, x.nextRenewal) <= 30)
      .reduce((s, x) => s + x.amount, 0);
  const toReceive = pending.filter((p) => p.direction === "To receive");
  const referralPayoutsPending =
    scope === "Infinity Linkage" ? 0 : (await getReferralPayouts()).filter((x) => x.status !== "Paid").reduce((s, x) => s + x.amount, 0);
  const referralUpcoming = toReceive.filter((p) => isReferral(p.categoryIds)).reduce((s, p) => s + p.remaining, 0);
  const referrals = referralUpcoming + referralPayoutsPending;
  const expected = toReceive.reduce((s, p) => s + p.remaining, 0) - referralUpcoming;
  const upcomingOut = bills + iOwe;
  const upcomingIn = expected + owedToMe + referrals;

  const summary = {
    netBalance,
    totalIncome,
    totalExpenses,
    monthIncome: income,
    monthExpenses: expenses,
    upcomingOut,
    bills,
    peopleYouOwe: iOwe,
    upcomingIn,
    expected,
    receivables: owedToMe,
    referrals,
    projected: netBalance + upcomingIn - upcomingOut,
  };

  return {
    today,
    thisMonth,
    summary,
    kpis: { income, expenses, net: income - expenses, lastIncome, lastExpenses, owedToMe, iOwe },
    monthly,
    categorySpend,
    openDebts: openDebts.slice(0, 6),
    people: people.filter((p) => p.net !== 0).slice(0, 6),
    peopleById: Object.fromEntries(people.map((p) => [p.id, p.name])),
    upcoming,
    dueOut,
    dueIn,
    monthlySubCost,
    recent: tx.slice(0, 8).map((t) => ({
      ...t,
      categoryName: categoryById.get(t.categoryIds[0] ?? "")?.name ?? null,
    })),
  };
}

export { getRawPeople as getPeopleList, getRawDebts };

// ---------- One person's full history ----------

export type PersonEvent = {
  key: string;
  date: string | null;
  kind: "lent" | "borrowed" | "repaid-to-you" | "you-repaid" | "paid" | "received" | "upcoming";
  title: string;
  detail: string;
  amount: number;
  flow: "in" | "out";
  url: string;
  status?: string;
};

export async function getPersonDetail(personId: string) {
  await connection();
  const same = (a: string, b: string) => a.replaceAll("-", "") === b.replaceAll("-", "");
  const [rawDebts, rawPeople, transactions, payments, categories] = await Promise.all([
    getRawDebts(),
    getRawPeople(),
    getTransactions(),
    getUpcomingPayments(),
    getCategories(),
  ]);
  const today = todayIST();
  const { debts, people } = computeDebts(rawDebts, rawPeople, transactions, today);
  const person = people.find((p) => same(p.id, personId));
  if (!person) return null;

  const theirDebts = debts.filter((d) => d.personIds.some((id) => same(id, person.id)));
  const debtIds = new Set(theirDebts.map((d) => d.id.replaceAll("-", "")));
  const catName = new Map(categories.map((c) => [c.id.replaceAll("-", ""), c.name]));
  const nameLc = person.name.trim().toLowerCase();

  const events: PersonEvent[] = [];
  for (const d of theirDebts) {
    events.push({
      key: `d:${d.id}`,
      date: d.date,
      kind: d.direction === "Owes me" ? "lent" : "borrowed",
      title: d.direction === "Owes me" ? `You lent · ${d.description}` : `You borrowed · ${d.description}`,
      detail: d.remaining > 0 ? `${d.status}${d.dueDate ? ` · due ${formatDate(d.dueDate)}` : ""}` : "Settled",
      amount: d.amount,
      flow: d.direction === "Owes me" ? "out" : "in",
      url: d.url,
      status: d.status,
    });
  }
  // Transactions: repayments linked to their debts, or entries naming them in "Paid To / From".
  const linkedTx = transactions.filter(
    (t) =>
      t.debtIds.some((id) => debtIds.has(id.replaceAll("-", ""))) ||
      (nameLc.length > 1 && t.paidToFrom.trim().toLowerCase() === nameLc),
  );
  for (const t of linkedTx) {
    const isRepay = t.debtIds.some((id) => debtIds.has(id.replaceAll("-", "")));
    const inflow = t.type === "Income";
    events.push({
      key: `t:${t.id}`,
      date: t.date,
      kind: isRepay ? (inflow ? "repaid-to-you" : "you-repaid") : inflow ? "received" : "paid",
      title: isRepay ? (inflow ? "Paid you back" : "You paid back") : t.name || (inflow ? "Received" : "Paid"),
      detail: [isRepay ? t.name : null, catName.get(t.categoryIds[0]?.replaceAll("-", "") ?? ""), t.paymentMethod].filter(Boolean).join(" · "),
      amount: t.amount,
      flow: inflow ? "in" : "out",
      url: t.url,
    });
  }
  const theirPayments = payments.filter((p) => p.personIds.some((id) => same(id, person.id)));
  for (const p of theirPayments) {
    events.push({
      key: `u:${p.id}`,
      date: p.dueDate,
      kind: "upcoming",
      title: p.name,
      detail: `${p.direction === "To receive" ? "Expected from them" : "To pay them"} · ${p.status === "Paid" ? "Done" : "Pending"}${p.repeat && p.repeat !== "One-time" ? ` · ${p.repeat}` : ""}`,
      amount: p.amount,
      flow: p.direction === "To receive" ? "in" : "out",
      url: p.url,
      status: p.status ?? "Pending",
    });
  }
  events.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const sumTx = (type: "Income" | "Expense") => linkedTx.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  return {
    today,
    person,
    people: people.map((x) => ({ value: x.id, label: x.name })),
    openDebts: theirDebts.filter((d) => d.remaining > 0),
    pending: theirPayments.filter((p) => p.status !== "Paid"),
    events,
    totals: {
      theyOweMe: person.theyOweMe,
      iOweThem: person.iOweThem,
      receivedFrom: sumTx("Income"),
      paidTo: sumTx("Expense"),
      lent: theirDebts.filter((d) => d.direction === "Owes me").reduce((s, d) => s + d.amount, 0),
      borrowed: theirDebts.filter((d) => d.direction === "I owe").reduce((s, d) => s + d.amount, 0),
    },
  };
}

// ---------- Referral programs & payouts ----------

export type ReferralProgram = {
  id: string; url: string; company: string; platform: string; link: string | null;
  commission: string; active: boolean; notes: string;
};
export type ReferralPayout = {
  id: string; url: string; name: string; programId: string | null; amount: number; originalAmount: string;
  status: "Pending" | "Approved" | "Paid"; earnedDate: string | null; expectedPayout: string | null;
  paidDate: string | null; notes: string;
};

export async function getReferralPrograms(): Promise<ReferralProgram[]> {
  const rows = await rowsOf("referralPrograms");
  return rows
    .map((pr) => {
      const raw = read.text(pr, "Link");
      const link = /^https?:\/\//.test(raw) ? raw : null;
      return {
        id: pr.id, url: pr.url,
        company: read.text(pr, "Company"),
        platform: read.select(pr, "Platform") ?? "Direct",
        link,
        commission: read.text(pr, "Commission"),
        active: read.checkbox(pr, "Active"),
        notes: read.text(pr, "Notes"),
      };
    })
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.company.localeCompare(b.company));
}

export async function getReferralPayouts(): Promise<ReferralPayout[]> {
  const rows = await rowsOf("referralPayouts");
  return rows.map((pr) => {
    const st = read.select(pr, "Status");
    return {
      id: pr.id, url: pr.url,
      name: read.text(pr, "Name"),
      programId: read.ids(pr, "Program")[0] ?? null,
      amount: read.number(pr, "Amount") ?? 0,
      originalAmount: read.text(pr, "Original Amount"),
      status: st === "Paid" || st === "Approved" ? st : "Pending",
      earnedDate: read.date(pr, "Earned Date"),
      expectedPayout: read.date(pr, "Expected Payout"),
      paidDate: read.date(pr, "Paid Date"),
      notes: read.text(pr, "Notes"),
    };
  });
}

export async function getReferrals() {
  await connection();
  const [programs, payouts] = await Promise.all([getReferralPrograms(), getReferralPayouts()]);
  const today = todayIST();
  const month = monthKey(today);
  const norm = (id: string) => id.replaceAll("-", "");
  const progById = new Map(programs.map((p) => [norm(p.id), p]));

  type ProgRow = ReferralProgram & { paid: number; pending: number; count: number; lastPaid: string | null };
  const progRows = new Map<string, ProgRow>(programs.map((p) => [norm(p.id), { ...p, paid: 0, pending: 0, count: 0, lastPaid: null }]));
  for (const x of payouts) {
    const r = x.programId ? progRows.get(norm(x.programId)) : undefined;
    if (!r) continue;
    r.count++;
    if (x.status === "Paid") {
      r.paid += x.amount;
      if (x.paidDate && (!r.lastPaid || x.paidDate > r.lastPaid)) r.lastPaid = x.paidDate;
    } else r.pending += x.amount;
  }
  const platforms = [...new Set(programs.map((p) => p.platform))].map((name) => {
    const list = [...progRows.values()].filter((r) => r.platform === name).sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
    return {
      name,
      programs: list,
      paid: list.reduce((s, r) => s + r.paid, 0),
      pending: list.reduce((s, r) => s + r.pending, 0),
    };
  }).sort((a, b) => b.paid + b.pending - (a.paid + a.pending));

  const withProgram = payouts.map((x) => {
    const prog = x.programId ? progById.get(norm(x.programId)) : undefined;
    return { ...x, company: prog?.company ?? "Unknown program", platform: prog?.platform ?? "—" };
  });
  const open = withProgram
    .filter((x) => x.status !== "Paid")
    .sort((a, b) => (a.expectedPayout ?? a.earnedDate ?? "9999").localeCompare(b.expectedPayout ?? b.earnedDate ?? "9999"));
  const paid = withProgram
    .filter((x) => x.status === "Paid")
    .sort((a, b) => (b.paidDate ?? "").localeCompare(a.paidDate ?? ""));

  return {
    today,
    programs,
    platforms,
    open,
    paid,
    totals: {
      paidAllTime: paid.reduce((s, x) => s + x.amount, 0),
      paidThisMonth: paid.filter((x) => x.paidDate && monthKey(x.paidDate) === month).reduce((s, x) => s + x.amount, 0),
      pending: open.filter((x) => x.status === "Pending").reduce((s, x) => s + x.amount, 0),
      approved: open.filter((x) => x.status === "Approved").reduce((s, x) => s + x.amount, 0),
    },
  };
}
