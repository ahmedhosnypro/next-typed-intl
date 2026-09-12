import { createClientI18n } from "next-typed-intl";

import { appLocales, Locale } from "@/lib/locale-config";
import { registerAppNamespaces } from "@/lib/namespaces";

/**
 * Client instance: registry + lazy loaders only. The eager `messages` map is
 * never imported on this side, so none of it enters the client bundle.
 */
export const i18nClient = createClientI18n({
  locales: appLocales,
  defaultLocale: Locale.En,
});

export const nsClient = registerAppNamespaces(i18nClient);
