import { createClientI18n } from "next-typed-intl";
import { createLocaleProxy } from "next-typed-intl/next";

import { appLocales, Locale } from "@/lib/locale-config";

// The proxy only needs locale resolution, so a registry-only instance keeps
// the eager message graph out of the proxy bundle.
const i18n = createClientI18n({ locales: appLocales, defaultLocale: Locale.En });

// "prefix" mode: /en/... and /ar/... URLs. Requests without a prefix are
// redirected to the resolved locale (cookie → Accept-Language → default),
// and the resolved locale is persisted in a cookie (persistent by default —
// `cookieMaxAge`, 1 year; pass 0 for a session cookie). For prefixed URLs
// the proxy stamps the pathname locale onto the request header
// (LOCALE_HEADER), so getRequestLocale in Server Components reads the
// URL-true locale on the very first render — no params.locale threading.
export default createLocaleProxy(i18n, { mode: "prefix" });

export const config = {
  // Exclude api and _vercel too: in prefix mode an unprefixed /api request
  // would otherwise be answered with a locale redirect instead of being served.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
