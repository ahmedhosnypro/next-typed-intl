import type { Metadata } from "next";
import { Geist, IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { locale } from "next/root-params";
import { getMessages, setRequestLocale } from "next-typed-intl/server";

import { AppI18nProvider } from "@/components/app-i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NavLinks } from "@/components/nav-links";
import { i18n } from "@/lib/i18n.server";
import { appLocales, Locale } from "@/lib/locale-config";

import "../globals.css";

// Latin sans for English; the Arabic variant of the same family keeps
// RTL rendering on the same design grid. Both are self-hosted by
// next/font — no runtime request to Google Fonts.
const geist = Geist({ subsets: ["latin"], variable: "--font-sans-latin" });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], variable: "--font-sans-arabic", weight: ["400", "500", "600", "700"] });

export function generateStaticParams() {
  return appLocales.map((tag) => ({ locale: tag }));
}

// Only locales from generateStaticParams are routable; anything else 404s
// statically instead of rendering-then-notFound() at request time.
export const dynamicParams = false;

export const metadata: Metadata = {
  title: "next-typed-intl — full example",
  description:
    "The full-pattern next-typed-intl showcase: locale-prefixed routing, lazy namespaces, CLDR plurals and RTL on Next.js 16.",
};

export default async function LocaleLayout(props: LayoutProps<'/[locale]'>) {
  // The root [locale] dynamic segment is read via next/root-params instead of
  // threading the params prop — the getter is available from any Server
  // Component without prop drilling.
  const tag = await locale();
  // The root param is an untyped string — narrow it to the locale union before
  // pinning it as this request's locale (setRequestLocale throws on unknown
  // locales; notFound keeps invalid segments out of the render).
  if (!i18n.isLocale(tag)) notFound();
  // Pin the request locale. getRequestLocale (and the locale-omitted forms of
  // getMessages/getNamespace) now return this WITHOUT touching
  // headers()/cookies(), so the [locale] routes prerender statically together
  // with the generateStaticParams above.
  setRequestLocale(i18n, tag);
  const t = await getMessages(i18n, tag);

  return (
    // dir is set from the locale; every component styles itself with logical
    // properties (inline-start/end), so the layout mirrors without overrides.
    <html lang={tag} dir={tag === Locale.Ar ? "rtl" : "ltr"} className={`${geist.variable} ${plexArabic.variable}`}>
      <body>
        <AppI18nProvider locale={tag}>
          <div className="shell">
            <header className="site-header">
              <div className="content">
                <div className="brand">
                  <span className="brand-mark" aria-hidden="true">
                    TI
                  </span>
                  <span className="brand-text">
                    <span className="brand-name">{t.layout.brand}</span>
                    <span className="brand-tagline">{t.layout.tagline}</span>
                  </span>
                </div>
                <div className="header-actions">
                  <NavLinks
                    links={[
                      { href: "/", label: t.nav.home },
                      { href: "/shop", label: t.nav.shop },
                    ]}
                  />
                  <LocaleSwitcher />
                </div>
              </div>
            </header>
            {props.children}
            <footer className="site-footer">
              <div className="content">
                <span className="footer-brand">
                  <span className="dot" aria-hidden="true" />
                  {t.layout.brand}
                </span>
                <span>{t.layout.footerNote}</span>
              </div>
            </footer>
          </div>
        </AppI18nProvider>
      </body>
    </html>
  );
}
