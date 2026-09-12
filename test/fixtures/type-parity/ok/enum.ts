import { createClientI18n, createI18n, type NamespaceHandle } from "../../../../src/index";

import { ar, en } from "./shared";

enum Locale {
  En = "en",
  Ar = "ar",
}

// String-enum members carry their literal types through the `const TLocales`
// generic, so an enum-configured instance is typed exactly like its
// string-literal counterpart — no `as const` needed on the locales array.
export const i18n = createI18n({
  locales: [Locale.En, Locale.Ar],
  defaultLocale: Locale.En,
  messages: { [Locale.En]: en, [Locale.Ar]: ar },
});

const locales: readonly Locale[] = i18n.locales;
const defaultLocale: Locale = i18n.defaultLocale;

const resolved: Locale = i18n.resolveLocale("en-US");

const arMessages: typeof en = i18n.getMessages(Locale.Ar);
const homeFromAr: string = arMessages.nav.home;

declare const candidate: string;
if (i18n.isLocale(candidate)) {
  const narrowed: Locale = candidate;
  const navHome: string = i18n.getMessages(narrowed).nav.home;
  void navHome;
}

// createClientI18n accepts the same enum config; the default locale is free
// to be any listed member.
export const client = createClientI18n({
  locales: [Locale.En, Locale.Ar],
  defaultLocale: Locale.Ar,
});
const clientLocales: readonly Locale[] = client.locales;
const clientResolved: Locale = client.resolveLocale(candidate);

// Namespace loaders are keyed by enum member; a missing member is a compile
// error, so listing both here proves the key inference.
interface AuthLabels {
  login: string;
}
const authHandle: NamespaceHandle<AuthLabels> = i18n.defineNamespace<AuthLabels>("auth", {
  [Locale.En]: () => Promise.resolve({ login: "Log in" }),
  [Locale.Ar]: () => Promise.resolve({ login: "تسجيل الدخول" }),
});
const authId: string = authHandle.id;

void locales;
void defaultLocale;
void resolved;
void homeFromAr;
void clientLocales;
void clientResolved;
void authId;
