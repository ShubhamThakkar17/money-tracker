"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { addSubscription, markRenewed, setSubscriptionActive } from "@/app/actions";
import { Button, Field, Input, Select } from "../ui";
import { FormStatus } from "./form-status";

type Opt = { value: string; label: string };

export function SubscriptionForm({ categories }: { categories: Opt[] }) {
  const [state, action, pending] = useActionState(addSubscription, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Name" className="col-span-2"><Input name="name" required placeholder="e.g. Figma Professional" /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required /></Field>
      <Field label="Billing cycle"><Select name="cycle" options={["Monthly", "Quarterly", "Yearly"]} /></Field>
      <Field label="Next renewal"><Input type="date" name="nextRenewal" /></Field>
      <Field label="Scope"><Select name="scope" options={["Infinity Linkage", "Personal"]} /></Field>
      <Field label="Category"><Select name="category" options={categories} placeholder="—" /></Field>
      <Field label="Payment method"><Select name="paymentMethod" options={["Credit Card", "UPI", "Debit Card", "Bank Transfer"]} /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add subscription"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function SubscriptionActions({ id, active, nextRenewal, cycle }: { id: string; active: boolean; nextRenewal: string | null; cycle: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-3 text-xs">
      {active && (
        <button disabled={pending} onClick={() => start(() => markRenewed(id, nextRenewal, cycle))} className="font-medium text-accent hover:underline disabled:opacity-60">
          Mark renewed
        </button>
      )}
      <button disabled={pending} onClick={() => start(() => setSubscriptionActive(id, !active))} className="text-ink-2 hover:underline disabled:opacity-60">
        {active ? "Cancel" : "Reactivate"}
      </button>
    </div>
  );
}
