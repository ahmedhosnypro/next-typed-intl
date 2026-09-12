# Static rendering & request locale on the server

On the server, the locale comes from the request: a `setRequestLocale` override, a header stamped by the locale proxy, the locale cookie, or Accept-Language negotiation. Reading those request signals opts a route into dynamic rendering, so this page also covers the `setRequestLocale` recipe that keeps `[locale]` routes statically prerenderable, and Next 16's `next/root-params` convention for reading a root locale segment.

## How the server resolves the locale

The server entry (`next-typed-intl/server`) exposes three async helpers:

- `getMessages(i18n, locale?)` — eager access to the full messages tree, for Server Components, route handlers, and anywhere per-call dynamic imports would be wasteful.
- `getNamespace(i18n, handle, locale?)` — resolves one lazy namespace (labels contain functions, so they cannot be passed to Client Components as props; client rendering resolves namespaces through `useTranslation` + suspense instead).
- `getRequestLocale(i18n, options?)` — the request-scoped locale.

All three are request-scoped: pass `locale` explicitly, or omit it to fall back to `getRequestLocale`.

```tsx
import { getMessages, getRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getRequestLocale(i18n);
  const t = await getMessages(i18n, locale);
  return <h1>{t.home.title}</h1>;
}
```

`getRequestLocale` resolves the locale with this precedence:

1. The `setRequestLocale` override, when set — returned without touching `headers()`/`cookies()`, so statically prerendered routes keep working.
2. The `LOCALE_HEADER` request header stamped by `createLocaleProxy` (`next-typed-intl/next`) — the URL-true locale in prefix mode, correct even on prefix redirects.
3. The locale cookie (`DEFAULT_LOCALE_COOKIE`, `"NEXT_LOCALE"` by default), resolved leniently (`AR` → `ar`).
4. Accept-Language negotiation, unless `detectAcceptLanguage: false` is passed.
5. The instance `defaultLocale`.

The optional second argument of `getRequestLocale` accepts `RequestLocaleOptions`: `cookieName` (cookie consulted before Accept-Language) and `detectAcceptLanguage` (fall back to the header when no stamped header or cookie matches; `true` by default).

Repeated calls with identical signals within a request reuse the memoized result (React `cache`); the `headers()`/`cookies()` reads themselves re-run per call.

## Keeping `[locale]` routes statically prerenderable

`headers()` and `cookies()` are Next's dynamic APIs, so any component that reaches `getRequestLocale` on the signal path opts the whole route into dynamic rendering. Prefix-mode routes can stay statically prerenderable instead: enumerate the locales with `generateStaticParams` and pin the request locale at the top of the `[locale]` layout (and in any standalone page):

```tsx
// app/[locale]/layout.tsx
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params; // string — narrow it before use
  if (!i18n.isLocale(locale)) notFound();
  setRequestLocale(i18n, locale);
  const t = await getMessages(i18n, locale);
  // ...
}
```

With the override set, `getRequestLocale(i18n)` — and the locale-omitted forms of `getMessages`/`getNamespace` — anywhere below the layout return the pinned locale **without** calling `headers()`/`cookies()`, so the whole route prerenders statically. Each request render gets a fresh override slot, so locales never leak across requests.

Passing an invalid locale throws `I18nError` with code `INVALID_LOCALE` (guards untyped call sites; typed callers already get a compile error). That is why the `i18n.isLocale(locale)` guard + `notFound()` above is the right way to narrow the untyped `params` segment: an unknown segment renders 404 instead of throwing at prerender time.

## Reading the segment with `next/root-params` (Next.js 16)

Next 16's documented convention for a locale segment at the root of the route tree is to read it with the `next/root-params` module instead of prop-drilling `params`. If your route tree is `app/[locale]/…`, import `locale` (the export name mirrors your segment folder name) in any **Server Component**:

```tsx
// app/[locale]/layout.tsx
import { locale } from "next/root-params";
import { getMessages, setRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children }) {
  const tag = await locale(); // canonical, already validated by the routes
  setRequestLocale(i18n, tag);
  const t = await getMessages(i18n, tag);
  return (
    <html lang={tag}>
      <body>{children}</body>
    </html>
  );
}
```

The getter is callable from any Server Component below the root layout — no prop drilling — and composes with `setRequestLocale` + `generateStaticParams` exactly like the `params`-based recipe above. It is **Server Components only**: it cannot be imported in Client Components, Server Actions, or Route Handlers (route handlers keep taking `params`).

## Related

- [Routing](./routing.md) — prefix strategy, the locale proxy, and localized pathnames (`createLocaleProxy`, `LOCALE_HEADER`).
- [Server API reference](../reference/server.md) — full signatures for `getMessages`, `getNamespace`, `getRequestLocale`, `setRequestLocale`, and `RequestLocaleOptions`.
- [Errors reference](../reference/errors.md) — `I18nError` and the `INVALID_LOCALE` code.
