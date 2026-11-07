"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCategory, addSubcategory } from "@/app/actions";
import { Button, Field, Input, Select } from "../ui";
import { FormStatus } from "./form-status";

type Opt = { value: string; label: string };

function useReset(state: { ok: boolean } | null) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state]);
  return ref;
}

export function SubcategoryForm({ categories, defaultCategory }: { categories: Opt[]; defaultCategory?: string }) {
  const [state, action, pending] = useActionState(addSubcategory, null);
  const ref = useReset(state);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <Field label="Name"><Input name="name" required placeholder="e.g. Rapido, Zomato, Blinkit" /></Field>
      <Field label="Belongs to"><Select name="category" options={categories} defaultValue={defaultCategory} placeholder="Pick a category" required /></Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add subcategory"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function CategoryForm() {
  const [state, action, pending] = useActionState(addCategory, null);
  const ref = useReset(state);
  return (
    <form ref={ref} action={action} className="grid grid-cols-[4.5rem_1fr] gap-3">
      <Field label="Emoji"><Input name="icon" placeholder="🍿" maxLength={4} className="text-center" /></Field>
      <Field label="Category name"><Input name="name" required placeholder="e.g. Fitness" /></Field>
      <Field label="Scope" className="col-span-2"><Select name="scope" options={["Both", "Personal", "Infinity Linkage"]} /></Field>
      <div className="col-span-2 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Saving…" : "Add category"}</Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
