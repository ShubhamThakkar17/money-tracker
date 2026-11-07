"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, type FormState } from "@/app/actions";
import Link from "next/link";
import { Button, Field, Input, Select, inputClass } from "../ui";
import { FormStatus } from "./form-status";
import { ScopeFields } from "./scope-fields";

type Opt = { value: string; label: string };
export type SubOpt = { value: string; label: string; categoryId: string | null };
const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer"];

export function TransactionForm({ today, categories, subcategories, debts }: {
  today: string; categories: Opt[]; subcategories: SubOpt[]; debts: Opt[];
}) {
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const norm = (id: string) => id.replaceAll("-", "");
  // Subcategories grouped under their category for the picker.
  const groups = categories
    .map((c) => ({ ...c, subs: subcategories.filter((s) => s.categoryId && norm(s.categoryId) === norm(c.value)) }))
    .filter((g) => g.subs.length);
  const pickSub = (v: string) => {
    setSubcategory(v);
    const sub = subcategories.find((s) => s.value === v);
    if (sub?.categoryId) setCategory(categories.find((c) => norm(c.value) === norm(sub.categoryId!))?.value ?? "");
  };
  const pickCat = (v: string) => {
    setCategory(v);
    const sub = subcategories.find((s) => s.value === subcategory);
    if (sub && (!sub.categoryId || norm(sub.categoryId) !== norm(v))) setSubcategory("");
  };
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addTransaction(prev, fd);
    if (r?.ok) {
      setCategory("");
      setSubcategory("");
    }
    return r;
  }, null);
  const [type, setType] = useState<"Expense" | "Income">("Expense");
  const [scope, setScope] = useState("Personal");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex rounded-lg border border-line p-0.5 sm:col-span-4" role="radiogroup" aria-label="Type">
        {(["Expense", "Income"] as const).map((t) => (
          <label key={t} className={`flex-1 cursor-pointer rounded-md py-1.5 text-center text-sm ${type === t ? "bg-surface-2 font-medium" : "text-ink-2"}`}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
            {t}
          </label>
        ))}
      </div>
      <Field label="What was it?" className="col-span-2">
        <Input name="name" required placeholder={type === "Expense" ? "e.g. Figma subscription" : "e.g. Website project – Acme"} />
      </Field>
      <Field label="Amount (₹)">
        <Input name="amount" inputMode="decimal" required placeholder="0" />
      </Field>
      <Field label="Date">
        <Input type="date" name="date" defaultValue={today} required />
      </Field>
      <Field label="Subcategory">
        <select name="subcategory" value={subcategory} onChange={(e) => pickSub(e.target.value)} className={inputClass}>
          <option value="">—</option>
          {groups.map((g) => (
            <optgroup key={g.value} label={g.label}>
              {g.subs.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <Select name="category" options={categories} placeholder="—" value={category} onChange={(e) => pickCat(e.target.value)} />
      </Field>
      <ScopeFields scope={scope} onScopeChange={setScope} />
      <Field label="Payment method">
        <Select name="paymentMethod" options={PAYMENT_METHODS} defaultValue="UPI" />
      </Field>
      <Field label={type === "Expense" ? "Paid to" : "Received from"}>
        <Input name="paidToFrom" placeholder="Optional" />
      </Field>
      {scope === "Work" && type === "Expense" && (
        <Field label="GST paid (₹)">
          <Input name="gst" inputMode="decimal" placeholder="Optional" />
        </Field>
      )}
      <Field label="Settles a debt?" className={scope === "Work" && type === "Expense" ? "" : "col-span-1"}>
        <Select name="debt" options={debts} placeholder="No" />
      </Field>
      <Field label="Notes" className="col-span-2">
        <Input name="notes" placeholder="Optional" />
      </Field>
      <p className="col-span-2 -mt-1 text-xs text-muted sm:col-span-4">
        Pick a subcategory like Rapido or Zomato and the category fills in by itself. <Link href="/categories" className="text-accent hover:underline">Manage categories</Link>
      </p>
      <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : `Add ${type.toLowerCase()}`}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
