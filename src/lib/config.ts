import "server-only";

export { TIME_ZONE } from "./constants";

export const SCOPES = ["Personal", "Infinity Linkage"] as const;
export const TX_TYPES = ["Expense", "Income"] as const;
export const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer"] as const;
export const SUB_PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Bank Transfer"] as const;
export const DIRECTIONS = ["I owe", "Owes me"] as const;
export const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"] as const;
export const REPEATS = ["One-time", "Monthly", "Quarterly", "Yearly"] as const;
export const UPCOMING_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer", "Auto-debit"] as const;
export const RELATIONSHIPS = ["Friend", "Family", "Client", "Vendor", "Other"] as const;

export type Scope = (typeof SCOPES)[number];
export type ScopeFilter = Scope | "all";

export function parseScope(v: string | string[] | undefined): ScopeFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "Personal" || s === "Infinity Linkage" ? s : "all";
}
