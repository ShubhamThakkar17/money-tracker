"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BILLING_CYCLES, DIRECTIONS, PAYMENT_METHODS, RELATIONSHIPS, REPEATS, SCOPES, TIME_ZONE, TX_TYPES, UPCOMING_METHODS } from "@/lib/config";
import { addMonths, cycleMonths, todayIST } from "@/lib/format";
import { findRow, insert, read, sameId, update, write, type TableKey } from "@/lib/sheets";
import { requireSession } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, expectedToken, safeEqual } from "@/lib/session";
import { computeDebts, getCategories, getPeopleList, getRawDebts, getReferralPayouts, getReferralPrograms, getSubcategories, getSubscriptions, getTransactions, getUpcomingPayments } from "@/lib/data";

export type FormState = { ok: boolean; message: string } | null;

// ---------- helpers ----------

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function oneOf<T extends readonly string[]>(fd: FormData, key: string, allowed: T): T[number] | null {
  const v = str(fd, key);
  return (allowed as readonly string[]).includes(v) ? (v as T[number]) : null;
}

function amount(fd: FormData, key: string, required = true): number | null {
  const raw = str(fd, key).replace(/[,₹\s]/g, "");
  if (!raw) {
    if (required) throw new Error("Enter an amount.");
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be a positive number.");
  return Math.round(n * 100) / 100;
}

function date(fd: FormData, key: string, required = false): string | null {
  const v = str(fd, key);
  if (!v) {
    if (required) throw new Error("Pick a date.");
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Invalid date.");
  return v;
}

function id(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return /^[0-9a-f-]{32,36}$/i.test(v) ? v : null;
}

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    await requireSession();
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, message: msg };
  }
}

// ---------- auth ----------

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const expected = await expectedToken();
  const password = String(fd.get("password") ?? "");
  if (!expected || !safeEqual(password, process.env.APP_PASSWORD ?? "")) {
    const delay = new Promise((r) => setTimeout(r, 600)); // slow down guessing
    await delay;
    return { ok: false, message: "Wrong password." };
  }
  (await cookies()).set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  const next = String(fd.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- transactions ----------

export async function addTransaction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Give the transaction a name.");
    const type = oneOf(fd, "type", TX_TYPES);
    if (!type) throw new Error("Choose Expense or Income.");
    const value = amount(fd, "amount")!;
    let category = id(fd, "category");
    const subcategory = id(fd, "subcategory");
    if (subcategory) {
      // A subcategory always files the transaction under its parent category.
      const sub = (await getSubcategories()).find((x) => sameId(x.id, subcategory));
      if (!sub) throw new Error("That subcategory no longer exists.");
      if (sub.categoryId) category = sub.categoryId;
    }
    const debt = id(fd, "debt");
    await insert("transactions", {
        Name: write.title(name),
        Date: write.date(date(fd, "date", true)),
        Amount: write.number(value),
        Type: write.select(type),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        Subcategory: write.relation(subcategory ? [subcategory] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", PAYMENT_METHODS)),
        "Paid To / From": write.text(str(fd, "paidToFrom")),
        Debt: write.relation(debt ? [debt] : []),
        "GST Paid": write.number(amount(fd, "gst", false)),
        Notes: write.text(str(fd, "notes")),
      });
    return `Added “${name}”.`;
  });
}

// ---------- debts & people ----------

async function createPerson(name: string, relationship: string | null, phone = "", upi = "") {
  const page = await insert("people", {
      Name: write.title(name),
      Relationship: write.select(relationship),
      Phone: write.phone(phone),
      "UPI ID": write.text(upi),
    });
  return page;
}

export async function addPerson(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a name.");
    await createPerson(name, oneOf(fd, "relationship", RELATIONSHIPS), str(fd, "phone"), str(fd, "upi"));
    return `Added ${name}.`;
  });
}

export async function addDebt(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const description = str(fd, "description");
    if (!description) throw new Error("Describe what the money was for.");
    const direction = oneOf(fd, "direction", DIRECTIONS);
    if (!direction) throw new Error("Choose who owes whom.");
    let personId = id(fd, "person");
    const newPerson = str(fd, "newPerson");
    if (!personId && newPerson) personId = await createPerson(newPerson, null);
    if (!personId) throw new Error("Pick a person or type a new name.");
    await insert("debts", {
        Description: write.title(description),
        Person: write.relation([personId]),
        Direction: write.select(direction),
        Amount: write.number(amount(fd, "amount")),
        Date: write.date(date(fd, "date")),
        "Due Date": write.date(date(fd, "dueDate")),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Notes: write.text(str(fd, "notes")),
      });
    return "Debt added.";
  });
}

/** Logs a repayment as a transaction linked to the debt (Income if they paid you, Expense if you paid them). */
export async function recordRepayment(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const debtId = id(fd, "debt");
    if (!debtId) throw new Error("Missing debt.");
    const value = amount(fd, "amount")!;
    if (value <= 0) throw new Error("Amount must be more than zero.");
    const [debts, categories] = await Promise.all([getRawDebts(), getCategories()]);
    const debt = debts.find((d) => d.id.replaceAll("-", "") === debtId.replaceAll("-", ""));
    if (!debt) throw new Error("Debt not found.");
    const repaymentCat = categories.find((c) => c.name.toLowerCase() === "debt repayment");
    const person = str(fd, "personName");
    await insert("transactions", {
        Name: write.title(
          debt.direction === "Owes me"
            ? `Repayment from ${person || "someone"}`
            : `Repayment to ${person || "someone"}`,
        ),
        Date: write.date(date(fd, "date", true)),
        Amount: write.number(value),
        Type: write.select(debt.direction === "Owes me" ? "Income" : "Expense"),
        Scope: write.select(debt.scope),
        Category: write.relation(repaymentCat ? [repaymentCat.id] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", PAYMENT_METHODS)),
        "Paid To / From": write.text(person),
        Debt: write.relation([debt.id]),
      });
    return `Recorded ₹${value.toLocaleString("en-IN")} repayment.`;
  });
}

// ---------- subscriptions ----------

export async function addSubscription(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a name.");
    const category = id(fd, "category");
    await insert("subscriptions", {
        Name: write.title(name),
        Amount: write.number(amount(fd, "amount")),
        "Billing Cycle": write.select(oneOf(fd, "cycle", BILLING_CYCLES)),
        "Next Renewal": write.date(date(fd, "nextRenewal")),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        "Payment Method": write.select(str(fd, "paymentMethod") || null),
        Active: write.checkbox(true),
        Notes: write.text(str(fd, "notes")),
      });
    return `Added ${name}.`;
  });
}

export async function setSubscriptionActive(subId: string, active: boolean): Promise<void> {
  await requireSession();
  await update("subscriptions", subId, { Active: write.checkbox(active) });
  revalidatePath("/", "layout");
}

/** Moves Next Renewal forward by one billing cycle. */
export async function markRenewed(subId: string, current: string | null, cycle: string | null): Promise<void> {
  await requireSession();
  const next = addMonths(current ?? todayIST(), cycleMonths(cycle) || 1);
  await update("subscriptions", subId, { "Next Renewal": write.date(next) });
  revalidatePath("/", "layout");
}

// ---------- deleting ----------

const DELETABLE = ["transactions", "debts", "subscriptions", "upcoming", "subcategories", "referralPrograms", "referralPayouts"] as const;
export type DeletableKind = (typeof DELETABLE)[number];


/**
 * Soft-deletes a row: stamps its "Deleted" cell (clear it in the sheet to restore) and
 * appends the reason to its Notes. Refuses rows outside the expected tab.
 */
export async function deleteEntry(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const kind = oneOf(fd, "kind", DELETABLE);
    const pageId = id(fd, "id");
    if (!kind || !pageId) throw new Error("Missing entry.");
    const reason = str(fd, "reason");
    if (reason.length < 3) throw new Error("Say why you're deleting this.");

    const row = await findRow(kind, pageId);
    if (!row) throw new Error("That entry doesn't belong here.");
    const notes = read.text(row, "Notes");
    const when = new Date().toLocaleString("en-IN", { timeZone: TIME_ZONE });
    const log = `[Deleted ${when}] ${reason.slice(0, 500)}`;
    await update(kind, row.id, {
      Notes: (notes ? `${notes}\n${log}` : log).slice(-2000),
      Deleted: `${when} · ${reason.slice(0, 200)}`,
    });
    return "Deleted.";
  });
}

// ---------- upcoming payments ----------

export async function addUpcomingPayment(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("What's the payment for?");
    const category = id(fd, "category");
    let person = id(fd, "person");
    const newPerson = str(fd, "newPerson");
    if (!person && str(fd, "person") === "__new") {
      if (!newPerson) throw new Error("Type the new person's name.");
      person = await createPerson(newPerson, oneOf(fd, "relationship", RELATIONSHIPS));
    }
    await insert("upcoming", {
        Name: write.title(name),
        Amount: write.number(amount(fd, "amount")),
        "Due Date": write.date(date(fd, "dueDate", true)),
        Direction: write.select(str(fd, "direction") === "To receive" ? "To receive" : "To pay"),
        Repeat: write.select(oneOf(fd, "repeat", REPEATS) ?? "One-time"),
        Status: write.select("Pending"),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        Person: write.relation(person ? [person] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", UPCOMING_METHODS)),
        Notes: write.text(str(fd, "notes")),
      });
    return `Added “${name}”.`;
  });
}

/**
 * Marks an upcoming item as paid: logs a transaction for it, then either moves the
 * due date forward one cycle (recurring) or sets Status → Paid (one-time).
 * Works for upcoming payments ("payment") and subscriptions ("subscription").
 */
export async function markPaid(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const kind = str(fd, "kind");
    const itemId = id(fd, "id");
    if (!itemId) throw new Error("Missing item.");
    const value = amount(fd, "amount")!;
    const paidOn = date(fd, "date") ?? todayIST();
    const method = str(fd, "paymentMethod");

    if (kind === "subscription") {
      const sub = (await getSubscriptions()).find((s) => sameId(s.id, itemId));
      if (!sub) throw new Error("Subscription not found.");
      const cat = sub.categoryIds;
      await insert("transactions", {
          Name: write.title(sub.name),
          Date: write.date(paidOn),
          Amount: write.number(value),
          Type: write.select("Expense"),
          Scope: write.select(sub.scope),
          Category: write.relation(cat),
          "Payment Method": write.select((PAYMENT_METHODS as readonly string[]).includes(method) ? method : sub.paymentMethod),
        });
      const months = cycleMonths(sub.cycle) || 1;
      await update("subscriptions", sub.id, { "Next Renewal": write.date(addMonths(sub.nextRenewal ?? paidOn, months)) });
      return `Logged ${sub.name} and moved the renewal forward.`;
    }

    const p = (await getUpcomingPayments()).find((x) => sameId(x.id, itemId));
    if (!p) throw new Error("Payment not found.");
    const people = await getPeopleList();
    const who = p.personIds.map((pid) => people.find((x) => sameId(x.id, pid))?.name).filter(Boolean).join(", ");
    const txMethod = (PAYMENT_METHODS as readonly string[]).includes(method)
      ? method
      : p.paymentMethod === "Auto-debit" ? "Bank Transfer" : p.paymentMethod;
    if (value <= 0) throw new Error("Amount must be more than zero.");
    const remaining = Math.max(0, p.amount - p.paidSoFar);
    const isPartial = value < remaining - 0.5;
    const receiving = p.direction === "To receive";
    await insert("transactions", {
        Name: write.title(isPartial ? `${p.name} (part ${receiving ? "received" : "payment"})` : p.name),
        Date: write.date(paidOn),
        Amount: write.number(value),
        Type: write.select(receiving ? "Income" : "Expense"),
        Scope: write.select(p.scope),
        Category: write.relation(p.categoryIds.slice(0, 1)),
        "Payment Method": write.select(txMethod),
        "Paid To / From": write.text(who),
        "Upcoming Payment": write.relation([p.id]),
      });
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

    if (isPartial) {
      // Partial: keep it pending and track what's been paid so far.
      await update("upcoming", p.id, { "Paid So Far": write.number(p.paidSoFar + value) });
      return `Logged ${fmt(value)} ${receiving ? "received" : "paid"}. ${fmt(remaining - value)} still ${receiving ? "to receive" : "to pay"}.`;
    }

    const months = cycleMonths(p.repeat);
    await update("upcoming", p.id, months
        ? { "Due Date": write.date(addMonths(p.dueDate ?? paidOn, months)), "Paid So Far": write.number(0) }
        : { Status: write.select("Paid"), "Paid So Far": write.number(p.amount) });
    return months
      ? `“${p.name}” fully ${receiving ? "received" : "paid"}. Next one is due ${addMonths(p.dueDate ?? paidOn, months)}.`
      : `“${p.name}” fully ${receiving ? "received" : "paid"}.`;
  });
}

// ---------- categories & subcategories ----------

export async function addCategory(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a category name.");
    const existing = await getCategories();
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new Error(`“${name}” already exists.`);
    const icon = str(fd, "icon");
    await insert("categories", {
      Category: name,
      Icon: icon ? [...icon][0] : null,
      Scope: ["Personal", "Infinity Linkage", "Both"].includes(str(fd, "scope")) ? str(fd, "scope") : "Both",
      Transfer: false,
    });
    return `Added category “${name}”.`;
  });
}

export async function addSubcategory(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a name, e.g. Rapido.");
    const categoryId = id(fd, "category");
    if (!categoryId) throw new Error("Pick the category it belongs to.");
    const subs = await getSubcategories();
    if (subs.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.categoryId && sameId(x.categoryId, categoryId))) {
      throw new Error(`“${name}” is already in that category.`);
    }
    await insert("subcategories", { Name: write.title(name), Category: write.relation([categoryId]) });
    return `Added “${name}”.`;
  });
}

// ---------- editing ----------

/** Refuses to edit a row that isn't in the expected tab. */
async function assertIn(table: TableKey, rowId: string) {
  if (!(await findRow(table, rowId))) throw new Error("That entry doesn't belong here.");
}

export async function updateTransaction(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing entry.");
    await assertIn("transactions", pageId);
    const name = str(fd, "name");
    if (!name) throw new Error("Give the transaction a name.");
    const type = oneOf(fd, "type", TX_TYPES);
    if (!type) throw new Error("Choose Expense or Income.");
    let category = id(fd, "category");
    const subcategory = id(fd, "subcategory");
    if (subcategory) {
      const sub = (await getSubcategories()).find((x) => sameId(x.id, subcategory));
      if (sub?.categoryId) category = sub.categoryId;
    }
    await update("transactions", pageId, {
        Name: write.title(name),
        Date: write.date(date(fd, "date", true)),
        Amount: write.number(amount(fd, "amount")),
        Type: write.select(type),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        Subcategory: write.relation(subcategory ? [subcategory] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", PAYMENT_METHODS)),
        "Paid To / From": write.text(str(fd, "paidToFrom")),
        "GST Paid": write.number(amount(fd, "gst", false)),
        Notes: write.text(str(fd, "notes")),
      });
    return `Saved “${name}”.`;
  });
}

export async function updateDebt(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing entry.");
    await assertIn("debts", pageId);
    const description = str(fd, "description");
    if (!description) throw new Error("Describe what the money was for.");
    const direction = oneOf(fd, "direction", DIRECTIONS);
    if (!direction) throw new Error("Choose who owes whom.");
    const person = id(fd, "person");
    if (!person) throw new Error("Pick a person.");
    await update("debts", pageId, {
        Description: write.title(description),
        Person: write.relation([person]),
        Direction: write.select(direction),
        Amount: write.number(amount(fd, "amount")),
        Date: write.date(date(fd, "date")),
        "Due Date": write.date(date(fd, "dueDate")),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Notes: write.text(str(fd, "notes")),
      });
    return "Debt saved.";
  });
}

export async function updateUpcomingPayment(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing entry.");
    await assertIn("upcoming", pageId);
    const name = str(fd, "name");
    if (!name) throw new Error("What's the payment for?");
    const category = id(fd, "category");
    const person = id(fd, "person");
    await update("upcoming", pageId, {
        Name: write.title(name),
        Amount: write.number(amount(fd, "amount")),
        "Due Date": write.date(date(fd, "dueDate", true)),
        Direction: write.select(str(fd, "direction") === "To receive" ? "To receive" : "To pay"),
        Repeat: write.select(oneOf(fd, "repeat", REPEATS) ?? "One-time"),
        Status: write.select(str(fd, "status") === "Paid" ? "Paid" : "Pending"),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        Person: write.relation(person ? [person] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", UPCOMING_METHODS)),
        "Paid So Far": write.number(amount(fd, "paidSoFar", false) ?? 0),
        Notes: write.text(str(fd, "notes")),
      });
    return `Saved “${name}”.`;
  });
}

export async function updateSubscription(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing entry.");
    await assertIn("subscriptions", pageId);
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a name.");
    const category = id(fd, "category");
    await update("subscriptions", pageId, {
        Name: write.title(name),
        Amount: write.number(amount(fd, "amount")),
        "Billing Cycle": write.select(oneOf(fd, "cycle", BILLING_CYCLES)),
        "Next Renewal": write.date(date(fd, "nextRenewal")),
        Scope: write.select(oneOf(fd, "scope", SCOPES)),
        Category: write.relation(category ? [category] : []),
        "Payment Method": write.select(str(fd, "paymentMethod") || null),
        Active: write.checkbox(str(fd, "active") === "on"),
        Notes: write.text(str(fd, "notes")),
      });
    return `Saved ${name}.`;
  });
}

export async function updatePerson(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing person.");
    await assertIn("people", pageId);
    const name = str(fd, "name");
    if (!name) throw new Error("Enter a name.");
    await update("people", pageId, {
        Name: write.title(name),
        Relationship: write.select(oneOf(fd, "relationship", RELATIONSHIPS)),
        Phone: write.phone(str(fd, "phone")),
        "UPI ID": write.text(str(fd, "upi")),
      });
    return `Saved ${name}.`;
  });
}

/**
 * One payment to/from a person that settles their open debts oldest-first.
 * Creates one linked transaction per debt it touches, so each debt keeps an exact log.
 */
export async function recordPersonPayment(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const personId = id(fd, "person");
    const direction = oneOf(fd, "direction", DIRECTIONS);
    if (!personId || !direction) throw new Error("Missing person.");
    let left = amount(fd, "amount")!;
    if (left <= 0) throw new Error("Amount must be more than zero.");
    const paidOn = date(fd, "date", true)!;
    const method = oneOf(fd, "paymentMethod", PAYMENT_METHODS);
    const personName = str(fd, "personName");

    const [raw, people, transactions, categories] = await Promise.all([getRawDebts(), getPeopleList(), getTransactions(), getCategories()]);
    const { debts } = computeDebts(raw, people, transactions, todayIST());
    const open = debts
      .filter((d) => d.direction === direction && d.remaining > 0 && d.personIds.some((p) => sameId(p, personId)))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const owed = open.reduce((s, d) => s + d.remaining, 0);
    if (!open.length) throw new Error("Nothing open with this person.");
    if (left > owed + 0.5) throw new Error(`That's more than the ₹${Math.round(owed).toLocaleString("en-IN")} still open.`);

    const repaymentCat = categories.find((c) => c.name.toLowerCase() === "debt repayment");
    const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
    const touched: string[] = [];
    for (const d of open) {
      if (left <= 0.5) break;
      const part = Math.min(d.remaining, left);
      await insert("transactions", {
          Name: write.title(direction === "Owes me" ? `Repayment from ${personName}` : `Repayment to ${personName}`),
          Date: write.date(paidOn),
          Amount: write.number(Math.round(part * 100) / 100),
          Type: write.select(direction === "Owes me" ? "Income" : "Expense"),
          Scope: write.select(d.scope),
          Category: write.relation(repaymentCat ? [repaymentCat.id] : []),
          "Payment Method": write.select(method),
          "Paid To / From": write.text(personName),
          Debt: write.relation([d.id]),
          Notes: write.text(`Part of a ${fmt(amount(fd, "amount")!)} payment`),
        });
      touched.push(`${d.description} ${fmt(part)}`);
      left -= part;
    }
    const rest = owed - amount(fd, "amount")!;
    return `Recorded ${fmt(amount(fd, "amount")!)} → ${touched.join(", ")}. ${rest > 0.5 ? `${fmt(rest)} still open.` : "All settled with " + personName + "."}`;
  });
}

// ---------- referrals ----------

const PAYOUT_STATUSES = ["Pending", "Approved", "Paid"] as const;

export async function addReferralProgram(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const company = str(fd, "company");
    if (!company) throw new Error("Enter the company name.");
    const platform = (str(fd, "platform") === "__new" ? str(fd, "newPlatform") : str(fd, "platform")) || "Direct";
    const existing = await getReferralPrograms();
    if (existing.some((p) => p.company.toLowerCase() === company.toLowerCase() && p.platform.toLowerCase() === platform.toLowerCase())) {
      throw new Error(`${company} on ${platform} already exists.`);
    }
    const link = str(fd, "link");
    await insert("referralPrograms", {
        Company: write.title(company),
        Platform: write.select(platform.slice(0, 100)),
        Link: /^https?:\/\//.test(link) ? link : null,
        Commission: write.text(str(fd, "commission")),
        Active: write.checkbox(true),
      });
    return `Added ${company} (${platform}).`;
  });
}

export async function addReferralPayout(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const programId = id(fd, "program");
    if (!programId) throw new Error("Pick the program (company).");
    const program = (await getReferralPrograms()).find((p) => sameId(p.id, programId));
    if (!program) throw new Error("Program not found.");
    const status = oneOf(fd, "status", PAYOUT_STATUSES) ?? "Pending";
    if (status === "Paid") throw new Error("Add it as Pending or Approved, then use “Mark paid” so it's logged as income.");
    const name = str(fd, "name") || `${program.company} commission`;
    await insert("referralPayouts", {
        Name: write.title(name),
        Program: write.relation([program.id]),
        Amount: write.number(amount(fd, "amount")),
        "Original Amount": write.text(str(fd, "originalAmount")),
        Status: write.select(status),
        "Earned Date": write.date(date(fd, "earnedDate")),
        "Expected Payout": write.date(date(fd, "expectedPayout")),
        Notes: write.text(str(fd, "notes")),
      });
    return `Added ${name}.`;
  });
}

export async function setPayoutStatus(payoutId: string, status: "Pending" | "Approved"): Promise<void> {
  await requireSession();
  await update("referralPayouts", payoutId, { Status: write.select(status) });
  revalidatePath("/", "layout");
}

/** Marks a payout paid and logs the money as an Income transaction (Side Income). */
export async function markReferralPaid(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const payoutId = id(fd, "id");
    if (!payoutId) throw new Error("Missing payout.");
    const [payouts, programs, categories, subs] = await Promise.all([getReferralPayouts(), getReferralPrograms(), getCategories(), getSubcategories()]);
    const payout = payouts.find((x) => sameId(x.id, payoutId));
    if (!payout) throw new Error("Payout not found.");
    if (payout.status === "Paid") throw new Error("Already marked paid.");
    const program = payout.programId ? programs.find((p) => sameId(p.id, payout.programId!)) : undefined;
    const value = amount(fd, "amount")!;
    if (value <= 0) throw new Error("Amount must be more than zero.");
    const paidOn = date(fd, "date", true)!;
    const sideIncome = categories.find((c) => /side income|referral|affiliate/i.test(c.name));
    const sub = program ? subs.find((x) => x.name.toLowerCase() === program.platform.toLowerCase()) : undefined;

    const tx = await insert("transactions", {
        Name: write.title(`Referral · ${program?.company ?? payout.name}${program ? ` (${program.platform})` : ""}`),
        Date: write.date(paidOn),
        Amount: write.number(value),
        Type: write.select("Income"),
        Scope: write.select("Personal"),
        Category: write.relation(sub?.categoryId ? [sub.categoryId] : sideIncome ? [sideIncome.id] : []),
        Subcategory: write.relation(sub ? [sub.id] : []),
        "Payment Method": write.select(oneOf(fd, "paymentMethod", PAYMENT_METHODS) ?? "Bank Transfer"),
        "Paid To / From": write.text(program?.platform ?? ""),
        Notes: write.text(payout.originalAmount ? `Original: ${payout.originalAmount}` : ""),
      });
    await update("referralPayouts", payout.id, {
        Status: write.select("Paid"),
        "Paid Date": write.date(paidOn),
        Amount: write.number(value),
        Transaction: write.relation([tx]),
      });
    return `Logged ₹${value.toLocaleString("en-IN")} from ${program?.company ?? payout.name} as income.`;
  });
}

export async function updateReferralPayout(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const pageId = id(fd, "id");
    if (!pageId) throw new Error("Missing payout.");
    await assertIn("referralPayouts", pageId);
    const programId = id(fd, "program");
    await update("referralPayouts", pageId, {
        Name: write.title(str(fd, "name") || "Commission"),
        Program: write.relation(programId ? [programId] : []),
        Amount: write.number(amount(fd, "amount")),
        "Original Amount": write.text(str(fd, "originalAmount")),
        Status: write.select(oneOf(fd, "status", PAYOUT_STATUSES) ?? "Pending"),
        "Earned Date": write.date(date(fd, "earnedDate")),
        "Expected Payout": write.date(date(fd, "expectedPayout")),
        Notes: write.text(str(fd, "notes")),
      });
    return "Payout saved.";
  });
}
