"use client";

import { I18nProvider } from "next-typed-intl/react";
import type { ReactNode } from "react";

import { i18nClient } from "@/lib/i18n.client";
import type { AppLocale } from "@/lib/locale-config";

export function AppI18nProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  return (
    <I18nProvider i18n={i18nClient} locale={locale}>
      {children}
    </I18nProvider>
  );
}
