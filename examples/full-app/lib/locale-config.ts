/**
 * The locale catalog as a string enum: one source of truth for the instance
 * configs, the locale proxy, static params and client components.
 */
export enum Locale {
  En = "en",
  Ar = "ar",
}

export const appLocales = [Locale.En, Locale.Ar] as const;

export type AppLocale = Locale;
