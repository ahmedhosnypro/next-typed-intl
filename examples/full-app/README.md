# examples/full-app

The full-pattern `next-typed-intl` showcase on Next.js 16.

## What it demonstrates

- **`[locale]` prefix routing** via `createLocaleProxy(i18n, { mode: "prefix" })` —
  every URL carries its locale (`/en/shop`, `/ar/shop`); un-prefixed URLs redirect,
  and the resolved locale persists in a cookie (`cookieMaxAge`, 1 year by default).
  The matcher excludes `api`/`_vercel` so API requests aren't locale-redirected.
- **Statically prerendered locale routes** — `generateStaticParams` enumerates
  the locales, and the `[locale]` layout validates the segment with
  `i18n.isLocale` (+ `notFound()`), then pins it with
  `setRequestLocale(i18n, locale)`. From then on, `getMessages(i18n, locale)` and
  any `getRequestLocale(i18n)` calls below the layout resolve **without
  reading `headers()`/`cookies()`**, so the `[locale]` routes prerender
  statically (○) instead of rendering on demand.
- **`next/root-params` for the root segment** — the `[locale]` layout and pages
  read the root dynamic segment with `await locale()` from
  `next/root-params` (Server Components only) instead of awaiting the
  `params` prop, then narrow it with `i18n.isLocale`.
- **Zero-eager client bundle** — the split:
  - `lib/i18n.server.ts` → `createI18n({ messages: { en, ar } })` (eager, server-only)
  - `lib/i18n.client.ts` → `createClientI18n(...)` (registry + lazy loaders only)
  - `lib/namespaces.ts` → the shared registrar both instances run, so namespace
    ids and loaders stay in sync across bundles.
- **Lazy namespaces with suspense** — `useTranslation(nsClient.shop)` under a
  `TranslationBoundary`; the same namespaces can be awaited server-side with
  `getNamespace` for the SSR shell.
- **CLDR pluralization typed as forms** — `stockNote(count)` and
  `cart.itemCount(count)` call `createPlural("ar")` / `createPlural("en")`,
  passing a `PluralForms` object checked against the six Arabic categories.
  `itemCount` also demos an ICU-style **explicit-count form** (`=0`), which
  wins over the category match. No ICU syntax, no message compiler.
- **Ordinal plurals** — `shop.popularityRank(rank)` uses
  `createPlural(locale, { type: "ordinal" })` for "1st / 2nd / 3rd most
  popular" (English `one/two/few` categories; Arabic maps everything to `other`).
- **Interpolation as typed functions** — `price(amount)`, `total(amount)`.
- **RTL** — the layout flips `<html dir>` for `ar`.

## Run it

```bash
cd ../.. && bun install && bun run build && bun link    # build the library and register it for linking
cd examples/full-app && bun install                     # consumes it via link:next-typed-intl
bun run dev                                             # http://localhost:3102/  (redirects to /en or /ar)
```

`link:next-typed-intl` symlinks to the repo root, so a rebuilt `dist/` is
picked up automatically — no reinstall needed.

### Using npm instead of bun

Once the package is published to the registry, plain npm works:
`npm install && npm run dev` (the dependency becomes a registry
`next-typed-intl`). Running the example against the local repo checkout with
npm needs a link instead of `link:` — from the repo root run
`npm link` after `bun run build`, then inside this example
`npm link next-typed-intl` and `npm install` for the rest.

## Structural note

The locale proxy, server, and client each create **their own instance** — the
library keeps instances fully isolated and handles join via namespace ids.
Because `proxy.ts` runs in the Node.js runtime (Next 16 proxies do not use the
edge runtime), it deliberately uses `createClientI18n` (no messages map) so
the eager graph never enters the proxy bundle.
