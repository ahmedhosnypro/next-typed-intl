# Localized navigation (prefix mode)

When the locale proxy runs in `mode: "prefix"` — locale as the first path
segment, `/ar/shop` for Arabic and `/shop` for the default locale under
`localePrefix: "as-needed"` — plain `next/link` and `next/navigation` calls
would produce locale-free hrefs and lose the active locale. `createNavigation`
wraps Next's routing primitives with locale awareness so every link and
programmatic navigation is built through the same prefix strategy the proxy
enforces. For how the proxy itself resolves and redirects locale prefixes, see
[Routing](./routing.md).

## Setup

Create the navigation set once, next to your i18n instance:

```ts
// lib/navigation.ts
import { createNavigation } from "next-typed-intl/react";
import { i18n } from "@/lib/i18n";

export const { Link, usePathname, useRouter, getPathname } =
  createNavigation(i18n, { localePrefix: "as-needed" }); // or "always" (the default)
```

`createNavigation` accepts the i18n instance plus an options object:

- `localePrefix` — `"always"` (default) prefixes every internal href with the
  locale segment; `"as-needed"` keeps hrefs to the default locale unprefixed,
  matching the proxy's rewrite behavior. The value must agree with the
  `localePrefix` you passed to `createLocaleProxy`, otherwise links point at
  URLs the proxy redirects away.

## Client navigation

```tsx
"use client";
import { Link, useRouter } from "@/lib/navigation";

<Link href="/shop">…</Link>                    // → /ar/shop under an ar context
<Link href="/shop" locale="en">…</Link>        // force a locale per link
router.push("/checkout");                      // current locale applied
router.replace("/cart", { locale: "en" });     // override per call
router.prefetch("/shop", { locale: "en" });
```

- **`Link`** accepts everything `next/link` accepts, with `href` as a
  locale-free internal pathname such as `"/shop"`. Absolute URLs carrying a
  scheme (`https:`, `mailto:`, `tel:`, …) pass through unlocalized.
- **`useRouter`** returns Next's router with locale-aware `push`/`replace`/
  `prefetch`: each accepts the usual Next options plus a `locale` option, and
  routes the href through the factory's prefixing rules. `back`, `forward`,
  and `refresh` pass through untouched.
- **`usePathname`** returns the pathname **without** the locale segment, so
  active-link matching and highlighting logic stays locale-agnostic.
- **`getPathname`** is a pure `(href, locale) => string` builder — the
  server-safe half of the factory, exported from the client-guarded `/react`
  entry. Prefer `toLocalizedPathname` on the server (below).

### Locale resolution

The locale for each link or navigation resolves in order:

1. the explicit `locale` prop (Link) or `locale` option (push/replace/prefetch),
2. the locale of the nearest `I18nProvider` — read leniently, so rendering
   outside a provider never throws,
3. the instance's `defaultLocale`.

With `localePrefix: "as-needed"`, hrefs to the default locale stay
**unprefixed**, so under an `en` context with `defaultLocale: "en"`,
`<Link href="/shop">` renders `/shop` — the same URL the proxy's internal
rewrite serves.

## Server-side hrefs

`getPathname` lives in the client-guarded `/react` entry, so Server Components
and route handlers should use `toLocalizedPathname` from
`next-typed-intl/next` instead — it builds the identical href without reading
any request state:

```ts
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

The options mirror the proxy's: `defaultLocale` and `localePrefix` control
when the prefix is emitted, and `locales` narrows which prefixes count (all
three are wired to the i18n instance in `getPathname`).

## SEO: hreflang via `alternates.languages`

In prefix mode, point `generateMetadata` at your locales so Next emits
`<link rel="alternate" hreflang>` tags plus the canonical URL:

```tsx
// app/[locale]/layout.tsx
import type { Metadata } from "next";
import { i18n } from "@/lib/i18n";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries([
        ...i18n.locales.map((l) => [l, `/${l}`]),
        ["x-default", "/"], // as-needed: the unprefixed default-locale URL
      ]),
    },
  };
}
```

`x-default` tells search engines which URL to serve when no locale matches;
with `localePrefix: "as-needed"` that is the unprefixed default-locale URL.

## API reference

Full type signatures for `createNavigation`, `Navigation`, `NavigationLinkProps`,
and `NavigationRouter` are in the [React entry reference](../reference/react.md).
