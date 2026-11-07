"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addReferralPayout, addReferralProgram, markReferralPaid, setPayoutStatus, updateReferralPayout, type FormState } from "@/app/actions";
import { Button, Field, Input, Select, inputClass } from "../ui";
import { FormStatus } from "./form-status";
import { toast } from "../toaster";
import { EditDialog } from "./edit-forms";

type Program = { value: string; label: string; platform: string };

function ProgramSelect({ programs, name = "program", defaultValue }: { programs: Program[]; name?: string; defaultValue?: string }) {
  const platforms = [...new Set(programs.map((p) => p.platform))];
  return (
    <select name={name} required defaultValue={defaultValue ?? ""} className={inputClass}>
      <option value="" disabled>Pick a company</option>
      {platforms.map((pl) => (
        <optgroup key={pl} label={pl}>
          {programs.filter((p) => p.platform === pl).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function ProgramForm({ platforms }: { platforms: string[] }) {
  const [platform, setPlatform] = useState(platforms[0] ?? "__new");
  const [state, action, pending] = useActionState(addReferralProgram, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Platform">
        <Select name="platform" options={[...platforms, { value: "__new", label: "+ New platform…" }]} value={platform} onChange={(e) => setPlatform(e.target.value)} />
      </Field>
      {platform === "__new" ? (
        <Field label="Platform name"><Input name="newPlatform" required placeholder="e.g. PartnerStack" /></Field>
      ) : <div />}
      <Field label="Company" className="col-span-2"><Input name="company" required placeholder="e.g. Framer, Cal.com" /></Field>
      <Field label="Commission"><Input name="commission" placeholder="e.g. 30% for 12 mo" /></Field>
      <Field label="Referral link"><Input name="link" type="url" placeholder="https://…" /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Saving…" : "Add company"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PayoutForm({ programs, today }: { programs: Program[]; today: string }) {
  const [state, action, pending] = useActionState(addReferralPayout, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  if (!programs.length) return <p className="text-sm text-muted">Add a company first (below).</p>;
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-3">
      <Field label="Company" className="col-span-2"><ProgramSelect programs={programs} /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required placeholder="0" /></Field>
      <Field label="Original amount"><Input name="originalAmount" placeholder="e.g. $25 (optional)" /></Field>
      <Field label="Status"><Select name="status" options={["Pending", "Approved"]} /></Field>
      <Field label="Earned on"><Input type="date" name="earnedDate" defaultValue={today} /></Field>
      <Field label="Expected payout" className="col-span-2"><Input type="date" name="expectedPayout" /></Field>
      <Field label="Note" className="col-span-2"><Input name="notes" placeholder="e.g. 3 signups in Sept" /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add payout"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PayoutActions({ id, amount, status, today }: { id: string; amount: number; status: "Pending" | "Approved"; today: string }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await markReferralPaid(prev, fd);
    if (r?.ok) { setOpen(false); toast(r.message); }
    return r;
  }, null);
  if (!open)
    return (
      <div className="flex items-center gap-3 text-xs">
        <button onClick={() => setOpen(true)} className="font-semibold text-accent hover:underline">Mark paid</button>
        <button
          disabled={busy}
          onClick={() => start(async () => { await setPayoutStatus(id, status === "Pending" ? "Approved" : "Pending"); toast(status === "Pending" ? "Marked approved." : "Moved back to pending."); })}
          className="text-ink-2 hover:underline disabled:opacity-60"
        >
          {status === "Pending" ? "Mark approved" : "Back to pending"}
        </button>
      </div>
    );
  return (
    <form action={action} className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Received (₹)" className="w-32"><Input name="amount" inputMode="decimal" defaultValue={String(amount)} required autoFocus /></Field>
      <Field label="Date" className="w-40"><Input type="date" name="date" defaultValue={today} required /></Field>
      <Field label="Into" className="w-36"><Select name="paymentMethod" options={["Bank Transfer", "UPI", "Cash"]} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <p className="w-full text-xs text-muted">Use the amount that actually landed (after fees / conversion). It&apos;s logged as Side Income.</p>
      <div className="w-full"><FormStatus state={state} /></div>
    </form>
  );
}

export type EditablePayout = {
  id: string; name: string; programId: string | null; amount: number; originalAmount: string;
  status: "Pending" | "Approved" | "Paid"; earnedDate: string | null; expectedPayout: string | null; notes: string;
};

export function EditPayout({ x, programs }: { x: EditablePayout; programs: Program[] }) {
  const norm = (s: string) => s.replaceAll("-", "");
  const current = x.programId ? programs.find((p) => norm(p.value) === norm(x.programId!))?.value : undefined;
  return (
    <EditDialog id={x.id} label={x.name} title="Edit payout" action={updateReferralPayout}>
      <Field label="Name" className="col-span-2"><Input name="name" defaultValue={x.name} required /></Field>
      <Field label="Company" className="col-span-2"><ProgramSelect programs={programs} defaultValue={current} /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" defaultValue={String(x.amount)} required /></Field>
      <Field label="Original amount"><Input name="originalAmount" defaultValue={x.originalAmount} /></Field>
      <Field label="Status"><Select name="status" options={["Pending", "Approved", "Paid"]} defaultValue={x.status} /></Field>
      <Field label="Earned on"><Input type="date" name="earnedDate" defaultValue={x.earnedDate ?? ""} /></Field>
      <Field label="Expected payout"><Input type="date" name="expectedPayout" defaultValue={x.expectedPayout ?? ""} /></Field>
      <Field label="Note"><Input name="notes" defaultValue={x.notes} /></Field>
    </EditDialog>
  );
}
