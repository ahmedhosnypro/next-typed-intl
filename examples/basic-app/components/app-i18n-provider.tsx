"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "next-typed-intl/react";

import { i18n, type AppLocale } from "@/lib/i18n";

/**
 * Client-side provider wrapper. The instance lives module-side (it contains
 * functions, so it can never cross the Server→Client boundary as a prop).
 */
export function AppI18nProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  return (
    <I18nProvider i18n={i18n} locale={locale}>
      {children}
    </I18nProvider>
  );
}
