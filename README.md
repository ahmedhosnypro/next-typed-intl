<div align="center">
  <img width="96" src="./assets/icon-256.png" alt="next-typed-intl logo">

  <h1>next-typed-intl</h1>

  <p>
    <a href="https://www.npmjs.com/package/next-typed-intl"><img alt="npm version" src="https://img.shields.io/npm/v/next-typed-intl"></a>
    <a href="./LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  </p>

  <p>
    <strong>Compile-time type-safe internationalization for Next.js.</strong><br>
    Autocompleted keys · typed plural functions · zero codegen · zero ICU parser<br>
    <sub>Eager server messages, lazy client namespaces — built for the App Router era.</sub>
  </p>
</div>

---

## Highlights

- 🔒 **Locale parity at compile time** — delete a key from one locale and you
  get a red squiggle, not a runtime `undefined` in production.
- ⌨️ **Keys as typed properties** — `t.nav.home` autocompletes, and renaming a
  key errors at every usage site.
- 🔢 **Plurals as plain functions** — `(count: number) => string`, backed by
  CLDR plural rules. No ICU parser, no message-format DSL.
- ⚡ **Eager server, lazy client** — a synchronous messages tree for Server
  Components; per-namespace dynamic imports with suspense for Client Components.
- 🧭 **App Router native** — cookie or `[locale]`-prefix routing, proxy
  (Next 16) / middleware (Next 15), statically prerenderable localized pages,
  RTL-ready.

```ts
const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en",
  messages: { en: enMessages, ar: arMessages },
});
// Delete a key from `ar` → red squiggle. Rename a key → every usage errors.
```

## Why not next-intl / Lingui / typesafe-i18n?

|                                       | next-typed-intl                        | next-intl              | Lingui                 | typesafe-i18n  |
| ------------------------------------- | -------------------------------------- | ---------------------- | ---------------------- | -------------- |
| Typed keys / autocomplete             | ✅ via interfaces                      | ⚠️ opt-in augmentation | ⚠️ codegen             | ✅ codegen     |
| Pluralization                         | CLDR `createPlural` + typed forms      | ICU messages           | ICU messages           | TS functions   |
| Compile step                          | none                                   | none                   | CLI extractor/compiler | loader + codegen |
| Eager server + lazy client namespaces | ✅ both in one API                     | string config          | partial                | partial        |
| Maintenance                           | —                                      | active                 | active                 | dormant        |

If you're fine with ICU strings and JSON catalogs, next-intl is great. This
library is for teams that want the **compiler** — not a runtime parser — to
guarantee every locale implements the whole schema, pluralizers included.
Coming from next-intl or react-i18next? See the
[vocabulary map](./docs/migration.md).

## Install

```bash
npm install next-typed-intl
# or
yarn add next-typed-intl
# or
pnpm add next-typed-intl
# or
bun add next-typed-intl
```

> **Peer dependencies:** `react ^18.3 || ^19` and `next ^15 || ^16` (both required).

## Quickstart (App Router)

**1. Define your schema — keys and functions, per namespace or one tree:**

```ts
// locales/types.ts
export interface Messages {
  home: { title: string; items: (count: number) => string };
}
```

**2. Implement every locale against it** — values are strings or typed
functions; pluralization is a typed call on a per-locale `plural` bound with
`createPlural("en")`, e.g.
``items: (count) => plural(count, { one: "1 item", other: `${count} items` })``.
Full en/ar walkthrough: [docs/getting-started.md](./docs/getting-started.md).

**3. Create the instance:**

```ts
// lib/i18n.ts
import { createI18n } from "next-typed-intl";
import { en } from "@/locales/en";
import { ar } from "@/locales/ar";

export const i18n = createI18n({
  locales: ["en", "ar"] as const,
  defaultLocale: "en", // any listed locale may be default; its entry is the parity schema
  messages: { en, ar },
});
```

**4. Resolve the locale:**

```ts
// proxy.ts (Next.js 16) — cookie mode: no URL prefix
// (on Next.js 15 the same export lives in middleware.ts)
import { createLocaleProxy } from "next-typed-intl/next";
import { i18n } from "@/lib/i18n";

export default createLocaleProxy(i18n, { mode: "cookie" });
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

**5a. Server Components — eager, synchronous:**

```tsx
import { getMessages, getRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getRequestLocale(i18n);
  const t = await getMessages(i18n, locale);
  return <h1>{t.home.title}</h1>;
}
```

**5b. Client Components — lazy namespaces with suspense:**

```tsx
"use client";
const t = useTranslation(cart); // suspends until the locale chunk loads
return <p>{t.itemCount(3)}</p>;
```

That's the shape. Everything else — canonicalized locale tags, enum-driven
configs, prefix routing, static prerendering, SSR namespace handoff — builds
on these five steps. Continue in
**[docs/getting-started.md](./docs/getting-started.md)** →

## Documentation

Full documentation lives in **[docs/](./docs/README.md)** — the same tree ships
inside the npm package, so after installing you can read it offline at
`node_modules/next-typed-intl/docs/README.md`.

**Guides**

- [Messages & namespaces](./docs/guides/messages.md) — eager server trees, lazy client namespaces, suspense reads
- [Locale routing](./docs/guides/routing.md) — cookie mode vs `[locale]` prefix mode
- [Static rendering](./docs/guides/static-rendering.md) — keeping localized pages prerenderable
- [Pluralization](./docs/guides/plurals.md) — typed plural forms backed by CLDR
- [Formatting](./docs/guides/formatting.md) — numbers, currency, dates, ranges, relative time, lists
- [Interpolation](./docs/guides/interpolation.md) — typed placeholders
- [Rich text](./docs/guides/rich-text.md) — JSX inside translations, RSC-safe
- [Localized navigation & SEO](./docs/guides/navigation.md) — locale-aware `Link` and pathnames
- [Locale parity testing](./docs/guides/testing.md) — assert every locale implements the schema

**API reference**

- [`next-typed-intl`](./docs/reference/core.md) — `createI18n`, `plural`, formatters, `interpolate`
- [`next-typed-intl/react`](./docs/reference/react.md) — `I18nProvider`, `useTranslation`, `createNavigation`
- [`next-typed-intl/server`](./docs/reference/server.md) — `getMessages`, `getRequestLocale`, `setRequestLocale`
- [`next-typed-intl/next`](./docs/reference/next.md) — `createLocaleProxy`, pathname helpers
- [`next-typed-intl/rich`](./docs/reference/rich.md) — `renderRichText`, tag types
- [`next-typed-intl/testing`](./docs/reference/testing.md) — `assertLocaleParity`
- [Error codes](./docs/reference/errors.md) — every `I18nError` variant, documented

**Migrating:** [from next-intl / react-i18next](./docs/migration.md)

## Examples

- [`examples/basic-app`](examples/basic-app) — cookie-locale starter.
- [`examples/full-app`](examples/full-app) — `[locale]` prefix routing with
  `next/root-params`, zero-eager client bundle, suspense namespaces, Arabic
  plurals, RTL.

```bash
bun install && bun run build && bun pm pack   # from the repo root
cd examples/basic-app && bun install && bun run dev
```

## Quality & development

`bun run quality-gate` → tsc (7, native) → oxlint → biome → eslint →
jscpd → knip → tests → build → publint + attw. See `AGENTS.md`.

A git pre-commit hook (`.git-hooks/pre-commit`, installed automatically by
`bun install` via the `prepare` script) runs all of these except the packing
checks — failing on **warnings**, not just errors.

---

## License

[MIT](./LICENSE) — free for any use, including commercial.
