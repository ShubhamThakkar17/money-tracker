"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteEntry, type DeletableKind, type FormState } from "@/app/actions";
import { Button, inputClass } from "../ui";
import { FormStatus } from "./form-status";

/** Trash icon that opens a confirm dialog; a reason is required and saved to the entry's Notes. */
export function DeleteButton({ kind, id, label }: { kind: DeletableKind; id: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(deleteEntry, null as FormState);
  const [opened, setOpened] = useState(false); // mount the form on first open; long lists would ship one per row

  useEffect(() => {
    if (state?.ok) dialog.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpened(true); form.current?.reset(); dialog.current?.showModal(); }}
        className="rounded p-1 text-muted hover:bg-critical/12 hover:text-critical-text"
        aria-label={`Delete ${label}`}
        title="Delete"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
          <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.8 10.6a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10.6M8.5 9v5M11.5 9v5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
      >
        {opened && <form ref={form} action={action} className="flex flex-col gap-3 p-5 text-left">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <h2 className="text-base font-semibold">Delete “{label}”?</h2>
          <p className="text-sm text-ink-2">It’s marked Deleted in the Google Sheet, not erased. Clear its Deleted cell to bring it back. Your reason is saved in its Notes.</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">Reason</span>
            <textarea name="reason" required minLength={3} maxLength={500} rows={3} autoFocus className={inputClass} placeholder="e.g. Duplicate entry, wrong amount" />
          </label>
          <FormStatus state={state?.ok ? null : state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </div>
        </form>}
      </dialog>
    </>
  );
}
