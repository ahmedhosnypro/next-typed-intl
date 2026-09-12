import { createI18n } from "next-typed-intl";

import { arMessages } from "@/locales/ar";
import { enMessages } from "@/locales/en";
import type { CounterLabels } from "@/locales/types";

/**
 * The locale catalog as a string enum: one source of truth, keyed into
 * `locales`, `defaultLocale`, messages maps and namespace loaders.
 */
export enum Locale {
  En = "en",
  Ar = "ar",
}

export const appLocales = [Locale.En, Locale.Ar] as const;

export type AppLocale = Locale;

/**
 * The app's single i18n instance. Imported by server code (eager messages),
 * the locale proxy (locale resolution), and the client bundle (namespace registry).
 * Removing a key from `ar` fails `tsc` — that is the library's headline feature.
 */
export const i18n = createI18n({
  locales: appLocales,
  defaultLocale: Locale.En,
  messages: { [Locale.En]: enMessages, [Locale.Ar]: arMessages },
});

/**
 * Lazy namespace: `useTranslation(counterNamespace)` in a client component
 * suspends until the chunk for the current locale arrives.
 */
export const counterNamespace = i18n.defineNamespace<CounterLabels>("counter", {
  [Locale.En]: () => import("@/locales/en/counter").then((m) => m.counter),
  [Locale.Ar]: () => import("@/locales/ar/counter").then((m) => m.counter),
});
