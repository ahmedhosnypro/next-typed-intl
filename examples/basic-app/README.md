# examples/basic-app

The smallest useful `next-typed-intl` integration: a Next.js 16 app with
cookie-based locale (no URL prefix), an eager server messages tree, and one
lazy client namespace.

## What it demonstrates

- `createI18n` with en/ar and the default locale first — removing a key from
  `locales/ar.ts` fails `tsc` immediately.
- `proxy.ts` running `createLocaleProxy(i18n, { mode: "cookie" })` — it
  persists the resolved locale as a durable cookie (Path=/, SameSite=Lax,
  1-year `max-age` by default; tune via `cookieMaxAge`) and stamps it on the
  request, so `getRequestLocale` stays coherent.
- RSC reading via `getMessages(i18n, locale)` and awaiting a lazy namespace
  server-side via `getNamespace`.
- `<AppI18nProvider>` — the required `"use client"` wrapper (the instance holds
  functions and cannot cross the Server→Client boundary as a prop).
- `useTranslation(counterNamespace)` in a client component with a
  `TranslationBoundary` suspense fallback.
- Pluralization via `createPlural` — `countLabel(count)` picks among the
  typed CLDR forms (all six categories in Arabic), and both locales demo an
  ICU-style explicit-count `=0` form ("No clicks yet" / "لا نقرات بعد") that
  wins over the category match.
- A locale switcher that writes the cookie (`Path=/; Max-Age=31536000;
  SameSite=Lax`, matching the locale proxy's defaults) and calls
  `router.refresh()`.

## Run it

```bash
cd ../.. && bun install && bun run build && bun link   # build the library and register it for linking
cd examples/basic-app && bun install                   # consumes it via link:next-typed-intl
bun run dev                                            # http://localhost:3101
```

### Using npm instead of bun

Once the package is published to the registry, plain npm works:
`npm install && npm run dev` (the dependency becomes a registry
`next-typed-intl`). Running the example against the local repo checkout with
npm needs a link instead of `link:` — from the repo root run
`npm link` after `bun run build`, then inside this example
`npm link next-typed-intl` and `npm install` for the rest.

Note: this example keeps one `lib/i18n.ts` module, so the eager messages map
also lands in the client bundle — perfectly fine at this size. The
`examples/full-app` project shows the zero-eager-client split
(`createClientI18n`) and `[locale]`-prefix URL routing.
