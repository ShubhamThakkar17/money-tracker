"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addDebt, addPerson, recordPersonPayment, recordRepayment, type FormState } from "@/app/actions";
import { Button, Field, Input, Select } from "../ui";
import { FormStatus } from "./form-status";
import { toast } from "../toaster";

type Opt = { value: string; label: string };

function useResetOnSuccess(state: { ok: boolean } | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function DebtForm({ today, people }: { today: string; people: Opt[] }) {
  const [state, action, pending] = useActionState(addDebt, null);
  const ref = useResetOnSuccess(state);
  const [person, setPerson] = useState("");
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Direction" className="col-span-2">
        <Select name="direction" options={[{ value: "Owes me", label: "They owe me (I lent money)" }, { value: "I owe", label: "I owe them (I borrowed)" }]} />
      </Field>
      <Field label="Person">
        <Select name="person" options={people} placeholder="+ New person" value={person} onChange={(e) => setPerson(e.target.value)} />
      </Field>
      {person === "" ? (
        <Field label="New person's name">
          <Input name="newPerson" placeholder="e.g. Rahul" />
        </Field>
      ) : (
        <div />
      )}
      <Field label="What for?" className="col-span-2">
        <Input name="description" required placeholder="e.g. Goa trip share" />
      </Field>
      <Field label="Amount (₹)">
        <Input name="amount" inputMode="decimal" required placeholder="0" />
      </Field>
      <Field label="Scope">
        <Select name="scope" options={["Personal", "Infinity Linkage"]} />
      </Field>
      <Field label="Date">
        <Input type="date" name="date" defaultValue={today} />
      </Field>
      <Field label="Due date">
        <Input type="date" name="dueDate" />
      </Field>
      <Field label="Notes" className="col-span-2">
        <Input name="notes" placeholder="Optional" />
      </Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add debt"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PersonForm() {
  const [state, action, pending] = useActionState(addPerson, null);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Name"><Input name="name" required /></Field>
      <Field label="Relationship"><Select name="relationship" options={["Friend", "Family", "Client", "Vendor", "Other"]} /></Field>
      <Field label="Phone"><Input name="phone" type="tel" placeholder="Optional" /></Field>
      <Field label="UPI ID"><Input name="upi" placeholder="Optional" /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Saving…" : "Add person"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function RepaymentForm({ debtId, personName, remaining, today, direction }: {
  debtId: string; personName: string; remaining: number; today: string; direction: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await recordRepayment(prev, fd);
    if (result?.ok) {
      setOpen(false);
      toast(result.message);
    }
    return result;
  }, null);
  if (!open)
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-accent hover:underline">
          {direction === "Owes me" ? "Record payment received" : "Record payment made"}
        </button>
      </div>
    );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="debt" value={debtId} />
      <input type="hidden" name="personName" value={personName} />
      <Field label="Amount (₹)" className="w-28"><Input name="amount" inputMode="decimal" defaultValue={String(remaining)} required /></Field>
      <Field label="Date" className="w-40"><Input type="date" name="date" defaultValue={today} required /></Field>
      <Field label="Method" className="w-36"><Select name="paymentMethod" options={["UPI", "Cash", "Bank Transfer", "Debit Card", "Credit Card"]} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <div className="w-full"><FormStatus state={state} /></div>
    </form>
  );
}

/** One payment for a person that settles their open debts oldest-first. */
export function PersonPaymentForm({ personId, personName, direction, total, today }: {
  personId: string; personName: string; direction: "I owe" | "Owes me"; total: number; today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await recordPersonPayment(prev, fd);
    if (r?.ok) {
      setOpen(false);
      toast(r.message);
    }
    return r;
  }, null);
  const label = direction === "Owes me" ? `Record payment from ${personName}` : `Record payment to ${personName}`;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-accent hover:underline">
        {label}
      </button>
    );
  return (
    <form action={action} className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-3">
      <input type="hidden" name="person" value={personId} />
      <input type="hidden" name="personName" value={personName} />
      <input type="hidden" name="direction" value={direction} />
      <Field label="Amount (₹)" className="w-32"><Input name="amount" inputMode="decimal" defaultValue={String(total)} required autoFocus /></Field>
      <Field label="Date" className="w-40"><Input type="date" name="date" defaultValue={today} required /></Field>
      <Field label="Method" className="w-36"><Select name="paymentMethod" options={["UPI", "Cash", "Bank Transfer", "Debit Card", "Credit Card"]} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <p className="w-full text-xs text-muted">Applied to the oldest debt first, then the next. Each debt gets its own log entry.</p>
      <div className="w-full"><FormStatus state={state} /></div>
    </form>
  );
}
