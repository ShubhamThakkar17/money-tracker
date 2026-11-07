"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import {
  updateDebt,
  updatePerson,
  updateSubscription,
  updateTransaction,
  updateUpcomingPayment,
  type FormState,
} from "@/app/actions";
import { Button, Field, Input, Select, inputClass } from "../ui";
import { FormStatus } from "./form-status";
import { toast } from "../toaster";

type Opt = { value: string; label: string };
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const norm = (id: string) => id.replaceAll("-", "");
/** Match a stored relation id to the option list (ids may differ only in dashes). */
const pick = (opts: Opt[], id: string | null | undefined) =>
  id ? (opts.find((o) => norm(o.value) === norm(id))?.value ?? "") : "";

/** Pencil button that opens a dialog with a pre-filled edit form. */
export function EditDialog({ id, label, title, action, children, wide }: {
  id: string; label: string; title: string; action: Action; children: ReactNode; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0); // remount the form on open so it shows current values
  const [state, run, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok) {
      dialog.current?.close();
      toast(r.message);
    }
    return r;
  }, null);

  return (
    <>
      <button
        type="button"
        onClick={() => { setKey((k) => k + 1); dialog.current?.showModal(); }}
        className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={`Edit ${label}`}
        title="Edit"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40`}
      >
        <form key={key} action={run} className="flex max-h-[85vh] flex-col gap-3 overflow-y-auto p-5 text-left">
          <input type="hidden" name="id" value={id} />
          <h2 className="text-base font-semibold">{title}</h2>
          {/* Fields mount on first open: long lists (400+ rows) would otherwise ship one full form per row. */}
          {key > 0 && <div className="grid grid-cols-2 gap-3">{children}</div>}
          <FormStatus state={state?.ok ? null : state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

const SCOPES = ["Personal", "Infinity Linkage"];

// ---------- Transaction ----------

export type EditableTransaction = {
  id: string; name: string; date: string | null; amount: number; type: "Expense" | "Income" | null;
  scope: string | null; categoryIds: string[]; subcategoryIds: string[]; paymentMethod: string | null;
  paidToFrom: string; gst: number | null; notes: string;
};

export function EditTransaction({ t, categories, subcategories }: {
  t: EditableTransaction; categories: Opt[]; subcategories: (Opt & { categoryId: string | null })[];
}) {
  return (
    <EditDialog id={t.id} label={t.name} title="Edit transaction" action={updateTransaction} wide>
      <TransactionFields t={t} categories={categories} subcategories={subcategories} />
    </EditDialog>
  );
}

function TransactionFields({ t, categories, subcategories }: {
  t: EditableTransaction; categories: Opt[]; subcategories: (Opt & { categoryId: string | null })[];
}) {
  const [category, setCategory] = useState(pick(categories, t.categoryIds[0]));
  const [subcategory, setSubcategory] = useState(pick(subcategories, t.subcategoryIds[0]));
  const groups = categories
    .map((c) => ({ ...c, subs: subcategories.filter((s) => s.categoryId && norm(s.categoryId) === norm(c.value)) }))
    .filter((g) => g.subs.length);
  return (
    <>
      <Field label="Name" className="col-span-2"><Input name="name" defaultValue={t.name} required /></Field>
      <Field label="Type"><Select name="type" options={["Expense", "Income"]} defaultValue={t.type ?? "Expense"} /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" defaultValue={String(t.amount)} required /></Field>
      <Field label="Date"><Input type="date" name="date" defaultValue={t.date ?? ""} required /></Field>
      <Field label="Scope"><Select name="scope" options={SCOPES} defaultValue={t.scope ?? "Personal"} /></Field>
      <Field label="Subcategory">
        <select
          name="subcategory"
          value={subcategory}
          onChange={(e) => {
            setSubcategory(e.target.value);
            const sub = subcategories.find((s) => s.value === e.target.value);
            if (sub?.categoryId) setCategory(pick(categories, sub.categoryId));
          }}
          className={inputClass}
        >
          <option value="">—</option>
          {groups.map((g) => (
            <optgroup key={g.value} label={g.label}>
              {g.subs.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <Select
          name="category"
          options={categories}
          placeholder="—"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            const sub = subcategories.find((s) => s.value === subcategory);
            if (sub && (!sub.categoryId || norm(sub.categoryId) !== norm(e.target.value))) setSubcategory("");
          }}
        />
      </Field>
      <Field label="Payment method"><Select name="paymentMethod" options={["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer"]} placeholder="—" defaultValue={t.paymentMethod ?? ""} /></Field>
      <Field label="Paid to / from"><Input name="paidToFrom" defaultValue={t.paidToFrom} /></Field>
      <Field label="GST paid (₹)"><Input name="gst" inputMode="decimal" defaultValue={t.gst != null ? String(t.gst) : ""} placeholder="Optional" /></Field>
      <Field label="Notes" className="col-span-2"><Input name="notes" defaultValue={t.notes} /></Field>
    </>
  );
}

// ---------- Debt ----------

export type EditableDebt = {
  id: string; description: string; personIds: string[]; direction: "I owe" | "Owes me" | null; amount: number;
  date: string | null; dueDate: string | null; scope: string | null; notes: string;
};

export function EditDebt({ d, people }: { d: EditableDebt; people: Opt[] }) {
  return (
    <EditDialog id={d.id} label={d.description} title="Edit debt" action={updateDebt}>
      <Field label="Direction" className="col-span-2">
        <Select name="direction" options={[{ value: "Owes me", label: "They owe me (I lent money)" }, { value: "I owe", label: "I owe them (I borrowed)" }]} defaultValue={d.direction ?? "Owes me"} />
      </Field>
      <Field label="Person"><Select name="person" options={people} defaultValue={pick(people, d.personIds[0])} required /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" defaultValue={String(d.amount)} required /></Field>
      <Field label="What for?" className="col-span-2"><Input name="description" defaultValue={d.description} required /></Field>
      <Field label="Date"><Input type="date" name="date" defaultValue={d.date ?? ""} /></Field>
      <Field label="Due date"><Input type="date" name="dueDate" defaultValue={d.dueDate ?? ""} /></Field>
      <Field label="Scope"><Select name="scope" options={SCOPES} defaultValue={d.scope ?? "Personal"} /></Field>
      <Field label="Notes"><Input name="notes" defaultValue={d.notes} /></Field>
      <p className="col-span-2 text-xs text-muted">Repayments are separate transactions. Edit or delete them on the Transactions page.</p>
    </EditDialog>
  );
}

// ---------- Upcoming payment ----------

export type EditableUpcoming = {
  id: string; name: string; amount: number; dueDate: string | null; direction: "To pay" | "To receive";
  repeat: string | null; status: string | null; scope: string | null; categoryIds: string[]; personIds: string[];
  paymentMethod: string | null; notes: string; paidSoFar: number;
};

export function EditUpcoming({ p, categories, people }: { p: EditableUpcoming; categories: Opt[]; people: Opt[] }) {
  return (
    <EditDialog id={p.id} label={p.name} title="Edit upcoming payment" action={updateUpcomingPayment}>
      <Field label="Direction"><Select name="direction" options={["To pay", "To receive"]} defaultValue={p.direction} /></Field>
      <Field label="Status"><Select name="status" options={["Pending", "Paid"]} defaultValue={p.status ?? "Pending"} /></Field>
      <Field label="What for?" className="col-span-2"><Input name="name" defaultValue={p.name} required /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" defaultValue={String(p.amount)} required /></Field>
      <Field label="Due date"><Input type="date" name="dueDate" defaultValue={p.dueDate ?? ""} required /></Field>
      <Field label={p.direction === "To receive" ? "Received so far (₹)" : "Paid so far (₹)"}><Input name="paidSoFar" inputMode="decimal" defaultValue={p.paidSoFar ? String(p.paidSoFar) : ""} placeholder="0" /></Field>
      <Field label="Repeats"><Select name="repeat" options={["One-time", "Monthly", "Quarterly", "Yearly"]} defaultValue={p.repeat ?? "One-time"} /></Field>
      <Field label="Scope"><Select name="scope" options={SCOPES} defaultValue={p.scope ?? "Personal"} /></Field>
      <Field label="Category"><Select name="category" options={categories} placeholder="—" defaultValue={pick(categories, p.categoryIds[0])} /></Field>
      <Field label="Method"><Select name="paymentMethod" options={["UPI", "Auto-debit", "Credit Card", "Debit Card", "Cash", "Bank Transfer"]} placeholder="—" defaultValue={p.paymentMethod ?? ""} /></Field>
      <Field label="Person" className="col-span-2"><Select name="person" options={people} placeholder="— No one —" defaultValue={pick(people, p.personIds[0])} /></Field>
      <Field label="Notes" className="col-span-2"><Input name="notes" defaultValue={p.notes} /></Field>
    </EditDialog>
  );
}

// ---------- Subscription ----------

export type EditableSubscription = {
  id: string; name: string; amount: number; cycle: string | null; nextRenewal: string | null; scope: string | null;
  paymentMethod: string | null; active: boolean; categoryIds: string[]; notes: string;
};

export function EditSubscription({ s, categories }: { s: EditableSubscription; categories: Opt[] }) {
  return (
    <EditDialog id={s.id} label={s.name} title="Edit subscription" action={updateSubscription}>
      <Field label="Name" className="col-span-2"><Input name="name" defaultValue={s.name} required /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" defaultValue={String(s.amount)} required /></Field>
      <Field label="Billing cycle"><Select name="cycle" options={["Monthly", "Quarterly", "Yearly"]} defaultValue={s.cycle ?? "Monthly"} /></Field>
      <Field label="Next renewal"><Input type="date" name="nextRenewal" defaultValue={s.nextRenewal ?? ""} /></Field>
      <Field label="Scope"><Select name="scope" options={SCOPES} defaultValue={s.scope ?? "Personal"} /></Field>
      <Field label="Category"><Select name="category" options={categories} placeholder="—" defaultValue={pick(categories, s.categoryIds[0])} /></Field>
      <Field label="Payment method"><Select name="paymentMethod" options={["Credit Card", "UPI", "Debit Card", "Bank Transfer"]} placeholder="—" defaultValue={s.paymentMethod ?? ""} /></Field>
      <Field label="Notes" className="col-span-2"><Input name="notes" defaultValue={s.notes} /></Field>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s.active} className="h-4 w-4 accent-[var(--accent)]" /> Active
      </label>
    </EditDialog>
  );
}

// ---------- Person ----------

export type EditablePerson = { id: string; name: string; relationship: string | null; phone: string; upi: string };

export function EditPerson({ p }: { p: EditablePerson }) {
  return (
    <EditDialog id={p.id} label={p.name} title="Edit person" action={updatePerson}>
      <Field label="Name"><Input name="name" defaultValue={p.name} required /></Field>
      <Field label="Relationship"><Select name="relationship" options={["Friend", "Family", "Client", "Vendor", "Other"]} defaultValue={p.relationship ?? "Other"} /></Field>
      <Field label="Phone"><Input name="phone" type="tel" defaultValue={p.phone} /></Field>
      <Field label="UPI ID"><Input name="upi" defaultValue={p.upi} /></Field>
      <p className="col-span-2 text-xs text-muted">Renaming someone doesn&apos;t change the “Paid to / from” text on older transactions.</p>
    </EditDialog>
  );
}
