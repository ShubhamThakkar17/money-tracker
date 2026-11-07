// Shared by proxy.ts and server code. Uses Web Crypto so it runs in any runtime.
export const SESSION_COOKIE = "ft_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * The session token is an HMAC of a fixed label keyed with APP_PASSWORD (+ optional
 * AUTH_SECRET). Changing the password invalidates every existing session.
 */
export async function expectedToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password + (process.env.AUTH_SECRET ?? "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("finance-tracker:v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const expected = await expectedToken();
  if (!expected) return true; // No APP_PASSWORD set → auth disabled (local dev).
  return !!token && safeEqual(token, expected);
}
