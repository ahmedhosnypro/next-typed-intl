# Getting Started

Install `next-typed-intl`, define a typed messages schema, and render it on the server and the client in a Next.js App Router project.

## Prerequisites

- Node.js (20+) or Bun
- Next.js `^15 || ^16` (App Router)
- React `^18.3 || ^19`

```bash
npm install next-typed-intl
# or
yarn add next-typed-intl
# or
pnpm add next-typed-intl
# or
bun add next-typed-intl
```

## 1. Define the schema

Keys are typed object properties and pluralizers are typed functions — the compiler, not a runtime parser, guarantees every locale implements the whole schema. Per namespace or one tree:

```ts
// locales/types.ts
export interface Messages {
  home: { title: string; items: (count: number) => string };
}
```

## 2. Implement each locale

Bind a `createPlural` once per locale file. It exposes the CLDR plural categories for that locale, all typed — Arabic gets all six, English gets `one` and `other`:

```ts
// locales/en.ts
import { createPlural } from "next-typed-intl";
import type { Messages } from "./types";

const plural = createPlural("en");

export const en: Messages = {
  home: {
    title: "Hello",
    items: (count) => plural(count, { one: "1 item", other: `${count} items` }),
  },
};
```

```ts
// locales/ar.ts
import { createPlural } from "next-typed-intl";
import type { Messages } from "./types";

const plural = createPlural("ar");

export const ar: Messages = {
  home: {
    title: "مرحباً",
    items: (count) =>
      plural(count, {
        zero: "لا عناصر",
        one: "عنصر واحد",
        two: "عنصران",
        few: `${count} عناصر`,
        many: `${count} عنصراً`,
        other: `${count} عنصراً`,
      }),
  },
};
```

## 3. Create the instance

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

Locale tags must be valid BCP-47 tags (hyphens: `"en-US"`, not `"en_US"`); invalid tags throw `INVALID_CONFIG` at setup. At setup, every declared tag and the `defaultLocale` are canonicalized via `Intl.getCanonicalLocales` — `"en-us"` becomes `"en-US"` — so `i18n.locales`, cookie values, URL segments, and message-map keys all use canonical form. Canonicalization is on by default; pass `canonicalizeLocales: false` to keep your declared strings verbatim. See [Messages](./guides/messages.md) for resolution, fallback, and canonicalization details.

## 4. Wire up routing

In cookie mode (the default), a single proxy in `proxy.ts` (Next 16) or `middleware.ts` (Next 15) resolves the locale per request, stamps it onto request headers, and persists the cookie — URLs keep no locale segment. Prefix mode (`/ar/...`) and its redirect/rewrite strategies are covered in [Routing](./guides/routing.md):

```ts
// proxy.ts (Next 16) or middleware.ts (Next 15)
import { i18n } from "@/lib/i18n";
import { createLocaleProxy } from "next-typed-intl/next";

export default createLocaleProxy(i18n, { mode: "cookie" });

export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
```

## 5a. Server Components

Server-side access is eager and synchronous: the whole messages tree is bundled into the server build, so `getMessages` performs no dynamic imports. It reads `headers()`/`cookies()`, so it must be imported in Server Components only — not in Client Components, Server Actions, or Route Handlers (route handlers keep taking `params`).

```tsx
import { getMessages, getRequestLocale } from "next-typed-intl/server";
import { i18n } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getRequestLocale(i18n); // setRequestLocale override → proxy-stamped header → cookie → Accept-Language → default
  const t = await getMessages(i18n, locale);
  return <h1>{t.home.title}</h1>;
}
```

Both `getMessages(i18n, locale?)` and `getNamespace(i18n, handle, locale?)` take a locale typed to your union; omitted, they fall back to `getRequestLocale`. Reading `headers()`/`cookies()` opts routes into dynamic rendering — to keep prefix-mode routes statically prerenderable, pin the locale with `setRequestLocale` as described in [Static Rendering](./guides/static-rendering.md).

## 5b. Client Components

Client-side access is lazy per namespace: each namespace declares a dynamic import per locale, and `useTranslation` suspends until the chunk loads.

Define the namespace from the same instance:

```ts
// lib/i18n.ts (continued)
import type { CartLabels } from "@/locales/types";

export const cart = i18n.defineNamespace<CartLabels>("cart", {
  en: () => import("@/locales/en/cart").then((m) => m.cart),
  ar: () => import("@/locales/ar/cart").then((m) => m.cart),
});
```

Read it in a Client Component:

```tsx
"use client";
import { useTranslation } from "next-typed-intl/react";
import { cart } from "@/lib/i18n";

export function CartSummary() {
  const t = useTranslation(cart); // suspends until the locale chunk loads
  return <p>{t.itemCount(3)}</p>;
}
```

Wrap lazily-loaded UI once with `TranslationBoundary` (Client Components only — the `next-typed-intl/react` entry is marked `"use client"`; in a Server Component use a plain `<Suspense>` instead):

```tsx
import { TranslationBoundary } from "next-typed-intl/react";

<TranslationBoundary fallback={<Spinner />}>
  <CartSummary />
</TranslationBoundary>
```

Provide the instance through a tiny `"use client"` wrapper in your app:

```tsx
"use client";
import { I18nProvider } from "next-typed-intl/react";
import { i18n } from "@/lib/i18n";

export function AppI18nProvider({ locale, children }) {
  return <I18nProvider i18n={i18n} locale={locale}>{children}</I18nProvider>;
}
```

The provider lives in your code because the instance holds functions — and functions cannot cross the Server→Client Component boundary as props.

To avoid the suspense flash for content you already loaded on the server, pass labels to `I18nProvider` via `initialNamespaces`, keyed by namespace id. The provider seeds them before any child renders, so `useTranslation` for those namespaces resolves synchronously. Labels handed across the boundary must be serializable — data only, no function-valued messages. Seeding is first-wins per namespace: an existing cache entry is not overwritten.

## Next steps

- [Routing](./guides/routing.md) — cookie vs prefix mode, redirects, rewrites, and matchers
- [Messages](./guides/messages.md) — locale resolution, fallback chains, and canonicalization
- [Plurals](./guides/plurals.md) — CLDR categories and `createPlural` in depth
- [Core API reference](./reference/core.md) — `createI18n`, `createClientI18n`, instance methods, and error codes
