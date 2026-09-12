import { createLocaleProxy } from "next-typed-intl/next";

import { i18n } from "@/lib/i18n";

// "cookie" mode: resolve cookie → Accept-Language → default (fallback chain:
// exact, then case-insensitive, then parent tag). The result is persisted as
// a durable cookie (Path=/, SameSite=Lax, max-age=1 year by default —
// tune via `cookieMaxAge`) and stamped on the request as
// `x-next-typed-intl-locale`, so `getRequestLocale` in Server Components sees
// the same locale the locale proxy just resolved. URLs stay locale-free.
export default createLocaleProxy(i18n, { mode: "cookie" });

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
