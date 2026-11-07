"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Button, Input } from "../ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <Input type="password" name="password" placeholder="Password" autoFocus required autoComplete="current-password" />
      {state && !state.ok && <p className="text-sm text-critical-text" role="alert">{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Sign in"}</Button>
    </form>
  );
}
