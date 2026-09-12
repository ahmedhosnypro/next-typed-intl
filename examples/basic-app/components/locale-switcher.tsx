"use client";

import { useLocale } from "next-typed-intl/react";
import { DEFAULT_LOCALE_COOKIE } from "next-typed-intl/next";
import { useRouter } from "next/navigation";

import { GlobeIcon } from "@/components/icons";
import { i18n } from "@/lib/i18n";

export function LocaleSwitcher({ label, switchTo }: { label: string; switchTo: string }) {
  const locale = useLocale();
  const router = useRouter();
  const other = i18n.locales.find((l) => l !== locale) ?? i18n.defaultLocale;

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        // Mirror the locale proxy's cookie defaults (path=/, max-age=1 year,
        // SameSite=Lax) so a client-side switch sticks exactly like one the
        // locale proxy set itself.
        document.cookie = `${DEFAULT_LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      <GlobeIcon />
      <span>{switchTo}</span>
      <span className="btn-hint">
        {label} · {other.toUpperCase()}
      </span>
    </button>
  );
}
