"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { addUpcomingPayment, markPaid, type FormState } from "@/app/actions";
import { Button, Field, Input, Select } from "../ui";
import { FormStatus } from "./form-status";
import { ScopeFields } from "./scope-fields";
import { formatINR } from "@/lib/format";
import { toast } from "../toaster";

type Opt = { value: string; label: string };

export function UpcomingForm({ today, categories, people }: { today: string; categories: Opt[]; people: Opt[] }) {
  const [person, setPerson] = useState("");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addUpcomingPayment(prev, fd);
    if (r?.ok) setPerson("");
    return r;
  }, null);
  const [direction, setDirection] = useState<"To pay" | "To receive">("To pay");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Direction">
        {(["To pay", "To receive"] as const).map((d) => (
          <label key={d} className={`flex-1 cursor-pointer rounded-md py-1.5 text-center text-sm ${direction === d ? "bg-surface-2 font-medium" : "text-ink-2"}`}>
            <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
            {d}
          </label>
        ))}
      </div>
      <Field label="What for?" className="col-span-2">
        <Input name="name" required placeholder={direction === "To pay" ? "e.g. Credit card bill, Rent, GST" : "e.g. Acme – 2nd milestone"} />
      </Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required placeholder="0" /></Field>
      <Field label="Due date"><Input type="date" name="dueDate" defaultValue={today} required /></Field>
      <Field label="Repeats"><Select name="repeat" options={["One-time", "Monthly", "Quarterly", "Yearly"]} /></Field>
      <ScopeFields />
      <Field label="Category"><Select name="category" options={categories} placeholder="—" /></Field>
      <Field label="Method"><Select name="paymentMethod" options={["UPI", "Auto-debit", "Credit Card", "Debit Card", "Cash", "Bank Transfer"]} /></Field>
      <Field label={direction === "To pay" ? "Paying (optional)" : "From (optional)"} className={person === "__new" ? "" : "col-span-2"}>
        <Select
          name="person"
          options={[...people, { value: "__new", label: "+ Add new person…" }]}
          placeholder="— No one —"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        />
      </Field>
      {person === "__new" && (
        <>
          <Field label="New person's name"><Input name="newPerson" required autoFocus placeholder="e.g. Rahul, Acme Studio" /></Field>
          <Field label="Relationship" className="col-span-2">
            <Select name="relationship" options={["Friend", "Family", "Client", "Vendor", "Other"]} defaultValue={direction === "To receive" ? "Client" : "Vendor"} />
          </Field>
        </>
      )}
      <Field label="Notes" className="col-span-2"><Input name="notes" placeholder="Optional" /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add upcoming payment"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function MarkPaidAction({ kind, id, amount, today, flow }: {
  kind: "payment" | "subscription" | "debt"; id: string; amount: number; today: string; flow: "in" | "out";
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await markPaid(prev, fd);
    if (r?.ok) {
      setOpen(false);
      toast(r.message);
    }
    return r;
  }, null);

  if (kind === "debt")
    return <Link href="/debts" className="mt-1.5 inline-block text-xs font-medium text-accent hover:underline">Record on Debts page →</Link>;

  if (!open)
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-accent hover:underline">
          {flow === "in" ? "Mark received" : "Mark paid"}
        </button>
      </div>
    );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Field label={flow === "in" ? "Amount received (₹)" : "Amount paid (₹)"} className="w-36"><Input name="amount" inputMode="decimal" defaultValue={String(amount)} required /></Field>
      <Field label={flow === "in" ? "Received on" : "Paid on"} className="w-40"><Input type="date" name="date" defaultValue={today} required /></Field>
      <Field label="Method" className="w-36"><Select name="paymentMethod" options={["UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cash"]} placeholder="Same as set" /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {kind === "payment" && (
        <p className="w-full text-xs text-muted">
          Due: {formatINR(amount)}. Enter less for a partial {flow === "in" ? "receipt" : "payment"}; the rest stays pending.
        </p>
      )}
      <div className="w-full"><FormStatus state={state} /></div>
    </form>
  );
}
