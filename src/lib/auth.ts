import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession } from "./session";

/** Re-check the session inside server actions (defence in depth beyond proxy.ts). */
export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) throw new Error("Not signed in");
}
