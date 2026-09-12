import "server-only";

import { createI18n } from "next-typed-intl";

import { arMessages } from "@/locales/ar";
import { enMessages } from "@/locales/en";
import { appLocales, Locale } from "@/lib/locale-config";
import { registerAppNamespaces } from "@/lib/namespaces";

/**
 * Server instance: eager messages for RSC/route handlers plus the namespace
 * registry. The eager map never ships to the client (see i18n.client.ts).
 */
export const i18n = createI18n({
  locales: appLocales,
  defaultLocale: Locale.En,
  messages: { [Locale.En]: enMessages, [Locale.Ar]: arMessages },
});

export const ns = registerAppNamespaces(i18n);
