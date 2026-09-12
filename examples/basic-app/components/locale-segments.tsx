"use client";

import { DEFAULT_LOCALE_COOKIE } from "next-typed-intl/next";
import { useRouter } from "next/navigation";
import { useLocale } from "next-typed-intl/react";

import { i18n } from "@/lib/i18n";

export function LocaleSegments({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="seg seg-lang" role="group" aria-label={label}>
      {i18n.locales.map((l) => (
        <button
          key={l}
          type="button"
          className={`seg-btn${l === locale ? " active" : ""}`}
          aria-pressed={l === locale}
          onClick={() => {
            // Mirror the locale proxy's cookie defaults (path=/, max-age=1 year,
            // SameSite=Lax) so a client-side switch sticks exactly like one the
            // locale proxy set itself.
            document.cookie = `${DEFAULT_LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
