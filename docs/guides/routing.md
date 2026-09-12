# Locale routing with the locale proxy

`next-typed-intl` ships a locale proxy — `createLocaleProxy` from `next-typed-intl/next` — that resolves each request's locale and hands it to your app. Drop it in as your Next.js `proxy.ts` (Next 16) or `middleware.ts` (Next 15) and every request either carries a locale cookie or a locale path segment; Server Components then read the resolved locale back via `getRequestLocale` (see [static rendering](./static-rendering.md)). The entry never imports `next/headers`, so the same export runs in both file conventions.

```ts
// proxy.ts (Next 16) or middleware.ts (Next 15)
import { createLocaleProxy } from "next-typed-intl/next";
import { i18n } from "@/lib/i18n";

export default createLocaleProxy(i18n, { mode: "cookie" });
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

## Two modes

`mode` selects the routing strategy:

- **`"cookie"` (default)** — stateless locale: the proxy resolves the locale, persists it in a cookie, and passes the request through unchanged. URLs keep no locale segment; your app lives directly under `app/`.
- **`"prefix"`** — the locale is the first path segment (`/ar/...`). Requests lacking a prefix are redirected to `/{locale}{pathname}`, and your pages live under `app/[locale]/`.

## The matcher

The matcher above excludes `api`, `_next`, `_vercel`, and any path containing a dot (static assets). Excluding `api` and `_vercel` matters especially in prefix mode: otherwise unprefixed API requests would be answered with a locale `307` redirect instead of being served.

## `localePrefix` in prefix mode

`localePrefix` only applies when `mode: "prefix"`:

- **`"always"` (default)** — every URL carries the locale segment. An unprefixed request resolves its locale and is redirected to `/{locale}{pathname}`.
- **`"as-needed"`** — the default locale is served unprefixed. An unprefixed request resolving to the default locale is **internally rewritten** to `/{defaultLocale}{pathname}`: the browser URL stays unprefixed while the app is served from its `app/[locale]` segment, so the rewrite works with a `[locale]` route tree instead of 404ing. Requests already prefixed with the default locale are redirected to the unprefixed equivalent (`/en/about` → `/about`); non-default locales keep their segments and behave like `"always"`.

Both the rewrite and the redirect are basePath-aware: the proxy strips `basePath` from the incoming pathname before inspecting the first segment and re-adds it when building the target URL.

## The locale cookie

The proxy persists the resolved locale in a cookie named by `DEFAULT_LOCALE_COOKIE` (`"NEXT_LOCALE"`), overridable with `cookieName`. Cookie attributes are `{ path: "/", sameSite: "lax", maxAge, secure }`:

- `cookieMaxAge` defaults to one year (`31_536_000` seconds). Pass `0` for a session cookie — `Max-Age` is omitted entirely (a literal `Max-Age=0` would delete the cookie immediately).
- `cookieSecure` defaults to the request's protocol: set on `https`, omitted on plain `http` so localhost development keeps working. It is resolved per request; override it explicitly if you need different behavior.

The cookie is written only when its value actually changed, keeping pass-through responses cache-friendly. Redirect responses in prefix mode always set it, so the redirect target doesn't re-negotiate.

Cookie values resolve leniently through `resolveLocale`, so stale or mis-cased cookies like `"AR"`, `"en_US"`, or a child tag like `"de-CH"` still map onto a configured locale (see the fallback chain below). If the cookie is absent (or matches nothing), the proxy falls back to `Accept-Language` negotiation via `detectAcceptLanguage`, then to `i18n.defaultLocale` — disable the header fallback with `detectAcceptLanguage: false`.

## The `LOCALE_HEADER` request header

Every pass-through response — and every default-locale rewrite in `as-needed` mode — stamps the resolved locale onto the forwarded request headers as `LOCALE_HEADER` (`"x-next-typed-intl-locale"`). Server Components read it back through `getRequestLocale`, which treats this header as its top precedence level after an explicit `setRequestLocale` override. That is how the server sees the URL-true locale instead of re-deriving it — important in prefix mode, where the cookie may still hold a stale value from a previous visit. See [static rendering](./static-rendering.md) for the full precedence chain.

## Locale resolution and strictness

`resolveLocale(value)` — the same function the proxy uses for cookie values — follows this fallback chain:

1. empty/absent input → `defaultLocale`
2. exact match against the configured `locales`
3. case-insensitive match (the configured casing wins)
4. parent-tag walk, most specific first (`de-CH-x` → `de-CH` → `de`)
5. `defaultLocale`

It also tolerates POSIX/LANG-style underscores (`"en_US"` → `"en-US"`).

`isLocale(value)` is strict: only an exact match against the configured `locales` returns `true`. Use it to validate the `[locale]` segment in prefix mode, combined with `notFound()` so unknown segments 404 instead of rendering with a silently substituted locale:

```tsx
// app/[locale]/layout.tsx
import { notFound } from "next/navigation";
import { i18n } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!i18n.isLocale(locale)) notFound();
  return children;
}
```

If your locales are canonicalized by `createI18n` (the default), URL segments must use the canonical form: with `locales: ["en-us", "ar"]` canonicalized to `["en-US", "ar"]`, a request for `/en-us/about` is redirected to `/en-US/about`. `isLocale` matches the canonical tags only, so the layout validation above rejects non-canonical segments too.

## Building locale-aware links

In prefix mode, links must carry the locale segment. `toLocalizedPathname` (also exported from `next-typed-intl/next`) inserts, replaces, or strips the first segment, honoring `localePrefix: "as-needed"` the same way the proxy does:

```ts
import { toLocalizedPathname } from "next-typed-intl/next";

toLocalizedPathname("/shop", "ar", {
  defaultLocale: i18n.defaultLocale,
  locales: i18n.locales,
}); // "/ar/shop"

toLocalizedPathname("/shop", "en-US", {
  defaultLocale: "en-US",
  localePrefix: "as-needed",
  locales: ["en-US", "ar"],
}); // "/shop" — default locale served unprefixed
```

For client-side navigation, `createNavigation` from `next-typed-intl/react` wraps `Link`, `usePathname`, and `useRouter` with the same prefix logic — see [navigation](./navigation.md). The companion helper `stripLocalePrefix` removes a recognized first segment, and `getLocaleFromPathname` extracts and validates one via `isLocale`.

## Full option reference

All options of `createLocaleProxy(i18n, options)`:

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `"cookie"` | `"cookie"` (no URL prefix) or `"prefix"` (locale as first path segment) |
| `localePrefix` | `"always"` | Prefix strategy for `mode: "prefix"`: `"always"` or `"as-needed"` |
| `cookieName` | `"NEXT_LOCALE"` (`DEFAULT_LOCALE_COOKIE`) | Cookie name consulted first and persisted |
| `detectAcceptLanguage` | `true` | Fall back to the `Accept-Language` header when the cookie is absent |
| `cookieMaxAge` | `31_536_000` (one year) | Cookie `Max-Age` in seconds; `0` means session cookie |
| `cookieSecure` | `true` on https, `false` on http | Mark the cookie `Secure`; resolved per request from the protocol |

The same detection options (`cookieName`, `detectAcceptLanguage`, `cookieMaxAge`, `cookieSecure`) are exported as `LocaleDetectionOptions`, and the full set as `LocaleProxyOptions`. The full handler and helper signatures are documented in [the `next` entry reference](../reference/next.md); `createLocaleMiddleware` remains as a deprecated alias for `createLocaleProxy`.

## Setup

If you haven't created the i18n instance yet, start with [getting started](../getting-started.md).
