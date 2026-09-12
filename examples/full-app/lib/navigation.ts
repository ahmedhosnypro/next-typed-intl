"use client";

import { createNavigation } from "next-typed-intl/react";

import { i18nClient } from "@/lib/i18n.client";
import type { Locale } from "@/lib/locale-config";

/**
 * Locale-aware navigation for prefix mode: `Link` prefixes hrefs with the
 * current locale, `usePathname` returns the pathname with the leading locale
 * segment stripped, and the router's push/replace/prefetch accept an explicit
 * `locale` option. The client instance is used — this module only ships to
 * the browser (switcher + client-rendered links).
 */
export const { Link, usePathname, useRouter, getPathname } = createNavigation<Locale>(i18nClient, {
  localePrefix: "always",
});
