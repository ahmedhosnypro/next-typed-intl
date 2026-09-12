/** Server-safe theme constants — importable from both Server and Client Components. */

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

/** Cookie attributes mirror the locale cookie so both persist for a year. */
export function themeCookieValue(theme: Theme) {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
