export const TIME_ZONE = "Asia/Kolkata";

export const THEME_COOKIE = "ft_theme";
export type Theme = "system" | "light" | "dark";

export function parseTheme(v: string | undefined): Theme {
  return v === "light" || v === "dark" ? v : "system";
}
