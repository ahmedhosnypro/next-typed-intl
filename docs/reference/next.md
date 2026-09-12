# `next-typed-intl/next` API reference

The `next-typed-intl/next` entry point provides the locale proxy and the request-free pathname/locale helpers it is built from. It never imports `next/headers` (and carries no `server-only` guard), so it runs in a Next.js 16 `proxy.ts`, a Next.js 15 `middleware.ts`, or any plain server module alike. For reading the locale back inside Server Components, see [`./server.md`](./server.md); for the client-side `Link`/`usePathname` navigation API, see [`./react.md`](./react.md). A walkthrough of both routing strategies lives in [`../guides/routing.md`](../guides/routing.md).

```ts
import {
  createLocaleProxy,
  resolveRequestLocale,
  detectAcceptLanguage,
  getLocaleFromPathname,
  stripLocalePrefix,
  toLocalizedPathname,
  DEFAULT_LOCALE_COOKIE,
  LOCALE_HEADER,
} from "next-typed-intl/next";
```

## Constants

### `DEFAULT_LOCALE_COOKIE`

```ts
const DEFAULT_LOCALE_COOKIE = "NEXT_LOCALE";
```

Default cookie name for locale persistence. Consulted first by `resolveRequestLocale`, written by `createLocaleProxy`. Override per call with `cookieName`.

### `LOCALE_HEADER`

```ts
const LOCALE_HEADER = "x-next-typed-intl-locale";
```

Request header the locale proxy stamps with the resolved locale on every pass-through (`NextResponse.next`) and on default-locale rewrites. Server Components read it back via `getRequestLocale` from `next-typed-intl/server`, which is the top precedence level after a `setRequestLocale` override — this is how the first render's locale stays in sync with the URL in prefix mode, where the cookie may still hold a stale value.

## `createLocaleProxy`

Builds the locale handler for `proxy.ts` (Next.js 16) or `middleware.ts` (Next.js 15).

```ts
function createLocaleProxy<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  options?: LocaleProxyOptions
): (request: NextRequest) => NextResponse;
```

Usage:

```ts
// proxy.ts (Next 16) or middleware.ts (Next 15)
import { i18n } from "@/lib/i18n";
import { createLocaleProxy } from "next-typed-intl/next";
export default createLocaleProxy(i18n, { mode: "prefix" });
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

Excluding `api` (and `_vercel`) in the matcher matters especially in prefix mode: otherwise API requests to unprefixed `/api/...` paths would be answered with a locale redirect instead of being served.

### `LocaleProxyOptions`

`LocaleProxyOptions` extends `LocaleDetectionOptions` with the two routing knobs:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `"cookie" \| "prefix"` | `"cookie"` | `"cookie"`: stateless locale — resolve and persist the cookie, URLs keep no locale segment. `"prefix"`: locale as the first path segment (`/ar/...`); requests lacking a prefix are redirected to the resolved locale. |
| `localePrefix` | `"always" \| "as-needed"` | `"always"` | Prefix strategy for `mode: "prefix"` only (see below). |

Inherited from `LocaleDetectionOptions`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cookieName` | `string` | `"NEXT_LOCALE"` | Cookie name consulted first. |
| `detectAcceptLanguage` | `boolean` | `true` | Fall back to the `Accept-Language` header when the cookie is absent. |
| `cookieMaxAge` | `number` | `31536000` (one year) | `Max-Age` (seconds) for the persisted locale cookie. Pass `0` for a session cookie. |
| `cookieSecure` | `boolean` | `true` on `https:` requests, `false` on plain http | Marks the locale cookie `Secure`. Resolved per request from the request URL's protocol, so localhost development keeps working; override explicitly if needed. |

### Cookie mode

The handler resolves the locale (cookie → `Accept-Language` → instance default, see `resolveRequestLocale`), passes the request through while stamping the resolved locale onto the forwarded request headers as `LOCALE_HEADER`, and persists the cookie as `{ path: "/", sameSite: "lax", maxAge, secure }`. The cookie is only re-set when its value actually changed, which keeps responses cache-friendly.

### Prefix mode

- `localePrefix: "always"` (default): every URL carries the locale segment. A request with a valid prefix is passed through (stamping `LOCALE_HEADER`) and its cookie synced; an unprefixed request is `307`-redirected to `/{locale}{pathname}` with the cookie set on the redirect response so the target doesn't re-negotiate.
- `localePrefix: "as-needed"`: the default locale is served unprefixed. Unprefixed requests resolving to the default locale are **internally rewritten** to `/{defaultLocale}{pathname}` — the browser URL stays unprefixed while the app is served from its `app/[locale]` segment. Requests prefixed with the default locale are redirected to the unprefixed equivalent (cookie set on the redirect). Non-default locales behave exactly like `"always"`.

The rewrite and redirect paths are basePath-aware: the proxy strips `basePath` from `nextUrl.pathname` before matching the locale segment and re-applies Next's own formatting on redirect targets.

### `createLocaleMiddleware` (deprecated)

```ts
/** @deprecated Use createLocaleProxy instead. */
export const createLocaleMiddleware: typeof createLocaleProxy;
/** @deprecated Use LocaleProxyOptions instead. */
export type LocaleMiddlewareOptions = LocaleProxyOptions;
```

Next 15-style aliases for `createLocaleProxy` / `LocaleProxyOptions`, kept for backward compatibility with codebases on the `middleware` file convention (Next 16 renamed that file to `proxy` and deprecated-but-kept `middleware` the same way). There is no behavioral difference between the two names.

## `resolveRequestLocale`

Synchronous locale resolution for the locale proxy.

```ts
function resolveRequestLocale<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  request: NextRequest,
  options?: LocaleDetectionOptions
): TLocale;
```

Fallback chain: the cookie named `cookieName` (default `DEFAULT_LOCALE_COOKIE`) → the `Accept-Language` header (unless `detectAcceptLanguage: false`) → `i18n.defaultLocale`.

The cookie is user-agent state, so it is resolved leniently through the instance's `resolveLocale` (`"AR"`, `"en_US"`, or a child tag like `"de-CH"` still map onto a configured locale via the case-insensitive → parent-tag fallback chain) and a cookie matching nothing bails to the instance default.

## `detectAcceptLanguage`

Pure `Accept-Language` header negotiation, no request object needed.

```ts
function detectAcceptLanguage<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  acceptLanguageHeader: string | null | undefined
): TLocale;
```

Parses the header with `negotiator` and matches with `@formatjs/intl-localematcher` (the pair recommended by the Next.js internationalization guide), returning the best-supported configured locale. Returns `i18n.defaultLocale` when the header is missing, when nothing matches, or when parsing throws.

## `getLocaleFromPathname`

```ts
function getLocaleFromPathname<TLocale extends string>(
  i18n: LocaleResolverShape<TLocale>,
  pathname: string
): TLocale | undefined;
```

Extracts a valid locale prefix from a pathname: `"/ar/dashboard"` → `"ar"`. The first segment must pass `i18n.isLocale` (a strict, exact match against the configured locales — `"/EN/..."` returns `undefined`); anything else returns `undefined`. Only the first segment is ever considered.

The pathname must be basePath-free: callers serving under a `basePath` must strip it first (the proxy does this internally).

## `stripLocalePrefix`

```ts
function stripLocalePrefix(pathname: string, locales: readonly string[]): string;
```

Removes a locale prefix from `pathname` when the first segment matches one of `locales`:

- `"/ar/shop"` with `ar` configured → `"/shop"`
- `"/ar"` → `"/"`
- `"/shop"`, or a first segment not in `locales` → returned unchanged

Only the first segment is ever considered: `"/shop/ar"` is untouched. Pathnames are assumed basePath-free and to start with `/`.

## `toLocalizedPathname`

Request-free counterpart for building locale-aware URLs (e.g. in `redirect()` calls from Server Components, where `getPathname` from the client-guarded `next-typed-intl/react` entry is unavailable).

```ts
function toLocalizedPathname<TLocale extends string>(
  pathname: string,
  locale: TLocale,
  options: {
    defaultLocale: TLocale;
    localePrefix?: "always" | "as-needed";
    locales?: readonly string[];
  }
): string;
```

- An existing locale segment is replaced: `"/ar/shop"` with `"en"` → `"/en/shop"`. Recognition uses `options.locales` when provided; otherwise only `[defaultLocale, locale]` are considered prefix candidates (the only locales knowable from the options alone — pass the full list whenever it is available).
- With `localePrefix: "as-needed"` and `locale === defaultLocale`, the pathname is returned **unprefixed** (the default locale lives at the root), matching `createLocaleProxy`'s rewrite behavior. `localePrefix` defaults to `"always"`.
- Otherwise `/{locale}` is inserted at the front; the root `"/"` becomes `"/{locale}"` with no trailing slash.

```tsx
import { redirect } from "next/navigation";
import { toLocalizedPathname } from "next-typed-intl/next";
import { i18n } from "@/lib/i18n";

redirect(
  toLocalizedPathname(`/orders/${id}`, locale, {
    defaultLocale: i18n.defaultLocale,
    localePrefix: "as-needed",
  }),
); // prefix applied, no headers read
```
