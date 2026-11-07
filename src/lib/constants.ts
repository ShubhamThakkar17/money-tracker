export const TIME_ZONE = "Asia/Kolkata";

/** Every entry is Personal or Work. Work entries can name the business they belong to. */
export const SCOPES = ["Personal", "Work"] as const;
export const BUSINESSES = ["Silver Touch", "Keshav Consultancy", "GrowwwPro", "Infinity Linkage", "Alendei", "Other"] as const;

/** Older rows used the business name as the scope; read those as Work. */
export function normScope(v: string | null | undefined): "Personal" | "Work" | "Both" | null {
  if (!v) return null;
  if (v === "Personal" || v === "Both") return v;
  return "Work";
}

export const THEME_COOKIE = "ft_theme";
export type Theme = "system" | "light" | "dark";

export function parseTheme(v: string | undefined): Theme {
  return v === "light" || v === "dark" ? v : "system";
}
