"use client";

import { useLocale } from "next-typed-intl/react";

import { appLocales, Locale, type AppLocale } from "@/lib/locale-config";
import { usePathname, useRouter } from "@/lib/navigation";

/** Swaps the leading locale segment of the current URL. */
export function LocaleSwitcher() {
  const locale = useLocale<AppLocale>();
  const pathname = usePathname();
  const router = useRouter();

  const other: AppLocale = appLocales.find((l) => l !== locale) ?? Locale.En;

  return (
    <button type="button" className="locale-switch" onClick={() => router.replace(pathname, { locale: other })}>
      <span className="globe" aria-hidden="true">
        🌐
      </span>
      {locale === Locale.En ? "العربية" : "English"}
    </button>
  );
}
